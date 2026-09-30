/* Login Google + sincronizacao com o backend (Google Apps Script) */
(function (root) {
  const ENTIDADES = ['pessoas', 'registros', 'visitas', 'notificacoes', 'fotos', 'config'];
  const Sync = { estado: 'offline', usuario: null, erro: null };
  const ouvintes = new Set();
  let gisCarregado = null;
  let emAndamento = null;
  const emVoo = new Set(); // pedidos em andamento (cancelados se a internet cair)

  Sync.on = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };
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
  Sync.chamar = async function (acao, dados) {
    const cfg = Sync.config();
    if (!cfg.apiUrl) throw new Error('Servidor não configurado.');
    let token = Sync.token() || (await Sync.renovarToken());
    if (!token) { emitir('login'); throw new Error('Faça login com sua conta Google para sincronizar.'); }
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
      const err = new Error(e && e.name === 'AbortError' && !ctl.semRede ? 'O servidor demorou demais para responder (conexão lenta). Nada foi perdido: os dados continuam no aparelho e serão enviados na próxima sincronização.' : 'Sem conexão com o servidor. Os dados continuam no aparelho.');
      err.rede = true;
      throw err;
    } finally { if (timer) clearTimeout(timer); if (ctl) emVoo.delete(ctl); }
    if (!resp.ok) { const err = new Error('Servidor respondeu ' + resp.status + '. Os dados continuam no aparelho.'); err.rede = true; throw err; }
    let j;
    try { j = JSON.parse(txt); } catch (e) {
      throw new Error('O servidor devolveu uma página em vez de dados. Confira no Apps Script: Implantar › Gerenciar implantações › “Quem pode acessar: Qualquer pessoa”, e use a URL que termina em /exec.');
    }
    if (j.ok && j.mensagem === 'Backend ativo.') {
      // resposta do doGet: o pedido foi redirecionado e chegou sem os dados
      throw new Error('O pedido ao servidor foi redirecionado e chegou incompleto (a URL do Apps Script precisa ser no formato https://script.google.com/macros/s/…/exec). Nada foi perdido: os dados continuam no aparelho.');
    }
    if (!j.ok) {
      if (j.codigo === 'TOKEN') { localStorage.removeItem('id_token'); emitir('login'); }
      if (j.codigo === 'SEM_ACESSO') emitir('sem_acesso', { erro: j.erro });
      const err = new Error(j.erro || 'Erro no servidor');
      err.codigo = j.codigo;
      throw err;
    }
    if (j.versao) Sync.versaoServidor = j.versao;
    return j;
  };

  Sync.quemSou = async function () {
    const j = await Sync.chamar('quemSou');
    if (!j.usuario) throw new Error('Resposta inesperada do servidor (quemSou).');
    Sync.versaoServidor = j.versao || 1;
    const u = Object.assign({}, Sync.usuarioLocal() || {}, j.usuario);
    localStorage.setItem('usuario', JSON.stringify(u));
    Sync.usuario = u;
    Sync._quemSouEm = Date.now();
    emitir('ok');
    return u;
  };

  /* ---------------- Sincronizacao ---------------- */
  let pedidoDurante = false;
  Sync.sincronizar = function () {
    if (emAndamento) { pedidoDurante = true; return emAndamento; }
    pedidoDurante = false;
    emAndamento = (async () => {
      // garante que o corpo rode depois de "emAndamento" receber a promessa (senão o "finally" abaixo
      // limparia a variável antes da hora e ela ficaria presa para sempre, bloqueando novas sincronizações)
      await null;
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
        const falhasFotos = await enviarFotos();
        await enviarAlteracoes();
        await receberAlteracoes();
        await sincronizarModelos();
        await DB.kvSet('ultimaSync', new Date().toISOString());
        if (falhasFotos.length) {
          emitir('erro', { erro: falhasFotos.length + ' foto(s) não puderam ser enviadas agora (' + falhasFotos[0] + '). Os demais dados foram sincronizados; o app tentará as fotos de novo.' });
        } else emitir('ok', { erro: null });
      } catch (e) {
        console.error(e);
        if (Sync.estado !== 'login' && Sync.estado !== 'sem_acesso') emitir('erro', { erro: e.message });
      } finally {
        emAndamento = null;
        // alterações feitas durante a sincronização: sincroniza de novo em seguida
        if (pedidoDurante && Sync.estado !== 'login' && Sync.estado !== 'sem_acesso') { pedidoDurante = false; setTimeout(() => Sync.sincronizar(), 1500); }
      }
    })();
    return emAndamento;
  };

  const perfilAtual = () => ((Sync.usuario || Sync.usuarioLocal() || {}).perfil) || 'consulta';

  async function enviarFotos() {
    const falhas = [];
    if (perfilAtual() === 'consulta') return falhas;
    const fotos = (await DB.all('fotos')).filter((f) => !f.driveId && !f.excluido);
    let i = 0;
    for (const f of fotos) {
      i++;
      const blob = await DB.blobGet(f.id);
      if (!blob) continue;
      // irregularidade recém-registrada ainda sem descrição: espera a descrição (vai no nome do arquivo no Drive)
      if (f.irregular && !String(f.descricao || '').trim() && Date.now() - Date.parse(f.criadoEm || 0) < 180000) continue;
      emitir('sincronizando', { detalhe: 'Enviando foto ' + i + ' de ' + fotos.length + '…' });
      try {
        const b64 = await Foto.blobParaBase64(blob);
        let destino = {};
        try { if (root.App && App.infoFotoDrive) destino = await App.infoFotoDrive(f); } catch (e) { /* usa a pasta Fotos */ }
        const j = await Sync.chamar('enviarFoto', { id: f.id, registroId: f.registroId, base64: b64, mime: blob.type || 'image/jpeg', pastas: destino.pastas, nome: destino.nome });
        if (!j.driveId) throw new Error('Resposta inesperada do servidor ao enviar foto.');
        const atual = await DB.get('fotos', f.id);
        if (!atual) continue;
        atual.driveId = j.driveId;
        atual._pendente = true;
        await DB.put('fotos', atual);
      } catch (e) {
        // sem internet / sessao / acesso: interrompe; erro de uma foto: segue com as outras
        if (e.rede || e.codigo === 'TOKEN' || e.codigo === 'SEM_ACESSO' || e.codigo === 'PERFIL' || /redirecionado|página em vez/.test(e.message)) throw e;
        console.warn('foto', f.id, e);
        falhas.push(e.message);
      }
    }
    return falhas;
  }

  const LOTE_MAX_ITENS = 80;
  const LOTE_MAX_BYTES = 1500000;
  async function enviarAlteracoes() {
    const perfil = perfilAtual();
    const itens = [];
    for (const e of ENTIDADES) {
      for (const o of (await DB.all(e)).filter((x) => x._pendente)) {
        // o servidor recusa: consulta nao grava nada; pessoas e ajustes so o administrador
        if (perfil === 'consulta' || ((e === 'pessoas' || e === 'config') && perfil !== 'admin')) { delete o._pendente; await DB.put(e, o); continue; }
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
      for (const e of Object.keys(lote)) {
        if (servidorAntigo && e === 'visitas') continue; // servidor desatualizado nao grava visitas: mantem pendente
        for (const o of lote[e]) {
          const atual = await DB.get(e, o.id);
          if (atual && atual.atualizadoEm === o.atualizadoEm) { delete atual._pendente; await DB.put(e, atual); }
        }
      }
      if (servidorAntigo && lote.visitas) throw new Error('Atualize o Code.gs no Apps Script (nova versão) para sincronizar as visitas.');
      enviados += n;
    }
  }

  async function receberAlteracoes() {
    let total = 0;
    for (let pagina = 0; pagina < 200; pagina++) {
      const desde = await DB.kvGet('servidorDesde', 0);
      const j = await Sync.chamar('receber', { desde });
      if (!j.dados) throw new Error('Resposta inesperada do servidor ao receber dados.');
      for (const e of ENTIDADES) {
        for (const o of (j.dados[e] || [])) {
          const local = await DB.get(e, o.id);
          if (local) {
            // mesma versao que o aparelho ja tem: nada a fazer
            if (!local._pendente && String(local.atualizadoEm) === String(o.atualizadoEm) && !!local.excluido === !!o.excluido && (e !== 'fotos' || !o.driveId || local.driveId === o.driveId)) continue;
            // alteracao local mais nova ainda nao enviada: mantem a local
            if (local._pendente && String(local.atualizadoEm) > String(o.atualizadoEm)) continue;
            // exclusao e definitiva: uma copia antiga do servidor nao "ressuscita" o que foi excluido aqui
            if (local.excluido && !o.excluido) {
              if (!local._pendente) { local._pendente = true; local.atualizadoEm = new Date().toISOString(); await DB.put(e, local); }
              continue;
            }
            if (local.miniatura && !o.miniatura) o.miniatura = local.miniatura;
            // nao perde o endereco da foto no Drive por causa de uma edicao feita em outro aparelho
            if (e === 'fotos' && local.driveId && !o.driveId) { o.driveId = local.driveId; o._pendente = true; pedidoDurante = true; }
          }
          await DB.put(e, o);
          total++;
        }
      }
      await DB.kvSet('servidorDesde', j.servidorAgora);
      if (!j.mais) break;
      emitir('sincronizando', { detalhe: 'Recebendo dados… (' + total + ')' });
    }
    if (total && root.App && App.aoReceberDados) await App.aoReceberDados(total);
  }

  async function sincronizarModelos() {
    const cfg = await DB.get('config', 'geral');
    if (!cfg || !cfg.modelos) return;
    for (const tipo of Object.keys(cfg.modelos)) {
      const m = cfg.modelos[tipo];
      if (!m || !m.driveId) continue;
      const local = await DB.arquivoGet('modelo_' + tipo);
      if (local && local.driveId === m.driveId) continue;
      const r = await Sync.chamar('baixarArquivo', { driveId: m.driveId });
      const blob = Foto.base64ParaBlob(r.base64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      await DB.arquivoSet('modelo_' + tipo, blob, { driveId: m.driveId, nome: m.nome });
    }
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
    for (const e of ENTIDADES) {
      for (const o of await DB.all(e)) { if (!o._pendente) { o._pendente = true; await DB.put(e, o); n++; } }
    }
    return n;
  };

  Sync.enviarArquivo = async function (nome, blob) {
    const b64 = await Foto.blobParaBase64(blob);
    return Sync.chamar('enviarArquivo', { nome, base64: b64, mime: blob.type });
  };

  root.addEventListener('online', () => Sync.sincronizar());
  root.addEventListener('offline', () => {
    // a conexao caiu: cancela os pedidos em andamento para a sincronizacao nao ficar presa esperando
    emVoo.forEach((c) => { c.semRede = true; c.abort(); });
    emitir('offline');
  });
  root.Sync = Sync;
})(self);
