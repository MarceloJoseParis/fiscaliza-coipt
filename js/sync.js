/* Login Google + sincronizacao com o backend (Google Apps Script) */
(function (root) {
  const ENTIDADES = ['pessoas', 'registros', 'visitas', 'notificacoes', 'fotos', 'config'];
  const Sync = { estado: 'offline', usuario: null, erro: null };
  const ouvintes = new Set();
  let gisCarregado = null;
  let emAndamento = null;
  const emVoo = new Set(); // pedidos em andamento (cancelados se a internet cair)

  Sync.on = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };

  /* Registro de diagnóstico (últimos 40 eventos) — Ajustes › Diagnóstico da sincronização */
  Sync.log = function (tipo, msg, extra) {
    try {
      const l = JSON.parse(localStorage.getItem('logSync') || '[]');
      l.push({ em: new Date().toISOString(), tipo, msg: String(msg || '').slice(0, 400), extra: extra ? String(extra).slice(0, 600) : undefined });
      localStorage.setItem('logSync', JSON.stringify(l.slice(-40)));
    } catch (e) { /* */ }
  };
  Sync.lerLog = () => { try { return JSON.parse(localStorage.getItem('logSync') || '[]'); } catch (e) { return []; } };
  Sync.limparLog = () => { try { localStorage.removeItem('logSync'); } catch (e) { /* */ } };
  function emitir(estado, extra) {
    Sync.estado = estado;
    Object.assign(Sync, extra || {});
    ouvintes.forEach((f) => { try { f(Sync); } catch (e) { console.error(e); } });
  }

  Sync.config = function () {
    const c = root.APP_CONFIG || {};
    let local = {};
    try { local = JSON.parse(localStorage.getItem('app_config_local') || '{}'); } catch (e) { /* */ }
    return { apiUrl: Sync.normalizarUrl(local.apiUrl || c.API_URL || ''), clientId: (local.clientId || c.GOOGLE_CLIENT_ID || '').trim() };
  };
  /* URLs de contas Google Workspace (…/a/macros/dominio/s/…) redirecionam e transformam o POST em GET:
     usa sempre o formato direto https://script.google.com/macros/s/ID/exec */
  Sync.normalizarUrl = function (u) {
    u = String(u || '').trim();
    u = u.replace(/^https:\/\/script\.google\.com\/a\/macros\/[^/]+\/s\//, 'https://script.google.com/macros/s/');
    u = u.replace(/^https:\/\/script\.google\.com\/(?:macros\/)?u\/\d+\/s\//, 'https://script.google.com/macros/s/');
    u = u.replace(/\/dev(\?.*)?$/, '/exec');
    return u;
  };
  Sync.salvarConfigLocal = (cfg) => localStorage.setItem('app_config_local', JSON.stringify(cfg || {}));
  Sync.habilitado = () => !!(Sync.config().apiUrl && Sync.config().clientId);

  /* ---------------- Token ---------------- */
  function decodificar(jwt) {
    const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(p).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  }
  Sync.token = function () {
    // sessão do app (30 dias, renovada a cada sincronização): não depende do login do Google, que dura só 1 hora
    try {
      const sess = localStorage.getItem('sessao');
      const exp = +localStorage.getItem('sessao_exp') || 0;
      if (sess && exp > Date.now() + 3600000) return sess;
    } catch (e) { /* */ }
    const t = localStorage.getItem('id_token');
    if (!t) return null;
    try {
      const d = decodificar(t);
      if (d.exp * 1000 < Date.now() + 60000) return null;
      return t;
    } catch (e) { return null; }
  };
  Sync.usuarioLocal = function () {
    try { return JSON.parse(localStorage.getItem('usuario') || 'null'); } catch (e) { return null; }
  };
  Sync.sair = function () {
    localStorage.removeItem('id_token');
    localStorage.removeItem('sessao'); localStorage.removeItem('sessao_exp');
    localStorage.removeItem('usuario');
    Sync.usuario = null;
    if (root.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    emitir('login');
  };

  function carregarGIS() {
    if (gisCarregado) return gisCarregado;
    gisCarregado = new Promise((res, rej) => {
      if (root.google && google.accounts && google.accounts.id) return res();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => { gisCarregado = null; rej(new Error('Sem internet para carregar o login do Google.')); };
      document.head.appendChild(s);
    });
    return gisCarregado;
  }

  let aguardandoToken = [];
  async function iniciarGIS() {
    await carregarGIS();
    if (Sync._gisIniciado) return;
    google.accounts.id.initialize({
      client_id: Sync.config().clientId,
      auto_select: true,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      callback: async (resp) => {
        localStorage.setItem('id_token', resp.credential);
        const d = decodificar(resp.credential);
        const u = Object.assign({}, Sync.usuarioLocal() || {}, { email: d.email, nome: d.name, foto: d.picture });
        localStorage.setItem('usuario', JSON.stringify(u));
        Sync.usuario = u;
        aguardandoToken.forEach((f) => f(resp.credential));
        aguardandoToken = [];
        try { await Sync.quemSou(); } catch (e) { /* tratado em quemSou */ }
        Sync.sincronizar();
      },
    });
    Sync._gisIniciado = true;
  }

  /** Mostra o botao "Entrar com Google" dentro do elemento. */
  Sync.renderizarBotao = async function (el) {
    if (!Sync.habilitado()) return;
    try {
      await iniciarGIS();
      google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'pt-BR' });
    } catch (e) {
      el.textContent = e.message;
    }
  };

  /** Tenta renovar o token silenciosamente (sem clique). */
  Sync.renovarToken = async function () {
    if (Sync.token()) return Sync.token();
    if (!navigator.onLine || !Sync.habilitado()) return null;
    try { await iniciarGIS(); } catch (e) { return null; }
    return new Promise((res) => {
      const timer = setTimeout(() => res(null), 8000);
      aguardandoToken.push((t) => { clearTimeout(timer); res(t); });
      try { google.accounts.id.prompt(); } catch (e) { clearTimeout(timer); res(null); }
    });
  };

  /* ---------------- Chamada ao backend ---------------- */
  Sync.TEMPO_LIMITE = { padrao: 120000, enviarFoto: 180000, baixarArquivo: 180000, enviarArquivo: 180000 };
  // falhas passageiras do Google (planilha/Drive ocupados, tempo esgotado etc.): vale tentar de novo
  const TEMPORARIO = /timed out|tempo limite|Service|Servi[çc]o|temporar|try again|tente novamente|Internal|interno|busy|ocupad|Exceeded|excedid|Limit|Too many|Lock|bloqueio|Rate|unavailable|indispon/i;
  Sync.chamar = async function (acao, dados, tentativa) {
    try {
      return await chamarUmaVez(acao, dados);
    } catch (e) {
      if (e.renovar && !tentativa) return Sync.chamar(acao, dados, 1);
      const repetir = (tentativa || 0) < 2 && !e.semRede && !e.tempoEsgotado && e.codigo !== 'TOKEN' && e.codigo !== 'SEM_ACESSO' && e.codigo !== 'PERFIL' &&
        (e.rede || e.temporario || TEMPORARIO.test(e.message)) && navigator.onLine;
      if (!repetir) throw e;
      Sync.log('repetindo', acao + ': ' + e.message);
      await new Promise((r) => setTimeout(r, 2500 * ((tentativa || 0) + 1)));
      return Sync.chamar(acao, dados, (tentativa || 0) + 1);
    }
  };
  async function chamarUmaVez(acao, dados) {
    const cfg = Sync.config();
    if (!cfg.apiUrl) throw new Error('Servidor não configurado.');
    let token = Sync.token() || (await Sync.renovarToken());
    if (!token) { emitir('login'); const err = new Error('Faça login com sua conta Google para sincronizar.'); err.codigo = 'TOKEN'; throw err; }
    // tempo limite: uma conexão travada não pode bloquear a sincronização para sempre
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), Sync.TEMPO_LIMITE[acao] || Sync.TEMPO_LIMITE.padrao) : null;
    if (ctl) emVoo.add(ctl);
    let resp, txt;
    try {
      resp = await fetch(cfg.apiUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ acao, token }, dados || {})),
        signal: ctl ? ctl.signal : undefined,
      });
      txt = await resp.text();
    } catch (e) {
      const err = new Error(e && e.name === 'AbortError' && !(ctl && ctl.semRede) ? 'O servidor demorou demais para responder (conexão lenta). Nada foi perdido: os dados continuam no aparelho e serão enviados na próxima sincronização.' : 'Sem conexão com o servidor. Os dados continuam no aparelho.');
      err.rede = true;
      if (ctl && ctl.semRede) err.semRede = true;
      else if (e && e.name === 'AbortError') err.tempoEsgotado = true;
      throw err;
    } finally { if (timer) clearTimeout(timer); if (ctl) emVoo.delete(ctl); }
    if (!resp.ok) { const err = new Error('Servidor respondeu ' + resp.status + '. Os dados continuam no aparelho.'); err.rede = true; throw err; }
    let j;
    try { j = JSON.parse(txt); } catch (e) {
      // pagina HTML: pode ser erro do proprio Google (tempo esgotado, falha passageira) ou falta de permissao
      const texto = String(txt || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      Sync.log('pagina', acao + ': resposta não-JSON', texto);
      if (/Exceeded maximum execution time|tempo m[áa]ximo de execu/i.test(texto)) {
        const err = new Error('O servidor do Google demorou demais para processar (' + acao + '). Nada foi perdido; o app tentará em partes menores.'); err.temporario = true; throw err;
      }
      if (/accounts\.google\.com|ServiceLogin/i.test(resp.url || '') || /n[ãa]o tem permiss[ãa]o para acessar|you need access|precisa de acesso|access denied/i.test(texto)) {
        throw new Error('O servidor pediu login do Google em vez de responder. Confira no Apps Script: Implantar › Gerenciar implantações › “Executar como: Eu” e “Quem pode acessar: Qualquer pessoa”, e use a URL que termina em /exec.');
      }
      const err = new Error('O servidor do Google respondeu com uma página de erro' + (texto ? ': “' + texto.slice(0, 140) + '”' : '') + '. Nada foi perdido; o app tentará de novo.');
      err.temporario = true;
      throw err;
    }
    if (j.ok && j.mensagem === 'Backend ativo.') {
      // resposta do doGet: o pedido foi redirecionado e chegou sem os dados
      throw new Error('O pedido ao servidor foi redirecionado e chegou incompleto (a URL do Apps Script precisa ser no formato https://script.google.com/macros/s/…/exec). Nada foi perdido: os dados continuam no aparelho.');
    }
    if (!j.ok) {
      if (j.codigo === 'TOKEN') {
        localStorage.removeItem('sessao'); localStorage.removeItem('sessao_exp');
        // a sessão do app venceu, mas o login do Google ainda vale: tenta de novo sem incomodar o usuário
        if (String(token).indexOf('S1.') === 0 && Sync.token()) { const err = new Error('Sessão renovada'); err.renovar = true; throw err; }
        localStorage.removeItem('id_token'); emitir('login');
      }
      if (j.codigo === 'SEM_ACESSO') emitir('sem_acesso', { erro: j.erro });
      const err = new Error(j.erro || 'Erro no servidor');
      err.codigo = j.codigo;
      throw err;
    }
    if (j.versao) Sync.versaoServidor = j.versao;
    return j;
  }

  Sync.quemSou = async function () {
    const j = await Sync.chamar('quemSou');
    if (!j.usuario) throw new Error('Resposta inesperada do servidor (quemSou).');
    Sync.versaoServidor = j.versao || 1;
    if (j.sessao) { try { localStorage.setItem('sessao', j.sessao); localStorage.setItem('sessao_exp', String(Date.now() + 29 * 86400000)); } catch (e) { /* */ } }
    const u = Object.assign({}, Sync.usuarioLocal() || {}, j.usuario);
    localStorage.setItem('usuario', JSON.stringify(u));
    Sync.usuario = u;
    Sync._quemSouEm = Date.now();
    emitir('ok');
    return u;
  };

  /* ---------------- Sincronizacao ---------------- */
  let pedidoDurante = false;
  let tentativaAuto = null, falhasSeguidas = 0;
  Sync.ultimaTentativa = 0;
  function agendarNovaTentativa() {
    clearTimeout(tentativaAuto);
    const espera = [15, 45, 120, 300, 600][Math.min(Math.max(falhasSeguidas, 1) - 1, 4)] * 1000;
    tentativaAuto = setTimeout(() => { if (navigator.onLine) Sync.sincronizar(); }, espera);
  }
  // falha passageira (sem sinal, Google ocupado/instável): não é erro do app, tenta de novo sozinho
  const passageira = (e) => !!(e && (e.rede || e.temporario || e.codigo === 'OCUPADO' || e.codigo === 'TEMPORARIO' || TEMPORARIO.test(e.message || '')));

  Sync.sincronizar = function () {
    if (emAndamento) { pedidoDurante = true; return emAndamento; }
    pedidoDurante = false;
    emAndamento = (async () => {
      // garante que o corpo rode depois de "emAndamento" receber a promessa (senão o "finally" abaixo
      // limparia a variável antes da hora e ela ficaria presa para sempre, bloqueando novas sincronizações)
      await null;
      Sync.ultimaTentativa = Date.now();
      try {
        if (!Sync.habilitado()) { emitir('local'); return; }
        if (!navigator.onLine) { emitir('offline'); return; }
        emitir('sincronizando');
        if (!Sync.token()) {
          const t = await Sync.renovarToken();
          if (!t) { emitir('login'); return; }
        }
        // confere o perfil periodicamente (o administrador pode ter mudado)
        if (!Sync.usuario || !Sync.usuario.perfil || Date.now() - (Sync._quemSouEm || 0) > 30 * 60000) { await Sync.quemSou(); emitir('sincronizando'); }
        let primeiroErro = null;
        const guardar = (e) => { if (!primeiroErro) primeiroErro = e; if (e.rede && !e.tempoEsgotado) throw e; };
        // 1) dados primeiro (são pequenos): uma conexão fraca não segura cadastros, visitas e notificações atrás das fotos
        try { await enviarAlteracoes(); } catch (e) { guardar(e); }
        // 2) fotos (grandes)
        let fotos = { falhas: [], grave: null };
        try { fotos = await enviarFotos(); } catch (e) { guardar(e); }
        // 3) endereço das fotos no Drive
        try { await enviarAlteracoes(); } catch (e) { guardar(e); }
        // 4) o que os outros aparelhos gravaram — mesmo que algum envio acima tenha falhado
        await receberAlteracoes();
        const falhaModelo = await sincronizarModelos();
        if (primeiroErro) throw primeiroErro;
        await DB.kvSet('ultimaSync', new Date().toISOString());
        falhasSeguidas = 0; clearTimeout(tentativaAuto);
        if (falhaModelo) Sync.log('aviso', falhaModelo);
        if (fotos.grave) {
          Sync.log('erro', fotos.grave);
          falhasSeguidas = 3; agendarNovaTentativa();
          emitir('erro', { erro: fotos.grave });
        } else {
          if (fotos.falhas.length) { falhasSeguidas = 1; agendarNovaTentativa(); }
          emitir('ok', { erro: null });
        }
      } catch (e) {
        console.error(e);
        if (Sync.estado === 'login' || Sync.estado === 'sem_acesso' || e.codigo === 'TOKEN') { Sync.log(Sync.estado, e && e.message); return; }
        falhasSeguidas++;
        agendarNovaTentativa();
        if (passageira(e) && falhasSeguidas < 4) {
          Sync.log(e.rede ? 'sem conexão' : 'passageiro', e.message);
          emitir('offline', { erro: e.message });
        } else {
          Sync.log('erro', e && e.message, e && e.stack);
          emitir('erro', { erro: (e && e.message) || String(e) });
        }
      } finally {
        emAndamento = null;
        // alterações feitas durante a sincronização: sincroniza de novo em seguida
        if (pedidoDurante && Sync.estado !== 'login' && Sync.estado !== 'sem_acesso') { pedidoDurante = false; setTimeout(() => Sync.sincronizar(), 1500); }
      }
    })();
    return emAndamento;
  };

  const perfilAtual = () => ((Sync.usuario || Sync.usuarioLocal() || {}).perfil) || 'consulta';

  /* Fotos: cada foto que falha espera mais antes de tentar de novo (1 min, 5 min, 30 min, 2 h, 6 h),
     para uma foto com problema não deixar o indicador vermelho nem gastar dados sem parar. */
  const ESPERA_FOTO = [60, 300, 1800, 7200, 21600];
  async function enviarFotos() {
    const res = { falhas: [], grave: null };
    if (perfilAtual() === 'consulta') return res;
    const controle = await DB.kvGet('falhasFotos', {});
    const salvarControle = () => DB.kvSet('falhasFotos', controle);
    const fotos = (await DB.all('fotos')).filter((f) => !f.driveId && !f.excluido);
    let i = 0;
    const inicio = Date.now();
    for (const f of fotos) {
      i++;
      if (Date.now() - inicio > 4 * 60000) break; // o restante vai na próxima rodada (deixa receber os dados dos outros)
      const c = controle[f.id];
      if (c && (c.danificada || c.proxima > Date.now())) continue;
      // irregularidade recém-registrada ainda sem descrição: espera a descrição (vai no nome do arquivo no Drive)
      if (f.irregular && !String(f.descricao || '').trim() && Date.now() - Date.parse(f.criadoEm || 0) < 180000) continue;
      let blob;
      try { blob = await DB.blobGet(f.id); } catch (e) { blob = null; }
      if (!blob) continue;
      emitir('sincronizando', { detalhe: 'Enviando foto ' + i + ' de ' + fotos.length + '…' });
      try {
        let b64;
        try { b64 = await Foto.blobParaBase64(blob); } catch (e) {
          // arquivo da foto ilegível neste aparelho: não adianta tentar de novo
          controle[f.id] = { danificada: true, msg: 'arquivo da foto ilegível neste aparelho (' + (e.name || e.message) + ')' };
          await salvarControle();
          Sync.log('foto', 'Foto ' + f.id.slice(0, 8) + ' danificada neste aparelho: ' + (e.message || e.name));
          continue;
        }
        let destino = {};
        try { if (root.App && App.infoFotoDrive) destino = await App.infoFotoDrive(f); } catch (e) { /* usa a pasta Fotos */ }
        const j = await Sync.chamar('enviarFoto', { id: f.id, registroId: f.registroId, base64: b64, mime: blob.type || 'image/jpeg', pastas: destino.pastas, nome: destino.nome });
        if (!j.driveId) throw new Error('Resposta inesperada do servidor ao enviar foto.');
        await DB.atualizar('fotos', f.id, (a) => (a ? Object.assign(a, { driveId: j.driveId, _pendente: true }) : undefined));
        if (controle[f.id]) { delete controle[f.id]; await salvarControle(); }
      } catch (e) {
        if (e.codigo === 'TOKEN' || e.codigo === 'SEM_ACESSO' || e.codigo === 'PERFIL' || e.semRede || /redirecionado|pediu login/.test(e.message)) throw e;
        if (e.codigo === 'DRIVE_CHEIO') { res.grave = e.message; break; }
        // conexão lenta demais para esta foto: para de enviar fotos nesta rodada, mas segue recebendo os dados
        if (e.tempoEsgotado || e.rede) { Sync.log('foto', 'Envio de fotos interrompido: ' + e.message); break; }
        const n = ((controle[f.id] || {}).n || 0) + 1;
        controle[f.id] = { n, proxima: Date.now() + ESPERA_FOTO[Math.min(n - 1, ESPERA_FOTO.length - 1)] * 1000, msg: e.message };
        await salvarControle();
        Sync.log('foto', 'Foto ' + f.id.slice(0, 8) + ' (tentativa ' + n + '): ' + e.message);
        res.falhas.push(e.message);
        if (n >= 4) res.grave = 'Uma foto não consegue ser enviada ao Drive (' + e.message + '). Veja Ajustes › Diagnóstico.';
      }
    }
    return res;
  }

  const LOTE_MAX_ITENS = 60;
  const LOTE_MAX_BYTES = 700000;
  async function enviarAlteracoes() {
    const perfil = perfilAtual();
    if (perfil === 'consulta') return; // o perfil consulta não grava; nada é apagado do aparelho
    const itens = [];
    for (const e of ENTIDADES) {
      for (const o of (await DB.all(e)).filter((x) => x._pendente)) {
        // pessoas e ajustes só o administrador grava (o servidor recusaria)
        if ((e === 'pessoas' || e === 'config') && perfil !== 'admin') {
          await DB.atualizar(e, o.id, (a) => (a && a._pendente ? (delete a._pendente, a) : undefined));
          continue;
        }
        const c = Object.assign({}, o); delete c._pendente;
        itens.push({ e, o: c, tam: JSON.stringify(c).length });
      }
    }
    if (!itens.length) return;
    // envia em lotes: um lote grande demais pode estourar o tempo do servidor
    let enviados = 0;
    while (enviados < itens.length) {
      const lote = {};
      let n = 0, bytes = 0;
      while (enviados + n < itens.length && n < LOTE_MAX_ITENS && (n === 0 || bytes + itens[enviados + n].tam < LOTE_MAX_BYTES)) {
        const it = itens[enviados + n];
        (lote[it.e] = lote[it.e] || []).push(it.o);
        bytes += it.tam; n++;
      }
      emitir('sincronizando', { detalhe: 'Enviando alterações ' + (enviados + n) + ' de ' + itens.length + '…' });
      const j = await Sync.chamar('enviar', { dados: lote });
      if (typeof j.gravados !== 'number') throw new Error('Resposta inesperada do servidor ao enviar. Os dados continuam no aparelho.');
      const servidorAntigo = !j.versao || j.versao < 2;
      const falhou = new Set((j.falhas || []).map((x) => x.e + ':' + x.id));
      (j.falhas || []).forEach((x) => Sync.log('registro recusado', x.e + ' ' + String(x.id).slice(0, 8) + ': ' + x.erro));
      for (const e of Object.keys(lote)) {
        if (servidorAntigo && e === 'visitas') continue; // servidor desatualizado nao grava visitas: mantem pendente
        for (const o of lote[e]) {
          if (falhou.has(e + ':' + o.id)) continue; // continua pendente
          // só limpa se ninguém alterou o registro enquanto ele era enviado
          await DB.atualizar(e, o.id, (a) => (a && a._pendente && a.atualizadoEm === o.atualizadoEm ? (delete a._pendente, a) : undefined));
        }
      }
      // o servidor tinha versão mais nova (ou o registro foi excluído por outro aparelho): o aparelho fica igual ao servidor
      for (const e of Object.keys(j.rejeitados || {})) {
        for (const srv of j.rejeitados[e] || []) {
          const enviado = (lote[e] || []).find((x) => x.id === srv.id);
          if (!enviado) continue;
          await DB.atualizar(e, srv.id, (a) => {
            if (!a || (a._pendente && a.atualizadoEm !== enviado.atualizadoEm)) return undefined;
            if (a.miniatura && !srv.miniatura) srv.miniatura = a.miniatura;
            return srv;
          });
          Sync.log('versão do servidor', e + ' ' + String(srv.id).slice(0, 8) + ' — outra alteração mais nova prevaleceu');
        }
      }
      if (servidorAntigo && lote.visitas) throw new Error('Atualize o Code.gs no Apps Script (nova versão) para sincronizar as visitas.');
      enviados += n;
    }
  }

  async function receberAlteracoes() {
    // cursor vale para um servidor/planilha: se mudou, baixa tudo de novo
    const url = Sync.config().apiUrl;
    if ((await DB.kvGet('cursorUrl', null)) !== url) { await DB.kvSet('servidorDesde', 0); await DB.kvSet('cursorUrl', url); }
    let total = 0;
    for (let pagina = 0; pagina < 300; pagina++) {
      const desde = await DB.kvGet('servidorDesde', 0);
      const j = await Sync.chamar('receber', { desde });
      if (!j.dados) throw new Error('Resposta inesperada do servidor ao receber dados.');
      if (j.planilha) {
        const ant = await DB.kvGet('planilhaId', null);
        if (ant !== j.planilha) {
          await DB.kvSet('planilhaId', j.planilha);
          if (ant && desde) { Sync.log('aviso', 'Planilha do servidor mudou: baixando tudo de novo'); await DB.kvSet('servidorDesde', 0); continue; }
        }
      }
      for (const e of ENTIDADES) {
        for (const o of (j.dados[e] || [])) {
          if (!o || !o.id) continue;
          let mudou = false;
          try {
            await DB.atualizar(e, o.id, (local) => {
              if (local) {
                // mesma versao que o aparelho ja tem: nada a fazer
                if (!local._pendente && String(local.atualizadoEm) === String(o.atualizadoEm) && !!local.excluido === !!o.excluido && (e !== 'fotos' || !o.driveId || local.driveId === o.driveId)) return undefined;
                // alteracao local mais nova ainda nao enviada: mantem a local
                if (local._pendente && String(local.atualizadoEm) > String(o.atualizadoEm)) return undefined;
                // exclusao e definitiva: uma copia antiga do servidor nao "ressuscita" o que foi excluido aqui
                if (local.excluido && !o.excluido) {
                  if (local._pendente) return undefined;
                  local._pendente = true; local.atualizadoEm = DB.carimbo(o.atualizadoEm); pedidoDurante = true;
                  return local;
                }
                if (local.miniatura && !o.miniatura) o.miniatura = local.miniatura;
                // nao perde o endereco da foto no Drive por causa de uma edicao feita em outro aparelho
                if (e === 'fotos' && local.driveId && !o.driveId) { o.driveId = local.driveId; o._pendente = true; pedidoDurante = true; }
              }
              mudou = true;
              return o;
            });
          } catch (err) {
            // um registro com problema não pode travar o recebimento dos outros
            Sync.log('erro ao gravar recebido', e + ' ' + String(o.id).slice(0, 8) + ': ' + err.message);
          }
          if (mudou) total++;
        }
      }
      await DB.kvSet('servidorDesde', j.servidorAgora);
      if (j.ultima) Sync._ultimaVista = Math.max(Sync._ultimaVista || 0, j.ultima);
      if (!j.mais) break;
      emitir('sincronizando', { detalhe: 'Recebendo dados… (' + total + ')' });
    }
    if (total && root.App && App.aoReceberDados) { try { await App.aoReceberDados(total); } catch (e) { Sync.log('aviso', 'Atualizar tela: ' + e.message); } }
  }

  async function sincronizarModelos() {
    let falha = null;
    const cfg = await DB.get('config', 'geral');
    if (!cfg || !cfg.modelos) return falha;
    for (const tipo of Object.keys(cfg.modelos)) {
      const m = cfg.modelos[tipo];
      if (!m || !m.driveId) continue;
      const local = await DB.arquivoGet('modelo_' + tipo);
      if (local && local.driveId === m.driveId) continue;
      try {
        const r = await Sync.chamar('baixarArquivo', { driveId: m.driveId });
        const blob = Foto.base64ParaBlob(r.base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        await DB.arquivoSet('modelo_' + tipo, blob, { driveId: m.driveId, nome: m.nome });
      } catch (e) {
        if (e.rede || e.codigo === 'TOKEN') throw e;
        // modelo apagado/indisponível no Drive: continua usando o modelo deste aparelho, sem travar a sincronização
        falha = 'Modelo do Word “' + tipo + '” não pôde ser baixado (' + e.message + '). O administrador pode enviá-lo de novo em Ajustes › Modelos do Word.';
      }
    }
    return falha;
  }

  /** Baixa uma foto do Drive (quando o aparelho ainda nao a possui). */
  Sync.baixarFoto = async function (foto) {
    if (!foto.driveId) throw new Error('Foto ainda não enviada pelo aparelho que a registrou.');
    const r = await Sync.chamar('baixarArquivo', { driveId: foto.driveId });
    const blob = Foto.base64ParaBlob(r.base64, r.mime || 'image/jpeg');
    await DB.blobSet(foto.id, blob);
    return blob;
  };

  /** Marca todos os registros deste aparelho para reenvio (recupera envios que falharam). */
  Sync.reenviarTudo = async function () {
    let n = 0;
    if (perfilAtual() === 'consulta') return n;
    await DB.kvSet('falhasFotos', {}); // tenta de novo também as fotos que falharam
    for (const e of ENTIDADES) {
      for (const o of await DB.all(e)) { if (!o._pendente) { o._pendente = true; await DB.put(e, o); n++; } }
    }
    return n;
  };

  Sync.enviarArquivo = async function (nome, blob) {
    const b64 = await Foto.blobParaBase64(blob);
    return Sync.chamar('enviarArquivo', { nome, base64: b64, mime: blob.type });
  };

  /* Aviso rápido de novidades: a cada 20 s (com o app aberto na tela) pergunta ao servidor se alguém gravou
     algo; só então sincroniza. Assim o que um fiscal registra aparece nos outros celulares em segundos. */
  Sync._ultimaVista = 0;
  let semNovidades = false;
  Sync.verificarNovidades = async function () {
    if (semNovidades || emAndamento || !Sync.habilitado() || !navigator.onLine || (root.document && document.visibilityState !== 'visible')) return;
    if (!Sync.token() || Sync.estado === 'login' || Sync.estado === 'sem_acesso') return; // nunca abre tela de login sozinho
    try {
      const j = await chamarUmaVez('novidades');
      if (!Sync._ultimaVista) Sync._ultimaVista = j.ultima; // primeira consulta: a sincronização normal já acontece ao abrir
      else if (j.ultima > Sync._ultimaVista) { Sync.log('novidades', 'Outro aparelho gravou dados — sincronizando'); Sync.sincronizar(); }
    } catch (e) {
      if (/desconhecida/i.test(e.message || '')) semNovidades = true; // servidor antigo: fica só com a sincronização a cada 5 min
    }
  };
  setInterval(() => Sync.verificarNovidades(), 20000);

  root.addEventListener('online', () => { Sync.log('conexão', 'internet voltou'); Sync.sincronizar(); });
  // ao voltar para o app (iPhone/Android suspendem o app em segundo plano): sincroniza se já faz um tempo
  const aoVoltar = () => { if (document.visibilityState === 'visible' && Sync.habilitado() && navigator.onLine && Date.now() - Sync.ultimaTentativa > 20000) Sync.sincronizar(); };
  if (root.document) { document.addEventListener('visibilitychange', aoVoltar); root.addEventListener('pageshow', aoVoltar); root.addEventListener('focus', aoVoltar); }
  root.addEventListener('offline', () => {
    // a conexao caiu: cancela os pedidos em andamento para a sincronizacao nao ficar presa esperando
    emVoo.forEach((c) => { c.semRede = true; c.abort(); });
    emitir('offline');
  });
  root.Sync = Sync;
})(self);
