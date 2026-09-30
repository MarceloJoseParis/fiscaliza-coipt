/* Login Google + sincronizacao com o backend (Google Apps Script) */
(function (root) {
  const ENTIDADES = ['pessoas', 'registros', 'visitas', 'notificacoes', 'fotos', 'config'];
  const Sync = { estado: 'offline', usuario: null, erro: null };
  const ouvintes = new Set();
  let gisCarregado = null;
  let emAndamento = null;

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
  Sync.chamar = async function (acao, dados) {
    const cfg = Sync.config();
    if (!cfg.apiUrl) throw new Error('Servidor não configurado.');
    let token = Sync.token() || (await Sync.renovarToken());
    if (!token) { emitir('login'); throw new Error('Faça login com sua conta Google para sincronizar.'); }
    const resp = await fetch(cfg.apiUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ acao, token }, dados || {})),
    });
    if (!resp.ok) throw new Error('Servidor respondeu ' + resp.status);
    const txt = await resp.text();
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
      throw new Error(j.erro || 'Erro no servidor');
    }
    return j;
  };

  Sync.quemSou = async function () {
    const j = await Sync.chamar('quemSou');
    if (!j.usuario) throw new Error('Resposta inesperada do servidor (quemSou).');
    const u = Object.assign({}, Sync.usuarioLocal() || {}, j.usuario);
    localStorage.setItem('usuario', JSON.stringify(u));
    Sync.usuario = u;
    emitir('ok');
    return u;
  };

  /* ---------------- Sincronizacao ---------------- */
  Sync.sincronizar = function () {
    if (emAndamento) return emAndamento;
    emAndamento = (async () => {
      if (!Sync.habilitado()) { emitir('local'); return; }
      if (!navigator.onLine) { emitir('offline'); return; }
      emitir('sincronizando');
      try {
        if (!Sync.token()) {
          const t = await Sync.renovarToken();
          if (!t) { emitir('login'); return; }
        }
        if (!Sync.usuario || !Sync.usuario.perfil) await Sync.quemSou();
        await enviarFotos();
        await enviarAlteracoes();
        await receberAlteracoes();
        await sincronizarModelos();
        await DB.kvSet('ultimaSync', new Date().toISOString());
        emitir('ok', { erro: null });
      } catch (e) {
        console.error(e);
        if (Sync.estado === 'sincronizando') emitir('erro', { erro: e.message });
      } finally {
        emAndamento = null;
      }
    })();
    return emAndamento;
  };

  async function enviarFotos() {
    const fotos = (await DB.all('fotos')).filter((f) => !f.driveId && !f.excluido);
    for (const f of fotos) {
      const blob = await DB.blobGet(f.id);
      if (!blob) continue;
      emitir('sincronizando', { detalhe: 'Enviando fotos…' });
      const b64 = await Foto.blobParaBase64(blob);
      const j = await Sync.chamar('enviarFoto', { id: f.id, registroId: f.registroId, base64: b64, mime: blob.type || 'image/jpeg' });
      if (!j.driveId) throw new Error('Resposta inesperada do servidor ao enviar foto.');
      const atual = await DB.get('fotos', f.id);
      atual.driveId = j.driveId;
      atual._pendente = true;
      await DB.put('fotos', atual);
    }
  }

  async function enviarAlteracoes() {
    const lote = {};
    let total = 0;
    for (const e of ENTIDADES) {
      const pend = (await DB.all(e)).filter((o) => o._pendente);
      if (pend.length) {
        lote[e] = pend.map((o) => { const c = Object.assign({}, o); delete c._pendente; return c; });
        total += pend.length;
      }
    }
    if (!total) return;
    emitir('sincronizando', { detalhe: 'Enviando ' + total + ' alteração(ões)…' });
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
    return j;
  }

  async function receberAlteracoes() {
    const desde = await DB.kvGet('servidorDesde', 0);
    const j = await Sync.chamar('receber', { desde });
    if (!j.dados) throw new Error('Resposta inesperada do servidor ao receber dados.');
    let n = 0;
    for (const e of ENTIDADES) {
      for (const o of (j.dados[e] || [])) {
        const local = await DB.get(e, o.id);
        if (local && local._pendente && local.atualizadoEm > o.atualizadoEm) continue;
        if (local && local.miniatura && !o.miniatura) o.miniatura = local.miniatura;
        await DB.put(e, o);
        n++;
      }
    }
    await DB.kvSet('servidorDesde', j.servidorAgora);
    if (n && root.App && App.aoReceberDados) App.aoReceberDados(n);
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
  root.addEventListener('offline', () => emitir('offline'));
  root.Sync = Sync;
})(self);
