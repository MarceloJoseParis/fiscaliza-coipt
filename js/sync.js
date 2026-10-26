/* Login Google + sincronizacao com o backend (Google Apps Script) */
try { (self.VERSOES_JS = self.VERSOES_JS || {}).sync = '3.18.9'; } catch (e) { /* fora do navegador */ }
(function (root) {
  const ENTIDADES = ['pessoas', 'registros', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes', 'atividades'];
  // medições só sincronizam com o servidor versão 11 ou mais nova (o antigo ignoraria e elas se perderiam da equipe);
  // a atividade (comentários/histórico das obras) com a versão 14
  const MIN_SERVIDOR = { medicoes: 11, atividades: 14 };
  const Sync = { estado: 'offline', usuario: null, erro: null };
  // (antes esta linha ficava acima da declaração de Sync e falhava em silêncio: a versão do servidor só era conhecida após o login)
  try { const v = +localStorage.getItem('versaoServidor'); if (v) Sync.versaoServidor = v; } catch (e) { /* */ }
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
    try {
      const u = JSON.parse(localStorage.getItem('usuario') || 'null');
      if (u && u.foto) { delete u.foto; localStorage.setItem('usuario', JSON.stringify(u)); } // apaga a foto do perfil guardada por versões anteriores
      return u;
    } catch (e) { return null; }
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
        const u = Object.assign({}, Sync.usuarioLocal() || {}, { email: d.email, nome: d.name }); // a foto do perfil Google não é guardada (LGPD)
        delete u.foto;
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
  // tipo de aparelho (aparece para o administrador em "último acesso"); tablet conta como celular
  Sync.dispositivo = (() => { try { const ua = navigator.userAgent || ''; return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'celular' : 'computador'; } catch (e) { return ''; } })();
  Sync.TEMPO_LIMITE = { padrao: 120000, enviarFoto: 180000, baixarArquivo: 300000, enviarArquivo: 180000, enviarAnexo: 360000 };
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
      // a foto pode ter sido gravada mesmo com a resposta perdida: na nova tentativa o servidor procura a duplicata
      if ((acao === 'enviarFoto' || acao === 'enviarAnexo') && dados && !dados.repetida) dados = Object.assign({}, dados, { repetida: true });
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
        body: JSON.stringify(Object.assign({ acao, token, disp: Sync.dispositivo }, dados || {})),
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
    if (j.versao) { Sync.versaoServidor = j.versao; try { localStorage.setItem('versaoServidor', String(j.versao)); } catch (e) { /* */ } }
    return j;
  }

  /* Nomes da equipe (cadastrados em Ajustes › Usuários do grupo): usados no lugar do e-mail em relatórios e telas */
  let equipeNomes = null;
  Sync.guardarEquipe = function (lista) {
    const m = {};
    for (const u of lista || []) if (u && u.email && u.nome && String(u.nome).trim()) m[String(u.email).toLowerCase().trim()] = String(u.nome).trim();
    // 3.18.9: quem saiu da lista de usuários continua com o nome nos registros antigos
    let ant = equipeNomes; if (!ant) { try { ant = JSON.parse(localStorage.getItem('equipeNomes') || '{}') || {}; } catch (e) { ant = {}; } }
    for (const k of Object.keys(ant || {})) if (!m[k] && ant[k]) m[k] = ant[k];
    equipeNomes = m;
    try { localStorage.setItem('equipeNomes', JSON.stringify(m)); } catch (e) { /* */ }
  };
  Sync.nomeDe = function (email) {
    if (!email) return '';
    if (!equipeNomes) { try { equipeNomes = JSON.parse(localStorage.getItem('equipeNomes') || '{}') || {}; } catch (e) { equipeNomes = {}; } }
    return equipeNomes[String(email).toLowerCase().trim()] || email;
  };
  Sync.quemSou = async function () {
    const j = await Sync.chamar('quemSou');
    if (!j.usuario) throw new Error('Resposta inesperada do servidor (quemSou).');
    Sync.versaoServidor = j.versao || 1; try { localStorage.setItem('versaoServidor', String(Sync.versaoServidor)); } catch (e) { /* */ }
    if (Array.isArray(j.equipe)) Sync.guardarEquipe(j.equipe);
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
    tentativaAuto = setTimeout(() => { if (navigator.onLine) Sync.sincronizar({ forcar: true }); }, espera);
  }
  // falha passageira (sem sinal, Google ocupado/instável): não é erro do app, tenta de novo sozinho
  const passageira = (e) => !!(e && (e.rede || e.temporario || e.codigo === 'OCUPADO' || e.codigo === 'TEMPORARIO' || TEMPORARIO.test(e.message || '')));

  /* opts.rapido (sincronização disparada por uma gravação feita neste aparelho): a ida ao servidor para receber
     é pulada quando a consulta de novidades de poucos segundos atrás já mostrou que ninguém mais gravou nada —
     a sincronização após cada alteração fica bem mais rápida. Se alguém gravar logo depois, a próxima consulta
     de novidades (10–20 s) busca. opts.forcar (ou sem opções): sempre pergunta ao servidor. */
  Sync.sincronizar = function (opts) {
    const forcar = !(opts && opts.rapido) || !!(opts && opts.forcar);
    if (emAndamento) { pedidoDurante = true; if (forcar) pedidoForcado = true; return emAndamento; }
    pedidoDurante = false;
    emAndamento = (async () => {
      // garante que o corpo rode depois de "emAndamento" receber a promessa (senão o "finally" abaixo
      // limparia a variável antes da hora e ela ficaria presa para sempre, bloqueando novas sincronizações)
      await null;
      Sync.ultimaTentativa = Date.now();
      // 3.18.6: duas abas/janelas do app no mesmo computador não sincronizam ao mesmo tempo (fotos em dobro no Drive)
      if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
        let ocupado = false;
        await navigator.locks.request('fiscalizacao-sync', { ifAvailable: true }, async (trava) => { if (!trava) { ocupado = true; return; } await corpoSync(forcar); });
        if (ocupado) { Sync.log('outra aba', 'sincronização em andamento em outra janela do app — tenta de novo em 20 s'); clearTimeout(tentativaAuto); tentativaAuto = setTimeout(() => Sync.sincronizar({ forcar: true }), 20000); }
      } else await corpoSync(forcar);
    })().finally(() => {
      emAndamento = null;
      // alterações feitas durante a sincronização: sincroniza de novo em seguida
      if (pedidoDurante && Sync.estado !== 'login' && Sync.estado !== 'sem_acesso') { const f = pedidoForcado; pedidoDurante = false; pedidoForcado = false; setTimeout(() => Sync.sincronizar(f ? { forcar: true } : { rapido: true }), 800); }
    });
    return emAndamento;
  };
  async function corpoSync(forcar) {
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
        // 2) o que os outros aparelhos gravaram — ANTES das fotos (enviar muitas fotos levava minutos e
        //    atrasava tudo o que os colegas registraram)
        if (forcar || !(await nadaNovo())) await receberAlteracoes();
        else Sync.log('rápido', 'nada novo no servidor — recebimento pulado');
        const falhaModelo = await sincronizarModelos();
        // 3) fotos (grandes); o endereço no Drive vai sendo enviado durante o envio
        let fotos = { falhas: [], grave: null };
        try { fotos = await enviarFotos(); } catch (e) { guardar(e); }
        // 3b) arquivos anexados aos comentários das obras (projetos, TRD, TRP…)
        try { await enviarAnexos(); } catch (e) { guardar(e); }
        // 4) endereço das fotos no Drive (o que faltou)
        try { await enviarAlteracoes(); } catch (e) { guardar(e); }
        if (primeiroErro) throw primeiroErro;
        await DB.kvSet('ultimaSync', new Date().toISOString());
        falhasSeguidas = 0; clearTimeout(tentativaAuto);
        if (falhaModelo) Sync.log('aviso', falhaModelo);
        if (fotos.grave) {
          Sync.log('erro', fotos.grave);
          falhasSeguidas = 3; agendarNovaTentativa();
          emitir('erro', { erro: fotos.grave });
        } else {
          if (fotos.falhas.length || fotos.passageira) { falhasSeguidas = 1; agendarNovaTentativa(); }
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
      }
  }

  let pedidoForcado = false;
  // a consulta de novidades (há menos de 25 s) já disse qual é a última gravação do servidor e o aparelho já a tem
  async function nadaNovo() {
    if (!Sync._srvUltima || Date.now() - (Sync._novidadesEm || 0) > 25000) return false;
    if (await DB.kvGet('cursorUrl', null) !== Sync.config().apiUrl) return false;
    const falhos = await DB.kvGet('recebidosFalhos', {}) || {};
    if (Object.keys(falhos).length) return false;
    const visto = await DB.kvGet('vistoServidor', 0);
    return !!visto && Sync._srvUltima <= visto;
  }

  const perfilAtual = () => ((Sync.usuario || Sync.usuarioLocal() || {}).perfil) || 'consulta';

  /* Fotos: cada foto que falha espera mais antes de tentar de novo (1 min, 5 min, 30 min, 2 h, 6 h),
     para uma foto com problema não deixar o indicador vermelho nem gastar dados sem parar. */
  const ESPERA_FOTO = [60, 300, 1800, 7200, 21600];
  let fotosEmEnvio = false, novidadeDurante = false;
  const FOTOS_JUNTAS = 3;               // três fotos por vez (o Apps Script atende pedidos em paralelo)
  const DATA_PASTAS = '2026-09-29';     // antes disso as fotos iam soltas para Fotos/<id>.jpg
  async function enviarFotos() {
    const res = { falhas: [], grave: null };
    if (perfilAtual() === 'consulta') return res;
    const controle = await DB.kvGet('falhasFotos', {});
    const salvarControle = () => DB.kvSet('falhasFotos', controle);
    const todas = await DB.all('fotos');
    const fotos = todas.filter((f) => !f.driveId && !f.excluido);
    // limpa marcas de fotos que já foram enviadas ou excluídas
    const ativas = new Set(fotos.map((f) => f.id));
    let limpou = false;
    for (const id of Object.keys(controle)) if (!ativas.has(id)) { delete controle[id]; limpou = true; }
    if (limpou) await salvarControle();
    const inicio = Date.now();
    let feitas = 0, desdeEnvio = 0, ultimoEnvio = Date.now(), parar = false, i = 0, enviandoDados = false;
    const fila = fotos.slice();
    fotosEmEnvio = true;
    async function umaFoto(f, num) {
      const c = controle[f.id];
      if (c && (c.danificada || c.proxima > Date.now())) return;
      // irregularidade recém-registrada ainda sem descrição: espera a descrição (vai no nome do arquivo no Drive)
      if (f.irregular && !String(f.descricao || '').trim() && Date.now() - Date.parse(f.criadoEm || 0) < 180000) return;
      let blob;
      try { blob = await DB.blobGet(f.id); } catch (e) { blob = null; }
      if (!blob) return;
      emitir('sincronizando', { detalhe: 'Enviando foto ' + num + ' de ' + fotos.length + '…' });
      try {
        let b64;
        try { b64 = await Foto.blobParaBase64(blob); } catch (e) {
          // arquivo da foto ilegível neste aparelho: não adianta tentar de novo
          controle[f.id] = { danificada: true, msg: 'arquivo da foto ilegível neste aparelho (' + (e.name || e.message) + ')' };
          await salvarControle();
          Sync.log('foto', 'Foto ' + f.id.slice(0, 8) + ' danificada neste aparelho: ' + (e.message || e.name));
          return;
        }
        let destino = {};
        try { if (root.App && App.infoFotoDrive) destino = await App.infoFotoDrive(f); } catch (e) { /* usa a pasta Fotos */ }
        // "repetida": já houve tentativa (a resposta pode ter se perdido) — só então o servidor procura duplicata
        const repetida = !!(controle[f.id] && (controle[f.id].tentando || controle[f.id].n));
        if (!repetida) { controle[f.id] = { tentando: true }; await salvarControle(); }
        const j = await Sync.chamar('enviarFoto', { id: f.id, registroId: f.registroId, base64: b64, mime: blob.type || 'image/jpeg', pastas: destino.pastas, nome: destino.nome,
          repetida, antiga: String(f.criadoEm || '') < DATA_PASTAS });
        if (!j.driveId) throw new Error('Resposta inesperada do servidor ao enviar foto.');
        await DB.atualizar('fotos', f.id, (a) => {
          if (!a) return undefined;
          // o endereço no Drive entra no controle por campo (assim uma edição feita em outro aparelho não o apaga)
          if (!a._pendente) { a._campos = {}; a._base = {}; a._versaoBase = a.atualizadoEm; } // com a versão de base: o servidor confere conflitos
          if (a._campos) { a._campos.driveId = a.atualizadoEm; if (!('driveId' in (a._base || {}))) a._base = Object.assign({}, a._base, { driveId: 'undefined' }); }
          a.driveId = j.driveId; a._pendente = true;
          return a;
        });
        delete controle[f.id]; await salvarControle();
        feitas++; desdeEnvio++;
      } catch (e) {
        if (e.codigo === 'TOKEN' || e.codigo === 'SEM_ACESSO' || e.codigo === 'PERFIL' || e.semRede || /redirecionado|pediu login/.test(e.message)) { parar = true; throw e; }
        if (e.codigo === 'DRIVE_CHEIO') { res.grave = e.message; parar = true; return; }
        // conexão lenta ou Google ocupado/instável: para nesta rodada SEM contar como defeito da foto
        if (e.tempoEsgotado || e.rede || passageira(e)) { Sync.log('foto', 'Envio de fotos interrompido: ' + e.message); parar = true; res.passageira = true; return; }
        const n = ((controle[f.id] || {}).n || 0) + 1;
        controle[f.id] = { n, proxima: Date.now() + ESPERA_FOTO[Math.min(n - 1, ESPERA_FOTO.length - 1)] * 1000, msg: e.message };
        await salvarControle();
        Sync.log('foto', 'Foto ' + f.id.slice(0, 8) + ' (tentativa ' + n + '): ' + e.message);
        res.falhas.push(e.message);
        if (n >= 4) res.grave = 'Uma foto não consegue ser enviada ao Drive (' + e.message + '). Veja Ajustes › Diagnóstico.';
      }
    }
    let erroParar = null;
    async function trabalhador() {
      try { await trabalhar(); } catch (e) { parar = true; if (!erroParar) erroParar = e; }
    }
    async function trabalhar() {
      while (fila.length && !parar) {
        if (Date.now() - inicio > 4 * 60000) { res.restam = true; pedidoDurante = true; break; } // continua na próxima rodada, logo em seguida
        const f = fila.shift();
        await umaFoto(f, ++i);
        // os colegas passam a ver as fotos já enviadas sem esperar o fim de todas; e o que eles gravarem
        // enquanto isso chega aqui também (antes, só depois de terminar todas as fotos)
        const novidade = novidadeDurante;
        if (((desdeEnvio && (desdeEnvio >= 6 || Date.now() - ultimoEnvio > 45000)) || novidade) && !parar && !enviandoDados) {
          desdeEnvio = 0; ultimoEnvio = Date.now(); enviandoDados = true; novidadeDurante = false;
          try { await enviarAlteracoes(); if (novidade) await receberAlteracoes(); } catch (e) { if (e.rede) { parar = true; throw e; } } finally { enviandoDados = false; }
        }
      }
    }
    // espera os dois terminarem (um erro num deles para o outro, sem deixar envio "solto" em segundo plano)
    try { await Promise.all(Array.from({ length: Math.min(FOTOS_JUNTAS, fila.length) }, trabalhador)); } finally { fotosEmEnvio = false; }
    if (erroParar) throw erroParar;
    return res;
  }

  /* 3.18.7: arquivos dos comentários (atividades.arquivos[]): o arquivo fica no aparelho até ir
     para o Drive (store "arquivos", chave "anx_<id>"); o endereço (driveId) entra no comentário e chega aos outros aparelhos. Servidor 17 ou mais novo. */
  Sync.ANEXO_MIN_SERVIDOR = 17;
  const ESPERA_ANEXO = [60, 300, 1800, 7200];
  async function enviarAnexos() {
    if (perfilAtual() === 'consulta') return;
    if (!((Sync.versaoServidor || 0) >= Sync.ANEXO_MIN_SERVIDOR)) return; // fica no aparelho até o servidor ser atualizado
    const lista = [];
    // comentários da obra (arquivos) e notificações (documentos: assinada, comprovante, resposta… — 3.18.8)
    for (const [store, campo] of [['atividades', 'arquivos'], ['notificacoes', 'documentos']]) {
      for (const a of await DB.all(store)) {
        if (a.excluido || !Array.isArray(a[campo])) continue;
        for (const x of a[campo]) if (x && x.id && !x.driveId) lista.push({ a, x, store, campo });
      }
    }
    if (!lista.length) return;
    const controle = await DB.kvGet('falhasAnexos', {}) || {};
    let n = 0;
    for (const { a, x, store, campo } of lista) {
      const c = controle[x.id];
      if (c && c.proxima > Date.now()) continue;
      let blob = null;
      try { const r = await DB.arquivoGet('anx_' + x.id); blob = r ? r.blob : null; } catch (e) { blob = null; }
      if (!blob) continue; // arquivo de outro aparelho: quem anexou envia
      n++;
      emitir('sincronizando', { detalhe: 'Enviando arquivo ' + n + ' (' + (x.nome || '') + ')…' });
      try {
        const b64 = await Foto.blobParaBase64(blob);
        const repetida = !!(c && (c.tentando || c.n));
        if (!repetida) { controle[x.id] = { tentando: true }; await DB.kvSet('falhasAnexos', controle); }
        const j = await Sync.chamar('enviarAnexo', { id: x.id, base64: b64, mime: blob.type || x.mime || 'application/octet-stream', nome: x.nome, pasta: x.pasta, repetida });
        if (!j.driveId) throw new Error('Resposta inesperada do servidor ao enviar o arquivo.');
        await DB.atualizar(store, a.id, (o) => {
          if (!o || !Array.isArray(o[campo])) return undefined;
          const antes = jsn(o[campo]);
          const alvo = o[campo].find((y) => y.id === x.id); if (!alvo) return undefined;
          alvo.driveId = j.driveId;
          // como uma edição: os outros aparelhos recebem o endereço do arquivo
          if (!o._pendente) { o._campos = {}; o._base = {}; o._versaoBase = o.atualizadoEm; }
          if (o._campos) { if (!(campo in (o._base || {}))) o._base = Object.assign({}, o._base, { [campo]: antes }); o._campos[campo] = DB.carimbo(o.atualizadoEm); }
          o.atualizadoEm = DB.carimbo(o.atualizadoEm); o._pendente = true;
          pedidoDurante = true;
          return o;
        });
        try { await DB.del('arquivos', 'anx_' + x.id); } catch (e) { /* fica no aparelho; sem problema */ }
        delete controle[x.id]; await DB.kvSet('falhasAnexos', controle);
      } catch (e) {
        if (e.codigo === 'TOKEN' || e.codigo === 'SEM_ACESSO' || e.codigo === 'PERFIL' || e.semRede || /redirecionado|pediu login/.test(e.message)) throw e;
        if (e.tempoEsgotado || e.rede || passageira(e)) { Sync.log('arquivo', 'Envio de arquivos interrompido: ' + e.message); return; }
        const k = ((controle[x.id] || {}).n || 0) + 1;
        controle[x.id] = { n: k, proxima: Date.now() + ESPERA_ANEXO[Math.min(k - 1, ESPERA_ANEXO.length - 1)] * 1000, msg: e.message };
        await DB.kvSet('falhasAnexos', controle);
        Sync.log('arquivo', (x.nome || x.id) + ' (tentativa ' + k + '): ' + e.message);
      }
    }
  }
  function igualAoEnviado(a, o) {
    const c = Object.assign({}, a); for (const k of DB.CAMPOS_LOCAIS) delete c[k]; delete c._vb;
    const e = Object.assign({}, o); delete e._vb;
    return JSON.stringify(c) === JSON.stringify(e);
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
        if (MIN_SERVIDOR[e] && !((Sync.versaoServidor || 0) >= MIN_SERVIDOR[e])) continue; // fica pendente até o servidor ser atualizado
        const c = Object.assign({}, o); for (const k of DB.CAMPOS_LOCAIS) delete c[k];
        delete c._vb; // nunca reenvia um valor antigo que tenha ficado gravado (servidor anterior à versão 8)
        if (o._campos && o._versaoBase) c._vb = o._versaoBase; // o servidor confere se ninguém mudou o registro desde então
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
      // recusados pelo servidor (ele tem versão mais nova): tratados abaixo, juntando campo a campo
      for (const e of Object.keys(j.rejeitados || {})) for (const srv of j.rejeitados[e] || []) if (srv && srv.id) falhou.add(e + ':' + srv.id);
      (j.falhas || []).forEach((x) => Sync.log('registro recusado', x.e + ' ' + String(x.id).slice(0, 8) + ': ' + x.erro));
      for (const e of Object.keys(lote)) {
        if (servidorAntigo && e === 'visitas') continue; // servidor desatualizado nao grava visitas: mantem pendente
        // só limpa se o registro continua IGUAL ao que foi enviado (ex.: o endereço da foto no Drive pode ter
        // chegado durante o envio sem mudar a data de alteração — antes ele se perdia). Tudo numa transação só.
        const itensOk = lote[e].filter((o) => !falhou.has(e + ':' + o.id)).map((o) => ({ id: o.id, fn: (a) => {
          if (!a || !a._pendente) return undefined;
          if (a.atualizadoEm === o.atualizadoEm && igualAoEnviado(a, o)) { for (const k of DB.CAMPOS_LOCAIS) delete a[k]; return a; }
          // alterado durante o envio: a base passa a ser o que acabou de ser gravado no servidor
          if (a._campos) { a._versaoBase = o.atualizadoEm; a._base = Object.assign({}, a._base); for (const k of Object.keys(a._campos)) a._base[k] = jsn(o[k]); return a; }
          return undefined;
        } }));
        let rs = null;
        try { rs = await DB.atualizarVarios(e, itensOk); } catch (err) { rs = null; }
        if (!rs || rs.some((r) => r.erro)) for (const it of itensOk) { try { await DB.atualizar(e, it.id, it.fn); } catch (err) { /* continua pendente: vai de novo */ } }
      }
      // o servidor tinha versão mais nova (ou o registro foi excluído por outro aparelho): o aparelho fica igual ao servidor
      for (const e of Object.keys(j.rejeitados || {})) {
        for (const srv of j.rejeitados[e] || []) {
          const enviado = (lote[e] || []).find((x) => x.id === srv.id);
          if (!enviado) continue;
          await DB.atualizar(e, srv.id, (a) => {
            if (!a) return undefined;
            // alterações deste aparelho em campos que o outro não mexeu são mantidas (e reenviadas)
            if (a._pendente && a._campos && !srv.excluido) return mesclar(e, a, srv);
            if (a._pendente && a.atualizadoEm !== enviado.atualizadoEm) return undefined;
            return mesclar(e, a, srv);
          });
          Sync.log('versão do servidor', e + ' ' + String(srv.id).slice(0, 8) + ' — outra alteração mais nova prevaleceu');
        }
      }
      if (servidorAntigo && lote.visitas) throw new Error('Atualize o Code.gs no Apps Script (nova versão) para sincronizar as visitas.');
      // a única gravação nova no servidor foi esta: não precisa receber de novo nem "avisar" a si mesmo
      if (j.ultima && j.ultimaAntes) {
        const visto = await DB.kvGet('vistoServidor', 0);
        if (visto && visto === j.ultimaAntes) { await DB.kvSet('vistoServidor', j.ultima); Sync._ultimaVista = Math.max(Sync._ultimaVista || 0, j.ultima); }
      }
      enviados += n;
    }
  }

  /* Junta a versão do servidor com as alterações ainda não enviadas deste aparelho, campo a campo.
     Campo alterado só aqui: fica o daqui. Campo alterado só lá: fica o de lá. Alterado nos dois: vence a
     alteração mais recente. Exclusão vence sempre. */
  const jsn = (v) => String(JSON.stringify(v));
  const SIS = new Set(['id', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor', '_pendente', '_campos', '_base', '_versaoBase', '_vb']);
  const ehEmitida = (n) => !!n && (n.status === 'emitida' || n.status === 'enviada' || n.status === 'respondida');
  /* listas de itens com "id" (aditivos de prazo, contrarrespostas…): junta item a item — dois aparelhos que
     acrescentaram cada um o seu não perdem nenhum; o que foi tirado aqui (desfazer) continua fora */
  function juntarPorId(baseJson, loc, sv) {
    if (!Array.isArray(loc) || !Array.isArray(sv)) return loc;
    if (![...loc, ...sv].every((x) => x && typeof x === 'object' && x.id)) return loc;
    let base = []; try { base = JSON.parse(baseJson); } catch (err) { base = []; }
    if (!Array.isArray(base)) base = [];
    const mb = new Map(base.filter((x) => x && x.id).map((x) => [x.id, jsn(x)]));
    const ml = new Map(loc.map((x) => [x.id, x]));
    const out = [];
    for (const x of sv) {
      if (ml.has(x.id)) { const l = ml.get(x.id); out.push(mb.has(x.id) && mb.get(x.id) === jsn(l) ? x : l); ml.delete(x.id); } // mexido aqui: fica o daqui
      else if (!mb.has(x.id)) out.push(x); // novo do outro aparelho
      // estava na base e foi tirado aqui: fica fora
    }
    for (const l of ml.values()) if (!mb.has(l.id)) out.push(l); // novo deste aparelho
    return out;
  }
  function mesclar(e, local, srv) {
    const out = Object.assign({}, srv);
    if (local && local.miniatura && !out.miniatura) out.miniatura = local.miniatura;
    if (!local) return out;
    // 3.18.6: notificação emitida em outro aparelho: o rascunho antigo deste aparelho não muda o documento emitido
    if (e === 'notificacoes' && local._pendente && local._campos && !srv.excluido && ehEmitida(srv) && !ehEmitida(local) && !('status' in local._campos)) { // ("Reabrir" muda o status: esse vale)
      Sync.log('notificação emitida em outro aparelho', String(srv.id).slice(0, 8) + ' — alterações do rascunho deste aparelho descartadas');
      for (const k of DB.CAMPOS_LOCAIS) delete out[k];
      return out;
    }
    // e o contrário: emitida AQUI com base num rascunho que outro aparelho mexeu — vale o que foi emitido aqui
    if (e === 'notificacoes' && local._pendente && local._campos && !srv.excluido && ehEmitida(local) && !ehEmitida(srv) && 'status' in local._campos) {
      const campos = {};
      for (const k of new Set([...Object.keys(local), ...Object.keys(srv)])) {
        if (SIS.has(k) || k === 'miniatura') continue;
        if (jsn(local[k]) === jsn(srv[k])) continue;
        if (local[k] === undefined) delete out[k]; else out[k] = local[k];
        campos[k] = local._campos[k] || local.atualizadoEm;
      }
      out._campos = campos; out._base = {}; for (const k of Object.keys(campos)) out._base[k] = jsn(srv[k]);
      out._pendente = true; out._versaoBase = srv.atualizadoEm;
      const ref = String(local.atualizadoEm || '') > String(srv.atualizadoEm || '') ? local.atualizadoEm : srv.atualizadoEm;
      out.atualizadoEm = DB.carimbo(ref); out.atualizadoPor = local.atualizadoPor || srv.atualizadoPor;
      pedidoDurante = true;
      return out;
    }
    // não perde o endereço da foto no Drive por causa de uma edição feita em outro aparelho
    let pend = false;
    if (e === 'fotos' && local.driveId && !out.driveId) { out.driveId = local.driveId; pend = true; }
    const campos = {}, base = {};
    if (local._pendente && local._campos && !srv.excluido) {
      const tSrv = Date.parse(srv.atualizadoEm) || 0;
      for (const k of Object.keys(local._campos)) {
        if (k === 'driveId' && out.driveId) continue;
        const sv = jsn(srv[k]);
        if (sv === jsn(local[k])) continue;
        const servidorMudou = local._base && k in local._base && sv !== local._base[k];
        const lista = servidorMudou && Array.isArray(local[k]) && Array.isArray(srv[k]) ? juntarPorId(local._base[k], local[k], srv[k]) : null;
        if (lista && lista !== local[k]) { out[k] = lista; if (jsn(lista) !== sv) { campos[k] = local._campos[k]; base[k] = sv; } continue; }
        if (servidorMudou && tSrv > (Date.parse(local._campos[k]) || 0)) continue; // os dois mexeram: vale a mais recente
        if (local[k] === undefined) delete out[k]; else out[k] = local[k];
        campos[k] = local._campos[k]; base[k] = sv;
      }
    }
    if (Object.keys(campos).length) {
      out._campos = campos; out._base = base; out._pendente = true; out._versaoBase = srv.atualizadoEm;
      const ref = String(local.atualizadoEm || '') > String(srv.atualizadoEm || '') ? local.atualizadoEm : srv.atualizadoEm;
      out.atualizadoEm = DB.carimbo(ref); out.atualizadoPor = local.atualizadoPor || srv.atualizadoPor;
      pedidoDurante = true;
    } else if (pend) { out._pendente = true; pedidoDurante = true; }
    // perfil "consulta" não envia nada: não deixa registros marcados como pendentes para sempre
    if (perfilAtual() === 'consulta') for (const k of DB.CAMPOS_LOCAIS) delete out[k];
    return out;
  }
  // prepara o registro recebido e devolve a função que o junta com o do aparelho (para DB.atualizar/atualizarVarios)
  function prepararRecebido(e, o, marca) {
    if (o && '_vb' in o) { o = Object.assign({}, o); delete o._vb; }
    // LGPD: CPF do representante não é mais guardado (servidor ainda não atualizado pode mandar)
    if (o && (e === 'registros' || e === 'notificacoes' || e === 'medicoes')) {
      if ('n_representante_cpf' in o) { o = Object.assign({}, o); delete o.n_representante_cpf; }
      if (o.registroSnapshot && typeof o.registroSnapshot === 'object' && 'n_representante_cpf' in o.registroSnapshot) { o = Object.assign({}, o, { registroSnapshot: Object.assign({}, o.registroSnapshot) }); delete o.registroSnapshot.n_representante_cpf; }
    }
    return { id: o.id, fn: (local) => {
      if (local) {
        // mesma versao que o aparelho ja tem: nada a fazer
        if (!local._pendente && String(local.atualizadoEm) === String(o.atualizadoEm) && !!local.excluido === !!o.excluido && (e !== 'fotos' || !o.driveId || local.driveId === o.driveId)) return undefined;
        // 3.18.6: cópia mais antiga do que a que o aparelho já tem (ex.: recebida antes e guardada para gravar depois): ignora
        if (!local._pendente && !o.excluido && String(local.atualizadoEm || '') > String(o.atualizadoEm || '')) return undefined;
        // exclusao e definitiva: uma copia antiga do servidor nao "ressuscita" o que foi excluido aqui
        if (local.excluido && !o.excluido) {
          if (local._pendente) return undefined;
          local._pendente = true; local.atualizadoEm = DB.carimbo(o.atualizadoEm); pedidoDurante = true;
          return local;
        }
        if (local._pendente && !o.excluido) {
          // alterações ainda não enviadas: junta campo a campo (registros de versões antigas: vence a mais nova)
          if (local._campos) { marca.mudou = true; return mesclar(e, local, o); }
          if (String(local.atualizadoEm) > String(o.atualizadoEm)) return undefined;
        }
      }
      marca.mudou = true;
      return mesclar(e, local, o);
    } };
  }
  async function aplicarRecebido(e, o) {
    const marca = { mudou: false };
    const it = prepararRecebido(e, o, marca);
    await DB.atualizar(e, it.id, it.fn);
    return marca.mudou;
  }
  /* Uma página inteira de uma entidade numa transação só (antes: uma transação por registro — a primeira
     sincronização de um aparelho novo, com milhares de registros, levava minutos). Se a transação falhar,
     tenta um a um. Devolve quantos mudaram e os que não puderam ser gravados. */
  async function aplicarRecebidos(e, lista) {
    const marcas = lista.map(() => ({ mudou: false }));
    const itens = lista.map((o, i) => prepararRecebido(e, o, marcas[i]));
    let res = null;
    try { res = await DB.atualizarVarios(e, itens); } catch (err) { res = null; }
    let total = 0; const falhos = [];
    if (res) {
      res.forEach((r, i) => { if (r.erro) falhos.push({ o: lista[i], erro: r.erro }); else if (marcas[i].mudou) total++; });
      return { total, falhos };
    }
    for (const o of lista) {
      try { if (await aplicarRecebido(e, o)) total++; } catch (err) { falhos.push({ o, erro: err }); }
    }
    return { total, falhos };
  }

  async function receberAlteracoes() {
    // cursor vale para um servidor/planilha: se mudou, baixa tudo de novo
    const url = Sync.config().apiUrl;
    if ((await DB.kvGet('cursorUrl', null)) !== url) { await DB.kvSet('servidorDesde', 0); await DB.kvSet('cursorUrl', url); }
    let total = 0;
    // registros recebidos antes que não puderam ser gravados no aparelho
    const falhos = await DB.kvGet('recebidosFalhos', {}) || {};
    for (const k of Object.keys(falhos)) {
      try { if (await aplicarRecebido(falhos[k].e, falhos[k].o)) total++; delete falhos[k]; } catch (err) { /* tenta na próxima */ }
    }
    await DB.kvSet('recebidosFalhos', falhos);
    for (let pagina = 0; pagina < 300; pagina++) {
      const desde = await DB.kvGet('servidorDesde', 0);
      const j = await Sync.chamar('receber', { desde, visto: await DB.kvGet('vistoServidor', 0) });
      if (!j.dados) throw new Error('Resposta inesperada do servidor ao receber dados.');
      if (j.planilha) {
        const ant = await DB.kvGet('planilhaId', null);
        if (ant !== j.planilha) {
          await DB.kvSet('planilhaId', j.planilha);
          if (ant && desde) { Sync.log('aviso', 'Planilha do servidor mudou: baixando tudo de novo'); await DB.kvSet('servidorDesde', 0); continue; }
        }
      }
      for (const e of ENTIDADES) {
        const lista = (j.dados[e] || []).filter((o) => o && o.id);
        if (!lista.length) continue;
        const r = await aplicarRecebidos(e, lista);
        total += r.total;
        const ruins = new Set(r.falhos.map((f) => f.o.id));
        let tirou = false;
        for (const o of lista) if (!ruins.has(o.id) && falhos[e + ':' + o.id]) { delete falhos[e + ':' + o.id]; tirou = true; }
        if (tirou) { try { await DB.kvSet('recebidosFalhos', falhos); } catch (err) { /* */ } }
        for (const f of r.falhos) {
          // não conseguiu gravar no aparelho (memória cheia, app em segundo plano…): guarda para tentar de novo
          // (antes o registro era pulado para sempre, porque o cursor avançava)
          falhos[e + ':' + f.o.id] = { e, o: f.o };
          Sync.log('erro ao gravar recebido', e + ' ' + String(f.o.id).slice(0, 8) + ': ' + ((f.erro && f.erro.message) || f.erro));
        }
      }
      if (Object.keys(falhos).length) { try { await DB.kvSet('recebidosFalhos', falhos); } catch (err) { continue; /* nem isso: repete a página */ } }
      await DB.kvSet('servidorDesde', j.servidorAgora);
      await DB.kvSet('vistoServidor', j.mais ? 0 : (j.ultima || 0)); // última gravação já recebida por inteiro
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
    if (semNovidades || (emAndamento && !fotosEmEnvio) || falhasSeguidas > 0 || !Sync.habilitado() || !navigator.onLine || (root.document && document.visibilityState !== 'visible')) return;
    if (!Sync.token() || Sync.estado === 'login' || Sync.estado === 'sem_acesso') return; // nunca abre tela de login sozinho
    try {
      const j = await chamarUmaVez('novidades');
      if (j && typeof j.ultima === 'number') { Sync._srvUltima = j.ultima; Sync._novidadesEm = Date.now(); }
      if (!Sync._ultimaVista) Sync._ultimaVista = j.ultima; // primeira consulta: a sincronização normal já acontece ao abrir
      else if (j.ultima > Sync._ultimaVista) {
        Sync._atividade = Date.now();
        if (emAndamento && fotosEmEnvio) { novidadeDurante = true; return; } // recebe no intervalo entre as fotos
        Sync.log('novidades', 'Outro aparelho gravou dados — sincronizando'); Sync.sincronizar();
      }
    } catch (e) {
      if (/desconhecida/i.test(e.message || '')) semNovidades = true; // servidor antigo: fica só com a sincronização a cada 5 min
    }
  };
  // a cada 10 s quando há movimento (alguém gravou algo nos últimos 5 min); senão a cada 20 s
  Sync._atividade = 0;
  let ultimaConsulta = 0;
  setInterval(() => {
    const ritmo = Date.now() - Math.max(Sync._atividade, Sync._ultimaVista || 0) < 300000 ? 10000 : 20000;
    if (Date.now() - ultimaConsulta < ritmo - 500) return;
    ultimaConsulta = Date.now();
    Sync.verificarNovidades();
  }, 5000);

  root.addEventListener('online', () => { Sync.log('conexão', 'internet voltou'); Sync.sincronizar({ forcar: true }); });
  // ao voltar para o app (iPhone/Android suspendem o app em segundo plano): sincroniza se já faz um tempo
  const aoVoltar = () => { if (document.visibilityState === 'visible' && Sync.habilitado() && navigator.onLine && Date.now() - Sync.ultimaTentativa > 20000) Sync.sincronizar({ forcar: true }); };
  if (root.document) { document.addEventListener('visibilitychange', aoVoltar); root.addEventListener('pageshow', aoVoltar); root.addEventListener('focus', aoVoltar); }
  root.addEventListener('offline', () => {
    // a conexao caiu: cancela os pedidos em andamento para a sincronizacao nao ficar presa esperando
    emVoo.forEach((c) => { c.semRede = true; c.abort(); });
    emitir('offline');
  });
  root.Sync = Sync;
})(self);
