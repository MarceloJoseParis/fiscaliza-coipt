/* Aplicativo de Notificações Extrajudiciais - interface */
(function () {
  'use strict';
  const X = Extenso;
  const $main = document.getElementById('main');
  const App = (window.App = {});

  /* ================================================================== */
  /* Utilitarios                                                         */
  /* ================================================================== */
  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const f of filhos.flat(Infinity)) {
      if (f === null || f === undefined || f === false) continue;
      el.appendChild(f instanceof Node ? f : document.createTextNode(String(f)));
    }
    return el;
  }
  const limpar = (k) => k.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false);
  const rc = (el, ...k) => el.replaceChildren(...limpar(k));
  const ap = (el, ...k) => el.append(...limpar(k));

  const prefCamera = () => { try { return localStorage.getItem('camera_pref') || 'app'; } catch (e) { return 'app'; } };
  function aplicarTema(t) {
    try { localStorage.setItem('tema', t); } catch (e) { /* */ }
    const escuro = t === 'escuro' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light');
    const m = document.getElementById('meta-tema');
    if (m) m.setAttribute('content', escuro ? '#171a20' : '#ffffff');
  }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { let t = 'auto'; try { t = localStorage.getItem('tema') || 'auto'; } catch (e) { /* */ } if (t === 'auto') aplicarTema('auto'); });

  function toast(msg, erro) {
    const t = h('div', { class: 'toast' + (erro ? ' erro' : '') }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), erro ? 5000 : 2600);
  }

  function modal(titulo, conteudo, botoes) {
    return new Promise((resolve) => {
      const fundo = h('div', { class: 'modal-fundo' });
      const fechar = (v) => { fundo.remove(); resolve(v); };
      const acoes = h('div', { class: 'acoes', style: { justifyContent: 'flex-end', marginTop: '14px' } },
        (botoes || [{ txt: 'OK', valor: true, cls: 'pri' }]).map((b) => h('button', {
          class: 'btn ' + (b.cls || ''),
          onclick: async () => {
            if (b.antes) { const ok = await b.antes(); if (ok === false) return; }
            fechar(typeof b.valor === 'function' ? b.valor() : b.valor);
          },
        }, b.txt)));
      const m = h('div', { class: 'modal' }, titulo ? h('h2', {}, titulo) : null, conteudo, acoes);
      fundo.appendChild(m);
      fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(undefined); });
      document.body.appendChild(fundo);
      const f = m.querySelector('input,textarea,select');
      if (f) setTimeout(() => f.focus(), 50);
    });
  }
  const confirmar = (msg, txtOk, perigo) => modal('Confirmar', h('p', {}, msg), [
    { txt: 'Cancelar', valor: false }, { txt: txtOk || 'Confirmar', valor: true, cls: perigo ? 'perigo' : 'pri' }]);
  async function perguntarNumero(titulo, texto, valorInicial) {
    const inp = h('input', { type: 'number', min: '0', step: '1', value: valorInicial != null ? valorInicial : '' });
    const r = await modal(titulo, h('div', {}, h('p', {}, texto), inp), [
      { txt: 'Cancelar', valor: null }, { txt: 'Continuar', cls: 'pri', valor: () => inp.value }]);
    if (r === null || r === undefined || r === '') return null;
    return Math.max(0, parseInt(r, 10) || 0);
  }

  function campo(rotulo, input, dica) {
    return h('label', { class: 'campo' }, h('span', {}, rotulo), input, dica ? h('div', { class: 'dica' }, dica) : null);
  }
  /* campo sem <label>: necessario quando o conteudo tem varios botoes (um <label> repassa o clique ao 1o botao) */
  function campoBloco(rotulo, conteudo, dica) {
    return h('div', { class: 'campo-bloco' }, h('span', {}, rotulo), conteudo, dica ? h('div', { class: 'dica' }, dica) : null);
  }
  function inputTxt(obj, chave, attrs) {
    return h('input', Object.assign({ type: 'text', value: obj[chave] == null ? '' : obj[chave], oninput: (e) => { obj[chave] = e.target.value; } }, attrs || {}));
  }
  function inputArea(obj, chave, attrs) {
    const t = h('textarea', Object.assign({ oninput: (e) => { obj[chave] = e.target.value; } }, attrs || {}));
    t.value = obj[chave] == null ? '' : obj[chave];
    return t;
  }

  function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nome });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  }
  async function compartilharBlob(blob, nome, texto) {
    const file = new File([blob], nome, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nome, text: texto || nome }); return true; } catch (e) { if (e.name === 'AbortError') return true; }
    }
    baixarBlob(blob, nome);
    return false;
  }
  function nomeArquivo(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim(); }
  const dataHoraBR = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const ROTULO = { contrato: 'Contrato', convenio: 'Convênio' };
  // data/hora completa (ISO em UTC) -> data local dd/mm/aaaa (evita trocar o dia depois das 20h)
  const dataLocalBR = (iso) => { if (!iso) return ''; const s = String(iso); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return X.dataBR(s); const d = new Date(s); return isNaN(d) ? '' : X.dataBR(d); };
  const PLURAL = { contrato: 'Contratos', convenio: 'Convênios' };

  /* ---------- Status da obra ---------- */
  const STATUS_OBRA = {
    contrato: ['Obra não iniciada', 'Em execução', 'Paralisada', 'Contrato rescindido', 'Sem vigência', 'Em recebimento provisório', 'Obra concluída'],
    convenio: ['Em licitação', 'Obra não iniciada', 'Em execução', 'Paralisada', 'Contrato rescindido', 'Contrato rescindido – em processo de relicitação', 'Sem vigência', 'Em prestação de contas', 'Obra concluída'],
  };
  const COR_STATUS = {
    'Em execução': 'ok', 'Obra concluída': 'ok', 'Obra não iniciada': 'neutro', 'Em licitação': 'info', 'Em recebimento provisório': 'info', 'Em prestação de contas': 'info',
    'Paralisada': 'alerta', 'Contrato rescindido': 'perigo', 'Contrato rescindido – em processo de relicitação': 'perigo', 'Sem vigência': 'perigo',
  };
  const etq = (txt, cls, title) => h('span', { class: 'etq ' + (cls || ''), title: title || null }, txt);
  const etqStatus = (r) => (r.status_obra ? etq(r.status_obra, COR_STATUS[r.status_obra] || '') : null);

  /* ---------- Prazos em dias corridos (execução / vigência) ---------- */
  function diasAte(iso) {
    if (!iso) return null;
    const hoje = new Date(X.hojeISO() + 'T00:00:00'), d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return null;
    return Math.round((d - hoje) / 86400000);
  }
  function infoPrazo(iso) {
    const n = diasAte(iso);
    if (n === null) return null;
    const txt = n > 1 ? 'faltam ' + n + ' dias' : n === 1 ? 'falta 1 dia' : n === 0 ? 'termina hoje' : 'vencido há ' + -n + (n === -1 ? ' dia' : ' dias');
    return { n, txt, cls: n < 0 ? 'perigo' : n <= 30 ? 'alerta' : 'ok' };
  }
  function prazosDoRegistro(r) {
    const out = [];
    if (r.tipo === 'contrato' && r.prazo_execucao) out.push({ rot: 'Execução', data: r.prazo_execucao, info: infoPrazo(r.prazo_execucao) });
    if (r.vigencia) out.push({ rot: r.tipo === 'convenio' ? 'Vigência do Convênio' : 'Vigência Contratual', data: r.vigencia, info: infoPrazo(r.vigencia) });
    // obra encerrada (concluída, rescindida, sem vigência): prazo vencido não é alerta
    const encerrada = ['Obra concluída', 'Contrato rescindido', 'Contrato rescindido – em processo de relicitação', 'Sem vigência'].includes(r.status_obra);
    return out.filter((p) => p.info).map((p) => (encerrada && p.info.n < 0 ? Object.assign({}, p, { info: Object.assign({}, p.info, { cls: '' }) }) : p));
  }

  /* ---------- Prazo das notificações (dias úteis, a partir do dia seguinte ao envio) ---------- */
  const isoDe = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function feriados() {
    const set = new Set();
    String((CONFIG && CONFIG.feriados) || '').split(/[\n,;]+/).forEach((t) => {
      t = t.trim();
      let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
      if (m) set.add(m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'));
      else if ((m = /\d{4}-\d{2}-\d{2}/.exec(t))) set.add(m[0]);
    });
    return set;
  }
  function ehDiaUtil(d, fer) { const w = d.getDay(); return w !== 0 && w !== 6 && !fer.has(isoDe(d)); }
  function prazoFinalUteis(isoEnvio, dias) {
    const fer = feriados();
    const d = new Date(String(isoEnvio).slice(0, 10) + 'T12:00:00');
    let c = 0;
    while (c < Math.max(1, +dias || 3)) { d.setDate(d.getDate() + 1); if (ehDiaUtil(d, fer)) c++; }
    return isoDe(d);
  }
  function uteisRestantes(isoFim) {
    if (!isoFim || isNaN(new Date(String(isoFim).slice(0, 10) + 'T12:00:00'))) return 0;
    const fer = feriados();
    const hoje = new Date(X.hojeISO() + 'T12:00:00'), fim = new Date(String(isoFim).slice(0, 10) + 'T12:00:00');
    if (fim < hoje) return -Math.round((hoje - fim) / 86400000); // negativo = dias corridos de atraso
    let c = 0; const d = new Date(hoje);
    while (d < fim) { d.setDate(d.getDate() + 1); if (ehDiaUtil(d, fer)) c++; }
    return c;
  }
  const quemResponde = (tipo) => (tipo === 'convenio' ? 'a prefeitura' : 'a empresa');
  /* situação de uma notificação: rascunho, emitida sem envio, aguardando resposta, prazo encerrado, respondida */
  function situacaoNotif(n) {
    if (n.status !== 'emitida') return { k: 'rascunho', txt: 'Rascunho', cls: 'alerta', ordem: 4 };
    if (!n.enviadaEm) return { k: 'nao_enviada', txt: 'Emitida · não enviada', cls: 'info', ordem: 2 };
    if (n.respondidaEm) {
      const atraso = n.prazoFinal && n.respondidaEm > n.prazoFinal;
      return { k: 'respondida', txt: 'Respondida em ' + X.dataBR(n.respondidaEm) + (atraso ? ' (fora do prazo)' : ''), cls: 'ok', ordem: 3 };
    }
    const pf = n.prazoFinal || prazoFinalUteis(n.enviadaEm, n.prazoDiasEnvio || n.prazo_dias);
    const r = uteisRestantes(pf);
    if (r < 0) return { k: 'vencida', txt: 'Prazo encerrado em ' + X.dataBR(pf) + ' (há ' + -r + (r === -1 ? ' dia)' : ' dias)'), cls: 'perigo', ordem: 0, restante: r };
    return { k: 'aguardando', txt: r === 0 ? 'Prazo termina hoje' : r === 1 ? 'Falta 1 dia útil' : 'Faltam ' + r + ' dias úteis', cls: r <= 1 ? 'alerta' : 'info', ordem: 1, restante: r };
  }

  /* ================================================================== */
  /* Estado, usuario e permissoes                                        */
  /* ================================================================== */
  let CONFIG = null;
  App.usuario = () => (Sync.habilitado() ? (Sync.usuario || Sync.usuarioLocal()) : { email: 'local', nome: 'Este aparelho', perfil: 'admin' });
  const email = () => (App.usuario() || {}).email || '';
  const perfil = () => (App.usuario() || {}).perfil || (Sync.habilitado() ? 'consulta' : 'admin');
  const pode = {
    cadastro: () => perfil() === 'admin',
    notificar: () => perfil() === 'admin' || perfil() === 'fiscal',
    coletar: () => perfil() === 'admin' || perfil() === 'fiscal',
    admin: () => perfil() === 'admin',
  };

  const CONFIG_PADRAO = {
    id: 'geral',
    fiscais_padrao: [],
    coordenadores_padrao: [],
    prazo_padrao: 3,
    formato_numero: { convenio: '{seq3}/{ano}/CIPISNP/DRE-SINOP', contrato: '{ordinal2}' },
    seq_base: {},
    constatacao_padrao: {
      contrato: 'foram constatadas irregularidades na execução da referida obra, o que compromete muito a qualidade esperada, como demonstrado a seguir:',
      convenio: 'foram constatadas as seguintes irregularidades:',
    },
    providencias_padrao: {
      contrato: '',
      convenio: 'Diante das irregularidades constatadas, a **{nome_texto} deverá notificar formalmente a empresa contratada,** solicitando esclarecimentos e a apresentação de cronograma atualizado para regularização das pendências apontadas, sem afetar o prazo inicialmente pactuado.',
    },
    funcao_padrao: { convenio: ['Fiscal do Convênio'], contrato: ['Fiscal do Contrato', 'Fiscal Suplente do Contrato'] },
    modelos: {},
    pasta_fotos: '{tipo}-{numero}/{data}',
    feriados: '',
  };

  const PESSOAS_INICIAIS = [
    { id: 'p-marcelo', papel: 'fiscal', nome: 'Marcelo Jose Paris', tratamento: 'Eng. Eletricista', cargo: 'Engenheiro Eletricista – CREA 49297/MT', lotacao: 'CIPI-SNP/SEDUC/MT', extra: '' },
    { id: 'p-talison', papel: 'fiscal', nome: 'Talison Iago Limberger Battirola', tratamento: 'Eng. Civil', cargo: 'Engenheiro Civil – CREA 48846/MT', lotacao: 'CIPI-SNP/SEDUC/MT', extra: '' },
    { id: 'p-hiago', papel: 'fiscal', nome: 'Hiago de Souza Valério da Silva', tratamento: 'Eng. Civil', cargo: 'Engenheiro Civil – CREA 40530/MT', lotacao: 'CIPI-SNP/SEDUC/MT', extra: '' },
    { id: 'p-norberto', papel: 'coordenador', nome: 'Norberto G. Ribeiro Júnior', tratamento: '', cargo: 'Coordenador de Infraestrutura, Patrimônio e TI', lotacao: 'CIPI-SNP/SEDUC/MT', extra: '' },
    { id: 'p-andressa', papel: 'coordenador', nome: 'Andressa Midori Yamauchi Baufleur', tratamento: '', cargo: 'Coordenadora de Execução de Obras', lotacao: 'COEX/SUOB/SAIP/SEDUC/MT', extra: '' },
  ];

  async function carregarConfig() {
    let c = await DB.get('config', 'geral');
    if (!c) {
      c = JSON.parse(JSON.stringify(CONFIG_PADRAO));
      c.fiscais_padrao = ['p-talison', 'p-hiago', 'p-marcelo'];
      c.coordenadores_padrao = ['p-norberto', 'p-andressa'];
      if (!Sync.habilitado()) {
        await DB.salvar('config', c, email());
        for (const p of PESSOAS_INICIAIS) {
          if (!(await DB.get('pessoas', p.id))) await DB.salvar('pessoas', Object.assign({}, p), email());
        }
      }
    }
    // garante chaves novas
    for (const k of Object.keys(CONFIG_PADRAO)) if (c[k] === undefined) c[k] = JSON.parse(JSON.stringify(CONFIG_PADRAO[k]));
    CONFIG = c;
    return c;
  }
  App.config = () => CONFIG;

  /* Pasta e nome da foto no Google Drive (ex.: Fotos/Conv-013-2023/29.09.2026/14.21.05 - IRREGULARIDADE - ....jpg).
     A mesma regra existe no Code.gs (segmentosFoto_), usada para organizar fotos antigas. */
  const doisDig = (n) => String(n).padStart(2, '0');
  function segmentosPasta(f, r, v, padrao) {
    r = r || {};
    let iso = v && v.data;
    if (!iso) { const d = new Date(f.dataHora || Date.now()); iso = d.getFullYear() + '-' + doisDig(d.getMonth() + 1) + '-' + doisDig(d.getDate()); }
    const d = String(iso).split('-');
    const val = {
      tipo: r.tipo === 'convenio' ? 'Conv' : 'Contr',
      numero: nomeArquivo(r.numero || r.apelido || 'sem-numero'),
      apelido: nomeArquivo(r.apelido || ''),
      data: d.length === 3 ? d[2] + '.' + d[1] + '.' + d[0] : 'sem-data',
      ano: d[0] || '',
      visita: v ? 'Visita ' + v.numero : 'Sem visita',
    };
    return String(padrao || CONFIG_PADRAO.pasta_fotos).split('/').map((seg) => nomeArquivo(seg.replace(/\{(\w+)\}/g, (m, k) => (val[k] != null ? val[k] : '')))).filter(Boolean);
  }
  App.infoFotoDrive = async function (f) {
    const r = await DB.get('registros', f.registroId);
    const v = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
    const dt = f.dataHora ? new Date(f.dataHora) : null;
    const hora = dt ? doisDig(dt.getHours()) + '.' + doisDig(dt.getMinutes()) + '.' + doisDig(dt.getSeconds()) : '';
    const nome = [hora, f.irregular ? 'IRREGULARIDADE' : '', String(f.descricao || '').slice(0, 60)].filter(Boolean).join(' - ');
    return { pastas: segmentosPasta(f, r, v, (CONFIG || {}).pasta_fotos), nome: nomeArquivo(nome) };
  };

  /* ================================================================== */
  /* Sincronizacao - indicador                                           */
  /* ================================================================== */
  const chip = document.getElementById('chip-sync');
  const txtSync = document.getElementById('txt-sync');
  const TXT_ESTADO = { local: 'Neste aparelho', ok: 'Sincronizado', sincronizando: 'Sincronizando…', erro: 'Erro ao sincronizar', offline: 'Offline', login: 'Entrar', sem_acesso: 'Sem acesso' };
  // contar pendências lê o banco inteiro: no máximo a cada 3 s (o rótulo muda na hora)
  let pendCache = 0, contagemEm = 0, timerContagem = null;
  function desenharChip() {
    const st = Sync.habilitado() ? (navigator.onLine ? Sync.estado : 'offline') : 'local';
    chip.className = 'chip-sync ' + st;
    const rot = st === 'offline' && navigator.onLine && Sync.habilitado() ? 'Sem conexão' : (TXT_ESTADO[st] || st);
    txtSync.textContent = rot + (pendCache && st !== 'sincronizando' ? ' · ' + pendCache + ' pend.' : '');
  }
  async function contarPendentes() {
    contagemEm = Date.now();
    let pend = 0;
    try { if (Sync.habilitado()) for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config']) pend += (await DB.all(e)).filter((o) => o._pendente).length; } catch (e) { /* */ }
    pendCache = pend;
    desenharChip();
  }
  function atualizarChip() {
    desenharChip();
    clearTimeout(timerContagem);
    timerContagem = setTimeout(contarPendentes, Math.max(0, 3000 - (Date.now() - contagemEm)));
  }
  Sync.on(() => {
    atualizarChip();
    if (Sync.estado === 'sem_acesso' && !App._semAcesso) { App._semAcesso = true; rotear(); return; }
    if (Sync.estado === 'ok' && App._semAcesso) { App._semAcesso = false; rotear(); return; }
    if (App._login && Sync.estado === 'ok' && (Sync.usuario || Sync.usuarioLocal())) { App._login = false; rotear(); }
  });
  chip.addEventListener('click', () => {
    if (!Sync.habilitado()) { toast('Modo local: os dados ficam só neste aparelho. Veja Ajustes para ativar o compartilhamento.'); return; }
    if (Sync.estado === 'login' || !Sync.token()) { location.hash = '#/config'; return; }
    if ((Sync.estado === 'erro' || Sync.estado === 'offline') && Sync.erro) toast(Sync.erro, Sync.estado === 'erro');
    Sync.sincronizar();
  });
  let timerSync = null;
  App.agendarSync = function () {
    atualizarChip();
    if (!Sync.habilitado()) return;
    clearTimeout(timerSync);
    timerSync = setTimeout(() => Sync.sincronizar(), 2500);
  };
  App.aoReceberDados = async function () {
    await carregarConfig();
    await repararConsistencia();
    verificarPrazos();
    const r = location.hash;
    if (document.querySelector('.modal-fundo') || document.querySelector('.cv')) return; // não mexe na tela com janela ou câmera abertas
    if (!/notificacao|editar|novo|config|visita|coleta|irregularidade/.test(r)) rotear();
    else if (App._atualizarTela) { try { await App._atualizarTela(); } catch (e) { /* */ } } // telas com edição: atualiza só as partes seguras
  };

  /* ================================================================== */
  /* Roteador                                                            */
  /* ================================================================== */
  const btnVoltar = document.getElementById('btn-voltar');
  btnVoltar.addEventListener('click', () => history.back());
  function titulo(t, voltar) {
    document.getElementById('titulo').textContent = t;
    btnVoltar.classList.toggle('oculto', !voltar);
  }
  function marcarNav(r) {
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.r === r));
  }

  async function rotear() {
    App._atualizarTela = null;
    if (App._sairNotif) { const f = App._sairNotif; App._sairNotif = null; try { await f(); } catch (e) { console.error(e); } }
    const partes = (location.hash || '#/contratos').slice(2).split('/');
    const [r, a, b] = partes;
    window.scrollTo(0, 0);
    document.querySelectorAll('.fab').forEach((f) => f.remove());
    if (Sync.habilitado() && !App.usuario() && r !== 'config') return telaLogin();
    if (Sync.habilitado() && Sync.estado === 'sem_acesso' && r !== 'config') return telaLogin(Sync.erro);
    try {
      if (r === 'contratos' || r === 'convenios' || !r) { marcarNav(r || 'contratos'); return await telaLista(r === 'convenios' ? 'convenio' : 'contrato'); }
      if (r === 'registro') { return await telaRegistro(a); }
      if (r === 'editar') { return await telaFormRegistro(a); }
      if (r === 'novo') { return await telaFormRegistro(null, a); }
      if (r === 'notificacao') { return await telaNotificacao(a); }
      if (r === 'nova-notificacao') { return await criarNotificacao(a); }
      if (r === 'coleta') { marcarNav('coleta'); return await telaColeta(a); }
      if (r === 'notificacoes') { marcarNav('notificacoes'); return await telaNotificacoes(); }
      if (r === 'visita') { return await telaVisita(a); }
      if (r === 'irregularidade') { return await telaIrregularidade(a, b); }
      if (r === 'config') { marcarNav('config'); return await telaConfig(a); }
      location.hash = '#/contratos';
    } catch (e) {
      console.error(e);
      rc($main, h('div', { class: 'card' }, h('h2', {}, 'Ocorreu um erro'), h('p', {}, e.message)));
    }
  }
  window.addEventListener('hashchange', rotear);

  function telaLogin(aviso) {
    App._login = !aviso;
    titulo('Notificações');
    const alvo = h('div', { style: { display: 'flex', justifyContent: 'center', margin: '18px 0' } });
    rc($main, h('div', { class: 'card login-box' },
      h('div', { class: 'logo' }, '📋'),
      h('h2', {}, 'Notificações Extrajudiciais'),
      h('p', { class: 'sub' }, 'Entre com sua conta Google. Somente e-mails autorizados pelo administrador têm acesso.'),
      alvo,
      aviso ? h('p', { class: 'aviso' }, aviso) : null,
      aviso ? h('button', { class: 'btn', onclick: () => { Sync.sair(); telaLogin(); } }, 'Entrar com outra conta') : null,
      navigator.onLine ? null : h('p', { class: 'aviso' }, 'Sem internet. O primeiro acesso precisa de conexão.'),
      h('p', { class: 'dica' }, h('a', { href: 'privacidade.html' }, 'Política de privacidade'))));
    if (!aviso) Sync.renderizarBotao(alvo);
  }

  async function garantirSemente() {
    // No modo compartilhado, o primeiro administrador cria as pessoas e a configuracao iniciais
    if (!Sync.habilitado() || !pode.admin()) return;
    if (!(await DB.kvGet('ultimaSync', null))) return;
    if (await DB.get('config', 'geral')) return;
    const c = JSON.parse(JSON.stringify(CONFIG_PADRAO));
    c.fiscais_padrao = ['p-talison', 'p-hiago', 'p-marcelo'];
    c.coordenadores_padrao = ['p-norberto', 'p-andressa'];
    await DB.salvar('config', c, email());
    for (const p of PESSOAS_INICIAIS) if (!(await DB.get('pessoas', p.id))) await DB.salvar('pessoas', Object.assign({}, p), email());
    await carregarConfig();
  }

  /* ================================================================== */
  /* Dados auxiliares                                                    */
  /* ================================================================== */
  async function pessoasMap() {
    const m = {};
    for (const p of await DB.listar('pessoas')) m[p.id] = p;
    return m;
  }
  async function notificacoesDe(registroId) {
    return (await DB.byIndex('notificacoes', 'registroId', registroId)).filter((n) => !n.excluido)
      .sort((a, b) => (b.ordinal || 0) - (a.ordinal || 0) || String(b.criadoEm).localeCompare(a.criadoEm));
  }
  async function fotosDe(registroId) {
    return (await DB.byIndex('fotos', 'registroId', registroId)).filter((f) => !f.excluido)
      .sort((a, b) => String(b.dataHora).localeCompare(a.dataHora));
  }
  function descricaoRegistro(r) {
    const partes = [ROTULO[r.tipo] + ' nº ' + (r.numero || '—')];
    if (r.n_nome) partes.push(r.n_nome);
    return partes.join(' · ');
  }

  /* ================================================================== */
  /* Lista de contratos / convenios                                      */
  /* ================================================================== */
  async function telaLista(tipo) {
    titulo(PLURAL[tipo]);
    const regs = (await DB.listar('registros', (r) => r.tipo === tipo)).sort((a, b) => String(a.apelido || '').localeCompare(b.apelido || ''));
    const notifs = await DB.listar('notificacoes');
    const busca = h('input', { type: 'search', placeholder: 'Buscar por nome, número, empresa…' });
    const chaveFiltro = 'filtro_status_' + tipo;
    const filtroSt = h('select', { onchange: () => { sessionStorage.setItem(chaveFiltro, filtroSt.value); desenhar(); } },
      h('option', { value: '' }, 'Todos os status (' + regs.length + ')'),
      STATUS_OBRA[tipo].map((st) => { const n = regs.filter((r) => r.status_obra === st).length; return n ? h('option', { value: st }, st + ' (' + n + ')') : null; }),
      regs.some((r) => !r.status_obra) ? h('option', { value: '__sem' }, 'Sem status informado (' + regs.filter((r) => !r.status_obra).length + ')') : null);
    filtroSt.value = sessionStorage.getItem(chaveFiltro) || '';
    if (filtroSt.selectedIndex < 0) filtroSt.value = '';
    const lista = h('div');
    const desenhar = () => {
      const q = busca.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const fs = filtroSt.value;
      const filtrados = regs.filter((r) => (!fs || (fs === '__sem' ? !r.status_obra : r.status_obra === fs)) &&
        (!q || [r.apelido, r.numero, r.n_nome, r.objeto, r.processo, r.status_obra].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
      rc(lista, ...(filtrados.length ? filtrados.map((r) => {
        const ns = notifs.filter((n) => n.registroId === r.id);
        const ult = ns.sort((a, b) => String(b.data).localeCompare(a.data))[0];
        const aguard = ns.filter((n) => ['aguardando', 'vencida'].includes(situacaoNotif(n).k));
        const venc = aguard.filter((n) => situacaoNotif(n).k === 'vencida').length;
        return h('a', { class: 'item', href: '#/registro/' + r.id },
          h('div', { class: 't' }, r.apelido || '(sem nome)', r._pendente ? h('span', { class: 'pend', title: 'Aguardando sincronização' }) : null),
          h('div', { class: 'd' }, descricaoRegistro(r)),
          h('div', { class: 'etqs' }, etqStatus(r),
            prazosDoRegistro(r).map((p) => etq(p.rot + ': ' + X.dataBR(p.data) + ' · ' + p.info.txt, p.info.cls)),
            venc ? etq('⏰ ' + venc + ' notificação(ões) com prazo encerrado', 'perigo') : aguard.length ? etq(aguard.length + ' notificação(ões) aguardando resposta', 'info') : null),
          h('div', { class: 'd' }, ns.length ? ns.length + ' notificação(ões) · última em ' + X.dataBR(ult.data) : 'Nenhuma notificação no app'));
      }) : [h('div', { class: 'vazio' }, regs.length ? 'Nada encontrado.' : 'Nenhum ' + ROTULO[tipo].toLowerCase() + ' cadastrado ainda.',
        pode.cadastro() && !regs.length ? h('div', { style: { marginTop: '12px' } }, h('a', { class: 'btn pri', href: '#/novo/' + tipo }, '+ Cadastrar ' + ROTULO[tipo].toLowerCase())) : null)]));
    };
    busca.addEventListener('input', desenhar);
    desenhar();
    rc($main, h('div', { class: 'linha-busca' }, busca, filtroSt), lista);
    if (pode.cadastro() && location.hash.indexOf(tipo === 'convenio' ? 'convenios' : 'contratos') >= 0 || (pode.cadastro() && tipo === 'contrato' && !location.hash)) document.body.appendChild(h('button', { class: 'fab', title: 'Novo', onclick: () => { location.hash = '#/novo/' + tipo; } }, '+'));
  }

  /* ================================================================== */
  /* Detalhe do registro                                                 */
  /* ================================================================== */
  async function visitasDe(registroId) {
    return (await DB.byIndex('visitas', 'registroId', registroId)).filter((v) => !v.excluido)
      .sort((a, b) => (b.numero || 0) - (a.numero || 0));
  }

  async function telaRegistro(id) {
    const r = await DB.get('registros', id);
    if (!r || r.excluido) { rc($main, h('div', { class: 'vazio' }, 'Cadastro não encontrado.')); return; }
    titulo(r.apelido || ROTULO[r.tipo], true);
    marcarNav(r.tipo === 'convenio' ? 'convenios' : 'contratos');
    const notifs = await notificacoesDe(id);
    const fotos = await fotosDe(id);
    const visitas = await visitasDe(id);
    const aba = sessionStorage.getItem('aba_reg2') || 'visitas';

    const info = h('table', { class: 'tabela-info' },
      [['Notificada', r.n_nome], [ROTULO[r.tipo] + ' nº', r.numero], ['Processo', r.processo],
        ['Local da obra', r.local_obra],
        ['Status', r.status_obra ? etqStatus(r) : ''],
        ...prazosDoRegistro(r).map((p) => [p.rot === 'Execução' ? 'Prazo de execução' : p.rot, h('span', {}, X.dataBR(p.data) + ' ', etq(p.info.txt, p.info.cls))]),
        ['Valor', r.valor ? 'R$ ' + X.formatarMoeda(X.parseMoeda(r.valor)) : ''],
        r.tipo === 'contrato' ? ['O.S. nº', r.os_numero] : ['', ''],
        ['Sanções', r.sancoes && r.sancoes.trim() ? 'Personalizadas' : 'Padrão do modelo']]
        .filter((x) => x[1]).map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v))));

    const cab = h('div', { class: 'card' },
      h('div', { class: 'sub' }, ROTULO[r.tipo]),
      h('h2', { style: { margin: '2px 0 8px' } }, r.apelido),
      r.objeto ? h('p', { class: 'sub', style: { marginTop: 0 } }, '“' + r.objeto + '”') : null,
      info,
      h('div', { class: 'acoes' },
        pode.coletar() ? h('a', { class: 'btn pri', href: '#/coleta/' + id }, '📷 Visita / fotos') : null,
        pode.notificar() ? h('a', { class: 'btn', href: '#/nova-notificacao/' + id }, '+ Nova notificação') : null,
        pode.cadastro() ? h('a', { class: 'btn', href: '#/editar/' + id }, '✏️ Editar cadastro') : null));

    const conteudo = h('div');
    const aba2 = (k, t) => h('button', { class: aba === k ? 'ativo' : '', onclick: () => { sessionStorage.setItem('aba_reg2', k); telaRegistro(id); } }, t);
    const abas = h('div', { class: 'abas' },
      aba2('visitas', 'Visitas (' + visitas.length + ')'),
      aba2('notif', 'Notificações (' + notifs.length + ')'),
      aba2('irr', 'Irregularidades (' + fotos.filter((f) => f.irregular && situacao(f) === 'pendente').length + ')'),
      aba2('fotos', 'Fotos (' + fotos.length + ')'));

    if (aba === 'visitas') {
      ap(conteudo, ...(visitas.length ? visitas.map((v) => {
        const fv = fotos.filter((f) => f.visitaId === v.id);
        const irr = fv.filter((f) => f.irregular).length;
        return h('a', { class: 'item', href: '#/visita/' + v.id },
          h('span', { class: 'badge ' + (v.status === 'concluida' ? 'emit' : 'rasc') }, v.status === 'concluida' ? 'Concluída' : 'Em andamento'),
          h('div', { class: 't' }, 'Visita nº ' + v.numero + ' · ' + X.dataBR(v.data), v._pendente ? h('span', { class: 'pend' }) : null),
          h('div', { class: 'd' }, [v.hora_inicio, v.hora_fim].filter(Boolean).join(' – ') + (v.hora_inicio ? ' · ' : '') + fv.length + ' foto(s)' + (irr ? ' · ⚠️ ' + irr + ' irregularidade(s)' : '')),
          h('div', { class: 'd' }, 'Por ' + (v.criadoPor || '—')));
      }) : [h('div', { class: 'vazio' }, 'Nenhuma visita registrada.',
        pode.coletar() ? h('div', { style: { marginTop: '12px' } }, h('a', { class: 'btn pri', href: '#/coleta/' + id }, '▶ Iniciar visita')) : null)]));
    } else if (aba === 'irr') {
      ap(conteudo, await painelIrregularidades(r));
    } else if (aba === 'notif') {
      ap(conteudo, ...(notifs.length ? notifs.map((n) => h('a', { class: 'item', href: '#/notificacao/' + n.id },
        h('span', { class: 'badge ' + (n.status === 'emitida' ? 'emit' : 'rasc') }, n.status === 'emitida' ? 'Emitida' : 'Rascunho'),
        h('div', { class: 't' }, (n.ordinal || '?') + 'ª Notificação', n._pendente ? h('span', { class: 'pend' }) : null),
        h('div', { class: 'd' }, 'Nº ' + (n.numero || '—') + ' · ' + X.dataBR(n.data)),
        n.status === 'emitida' ? h('div', { class: 'etqs' }, etq(situacaoNotif(n).txt, situacaoNotif(n).cls), n.prazoFinal && !n.respondidaEm ? etq('prazo até ' + X.dataBR(n.prazoFinal), '') : null) : null,
        h('div', { class: 'd' }, (n.itens && n.itens.length ? n.itens.length + ' item(ns) · ' : '') + ((n.fotos || []).length) + ' foto(s) · por ' + (n.criadoPor || '—'))))
        : [h('div', { class: 'vazio' }, 'Nenhuma notificação registrada no app para este ' + ROTULO[r.tipo].toLowerCase() + '.',
          r.ultima_notif_anterior ? h('div', { class: 'sub' }, 'Notificações emitidas antes do app: ' + r.ultima_notif_anterior) : null)]));
    } else {
      ap(conteudo, gradeFotos(fotos, { onclick: (f) => abrirFoto(f, () => telaRegistro(id)) }));
      if (!fotos.length) ap(conteudo, h('div', { class: 'vazio' }, 'Nenhuma foto coletada.'));
    }
    rc($main, cab, abas, conteudo);
  }

  /* ---------------- fotos ---------------- */
  const cacheUrls = new Map();
  async function urlFoto(f, grande) {
    if (!grande && f.miniatura) return f.miniatura;
    if (cacheUrls.has(f.id)) return cacheUrls.get(f.id);
    let blob = await DB.blobGet(f.id);
    if (!blob && grande && Sync.habilitado() && navigator.onLine) { try { blob = await Sync.baixarFoto(f); } catch (e) { /* */ } }
    if (!blob) return f.miniatura || '';
    const u = URL.createObjectURL(blob);
    cacheUrls.set(f.id, u);
    return u;
  }

  function gradeFotos(fotos, opts) {
    opts = opts || {};
    const g = h('div', { class: 'fotos' });
    for (const f of fotos) {
      const img = h('img', { alt: f.descricao || '', loading: 'lazy' });
      urlFoto(f).then((u) => { img.src = u; });
      const idx = opts.selecionadas ? opts.selecionadas.indexOf(f.id) : -1;
      ap(g, h('div', { class: 'foto' + (idx >= 0 ? ' sel' : '') + (f.irregular ? ' irr' : '') + (f.fora_relatorio && opts.marcarRelatorio ? ' fora' : ''), onclick: () => opts.onclick && opts.onclick(f) },
        img,
        idx >= 0 ? h('span', { class: 'num' }, idx + 1) : null,
        f.irregular ? h('span', { class: 'alerta', title: 'Irregularidade' }, '⚠️') : null,
        !f.driveId && Sync.habilitado() ? h('span', { class: 'nuvem', title: 'Ainda não enviada' }, '⏳') : null,
        h('div', { class: 'dt' }, dataHoraBR(f.dataHora))));
    }
    return g;
  }

  /* ---------------- gravação sem apagar alterações de outros aparelhos ---------------- */
  const CAMPOS_SISTEMA = ['id', '_pendente', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor'];
  const clonar = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  /* Grava só os campos que o usuário mudou na tela (base = cópia de quando a tela abriu),
     aplicando-os sobre a versão mais recente guardada no aparelho (que pode ter chegado de outro celular). */
  async function salvarMudancas(store, base, editado) {
    if (!editado.id || !(await DB.get(store, editado.id))) return DB.salvar(store, editado, email());
    const chaves = new Set([...Object.keys(base || {}), ...Object.keys(editado)]);
    return atualizarCampos(store, editado.id, (atual) => {
      for (const k of chaves) {
        if (CAMPOS_SISTEMA.includes(k)) continue;
        if (JSON.stringify((base || {})[k]) === JSON.stringify(editado[k])) continue;
        if (editado[k] === undefined) delete atual[k]; else atual[k] = clonar(editado[k]);
      }
    });
  }
  /* Lê a versão mais recente, altera e grava. */
  async function atualizarCampos(store, id, fn) {
    // leitura e gravação na mesma transação: uma sincronização no meio não é sobrescrita (fn não pode usar await)
    const quem = email();
    const r = await DB.atualizar(store, id, (o) => {
      if (!o) return undefined;
      fn(o);
      o.atualizadoEm = DB.carimbo(o.atualizadoEm);
      o.atualizadoPor = quem;
      o._pendente = true;
      return o;
    });
    if (!r) return null;
    if (App.agendarSync) App.agendarSync();
    return r;
  }
  async function salvarConfig(fn) {
    const o = (await DB.get('config', 'geral')) || clonar(CONFIG);
    await fn(o);
    await DB.salvar('config', o, email());
    return carregarConfig();
  }

  /* ---------------- exclusão de fotos (junto com o histórico das irregularidades) ---------------- */
  function recalcularSituacao(f) {
    const vs = f.verificacoes || [];
    const ult = vs[vs.length - 1];
    if (ult && ult.status === 'sanada') { f.situacao = 'sanada'; f.sanadaEm = ult.data; }
    else { f.situacao = 'pendente'; delete f.sanadaEm; }
  }
  /* Calcula tudo o que sai junto: fotos de verificação de uma irregularidade excluída,
     verificações que perdem a foto (ou a visita), rascunhos que usam as fotos. */
  async function planoExclusao(ids, visitaId) {
    const todas = new Map((await DB.all('fotos')).map((f) => [f.id, f]));
    const excluir = new Set();
    const iniciais = new Set();
    const add = (id, inicial) => {
      const f = todas.get(id);
      if (!f || f.excluido || excluir.has(id)) return;
      excluir.add(id);
      if (inicial) iniciais.add(id);
      if (f.irregular) {
        for (const vf of f.verificacoes || []) if (vf.fotoId) add(vf.fotoId);
        for (const o of todas.values()) if (o.verificacaoDe === id) add(o.id);
      }
    };
    ids.forEach((id) => add(id, true));
    const removerVerif = (vf) => (vf.fotoId && excluir.has(vf.fotoId)) || (visitaId && vf.visitaId === visitaId);
    const ajustar = [];
    for (const f of todas.values()) {
      if (f.excluido || excluir.has(f.id) || !f.irregular || !(f.verificacoes || []).length) continue;
      const restantes = f.verificacoes.filter((vf) => !removerVerif(vf));
      if (restantes.length !== f.verificacoes.length) {
        const depois = { verificacoes: restantes }; recalcularSituacao(depois);
        ajustar.push({ f, removidas: f.verificacoes.length - restantes.length, voltaPendente: situacao(f) === 'sanada' && depois.situacao !== 'sanada' });
      }
    }
    const notifs = (await DB.listar('notificacoes')).filter((n) => (n.fotos || []).some((s) => excluir.has(s.fotoId)));
    return { todas, excluir, iniciais, removerVerif, ajustar, rascunhos: notifs.filter((n) => n.status !== 'emitida'), emitidas: notifs.filter((n) => n.status === 'emitida') };
  }
  async function executarExclusao(plano) {
    for (const id of plano.excluir) await atualizarCampos('fotos', id, (o) => { o.excluido = true; });
    for (const { f } of plano.ajustar) {
      await atualizarCampos('fotos', f.id, (o) => { o.verificacoes = (o.verificacoes || []).filter((vf) => !plano.removerVerif(vf)); recalcularSituacao(o); });
    }
    for (const n of plano.rascunhos) await atualizarCampos('notificacoes', n.id, (o) => { o.fotos = (o.fotos || []).filter((s) => !plano.excluir.has(s.fotoId)); });
  }
  /* Exclui com confirmação, explicando o que mais sai junto. Retorna true se excluiu. */
  async function excluirFotos(ids, texto, visitaId) {
    const plano = await planoExclusao(ids, visitaId);
    if (plano.emitidas.length) {
      await modal('Não é possível excluir', h('p', {}, 'Há foto(s) anexada(s) a notificação já emitida (' +
        plano.emitidas.map((n) => (n.ordinal || '?') + 'ª — nº ' + (n.numero || '—')).join('; ') +
        '). Para preservar o documento emitido, ela(s) não pode(m) ser excluída(s). Se for mesmo necessário, um administrador pode reabrir a notificação e retirar a foto.'));
      return false;
    }
    const linhas = [];
    const extras = [...plano.excluir].filter((id) => !plano.iniciais.has(id)).length;
    if (extras) linhas.push('Também será(ão) excluída(s) ' + extras + ' foto(s) do histórico de verificações da irregularidade.');
    for (const a of plano.ajustar) linhas.push('A irregularidade “' + (a.f.descricao || 'sem descrição') + '” perde ' + a.removidas + ' registro(s) do histórico' + (a.voltaPendente ? ' e volta a ficar PENDENTE.' : '.'));
    if (plano.rascunhos.length) linhas.push('A(s) foto(s) será(ão) retirada(s) de ' + plano.rascunhos.length + ' rascunho(s) de notificação.');
    if (Sync.habilitado() && plano.excluir.size) linhas.push('No Google Drive, a(s) foto(s) vai(ão) para a lixeira (o dono da pasta pode recuperar em até 30 dias).');
    const ok = await modal('Confirmar exclusão', h('div', {}, h('p', {}, texto), linhas.map((l) => h('p', { class: 'sub' }, '• ' + l))),
      [{ txt: 'Cancelar', valor: false }, { txt: 'Excluir', cls: 'perigo', valor: true }]);
    if (!ok) return false;
    await executarExclusao(plano);
    return true;
  }

  /* Corrige dados antigos ou que chegaram fora de ordem de outros aparelhos:
     histórico apontando para foto/visita excluída, fotos de verificação órfãs, rascunhos com fotos excluídas. */
  let reparando = false;
  async function repararConsistencia() {
    if (reparando || !pode.coletar()) return 0;
    reparando = true;
    let n = 0;
    try {
      const fotos = await DB.all('fotos');
      const mapa = new Map(fotos.map((f) => [f.id, f]));
      const visitas = new Map((await DB.all('visitas')).map((v) => [v.id, v]));
      const valida = (vf) => {
        const fv = vf.fotoId ? mapa.get(vf.fotoId) : null;
        if (fv && fv.excluido) return false;
        const vis = vf.visitaId ? visitas.get(vf.visitaId) : null;
        return !(vis && vis.excluido);
      };
      for (const f of fotos) {
        if (f.excluido) continue;
        if (f.verificacaoDe) {
          const irr = mapa.get(f.verificacaoDe);
          if (irr && (irr.excluido || !irr.irregular)) {
            await atualizarCampos('fotos', f.id, (o) => { if (irr.excluido) o.excluido = true; else delete o.verificacaoDe; });
            n++; continue;
          }
        }
        if (f.irregular && (f.verificacoes || []).length && !f.verificacoes.every(valida)) {
          await atualizarCampos('fotos', f.id, (o) => { o.verificacoes = (o.verificacoes || []).filter(valida); recalcularSituacao(o); });
          n++;
        }
      }
      for (const nt of await DB.listar('notificacoes')) {
        if (nt.status === 'emitida') continue;
        if ((nt.fotos || []).some((s) => (mapa.get(s.fotoId) || {}).excluido)) {
          await atualizarCampos('notificacoes', nt.id, (o) => { o.fotos = (o.fotos || []).filter((s) => !(mapa.get(s.fotoId) || {}).excluido); });
          n++;
        }
      }
    } catch (e) { console.warn('reparo', e); } finally { reparando = false; }
    return n;
  }

  async function abrirFoto(f, depois) {
    f = (await DB.get('fotos', f.id)) || f;
    const img = h('img', { class: 'grande' });
    urlFoto(f, true).then((u) => { img.src = u; });
    const edit = { descricao: f.descricao || '', irregular: !!f.irregular, incluir: !f.fora_relatorio };
    const coord = f.lat != null ? h('a', { href: 'https://www.google.com/maps?q=' + f.lat + ',' + f.lng, target: '_blank', rel: 'noopener' }, Foto.textoCoord(f.lat, f.lng) + (f.precisao ? ' (±' + f.precisao + ' m)' : '')) : 'sem coordenadas';
    const podeEditar = pode.coletar();
    const irrDe = f.verificacaoDe ? await DB.get('fotos', f.verificacaoDe) : null;
    const nVer = (f.verificacoes || []).length;
    const rotDesc = h('span', {}, edit.irregular ? 'Descrição da irregularidade *' : 'Legenda (opcional)');
    const area = inputArea(edit, 'descricao', { readonly: !podeEditar, placeholder: 'Ex.: Telhas do refeitório amassadas' });
    const chkIrr = h('input', { type: 'checkbox', disabled: !podeEditar, checked: edit.irregular ? 'checked' : null,
      onchange: (e) => { edit.irregular = e.target.checked; rotDesc.textContent = edit.irregular ? 'Descrição da irregularidade *' : 'Legenda (opcional)'; } });
    const chkRel = h('input', { type: 'checkbox', disabled: !podeEditar, checked: edit.incluir ? 'checked' : null, onchange: (e) => { edit.incluir = e.target.checked; } });
    const corpo = h('div', {}, img,
      h('div', { class: 'sub' }, '🕒 ', dataHoraBR(f.dataHora), ' · 📍 ', coord),
      h('div', { class: 'sub', style: { marginBottom: '10px' } }, 'Por ', f.criadoPor || '—', f.origem === 'galeria' ? ' · importada da galeria' : ''),
      irrDe && !irrDe.excluido ? h('div', { class: 'aviso', style: { marginBottom: '8px' } }, '📋 Foto do histórico da irregularidade “' + (irrDe.descricao || '') + '”. ',
        h('a', { href: '#/irregularidade/' + irrDe.id, onclick: () => { const m = document.querySelector('.modal-fundo'); if (m) m.remove(); } }, 'Ver histórico'))
        : h('label', { class: 'linha', style: { marginBottom: '8px' } }, chkIrr, h('b', {}, '⚠️ Registrar como irregularidade')),
      nVer ? h('div', { class: 'sub', style: { marginBottom: '8px' } }, 'Histórico: ' + nVer + ' verificação(ões) — ', h('a', { href: '#/irregularidade/' + f.id, onclick: () => { const m = document.querySelector('.modal-fundo'); if (m) m.remove(); } }, 'abrir')) : null,
      h('label', { class: 'campo' }, rotDesc, area),
      h('label', { class: 'linha sub' }, chkRel, 'Incluir no relatório fotográfico'));
    const botoes = [{ txt: 'Fechar', valor: 'fechar' }];
    if (podeEditar) {
      botoes.unshift({ txt: 'Excluir', cls: 'perigo', valor: 'excluir' });
      botoes.push({ txt: 'Salvar', cls: 'pri', valor: 'salvar', antes: () => {
        if (edit.irregular && !edit.descricao.trim()) { toast('Descreva a irregularidade.', true); return false; }
      } });
    }
    const r = await modal(null, corpo, botoes);
    if (r === 'salvar') {
      let seguir = true;
      if (f.irregular && !edit.irregular && nVer) {
        seguir = await confirmar('Esta irregularidade tem ' + nVer + ' registro(s) no histórico de verificações. Ao deixar de ser irregularidade, esse histórico é apagado (as fotos de verificação continuam como fotos comuns da visita). Continuar?', 'Continuar', true);
        if (seguir) for (const vf of f.verificacoes) if (vf.fotoId) await atualizarCampos('fotos', vf.fotoId, (o) => { delete o.verificacaoDe; });
      }
      if (seguir) {
        await atualizarCampos('fotos', f.id, (o) => {
          o.descricao = edit.descricao.trim();
          o.irregular = edit.irregular;
          o.fora_relatorio = !edit.incluir;
          if (!o.irregular) { delete o.verificacoes; delete o.situacao; delete o.sanadaEm; }
        });
        toast('Foto atualizada');
      }
    } else if (r === 'excluir') {
      const txt = f.irregular ? 'Excluir esta irregularidade (foto e descrição)? Ela não aparecerá mais para ninguém do grupo.'
        : irrDe ? 'Excluir esta foto? O registro de verificação ligado a ela será retirado do histórico da irregularidade.'
          : 'Excluir esta foto? Ela não aparecerá mais para ninguém do grupo.';
      if (await excluirFotos([f.id], txt)) toast('Foto excluída');
    }
    if (depois) depois();
  }

  /* ================================================================== */
  /* Cadastro (formulario) de contrato / convenio                        */
  /* ================================================================== */
  function funcoesPadrao(tipo, i) {
    const lista = (CONFIG.funcao_padrao || {})[tipo] || [];
    return lista[Math.min(i, lista.length - 1)] || '';
  }
  function fiscaisPadrao(tipo) {
    return (CONFIG.fiscais_padrao || []).map((pid, i) => ({ pessoaId: pid, funcao: funcoesPadrao(tipo, i) }));
  }

  /* Editor de lista de assinantes: [{pessoaId, funcao?}] */
  function editorAssinantes(lista, pessoas, papel, comFuncao, tipo) {
    const box = h('div', { class: 'lista-ord' });
    const desenhar = () => {
      rc(box, ...lista.map((item, i) => {
        const sel = h('select', { onchange: (e) => { item.pessoaId = e.target.value; } },
          Object.values(pessoas).filter((p) => p.papel === papel || p.id === item.pessoaId).sort((a, b) => a.nome.localeCompare(b.nome))
            .map((p) => h('option', { value: p.id, selected: p.id === item.pessoaId ? 'selected' : null }, p.nome)));
        return h('div', { class: 'li' },
          h('div', { class: 'cresce', style: { flex: 1 } }, sel,
            comFuncao ? h('input', { type: 'text', value: item.funcao || '', placeholder: 'Função (ex.: Fiscal do Contrato)', style: { marginTop: '6px' }, oninput: (e) => { item.funcao = e.target.value; } }) : null),
          h('div', { class: 'ctl' },
            h('button', { class: 'btn peq', type: 'button', disabled: i === 0, onclick: () => { lista.splice(i - 1, 0, lista.splice(i, 1)[0]); desenhar(); } }, '▲'),
            h('button', { class: 'btn peq', type: 'button', disabled: i === lista.length - 1, onclick: () => { lista.splice(i + 1, 0, lista.splice(i, 1)[0]); desenhar(); } }, '▼'),
            h('button', { class: 'btn peq perigo', type: 'button', onclick: () => { lista.splice(i, 1); desenhar(); } }, '✕')));
      }), h('button', { class: 'btn peq', type: 'button', onclick: () => {
        const livres = Object.values(pessoas).filter((p) => p.papel === papel && !lista.some((l) => l.pessoaId === p.id));
        if (!livres.length) { toast('Cadastre mais pessoas em Ajustes › Assinantes'); return; }
        lista.push({ pessoaId: livres[0].id, funcao: comFuncao ? funcoesPadrao(tipo, lista.length) : undefined });
        desenhar();
      } }, '+ Adicionar'));
    };
    desenhar();
    return box;
  }

  async function telaFormRegistro(id, tipoNovo) {
    if (!pode.cadastro()) { toast('Apenas administradores editam cadastros.', true); history.back(); return; }
    const existente = id ? await DB.get('registros', id) : null;
    const baseReg = existente ? clonar(existente) : null;
    const r = existente ? JSON.parse(JSON.stringify(existente)) : {
      tipo: tipoNovo === 'convenio' ? 'convenio' : 'contrato',
      fiscais: null, coordenadores: null, prazo_dias: CONFIG.prazo_padrao,
    };
    const tipo = r.tipo;
    if (!r.fiscais) r.fiscais = fiscaisPadrao(tipo);
    if (!r.coordenadores) r.coordenadores = (CONFIG.coordenadores_padrao || []).slice();
    const coords = r.coordenadores.map((pid) => ({ pessoaId: pid }));
    const pessoas = await pessoasMap();
    titulo((existente ? 'Editar ' : 'Novo ') + ROTULO[tipo].toLowerCase(), true);

    const valorInp = (chave, chaveExt) => {
      const inpExt = inputTxt(r, chaveExt, { placeholder: 'gerado automaticamente' });
      const inp = h('input', { type: 'text', inputmode: 'decimal', value: r[chave] != null && r[chave] !== '' ? X.formatarMoeda(X.parseMoeda(r[chave])) : '', placeholder: '0,00',
        oninput: (e) => { r[chave] = X.parseMoeda(e.target.value); r[chaveExt] = ''; inpExt.value = ''; inpExt.placeholder = X.moeda(r[chave]) || 'gerado automaticamente'; } });
      inpExt.placeholder = X.moeda(X.parseMoeda(r[chave])) || 'gerado automaticamente';
      return [inp, inpExt];
    };
    const [vInp, vExt] = valorInp('valor', 'valor_extenso');
    const nomeTexto = inputTxt(r, 'n_nome_texto', { placeholder: tipo === 'convenio' ? 'Ex.: Prefeitura Municipal de Cláudia' : 'Ex.: HFC CONSTRUTORA E ENGENHARIA LTDA' });

    const secNotificada = h('div', { class: 'card' }, h('h2', {}, 'Notificada (' + (tipo === 'convenio' ? 'Convenente' : 'Contratada') + ')'),
      campo('Nome / Razão social (como aparece no quadro)', inputTxt(r, 'n_nome', { placeholder: tipo === 'convenio' ? 'PREFEITURA MUNICIPAL DE CLÁUDIA' : 'HFC CONSTRUTORA E ENGENHARIA LTDA' })),
      campo('Nome usado no texto', nomeTexto, 'Usado nas frases “firmado entre a Secretaria… e a ___” e “NOTIFICAR a ___”.'),
      h('div', { class: 'grade2' },
        campo('CNPJ', inputTxt(r, 'n_cnpj', { inputmode: 'numeric' })),
        campo('Telefone', inputTxt(r, 'n_telefone', { inputmode: 'tel' })),
        campo('Representante legal', inputTxt(r, 'n_representante')),
        campo('CPF do representante (opcional)', inputTxt(r, 'n_representante_cpf', { inputmode: 'numeric' }))),
      campo('Logradouro', inputTxt(r, 'n_logradouro')),
      h('div', { class: 'grade2' },
        campo('Bairro', inputTxt(r, 'n_bairro')),
        campo('CEP', inputTxt(r, 'n_cep', { inputmode: 'numeric' }))),
      campo('Município/UF', inputTxt(r, 'n_municipio', { placeholder: 'Ex.: Sinop/MT' })));

    const selStatus = h('select', { onchange: (e) => { r.status_obra = e.target.value; } },
      h('option', { value: '' }, '— não informado —'),
      STATUS_OBRA[tipo].map((st) => h('option', { value: st, selected: r.status_obra === st ? 'selected' : null }, st)),
      r.status_obra && !STATUS_OBRA[tipo].includes(r.status_obra) ? h('option', { value: r.status_obra, selected: 'selected' }, r.status_obra) : null);
    const secDados = h('div', { class: 'card' }, h('h2', {}, 'Dados do ' + ROTULO[tipo].toLowerCase()),
      campo('Status da obra', selStatus),
      campo('Nome curto (identificação no app e no nome do arquivo) *', inputTxt(r, 'apelido', { placeholder: tipo === 'convenio' ? 'Ex.: CONVÊNIO 0961-2024 - CLÁUDIA' : 'Ex.: CEI DAURY RIVA' })),
      campo('Objeto', inputArea(r, 'objeto', { placeholder: 'Sem aspas — o modelo já inclui' })),
      campo('Local da obra (endereço / município)', inputTxt(r, 'local_obra', { placeholder: 'Ex.: Bairro Dauri Riva, Sinop/MT' }), 'Aparece no relatório fotográfico.'),
      h('div', { class: 'grade2' },
        campo(ROTULO[tipo] + ' nº', inputTxt(r, 'numero')),
        campo('Processo/Protocolo nº', inputTxt(r, 'processo'))),
      campo('Valor do ' + ROTULO[tipo].toLowerCase() + ' (R$)', vInp),
      campo('Valor por extenso', vExt, 'Deixe vazio para gerar automaticamente.'),
      tipo === 'contrato' ? h('div', { class: 'grade2' },
        campo('Prazo de execução (data final)', h('input', { type: 'date', value: r.prazo_execucao || '', oninput: (e) => { r.prazo_execucao = e.target.value; } })),
        campo('Prazo de vigência (data final)', h('input', { type: 'date', value: r.vigencia || '', oninput: (e) => { r.vigencia = e.target.value; } })))
        : campo('Prazo de vigência (data final)', h('input', { type: 'date', value: r.vigencia || '', oninput: (e) => { r.vigencia = e.target.value; } })),
      h('div', { class: 'dica' }, 'O app mostra na lista quantos dias faltam para cada prazo.'),
      tipo === 'contrato' ? (() => {
        const [oInp, oExt] = valorInp('valor_os', 'valor_os_extenso');
        return h('div', {}, h('h3', {}, 'Ordem de Serviço (opcional)'),
          campo('O.S. nº', inputTxt(r, 'os_numero')),
          campo('Objeto específico da O.S.', inputArea(r, 'objeto_especifico')),
          campo('Valor da O.S. (R$)', oInp), campo('Valor da O.S. por extenso', oExt),
          h('div', { class: 'dica' }, 'Campos da O.S. vazios são removidos automaticamente do documento.'));
      })() : null);

    const secAss = h('div', { class: 'card' }, h('h2', {}, 'Assinaturas deste ' + ROTULO[tipo].toLowerCase()),
      h('p', { class: 'sub' }, 'Vêm dos padrões definidos em Ajustes. Altere aqui só se este ' + ROTULO[tipo].toLowerCase() + ' tiver fiscais diferentes.'),
      h('h3', {}, 'Fiscais'), editorAssinantes(r.fiscais, pessoas, 'fiscal', true, tipo),
      h('h3', {}, 'Coordenadores'), editorAssinantes(coords, pessoas, 'coordenador', false, tipo));

    const ultimaInp = h('input', { type: 'number', min: '0', value: r.ultima_notif_anterior == null ? '' : r.ultima_notif_anterior, oninput: (e) => { r.ultima_notif_anterior = e.target.value === '' ? null : parseInt(e.target.value, 10); } });
    const secPad = h('div', { class: 'card' }, h('h2', {}, 'Padrões das notificações'),
      campo('Última notificação emitida antes de usar o app', ultimaInp, 'Ex.: se já foram emitidas 5 notificações, informe 5 (a próxima será a 6ª). Se ficar vazio, o app pergunta na primeira notificação.'),
      campo('Prazo para resposta (dias úteis)', h('input', { type: 'number', min: '1', value: r.prazo_dias || CONFIG.prazo_padrao, oninput: (e) => { r.prazo_dias = parseInt(e.target.value, 10) || CONFIG.prazo_padrao; } })));

    const sancArea = inputArea(r, 'sancoes', { placeholder: 'Em branco = usa as sanções do modelo do Word.', style: { minHeight: '180px' } });
    const secSanc = h('div', { class: 'card' }, h('h2', {}, 'Sanções administrativas'),
      h('p', { class: 'sub' }, 'Texto da seção “Possíveis sanções administrativas” deste ' + ROTULO[tipo].toLowerCase() + '. ' +
        'Deixe em branco para usar o texto padrão do modelo.'),
      sancArea,
      h('div', { class: 'dica' }, 'Cada linha vira um parágrafo. Use **texto** para negrito (ex.: **16.1.** Comete infração…).'),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', type: 'button', onclick: async () => {
          if (r.sancoes && r.sancoes.trim() && !(await confirmar('Substituir o texto atual pelo texto padrão do modelo?', 'Substituir'))) return;
          try {
            const txt = await DocGen.extrairTextoBloco(await modeloDocx(tipo), 'sancoes_padrao');
            if (!txt) { toast('O modelo atual não tem o bloco de sanções marcado.', true); return; }
            r.sancoes = txt; sancArea.value = txt; toast('Texto padrão carregado — edite o que precisar.');
          } catch (e) { toast(e.message, true); }
        } }, '⇩ Carregar texto padrão para editar'),
        h('button', { class: 'btn peq', type: 'button', onclick: () => { r.sancoes = ''; sancArea.value = ''; toast('Usará o texto padrão do modelo.'); } }, 'Usar padrão do modelo')));

    const salvar = async () => {
      if (!r.apelido || !r.apelido.trim()) { toast('Informe o nome curto.', true); return; }
      r.coordenadores = coords.map((c) => c.pessoaId).filter(Boolean);
      r.fiscais = r.fiscais.filter((f) => f.pessoaId);
      if (!r.n_nome_texto) r.n_nome_texto = '';
      const salvo = existente ? await salvarMudancas('registros', baseReg, r) : await DB.salvar('registros', r, email());
      toast('Cadastro salvo');
      location.replace('#/registro/' + salvo.id);
    };
    const acoes = h('div', { class: 'card' }, h('div', { class: 'acoes', style: { marginTop: 0 } },
      h('button', { class: 'btn pri', onclick: salvar }, 'Salvar'),
      h('button', { class: 'btn', onclick: () => history.back() }, 'Cancelar'),
      existente ? h('button', { class: 'btn perigo', style: { marginLeft: 'auto' }, onclick: async () => {
        if (await confirmar('Excluir este cadastro? O histórico de notificações continuará guardado no servidor, mas ficará oculto.', 'Excluir', true)) {
          await DB.excluir('registros', existente.id, email());
          location.replace('#/' + (tipo === 'convenio' ? 'convenios' : 'contratos'));
        }
      } }, 'Excluir') : null));
    rc($main, secDados, secNotificada, secAss, secSanc, secPad, acoes);
  }

  /* ================================================================== */
  /* Coleta de fotos em campo (offline)                                  */
  /* ================================================================== */
  /* ================================================================== */
  /* Visitas (coleta em campo e relatorio fotografico)                   */
  /* ================================================================== */
  const horaAgora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const CLIMAS = ['', 'Ensolarado', 'Parcialmente nublado', 'Nublado', 'Chuvoso', 'Chuva forte', 'Após chuva (solo úmido)'];

  async function telaColeta(registroId) {
    if (!registroId) {
      titulo('Visita à obra');
      const regs = (await DB.listar('registros')).sort((a, b) => String(a.apelido).localeCompare(b.apelido));
      const recentes = (await DB.kvGet('coletaRecentes', [])).map((id) => regs.find((r) => r.id === id)).filter(Boolean);
      const andamento = (await DB.listar('visitas', (v) => v.status !== 'concluida' && v.criadoPor === email()));
      const bloco = (lista) => lista.map((r) => h('a', { class: 'item', href: '#/coleta/' + r.id },
        h('span', { class: 'badge' }, ROTULO[r.tipo]), h('div', { class: 't' }, r.apelido), h('div', { class: 'd' }, descricaoRegistro(r))));
      rc($main,
        andamento.length ? h('h3', { class: 'sub' }, 'Suas visitas em andamento') : null,
        andamento.map((v) => { const r = regs.find((x) => x.id === v.registroId); return r ? h('a', { class: 'item', href: '#/visita/' + v.id },
          h('span', { class: 'badge rasc' }, 'Em andamento'), h('div', { class: 't' }, r.apelido), h('div', { class: 'd' }, 'Visita nº ' + v.numero + ' · ' + X.dataBR(v.data))) : null; }),
        h('p', { class: 'sub' }, 'Escolha a obra para iniciar uma visita. Funciona sem internet: as fotos ficam no aparelho e são enviadas quando houver conexão.'),
        recentes.length ? h('h3', { class: 'sub' }, 'Usadas recentemente') : null, bloco(recentes),
        h('h3', { class: 'sub' }, 'Todas as obras'), regs.length ? bloco(regs) : h('div', { class: 'vazio' }, 'Nenhum contrato ou convênio cadastrado.'));
      return;
    }
    const r = await DB.get('registros', registroId);
    if (!r) { location.replace('#/coleta'); return; }
    if (!pode.coletar()) { rc($main, h('div', { class: 'aviso' }, 'Seu perfil permite apenas consulta.')); return; }
    const rec = (await DB.kvGet('coletaRecentes', [])).filter((x) => x !== registroId);
    rec.unshift(registroId);
    DB.kvSet('coletaRecentes', rec.slice(0, 5));
    const abertas = (await visitasDe(registroId)).filter((v) => v.status !== 'concluida');
    if (abertas.length) {
      const v = abertas[0];
      const esc = await modal('Visita em andamento', h('p', {}, 'Há uma visita em andamento nesta obra (nº ' + v.numero + ', ' + X.dataBR(v.data) + '). Deseja continuar nela?'),
        [{ txt: 'Nova visita', valor: 'nova' }, { txt: 'Continuar', cls: 'pri', valor: 'continuar' }]);
      if (esc === 'continuar') { location.replace('#/visita/' + v.id); return; }
      if (esc !== 'nova') { history.back(); return; }
    }
    await criarVisita(r);
  }

  async function criarVisita(r) {
    const vs = await visitasDe(r.id);
    const pessoas = await pessoasMap();
    const pos = await Foto.posicaoAtual(60000).catch(() => null);
    const v = {
      id: DB.uuid(), registroId: r.id, tipo: r.tipo,
      numero: Math.max(0, ...vs.map((x) => +x.numero || 0)) + 1,
      data: X.hojeISO(), hora_inicio: horaAgora(), hora_fim: '', status: 'andamento',
      fiscais: snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao(r.tipo), pessoas, true),
      equipe: '', acompanhantes: '', objetivo: 'Acompanhamento e fiscalização da execução da obra.', clima: '', trabalhadores: null,
      servicos: '', avanco_exec: null, avanco_prev: null, observacoes: '',
      lat: pos ? pos.lat : null, lng: pos ? pos.lng : null,
    };
    await DB.salvar('visitas', v, email());
    location.replace('#/visita/' + v.id);
  }

  /* Processa fotos (camera/galeria) e grava no aparelho */
  async function salvarFotos(arquivos, origem, r, v, opt, status) {
    const salvas = [];
    for (let i = 0; i < arquivos.length; i++) {
      const arq = arquivos[i];
      if (status) rc(status, h('span', { class: 'carregando' }), ' Processando foto ' + (i + 1) + ' de ' + arquivos.length + '…');
      try {
        const exif = await Foto.lerExif(arq);
        let dataHora, lat = null, lng = null, precisao = null;
        if (origem === 'camera') {
          dataHora = new Date().toISOString();
          const p = await Foto.posicaoAtual(120000);
          if (p) { lat = p.lat; lng = p.lng; precisao = p.precisao; }
          else if (exif.lat != null) { lat = exif.lat; lng = exif.lng; }
        } else {
          dataHora = exif.dataHora || new Date(arq.lastModified || Date.now()).toISOString();
          if (exif.lat != null) { lat = exif.lat; lng = exif.lng; }
        }
        const carimbar = origem === 'camera' || opt.carimbarGaleria;
        const linhas = carimbar ? [Foto.textoDataHora(dataHora), lat != null ? Foto.textoCoord(lat, lng) : 'sem coordenadas', r.apelido] : null;
        const res = await Foto.processar(arq, { carimbo: linhas, angulo: arq.angulo, origemCamera: arq.angulo !== undefined });
        const foto = { id: DB.uuid(), registroId: r.id, visitaId: v ? v.id : null, tipo: r.tipo, dataHora, lat, lng, precisao, origem,
          carimbada: !!carimbar, largura: res.largura, altura: res.altura, miniatura: res.miniatura, descricao: '', irregular: !!opt.irregular };
        await DB.blobSet(foto.id, res.blob);
        await DB.salvar('fotos', foto, email());
        salvas.push(foto);
        if (opt.irregular) {
          const edit = { descricao: '' };
          const desc = await modal('⚠️ Descreva a irregularidade', h('div', {},
            h('img', { class: 'grande', src: res.miniatura }),
            campo('O que está irregular?', inputArea(edit, 'descricao', { placeholder: 'Ex.: Trincas no contrapiso do refeitório' }))),
          [{ txt: 'Não é irregularidade', valor: '__normal' },
            { txt: 'Salvar', cls: 'pri', valor: () => edit.descricao, antes: () => { if (!edit.descricao.trim()) { toast('Descreva a irregularidade (ou marque como foto normal).', true); return false; } } }]);
          const salvo = await atualizarCampos('fotos', foto.id, (o) => {
            if (desc === '__normal') o.irregular = false;
            else if (desc) o.descricao = desc.trim();
          });
          if (salvo) Object.assign(foto, salvo);
        }
      } catch (e) {
        console.error(e);
        toast('Erro ao processar foto: ' + e.message, true);
      }
    }
    return salvas;
  }

  async function telaVisita(id) {
    const v0 = await DB.get('visitas', id);
    if (!v0 || v0.excluido) { rc($main, h('div', { class: 'vazio' }, 'Visita não encontrada.')); return; }
    const r = await DB.get('registros', v0.registroId);
    if (!r) { rc($main, h('div', { class: 'vazio' }, 'Obra desta visita não encontrada.')); return; }
    marcarNav(r.tipo === 'convenio' ? 'convenios' : 'contratos');
    titulo('Visita nº ' + v0.numero + ' · ' + r.apelido, true);
    const v = JSON.parse(JSON.stringify(v0));
    let vBase = clonar(v0);
    const podeEd = pode.coletar();
    const pessoas = await pessoasMap();
    let sujo = false;
    const marcar = () => { sujo = true; };

    const salvarVisita = async (silencioso) => {
      v.fiscais = snapshotAssinantes(edFiscais, pessoas, true);
      const salvo = await salvarMudancas('visitas', vBase, v);
      Object.assign(v0, salvo);
      vBase = clonar(v);
      sujo = false;
      if (!silencioso) toast('Dados da visita salvos');
    };
    App._sairNotif = async () => { if (sujo && podeEd) await salvarVisita(true); };

    /* --- cabecalho --- */
    const cab = h('div', { class: 'card' },
      h('span', { class: 'badge ' + (v.status === 'concluida' ? 'emit' : 'rasc'), style: { float: 'right' } }, v.status === 'concluida' ? 'Concluída' : 'Em andamento'),
      h('div', { class: 'sub' }, ROTULO[r.tipo] + ' nº ' + (r.numero || '—')),
      h('h2', { style: { margin: '2px 0 4px' } }, r.apelido),
      h('div', { class: 'sub' }, 'Visita nº ' + v.numero + ' · ' + X.dataBR(v.data) + (v.hora_inicio ? ' · início ' + v.hora_inicio : '') + (v.hora_fim ? ' · fim ' + v.hora_fim : '')));

    /* --- captura --- */
    const gps = h('div', { class: 'gps' }, h('span', { class: 'carregando' }), ' Obtendo localização GPS…');
    const status = h('div', { class: 'sub', style: { minHeight: '20px', margin: '6px 0 0' } });
    const opt = { carimbarGaleria: await DB.kvGet('carimbarGaleria', false), irregular: false };
    const inpCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto' });
    const inpGal = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'oculto' });
    let fila = Promise.resolve();
    const disparar = async (irregular, galeria) => {
      opt.irregular = irregular;
      if (galeria || !Camera.suportada() || prefCamera() === 'aparelho') { (galeria ? inpGal : inpCam).click(); return; }
      let nFotos = 0, nIrr = 0;
      try {
        if (irregular) {
          const res = await Camera.abrir({ modo: 'unica', titulo: '⚠️ Irregularidade · ' + r.apelido });
          const blob = res && res.aparelho ? res.aparelho[0] : res;
          if (blob) { const sv = await salvarFotos([blob], 'camera', r, v0, { irregular: true }); nIrr += sv.filter((x) => x.irregular).length; nFotos += sv.length; }
        } else {
          const res = await Camera.abrir({
            titulo: 'Visita nº ' + v0.numero + ' · ' + r.apelido,
            aoFoto: (blob) => {
              const pr = fila.then(() => salvarFotos([blob], 'camera', r, v0, { irregular: false })).then((sv) => { nFotos += sv.length; return sv[0]; });
              fila = pr.catch(() => {});
              return pr;
            },
            urlFoto: async (foto) => { const bl = await DB.blobGet(foto.id); return bl ? URL.createObjectURL(bl) : null; },
            aoExcluir: async (foto) => { if (foto) { await executarExclusao(await planoExclusao([foto.id])); nFotos--; } },
          });
          await fila;
          if (res && res.aparelho) {
            const sv = await salvarFotos(Array.from(res.aparelho), 'camera', r, v0, { irregular: false }, status);
            nFotos += sv.length;
          }
        }
      } catch (e) {
        console.warn(e);
        toast('Não foi possível abrir a câmera do app (' + (e.name === 'NotAllowedError' ? 'permissão negada' : e.message) + '). Usando a câmera do aparelho.', true);
        inpCam.click();
        return;
      }
      rc(status, nFotos ? '✅ ' + nFotos + ' foto(s) salva(s)' + (nIrr ? ' · ⚠️ ' + nIrr + ' irregularidade(s)' : '') + '.' : '');
      desenharFotos();
    };
    const aoSelecionar = async (inp, origem) => {
      const f = Array.from(inp.files); inp.value = '';
      if (!f.length) return;
      const salvas = await salvarFotos(f, origem, r, v0, Object.assign({}, opt), status);
      const nIrr = salvas.filter((x) => x.irregular).length;
      rc(status, salvas.length ? '✅ ' + salvas.length + ' foto(s) salva(s)' + (nIrr ? ' · ⚠️ ' + nIrr + ' irregularidade(s)' : '') + '.' : '');
      desenharFotos();
    };
    inpCam.addEventListener('change', () => aoSelecionar(inpCam, 'camera'));
    inpGal.addEventListener('change', () => aoSelecionar(inpGal, 'galeria'));
    const chkGal = h('input', { type: 'checkbox', checked: opt.carimbarGaleria ? 'checked' : null, onchange: (e) => { opt.carimbarGaleria = e.target.checked; DB.kvSet('carimbarGaleria', e.target.checked); } });
    const captura = podeEd ? h('div', { class: 'card' },
      h('div', { class: 'grade-bt' },
        h('button', { class: 'btn pri grande', onclick: () => disparar(false) }, '📷 Câmera'),
        h('button', { class: 'btn alerta grande', onclick: () => disparar(true) }, '⚠️ Irregularidade')),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', onclick: () => disparar(false, true) }, '🖼️ Galeria'),
        h('button', { class: 'btn peq', onclick: () => disparar(true, true) }, '🖼️ Irregularidade da galeria')),
      h('label', { class: 'linha sub', style: { marginTop: '8px' } }, chkGal, ' Carimbar data/hora/GPS nas fotos da galeria'),
      h('div', { class: 'dica' }, 'Câmera: fica aberta para várias fotos seguidas, sem pedir descrição. Para irregularidades use o botão ⚠️ Irregularidade.'),
      status, inpCam, inpGal) : null;

    /* --- fotos --- */
    const boxFotos = h('div');
    const boxIrr = h('div');
    async function desenharFotos() {
      const fotos = (await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido).sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
      const irr = fotos.filter((f) => f.irregular);
      rc(boxFotos, h('h2', {}, 'Fotos da visita (' + fotos.length + ')'),
        fotos.length ? gradeFotos(fotos, { marcarRelatorio: true, onclick: (f) => abrirFoto(f, desenharFotos) }) : h('div', { class: 'vazio' }, 'Nenhuma foto ainda.'),
        fotos.some((f) => f.fora_relatorio) ? h('div', { class: 'dica' }, 'Fotos esmaecidas não entram no relatório.') : null);
      const reverif = await reverificadasNaVisita(r, id);
      const nIrr = irr.length + reverif.length;
      rc(boxIrr, h('h2', {}, '⚠️ Irregularidades (' + nIrr + ')'),
        nIrr ? h('div', { class: 'lista-ord' }, reverif.map((f) => {
          const img = h('img'); fotoAtualIrr(f).then(urlFoto).then((u) => { img.src = u; });
          return h('div', { class: 'li', style: { cursor: 'pointer' }, onclick: () => { location.hash = '#/irregularidade/' + f.id + '/' + id; } }, img,
            h('div', { style: { flex: 1 } }, h('div', {}, f.descricao || '(sem descrição)'),
              h('div', { class: 'sub' }, '✗ Não sanada nesta visita · constatada em ' + dataHoraBR(f.dataHora).slice(0, 10))));
        }), irr.map((f) => {
          const img = h('img'); urlFoto(f).then((u) => { img.src = u; });
          return h('div', { class: 'li', style: { cursor: 'pointer' }, onclick: () => abrirFoto(f, desenharFotos) }, img, h('div', { style: { flex: 1 } }, h('div', {}, f.descricao || '(sem descrição)'), h('div', { class: 'sub' }, dataHoraBR(f.dataHora))));
        })) : h('div', { class: 'sub' }, 'Nenhuma irregularidade registrada nesta visita.'),
        nIrr && pode.notificar() ? h('div', { class: 'acoes' }, h('button', { class: 'btn', onclick: async () => { await salvarVisita(true); notificarVisita(v0, r); } }, '📝 Gerar notificação com estas irregularidades')) : null,
        reverif.length ? h('div', { class: 'dica' }, 'Irregularidades não sanadas entram na notificação com a foto nova desta visita.') : null);
      boxIrr.className = 'card';
      boxFotos.className = 'card';
      const pend = (await irregularidadesDe(r.id)).filter((f) => situacao(f) === 'pendente' && f.visitaId !== id);
      rc(boxPend, h('h2', {}, '📋 Pendências de visitas anteriores (' + pend.length + ')'),
        pend.length ? h('p', { class: 'sub' }, 'Verifique cada uma e registre se foi sanada, com foto e descrição do que foi feito.') : h('div', { class: 'sub' }, 'Nenhuma irregularidade pendente nesta obra.'),
        pend.map((f) => itemIrregularidade(f, () => { location.hash = '#/irregularidade/' + f.id + '/' + id; })));
      boxPend.className = 'card';
    }
    const boxPend = h('div');

    /* --- dados --- */
    const edFiscais = (v.fiscais || []).map((f) => ({ pessoaId: f.pessoaId, funcao: f.funcao }));
    const ro = !podeEd;
    const num = (k, attrs) => h('input', Object.assign({ type: 'number', inputmode: 'decimal', value: v[k] == null ? '' : v[k], readonly: ro,
      oninput: (e) => { v[k] = e.target.value === '' ? null : Number(e.target.value); marcar(); } }, attrs || {}));
    const txt = (k, attrs) => inputTxt(v, k, Object.assign({ readonly: ro, oninput: (e) => { v[k] = e.target.value; marcar(); } }, attrs || {}));
    const area = (k, attrs) => inputArea(v, k, Object.assign({ readonly: ro, oninput: (e) => { v[k] = e.target.value; marcar(); } }, attrs || {}));
    const dados = h('details', { class: 'card', open: sessionStorage.getItem('visita_dados_aberto') === '1' ? true : null,
      ontoggle: (e) => sessionStorage.setItem('visita_dados_aberto', e.target.open ? '1' : '0') },
      h('summary', { style: { fontWeight: '600', cursor: 'pointer' } }, 'Dados da visita (para o relatório)'),
      h('div', { style: { marginTop: '10px' } },
        h('div', { class: 'grade2' },
          campo('Data', h('input', { type: 'date', value: v.data, readonly: ro, oninput: (e) => { v.data = e.target.value; marcar(); } })),
          h('div', { class: 'grade2' },
            campo('Início', h('input', { type: 'time', value: v.hora_inicio || '', readonly: ro, oninput: (e) => { v.hora_inicio = e.target.value; marcar(); } })),
            campo('Fim', h('input', { type: 'time', value: v.hora_fim || '', readonly: ro, oninput: (e) => { v.hora_fim = e.target.value; marcar(); } })))),
        campo('Objetivo da visita', txt('objetivo')),
        h('h3', {}, 'Equipe de fiscalização'),
        ro ? h('div', { class: 'sub' }, (v.fiscais || []).map((f) => f.nome).join(', ')) : h('div', { onchange: marcar, onclick: (e) => { if (e.target.tagName === 'BUTTON') marcar(); } }, editorAssinantes(edFiscais, pessoas, 'fiscal', true, r.tipo)),
        campo('Acompanhantes (empresa/prefeitura)', txt('acompanhantes', { placeholder: 'Ex.: Eng. Fulano (responsável técnico da contratada)' })),
        h('h3', {}, 'Condições do canteiro'),
        h('div', { class: 'grade2' },
          campo('Condições do tempo', h('select', { disabled: ro, onchange: (e) => { v.clima = e.target.value; marcar(); } }, CLIMAS.map((c) => h('option', { value: c, selected: v.clima === c ? 'selected' : null }, c || '—')))),
          campo('Trabalhadores no canteiro', num('trabalhadores', { min: '0', step: '1' }))),
        campo('Serviços em execução', area('servicos', { style: { minHeight: '60px' } })),
        h('div', { class: 'grade2' },
          campo('Avanço físico executado (%)', num('avanco_exec', { min: '0', max: '100', step: '0.1' })),
          campo('Avanço previsto no cronograma (%)', num('avanco_prev', { min: '0', max: '100', step: '0.1' }))),
        campo('Observações gerais', area('observacoes'), 'Use **texto** para negrito. Cada linha vira um parágrafo.'),
        podeEd ? h('button', { class: 'btn pri', onclick: () => salvarVisita() }, '💾 Salvar dados') : null));

    /* --- acoes --- */
    const acoes = h('div', { class: 'card' }, h('h2', {}, 'Relatório e encerramento'),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn pri', onclick: async () => { if (podeEd && sujo) await salvarVisita(true); dialogoRelatorio(v0, r); } }, '📄 Relatório fotográfico'),
        podeEd && v.status !== 'concluida' ? h('button', { class: 'btn ok', onclick: async () => {
          if (!v.hora_fim) v.hora_fim = horaAgora();
          v.status = 'concluida';
          await salvarVisita(true);
          toast('Visita concluída');
          telaVisita(id);
        } }, '✅ Concluir visita') : null,
        podeEd && v.status === 'concluida' ? h('button', { class: 'btn peq', onclick: async () => { v.status = 'andamento'; await salvarVisita(true); telaVisita(id); } }, 'Reabrir visita') : null,
        (pode.admin() || v0.criadoPor === email()) ? h('button', { class: 'btn peq perigo', onclick: async () => {
          const idsFotos = (await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido).map((f) => f.id);
          if (!(await excluirFotos(idsFotos, 'Excluir esta visita e todas as ' + idsFotos.length + ' foto(s) dela? As verificações de irregularidades feitas nesta visita também saem do histórico.', id))) return;
          await DB.excluir('visitas', id, email());
          App._sairNotif = null;
          location.replace('#/registro/' + r.id);
        } }, 'Excluir visita') : null));

    rc($main, cab, v.status !== 'concluida' ? gps : null, captura, boxPend, boxFotos, boxIrr, dados, acoes);
    await desenharFotos();
    App._atualizarTela = () => (document.body.contains(boxFotos) ? desenharFotos() : null); // fotos de outros aparelhos aparecem sem sair da tela
    if (v.status !== 'concluida' && podeEd) {
      Foto.iniciarGPS();
      const off = Foto.onGPS((p, err) => {
        if (!document.body.contains(gps)) { off(); return; }
        if (p) { gps.className = 'gps ' + (p.precisao <= 30 ? 'bom' : ''); rc(gps, '📍 ' + Foto.textoCoord(p.lat, p.lng) + ' · precisão ±' + p.precisao + ' m'); }
        else if (err) { gps.className = 'gps ruim'; rc(gps, '⚠️ GPS indisponível: ' + (err.code === 1 ? 'permissão negada — libere a localização para este app.' : 'ative a localização do aparelho.')); }
      });
    }
  }

  // irregularidades de visitas anteriores verificadas como "nao sanada" nesta visita
  async function reverificadasNaVisita(r, visitaId) {
    return (await irregularidadesDe(r.id)).filter((f) => situacao(f) === 'pendente' && f.visitaId !== visitaId &&
      (f.verificacoes || []).some((vf) => vf.status === 'nao_sanada' && vf.visitaId === visitaId))
      .sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
  }

  async function notificarVisita(v, r) {
    const daVisita = (await DB.byIndex('fotos', 'visitaId', v.id)).filter((f) => !f.excluido && f.irregular && situacao(f) !== 'sanada').sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
    const fotos = (await reverificadasNaVisita(r, v.id)).concat(daVisita);
    const itens = [];
    for (const f of fotos) {
      const t = (f.descricao || '').trim().replace(/[.;]?$/, ';');
      if (t !== ';' && !itens.includes(t)) itens.push(t);
    }
    if (itens.length) itens[itens.length - 1] = itens[itens.length - 1].replace(/;$/, '.');
    App._sairNotif = null;
    const sel = [];
    for (const f of fotos) sel.push(await selIrregularidade(f));
    await criarNotificacao(r.id, { itens, fotos: sel, data_vistoria: v.data, visitaId: v.id });
  }

  async function dialogoRelatorio(v, r) {
    const fotos = (await DB.byIndex('fotos', 'visitaId', v.id)).filter((f) => !f.excluido).sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
    const incl = fotos.filter((f) => !f.fora_relatorio);
    const escolha = { layout: String(await DB.kvGet('layoutRelatorio', '4')) };
    const opcao = (val, txt, desc) => h('label', { class: 'item', style: { display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' } },
      h('input', { type: 'radio', name: 'layout', value: val, checked: escolha.layout === val ? 'checked' : null, onchange: () => { escolha.layout = val; } }),
      h('div', {}, h('div', { class: 't' }, txt), h('div', { class: 'd' }, desc)));
    const corpo = h('div', {},
      h('p', { class: 'sub' }, incl.length + ' de ' + fotos.length + ' foto(s) entrarão no relatório. Para retirar uma foto, abra-a e desmarque “Incluir no relatório”.'),
      opcao('2', '2 fotos por página', 'Fotos grandes, uma abaixo da outra'),
      opcao('4', '4 fotos por página', 'Grade 2 × 2 (recomendado)'),
      opcao('6', '6 fotos por página', 'Grade 2 × 3, mais compacto'));
    const acao = await modal('Relatório fotográfico', corpo, [{ txt: 'Cancelar', valor: null }, { txt: '📤 Compartilhar', valor: 'comp' }, { txt: '⬇️ Baixar Word', cls: 'pri', valor: 'baixar' }]);
    if (!acao) return;
    DB.kvSet('layoutRelatorio', escolha.layout);
    const st = h('div', {}, h('span', { class: 'carregando' }), ' Gerando relatório…');
    const fundo = h('div', { class: 'modal-fundo' }, h('div', { class: 'modal' }, st));
    document.body.appendChild(fundo);
    try {
      const itens = [];
      const faltando = [];
      for (const f of incl) {
        let blob = await DB.blobGet(f.id);
        if (!blob && Sync.habilitado() && navigator.onLine) { try { blob = await Sync.baixarFoto(f); } catch (e) { /* */ } }
        if (!blob) { faltando.push(f); continue; }
        const leg = f.irregular ? 'IRREGULARIDADE: ' + (f.descricao || '') : (f.descricao || '');
        itens.push({ img: blob, legenda: leg, irregular: !!f.irregular, descricao: f.descricao || '',
          meta: dataHoraBR(f.dataHora) + (f.lat != null ? ' · ' + Foto.textoCoord(f.lat, f.lng) : '') });
      }
      if (faltando.length) throw new Error(faltando.length + ' foto(s) ainda não estão neste aparelho. Conecte-se à internet para baixá-las.');
      const dados = DocGen.montarDadosRelatorio(r, v, itens, { layout: +escolha.layout });
      const blob = await DocGen.gerar(await modeloDocx('relatorio'), dados, { type: 'blob' });
      const nome = nomeArquivo('RELATÓRIO FOTOGRÁFICO - ' + r.apelido + ' - VISITA ' + v.numero + ' - ' + X.dataBR(v.data).replace(/\//g, '-')) + '.docx';
      fundo.remove();
      if (acao === 'comp') await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      toast('Relatório gerado: ' + nome);
    } catch (e) {
      fundo.remove();
      console.error(e);
      toast(e.message, true);
    }
  }

  /* ================================================================== */
  /* Historico de irregularidades (pendente / sanada)                    */
  /* ================================================================== */
  const situacao = (f) => (f.situacao === 'sanada' ? 'sanada' : 'pendente');

  async function irregularidadesDe(registroId) {
    return (await DB.byIndex('fotos', 'registroId', registroId)).filter((f) => !f.excluido && f.irregular)
      .sort((a, b) => String(b.dataHora).localeCompare(a.dataHora));
  }

  /* Foto "atual" de uma irregularidade: a mais recente tirada numa verificacao
     "nao sanada"; sem isso, a foto original da constatacao. */
  async function fotoAtualIrr(f, mapa) {
    const vs = f.verificacoes || [];
    for (let i = vs.length - 1; i >= 0; i--) {
      const vf = vs[i];
      if (vf.status !== 'nao_sanada' || !vf.fotoId) continue;
      const fv = mapa ? mapa.get(vf.fotoId) : await DB.get('fotos', vf.fotoId);
      if (fv && !fv.excluido) return fv;
    }
    return f;
  }
  // item de anexo de notificacao para uma irregularidade (usa a foto atual)
  async function selIrregularidade(f, mapa) {
    const atual = await fotoAtualIrr(f, mapa);
    return { fotoId: atual.id, irrId: f.id, legenda: legendaPadrao(f) };
  }

  function itemIrregularidade(f, onclick, extra) {
    const img = h('img'); fotoAtualIrr(f).then((a) => urlFoto(situacao(f) === 'pendente' ? a : f)).then((u) => { img.src = u; });
    const st = situacao(f);
    const ult = (f.verificacoes || [])[(f.verificacoes || []).length - 1];
    return h('div', { class: 'item', style: { cursor: 'pointer' }, onclick },
      h('div', { class: 'item-irr' }, extra || null, img,
        h('div', { class: 'cresce' },
          h('span', { class: 'badge ' + st, style: { float: 'right', marginLeft: '6px' } }, st === 'sanada' ? '✓ Sanada' : 'Pendente'),
          h('div', { class: 't', style: { fontWeight: 500 } }, f.descricao || '(sem descrição)'),
          h('div', { class: 'd' }, 'Constatada em ' + dataHoraBR(f.dataHora).slice(0, 10) +
            (st === 'sanada' && f.sanadaEm ? ' · sanada em ' + dataLocalBR(f.sanadaEm) : '') +
            (st === 'pendente' && ult ? ' · última verificação ' + dataLocalBR(ult.data) + ': não sanada' : '')))));
  }

  async function painelIrregularidades(r) {
    const todas = await irregularidadesDe(r.id);
    const filtro = sessionStorage.getItem('filtro_irr') || 'pendente';
    const lista = todas.filter((f) => filtro === 'todas' || situacao(f) === filtro);
    const nP = todas.filter((f) => situacao(f) === 'pendente').length, nS = todas.length - nP;
    const bt = (k, t) => h('button', { class: filtro === k ? 'ativo' : '', onclick: () => { sessionStorage.setItem('filtro_irr', k); telaRegistro(r.id); } }, t);
    return h('div', {},
      h('div', { class: 'filtros' }, bt('pendente', 'Pendentes (' + nP + ')'), bt('sanada', 'Sanadas (' + nS + ')'), bt('todas', 'Todas (' + todas.length + ')')),
      todas.length ? h('div', { class: 'acoes', style: { marginTop: 0, marginBottom: '10px' } }, h('button', { class: 'btn', onclick: () => dialogoIrregularidades(r) }, '📄 Relatório de irregularidades')) : null,
      lista.length ? lista.map((f) => itemIrregularidade(f, () => { location.hash = '#/irregularidade/' + f.id; }))
        : h('div', { class: 'vazio' }, filtro === 'pendente' ? 'Nenhuma irregularidade pendente. 👍' : 'Nada por aqui.'));
  }

  async function telaIrregularidade(id, visitaId) {
    const f = await DB.get('fotos', id);
    if (!f || f.excluido) { rc($main, h('div', { class: 'vazio' }, 'Irregularidade não encontrada.')); return; }
    const r = await DB.get('registros', f.registroId);
    if (!r) { rc($main, h('div', { class: 'vazio' }, 'Obra não encontrada.')); return; }
    titulo('Irregularidade · ' + r.apelido, true);
    marcarNav(r.tipo === 'convenio' ? 'convenios' : 'contratos');
    const st = situacao(f);
    const visOrig = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
    const img = h('img', { class: 'grande' });
    urlFoto(f, true).then((u) => { img.src = u; });

    const cab = h('div', { class: 'card' },
      h('span', { class: 'badge ' + st, style: { float: 'right' } }, st === 'sanada' ? '✓ Sanada' : 'Pendente'),
      h('div', { class: 'sub' }, 'Constatada em ' + dataHoraBR(f.dataHora) + (visOrig ? ' · Visita nº ' + visOrig.numero : '') + ' · por ' + (f.criadoPor || '—')),
      h('h2', { style: { margin: '6px 0 10px' } }, f.descricao || '(sem descrição)'),
      img,
      f.lat != null ? h('div', { class: 'sub' }, '📍 ', h('a', { href: 'https://www.google.com/maps?q=' + f.lat + ',' + f.lng, target: '_blank', rel: 'noopener' }, Foto.textoCoord(f.lat, f.lng))) : null,
      pode.coletar() ? h('div', { class: 'acoes' }, h('button', { class: 'btn peq', onclick: () => abrirFoto(f, () => telaIrregularidade(id, visitaId)) }, '✏️ Editar descrição')) : null);

    const hist = h('div', { class: 'card' }, h('h2', {}, 'Histórico de verificações'));
    const verifs = (f.verificacoes || []).slice().reverse();
    if (!verifs.length) ap(hist, h('div', { class: 'sub' }, 'Ainda não verificada em visita posterior.'));
    for (const vf of verifs) {
      const fotoV = vf.fotoId ? await DB.get('fotos', vf.fotoId) : null;
      const box = h('div', { class: 'verif ' + vf.status },
        h('div', {}, h('b', {}, vf.status === 'sanada' ? '✓ Sanada' : '✗ Não sanada'), ' — ', dataHoraBR(vf.data), ' · ', vf.por || '—'),
        vf.descricao ? h('div', { style: { margin: '4px 0' } }, vf.descricao) : null);
      if (fotoV) {
        const i1 = h('img'), i2 = h('img');
        urlFoto(f).then((u) => { i1.src = u; });
        urlFoto(fotoV).then((u) => { i2.src = u; });
        ap(box, h('div', { class: 'antes-depois' },
          h('figure', {}, i1, h('figcaption', {}, 'Antes · ' + dataHoraBR(f.dataHora).slice(0, 10))),
          h('figure', { onclick: () => abrirFoto(fotoV) }, i2, h('figcaption', {}, 'Depois · ' + dataHoraBR(fotoV.dataHora).slice(0, 10)))));
      }
      if (pode.coletar()) ap(box, h('div', { class: 'acoes', style: { marginTop: '6px' } }, h('button', { class: 'btn peq perigo', onclick: async () => {
        let ok;
        if (fotoV && !fotoV.excluido) ok = await excluirFotos([fotoV.id], 'Excluir este registro do histórico e a foto dele?');
        else {
          ok = await confirmar('Excluir este registro do histórico?', 'Excluir', true);
          if (ok) await atualizarCampos('fotos', f.id, (o) => { o.verificacoes = (o.verificacoes || []).filter((x) => x.id !== vf.id); recalcularSituacao(o); });
        }
        if (ok) { toast('Registro excluído do histórico'); telaIrregularidade(id, visitaId); }
      } }, '🗑 Excluir este registro')));
      ap(hist, box);
    }

    const acoes = h('div', { class: 'card' },
      pode.coletar() && st === 'pendente' ? h('div', { class: 'grade-bt' },
        h('button', { class: 'btn ok grande', onclick: () => verificarIrregularidade(f, r, 'sanada', visitaId) }, '✓ Sanada'),
        h('button', { class: 'btn perigo grande', onclick: () => verificarIrregularidade(f, r, 'nao_sanada', visitaId) }, '✗ Não sanada')) : null,
      pode.coletar() && st === 'sanada' ? h('button', { class: 'btn peq', onclick: async () => {
        if (!(await confirmar('Reabrir esta irregularidade (voltar para pendente)?', 'Reabrir'))) return;
        await atualizarCampos('fotos', f.id, (o) => {
          o.verificacoes = (o.verificacoes || []).concat([{ id: DB.uuid(), data: new Date().toISOString(), status: 'nao_sanada', descricao: 'Reaberta.', fotoId: null, visitaId: visitaId || null, por: email() }]);
          recalcularSituacao(o);
        });
        telaIrregularidade(id, visitaId);
      } }, '↺ Reabrir (voltar para pendente)') : null,
      pode.coletar() ? h('div', { class: 'acoes' }, h('button', { class: 'btn peq perigo', onclick: async () => {
        if (await excluirFotos([f.id], 'Excluir esta irregularidade (foto, descrição e todo o histórico)? Ela não aparecerá mais para ninguém do grupo.')) { toast('Irregularidade excluída'); history.back(); }
      } }, '🗑 Excluir irregularidade')) : null,
      h('p', { class: 'dica' }, st === 'pendente' ? 'Irregularidades pendentes aparecem como opção nas notificações. Ao marcar como sanada, ela sai das opções de notificação e fica no histórico.' : 'Sanada: não aparece mais nas opções de notificação.'));
    rc($main, cab, acoes, hist);
    App._atualizarTela = () => telaIrregularidade(id, visitaId);
  }

  async function escolherFoto(titulo, fundo) {
    if (Camera.suportada()) {
      if (fundo) fundo.style.display = 'none';
      if (prefCamera() !== 'aparelho') {
        try { const res = await Camera.abrir({ modo: 'unica', titulo }); return res && res.aparelho ? res.aparelho[0] : res; }
        catch (e) { /* cai para o seletor */ } finally { if (fundo) fundo.style.display = ''; }
      } else if (fundo) fundo.style.display = '';
    }
    return new Promise((res) => {
      const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
      inp.addEventListener('change', () => res(inp.files[0] || null));
      inp.click();
    });
  }

  async function verificarIrregularidade(f, r, status, visitaId) {
    const dado = { descricao: '', foto: null, origem: 'camera' };
    const prev = h('div', { class: 'antes-depois', style: { marginBottom: '10px' } });
    const imgAntes = h('img'); urlFoto(f).then((u) => { imgAntes.src = u; });
    const imgDepois = h('img');
    rc(prev, h('figure', {}, imgAntes, h('figcaption', {}, 'Antes')), h('figure', {}, imgDepois, h('figcaption', {}, 'Depois (toque em Câmera ou Galeria)')));
    const inpGal = h('input', { type: 'file', accept: 'image/*', class: 'oculto' });
    inpGal.addEventListener('change', () => { if (inpGal.files[0]) { dado.foto = inpGal.files[0]; dado.origem = 'galeria'; imgDepois.src = URL.createObjectURL(dado.foto); } });
    const corpo = h('div', {},
      h('p', { class: 'sub', style: { marginTop: 0 } }, f.descricao || ''),
      prev,
      h('div', { class: 'acoes', style: { marginTop: 0 } },
        h('button', { class: 'btn', onclick: async (e) => {
          const b = await escolherFoto('Depois · ' + (f.descricao || ''), e.target.closest('.modal-fundo'));
          if (b) { dado.foto = b; dado.origem = 'camera'; imgDepois.src = URL.createObjectURL(b); }
        } }, '📷 Câmera'),
        h('button', { class: 'btn', onclick: () => inpGal.click() }, '🖼️ Galeria'), inpGal),
      campo(status === 'sanada' ? 'O que foi feito (providência adotada) *' : 'Situação encontrada *',
        inputArea(dado, 'descricao', { placeholder: status === 'sanada' ? 'Ex.: Telhas substituídas e cumeeiras refixadas.' : 'Ex.: Empresa ainda não iniciou a correção.' })));
    const ok = await modal(status === 'sanada' ? '✓ Registrar como sanada' : '✗ Registrar como não sanada', corpo, [
      { txt: 'Cancelar', valor: false },
      { txt: 'Salvar', cls: status === 'sanada' ? 'ok' : 'pri', valor: true, antes: () => {
        if (!dado.descricao.trim()) { toast('Descreva ' + (status === 'sanada' ? 'o que foi feito.' : 'a situação encontrada.'), true); return false; }
        if (status === 'sanada' && !dado.foto) return confirmar('Registrar como sanada sem foto do “depois”?', 'Registrar sem foto');
      } }]);
    if (!ok) return;
    let fotoV = null;
    if (dado.foto) {
      const visita = visitaId ? await DB.get('visitas', visitaId) : null;
      const sv = await salvarFotos([dado.foto], dado.origem, r, visita, { irregular: false });
      fotoV = sv[0] || null;
      if (fotoV) {
        const desc = (status === 'sanada' ? 'Correção: ' : 'Verificação: ') + dado.descricao.trim();
        fotoV = (await atualizarCampos('fotos', fotoV.id, (o) => { o.verificacaoDe = f.id; o.descricao = desc; })) || fotoV;
      }
    }
    const agora = new Date().toISOString();
    await atualizarCampos('fotos', f.id, (o) => {
      o.verificacoes = (o.verificacoes || []).concat([{ id: DB.uuid(), data: agora, status, descricao: dado.descricao.trim(), fotoId: fotoV ? fotoV.id : null, visitaId: visitaId || null, por: email() }]);
      recalcularSituacao(o);
    });
    toast(status === 'sanada' ? 'Irregularidade registrada como sanada' : 'Verificação registrada: não sanada');
    if (visitaId) history.back(); else telaIrregularidade(f.id, visitaId);
  }

  /* Relatório de irregularidades: escolhe quais (pendentes e/ou sanadas) e gera o Word com o histórico completo e fotos */
  async function dialogoIrregularidades(r) {
    const todas = (await irregularidadesDe(r.id)).sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
    const sel = new Set(todas.map((f) => f.id));
    const caixas = new Map();
    const contagem = h('div', { class: 'sub', style: { margin: '4px 0 8px' } });
    const atualizar = () => {
      caixas.forEach((c, id) => { c.checked = sel.has(id); });
      const nS = todas.filter((f) => sel.has(f.id) && situacao(f) === 'sanada').length;
      contagem.textContent = sel.size + ' de ' + todas.length + ' selecionada(s)' + (sel.size ? ' — ' + (sel.size - nS) + ' pendente(s), ' + nS + ' sanada(s)' : '');
    };
    const lista = h('div', {}, todas.map((f) => {
      const chk = h('input', { type: 'checkbox', onclick: (e) => e.stopPropagation(), onchange: (e) => { if (e.target.checked) sel.add(f.id); else sel.delete(f.id); atualizar(); } });
      caixas.set(f.id, chk);
      return itemIrregularidade(f, () => { if (sel.has(f.id)) sel.delete(f.id); else sel.add(f.id); atualizar(); }, chk);
    }));
    const marcar = (filtro) => { sel.clear(); todas.filter(filtro).forEach((f) => sel.add(f.id)); atualizar(); };
    const corpo = h('div', {},
      h('p', { class: 'sub', style: { marginTop: 0 } }, 'Selecione as irregularidades do relatório. Cada uma sai com a foto da constatação e todo o histórico de verificações (sanada / não sanada), com as fotos.'),
      h('div', { class: 'filtros', style: { marginBottom: '4px' } },
        h('button', { onclick: () => marcar(() => true) }, 'Todas'),
        h('button', { onclick: () => marcar((f) => situacao(f) === 'pendente') }, 'Só pendentes'),
        h('button', { onclick: () => marcar((f) => situacao(f) === 'sanada') }, 'Só sanadas'),
        h('button', { onclick: () => marcar(() => false) }, 'Nenhuma')),
      contagem, lista);
    atualizar();
    const exige = () => { if (!sel.size) { toast('Selecione ao menos uma irregularidade.', true); return false; } };
    const acao = await modal('Relatório de irregularidades', corpo, [{ txt: 'Cancelar', valor: null }, { txt: '📤 Compartilhar', valor: 'comp', antes: exige }, { txt: '⬇️ Baixar Word', cls: 'pri', valor: 'baixar', antes: exige }]);
    if (!acao || !sel.size) return;
    const st = h('div', {}, h('span', { class: 'carregando' }), ' Gerando relatório…');
    const fundo = h('div', { class: 'modal-fundo' }, h('div', { class: 'modal' }, st));
    document.body.appendChild(fundo);
    try {
      const faltando = [];
      const pegar = async (foto) => {
        if (!foto || foto.excluido) return null;
        let b = await DB.blobGet(foto.id);
        if (!b && Sync.habilitado() && navigator.onLine) { try { b = await Sync.baixarFoto(foto); } catch (e) { /* */ } }
        if (!b) faltando.push(foto.id);
        return b || null;
      };
      const visitaTxt = async (vid) => { const v = vid ? await DB.get('visitas', vid) : null; return v ? 'Visita nº ' + v.numero : ''; };
      const itens = [];
      let k = 0;
      for (const f of todas.filter((x) => sel.has(x.id))) {
        rc(st, h('span', { class: 'carregando' }), ' Preparando irregularidade ' + (++k) + ' de ' + sel.size + '…');
        const historico = [];
        for (const vf of f.verificacoes || []) {
          const fotoV = vf.fotoId ? await DB.get('fotos', vf.fotoId) : null;
          historico.push({
            data: vf.data ? dataHoraBR(vf.data) : '',
            status: vf.status === 'sanada' ? 'SANADA' : 'NÃO SANADA',
            descricao: vf.descricao || '',
            visita: await visitaTxt(vf.visitaId),
            por: vf.por || '',
            img: await pegar(fotoV),
          });
        }
        itens.push({
          descricao: f.descricao || '',
          sanada: situacao(f) === 'sanada',
          sanada_em: f.sanadaEm ? dataLocalBR(f.sanadaEm) : '',
          constatada_data: dataHoraBR(f.dataHora),
          constatada_visita: await visitaTxt(f.visitaId),
          constatada_por: f.criadoPor || '',
          img: await pegar(f),
          historico,
        });
      }
      if (faltando.length && !(await confirmar(faltando.length + ' foto(s) ainda não estão neste aparelho (sem internet para baixá-las). Gerar o relatório sem elas?', 'Gerar sem elas'))) { fundo.remove(); return; }
      rc(st, h('span', { class: 'carregando' }), ' Montando o documento…');
      const pessoas = await pessoasMap();
      const fiscais = snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao(r.tipo), pessoas, true);
      const dados = DocGen.montarDadosIrregularidades(r, itens, fiscais, X.hojeISO());
      const blob = await DocGen.gerar(await modeloDocx('irregularidades'), dados, { type: 'blob' });
      const nome = nomeArquivo('RELATÓRIO DE IRREGULARIDADES - ' + r.apelido + ' - ' + X.dataBR(X.hojeISO()).replace(/\//g, '-')) + '.docx';
      fundo.remove();
      if (acao === 'comp') await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      toast('Relatório gerado: ' + nome);
    } catch (e) {
      fundo.remove();
      console.error(e);
      toast(e.message, true);
    }
  }

  async function dialogoSanadas(r) {
    const sanadas = (await irregularidadesDe(r.id)).filter((f) => situacao(f) === 'sanada')
      .sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
    const sel = new Set(sanadas.map((f) => f.id));
    const lista = h('div', {}, sanadas.map((f) => {
      const chk = h('input', { type: 'checkbox', checked: 'checked', onclick: (e) => e.stopPropagation(), onchange: (e) => { if (e.target.checked) sel.add(f.id); else sel.delete(f.id); } });
      return itemIrregularidade(f, () => { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }, chk);
    }));
    const corpo = h('div', {}, h('p', { class: 'sub', style: { marginTop: 0 } }, 'Selecione as irregularidades sanadas que devem constar no relatório (antes e depois).'),
      h('div', { class: 'acoes', style: { marginTop: 0, marginBottom: '8px' } },
        h('button', { class: 'btn peq', onclick: () => { lista.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = true; }); sanadas.forEach((f) => sel.add(f.id)); } }, 'Marcar todas'),
        h('button', { class: 'btn peq', onclick: () => { lista.querySelectorAll('input[type=checkbox]').forEach((c) => { c.checked = false; }); sel.clear(); } }, 'Desmarcar todas')),
      lista);
    const acao = await modal('Relatório de irregularidades sanadas', corpo, [{ txt: 'Cancelar', valor: null }, { txt: '📤 Compartilhar', valor: 'comp' }, { txt: '⬇️ Baixar Word', cls: 'pri', valor: 'baixar' }]);
    if (!acao) return;
    if (!sel.size) { toast('Selecione ao menos uma irregularidade.', true); return; }
    const fundo = h('div', { class: 'modal-fundo' }, h('div', { class: 'modal' }, h('span', { class: 'carregando' }), ' Gerando relatório…'));
    document.body.appendChild(fundo);
    try {
      const pegar = async (foto) => {
        if (!foto) return null;
        let b = await DB.blobGet(foto.id);
        if (!b && Sync.habilitado() && navigator.onLine) { try { b = await Sync.baixarFoto(foto); } catch (e) { /* */ } }
        if (!b) throw new Error('Há fotos que ainda não estão neste aparelho. Conecte-se à internet e tente de novo.');
        return b;
      };
      const itens = [];
      for (const f of sanadas.filter((x) => sel.has(x.id))) {
        const vf = (f.verificacoes || []).filter((x) => x.status === 'sanada').pop() || {};
        const fotoV = vf.fotoId ? await DB.get('fotos', vf.fotoId) : null;
        const visA = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
        const visD = vf.visitaId ? await DB.get('visitas', vf.visitaId) : null;
        itens.push({
          antes_img: await pegar(f), antes_desc: f.descricao || '', antes_data: dataHoraBR(f.dataHora).slice(0, 10), antes_visita: visA ? 'Visita nº ' + visA.numero : '',
          depois_img: fotoV ? await pegar(fotoV) : null, depois_desc: vf.descricao || '', depois_data: vf.data ? dataLocalBR(vf.data) : '—',
          depois_visita: visD ? 'Visita nº ' + visD.numero : (fotoV ? '' : 'sem foto'), verificado_por: vf.por || '',
        });
      }
      const pessoas = await pessoasMap();
      const fiscais = snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao(r.tipo), pessoas, true);
      const dados = DocGen.montarDadosSanadas(r, itens, fiscais, X.hojeISO());
      const blob = await DocGen.gerar(await modeloDocx('sanadas'), dados, { type: 'blob' });
      const nome = nomeArquivo('IRREGULARIDADES SANADAS - ' + r.apelido + ' - ' + X.dataBR(X.hojeISO()).replace(/\//g, '-')) + '.docx';
      fundo.remove();
      if (acao === 'comp') await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      toast('Relatório gerado: ' + nome);
    } catch (e) {
      fundo.remove();
      console.error(e);
      toast(e.message, true);
    }
  }

  /* ================================================================== */
  /* Notificacoes                                                        */
  /* ================================================================== */
  function formatarNumero(fmt, v) {
    return String(fmt || '').replace(/\{(seq|ordinal)(\d?)\}/g, (m, k, pad) => String(v[k] == null ? '' : v[k]).padStart(+pad || 0, '0'))
      .replace(/\{ano\}/g, v.ano);
  }

  function snapshotAssinantes(lista, pessoas, comFuncao) {
    return (lista || []).map((it) => {
      const pid = typeof it === 'string' ? it : it.pessoaId;
      const p = pessoas[pid];
      if (!p) return null;
      const s = { pessoaId: pid, nome: p.nome, tratamento: p.tratamento || '', cargo: p.cargo || '', lotacao: p.lotacao || '', extra: p.extra || '' };
      if (comFuncao) s.funcao = it.funcao || '';
      return s;
    }).filter(Boolean);
  }

  async function criarNotificacao(registroId, base) {
    if (!pode.notificar()) { toast('Seu perfil não permite criar notificações.', true); history.back(); return; }
    const r = await DB.get('registros', registroId);
    if (!r) { history.back(); return; }
    const notifs = await notificacoesDe(registroId);
    // ordinal (1ª, 2ª ...)
    let ordinal;
    const maxOrd = Math.max(0, ...notifs.map((n) => n.ordinal || 0));
    if (notifs.length) ordinal = maxOrd + 1;
    else if (r.ultima_notif_anterior != null && r.ultima_notif_anterior !== '') ordinal = +r.ultima_notif_anterior + 1;
    else {
      const n = await perguntarNumero('Primeira notificação no app',
        'Qual foi o número da última notificação já emitida para “' + r.apelido + '”? (Informe 0 se esta for a primeira.)', 0);
      if (n === null) { history.back(); return; }
      ordinal = n + 1;
      if (pode.cadastro()) await atualizarCampos('registros', r.id, (o) => { o.ultima_notif_anterior = n; });
    }
    // numero sequencial do setor
    const hoje = X.hojeISO();
    const ano = +hoje.slice(0, 4);
    const fmt = (CONFIG.formato_numero || {})[r.tipo] || '';
    let seq = null;
    if (/\{seq\d?\}/.test(fmt)) {
      const todas = await DB.listar('notificacoes', (n) => n.ano === ano && n.seq);
      let maxSeq = Math.max(0, ...todas.map((n) => +n.seq || 0));
      let baseSeq = (CONFIG.seq_base || {})[ano];
      if (!todas.length && (baseSeq === undefined || baseSeq === null)) {
        const n = await perguntarNumero('Numeração do setor ' + ano,
          'Qual foi o último número de notificação emitido pelo setor em ' + ano + '? (Ex.: informe 12 se a última foi 012/' + ano + '. Informe 0 se nenhuma.)', 0);
        if (n === null) { history.back(); return; }
        baseSeq = n;
        if (pode.admin()) await salvarConfig((o) => { o.seq_base = Object.assign({}, o.seq_base, { [ano]: n }); });
      }
      seq = Math.max(maxSeq, +baseSeq || 0) + 1;
    }
    const pessoas = await pessoasMap();
    const ultima = notifs[0];
    const provPadrao = ((CONFIG.providencias_padrao || {})[r.tipo] || '').replace(/\{nome_texto\}/g, r.n_nome_texto || r.n_nome || '');
    const n = {
      id: DB.uuid(), registroId, tipo: r.tipo, ordinal, seq, ano,
      numero: formatarNumero(fmt, { seq, ano, ordinal }),
      data: hoje, data_vistoria: (base && base.data_vistoria) || hoje,
      visitaId: (base && base.visitaId) || null,
      constatacao: base && base.constatacao !== undefined ? base.constatacao : ((ultima && ultima.constatacao) || (CONFIG.constatacao_padrao || {})[r.tipo] || ''),
      itens: base ? (base.itens || []).slice() : [],
      providencias: base && base.providencias !== undefined ? base.providencias : (ultima ? ultima.providencias || '' : provPadrao),
      prazo_dias: r.prazo_dias || CONFIG.prazo_padrao || 3,
      equipe: '',
      fiscais: snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao(r.tipo), pessoas, true),
      coordenadores: snapshotAssinantes(r.coordenadores && r.coordenadores.length ? r.coordenadores : CONFIG.coordenadores_padrao, pessoas, false),
      fotos: base ? (base.fotos || []).map((f) => Object.assign({}, f)) : [],
      status: 'rascunho',
    };
    await DB.salvar('notificacoes', n, email());
    location.replace('#/notificacao/' + n.id);
  }

  async function modeloDocx(tipo) {
    const custom = await DB.arquivoGet('modelo_' + tipo);
    if (custom && custom.blob) return custom.blob.arrayBuffer();
    const resp = await fetch('modelos/modelo_' + tipo + '.docx');
    if (!resp.ok) throw new Error('Modelo não encontrado. Abra o app com internet uma vez para baixá-lo.');
    return resp.arrayBuffer();
  }

  async function gerarDocx(n, r) {
    const reg = n.status === 'emitida' && n.registroSnapshot ? n.registroSnapshot : r;
    const fotosDoc = [];
    const faltando = [];
    for (const sel of n.fotos || []) {
      const f = await DB.get('fotos', sel.fotoId);
      let blob = await DB.blobGet(sel.fotoId);
      if (!blob && f && Sync.habilitado() && navigator.onLine) { try { blob = await Sync.baixarFoto(f); } catch (e) { /* */ } }
      if (!blob && (!f || f.excluido)) continue; // foto excluida: fica fora do documento
      if (!blob) { faltando.push(sel); continue; }
      fotosDoc.push({ legenda: sel.legenda || '', imagem: blob });
    }
    if (faltando.length) throw new Error(faltando.length + ' foto(s) ainda não estão neste aparelho. Conecte-se à internet para baixá-las (ou peça a quem registrou para sincronizar).');
    const dados = DocGen.montarDados(reg, Object.assign({}, n, { fotosDoc }));
    const blob = await DocGen.gerar(await modeloDocx(reg.tipo), dados, { type: 'blob' });
    const nome = nomeArquivo(n.ordinal + 'ª NOTIFICAÇÃO - ' + (reg.apelido || ROTULO[reg.tipo])) + '.docx';
    return { blob, nome };
  }

  function legendaPadrao(f) {
    if (f.descricao && f.descricao.trim()) return f.descricao.trim().replace(/[.;:]?$/, '.');
    return 'Foto registrada em ' + (dataLocalBR(f.dataHora) || X.dataBR(X.hojeISO())) + '.';
  }

  /* ---------- Tela "Notificações": todas, com prazo de resposta ---------- */
  async function telaNotificacoes() {
    titulo('Notificações');
    const regs = new Map((await DB.all('registros')).map((r) => [r.id, r]));
    const todas = (await DB.listar('notificacoes')).filter((n) => { const r = regs.get(n.registroId); return r && !r.excluido; })
      .map((n) => ({ n, sit: situacaoNotif(n), r: regs.get(n.registroId) }));
    const grupos = [
      ['pendentes', 'Aguardando resposta', (x) => x.sit.k === 'aguardando' || x.sit.k === 'vencida'],
      ['vencidas', 'Prazo encerrado', (x) => x.sit.k === 'vencida'],
      ['nao_enviadas', 'Não enviadas', (x) => x.sit.k === 'nao_enviada'],
      ['respondidas', 'Respondidas', (x) => x.sit.k === 'respondida'],
      ['rascunhos', 'Rascunhos', (x) => x.sit.k === 'rascunho'],
      ['todas', 'Todas', () => true],
    ];
    let filtro = sessionStorage.getItem('filtro_notifs') || 'pendentes';
    const g = grupos.find((x) => x[0] === filtro) || grupos[0];
    const lista = todas.filter(g[2]).sort((a, b) => a.sit.ordem - b.sit.ordem
      || (a.sit.k === 'vencida' || a.sit.k === 'aguardando' ? String(a.n.prazoFinal).localeCompare(String(b.n.prazoFinal)) : String(b.n.data || '').localeCompare(String(a.n.data || ''))));
    const filtros = h('div', { class: 'filtros' }, grupos.map(([k, rot, f]) => {
      const c = todas.filter(f).length;
      return h('button', { class: k === g[0] ? 'ativo' : '', onclick: () => { sessionStorage.setItem('filtro_notifs', k); telaNotificacoes(); } }, rot + ' (' + c + ')');
    }));
    const avisoPermissao = ('Notification' in window) && Notification.permission === 'default' && todas.some((x) => x.sit.k === 'aguardando' || x.sit.k === 'vencida')
      ? h('div', { class: 'aviso' }, '🔔 Quer ser avisado no celular quando um prazo terminar? ',
        h('button', { class: 'btn peq', onclick: async () => { try { await Notification.requestPermission(); } catch (e) { /* */ } telaNotificacoes(); } }, 'Ativar avisos'))
      : null;
    rc($main, avisoPermissao, filtros,
      lista.length ? lista.map(({ n, sit, r }) => h('a', { class: 'item', href: '#/notificacao/' + n.id },
        h('div', { class: 't' }, (n.ordinal || '?') + 'ª Notificação · ' + (r.apelido || ROTULO[r.tipo])),
        h('div', { class: 'd' }, ROTULO[r.tipo] + ' nº ' + (r.numero || '—') + ' · Nº ' + (n.numero || '—') + ' · emitida em ' + dataLocalBR(n.emitidaEm || n.data)),
        h('div', { class: 'etqs' }, etq(sit.txt, sit.cls),
          n.enviadaEm ? etq('enviada ' + X.dataBR(n.enviadaEm), '') : null,
          n.prazoFinal && !n.respondidaEm ? etq('prazo até ' + X.dataBR(n.prazoFinal), '') : null)))
        : h('div', { class: 'vazio' }, g[0] === 'pendentes' ? 'Nenhuma notificação aguardando resposta. 👍' : 'Nada por aqui.'),
      h('p', { class: 'dica' }, 'O prazo conta em dias úteis a partir do dia seguinte ao envio (sábados, domingos e os feriados cadastrados em Ajustes › Padrões não contam). Para registrar envio ou resposta, abra a notificação.'));
    App._atualizarTela = () => telaNotificacoes();
  }

  /* Avisos de prazo: número no ícone "Notificações" e aviso no celular quando um prazo termina */
  let verificandoPrazos = null;
  function verificarPrazos() {
    if (!verificandoPrazos) verificandoPrazos = verificarPrazosInterno().finally(() => { verificandoPrazos = null; });
    return verificandoPrazos;
  }
  async function verificarPrazosInterno() {
    try {
      const regs = new Map((await DB.all('registros')).map((r) => [r.id, r]));
      const ativas = (await DB.listar('notificacoes')).filter((n) => { const r = regs.get(n.registroId); return r && !r.excluido && n.status === 'emitida' && n.enviadaEm && !n.respondidaEm; });
      const vencidas = ativas.filter((n) => situacaoNotif(n).k === 'vencida');
      const hoje = ativas.filter((n) => { const st = situacaoNotif(n); return st.k === 'aguardando' && st.restante === 0; });
      const b = document.getElementById('badge-notif');
      if (b) { b.textContent = vencidas.length || hoje.length || ''; b.className = 'nav-badge' + (vencidas.length ? ' on' : hoje.length ? ' on alerta' : ''); }
      const avisadas = await DB.kvGet('avisosPrazo', {});
      const novos = [];
      const pf = (n) => n.prazoFinal || prazoFinalUteis(n.enviadaEm, n.prazoDiasEnvio || n.prazo_dias);
      for (const n of vencidas) { const c = n.id + ':' + pf(n); if (!avisadas[c]) novos.push({ n, chave: c, txt: 'terminou em ' + X.dataBR(pf(n)) + ' sem resposta registrada.' }); }
      for (const n of hoje) { const c = n.id + ':hoje:' + pf(n); if (!avisadas[c]) novos.push({ n, chave: c, txt: 'termina HOJE (' + X.dataBR(pf(n)) + ').' }); }
      if (!novos.length) return;
      // grava antes de mostrar: nunca avisa duas vezes a mesma coisa
      for (const x of novos) avisadas[x.chave] = new Date().toISOString();
      await DB.kvSet('avisosPrazo', avisadas);
      const textos = novos.map((x) => (x.n.ordinal || '?') + 'ª Notificação — ' + ((regs.get(x.n.registroId) || {}).apelido || '') + ': o prazo de resposta ' + x.txt);
      // aviso no celular (se permitido), um por notificação
      if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
        try {
          const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 3000))]);
          if (reg) for (let i = 0; i < novos.length; i++) await reg.showNotification('⏰ Prazo de notificação', { body: textos[i], tag: novos[i].chave, data: { url: '#/notificacao/' + novos[i].n.id }, icon: 'icons/icon-192.png' });
        } catch (e) { /* */ }
      }
      // aviso dentro do app: um só, somando tudo
      if (document.visibilityState === 'visible') toast('⏰ ' + (textos.length === 1 ? textos[0] : textos.length + ' prazos de notificação terminaram ou terminam hoje. Veja a aba Notificações.'), true);
    } catch (e) { console.warn('prazos', e); }
  }
  App.verificarPrazos = verificarPrazos;

  /* ---------- Envio e resposta das notificações ---------- */
  function aplicarEnvio(o, dataISO) {
    o.enviadaEm = dataISO;
    o.prazoDiasEnvio = +o.prazo_dias || 3;
    o.prazoFinal = prazoFinalUteis(dataISO, o.prazoDiasEnvio);
    o.enviadaPor = email();
  }
  async function pedirDataEnvio(n, inicial) {
    const d = { data: inicial || X.hojeISO() };
    const inp = h('input', { type: 'date', value: d.data, max: X.hojeISO(), oninput: (e) => { d.data = e.target.value; prev(); } });
    const info = h('p', { class: 'sub' });
    const prev = () => { rc(info, d.data ? 'Prazo de ' + (+n.prazo_dias || 3) + ' dia(s) útil(eis) para ' + quemResponde(n.tipo) + ' responder: até ' + X.dataBR(prazoFinalUteis(d.data, +n.prazo_dias || 3)) + '.' : ''); };
    prev();
    const ok = await modal('📨 Registrar envio', h('div', {},
      h('p', {}, 'Data em que a notificação foi enviada (normalmente hoje). O app passa a contar o prazo a partir do dia seguinte, em dias úteis.'),
      campo('Data do envio', inp), info),
    [{ txt: 'Cancelar', valor: false }, { txt: 'Registrar envio', cls: 'pri', valor: true, antes: () => {
      if (!d.data) { toast('Informe a data.', true); return false; }
      if (d.data > X.hojeISO()) { toast('A data do envio não pode ser futura.', true); return false; }
    } }]);
    return ok ? d : null;
  }
  async function pedirResposta(n) {
    const d = { data: X.hojeISO(), obs: '' };
    const ok = await modal('✅ Registrar resposta', h('div', {},
      h('p', {}, 'Data em que ' + quemResponde(n.tipo) + ' respondeu à notificação. A pendência sai da lista de prazos.'),
      campo('Data da resposta', h('input', { type: 'date', value: d.data, min: n.enviadaEm || null, oninput: (e) => { d.data = e.target.value; } })),
      campo('Observação (opcional)', inputArea(d, 'obs', { placeholder: 'Ex.: Ofício nº 123/2026 — apresentou cronograma de correção.' }))),
    [{ txt: 'Cancelar', valor: false }, { txt: 'Registrar', cls: 'ok', valor: true, antes: () => {
      if (!d.data) { toast('Informe a data.', true); return false; }
      if (n.enviadaEm && d.data < n.enviadaEm) { toast('A resposta não pode ser anterior ao envio (' + X.dataBR(n.enviadaEm) + ').', true); return false; }
      if (d.data > X.hojeISO()) { toast('A data da resposta não pode ser futura.', true); return false; }
    } }]);
    return ok ? d : null;
  }
  function cartaoEnvio(n, r, redesenhar) {
    const sit = situacaoNotif(n);
    const card = h('div', { class: 'card' }, h('h2', {}, 'Envio e prazo de resposta'));
    if (!n.enviadaEm) {
      ap(card, h('p', { class: 'sub', style: { marginTop: 0 } }, 'Ainda não registrada como enviada. No dia do envio, toque em “📨 Enviado”: o app passa a contar o prazo de ' + (+n.prazo_dias || 3) + ' dia(s) útil(eis) para ' + quemResponde(n.tipo) + ' responder e avisa quando terminar.'));
      return card;
    }
    ap(card,
      h('div', { class: 'etqs', style: { marginTop: 0, marginBottom: '8px' } }, etq(sit.txt, sit.cls)),
      h('table', { class: 'tabela-info' },
        h('tr', {}, h('td', {}, 'Enviada em'), h('td', {}, X.dataBR(n.enviadaEm) + (n.enviadaPor ? ' · por ' + n.enviadaPor : ''))),
        h('tr', {}, h('td', {}, 'Prazo para resposta'), h('td', {}, (n.prazoDiasEnvio || n.prazo_dias || 3) + ' dia(s) útil(eis) → até ' + X.dataBR(n.prazoFinal))),
        n.respondidaEm ? h('tr', {}, h('td', {}, 'Respondida em'), h('td', {}, X.dataBR(n.respondidaEm) + (n.respondidaPor ? ' · registrado por ' + n.respondidaPor : ''))) : null,
        n.respostaObs ? h('tr', {}, h('td', {}, 'Observação'), h('td', {}, n.respostaObs)) : null));
    if (pode.notificar()) {
      ap(card, h('div', { class: 'acoes' },
        !n.respondidaEm ? h('button', { class: 'btn ok', onclick: async () => {
          const resp = await pedirResposta(n);
          if (!resp) return;
          await atualizarCampos('notificacoes', n.id, (o) => { o.respondidaEm = resp.data; o.respostaObs = resp.obs.trim(); o.respondidaPor = email(); });
          toast('Resposta registrada'); verificarPrazos(); redesenhar();
        } }, '✅ Registrar resposta') : null,
        n.respondidaEm ? h('button', { class: 'btn peq', onclick: async () => {
          if (!(await confirmar('Desfazer o registro da resposta? A notificação volta a aguardar resposta.', 'Desfazer'))) return;
          await atualizarCampos('notificacoes', n.id, (o) => { delete o.respondidaEm; delete o.respostaObs; delete o.respondidaPor; });
          verificarPrazos(); redesenhar();
        } }, 'Desfazer resposta') : null,
        h('button', { class: 'btn peq', onclick: async () => {
          const envio = await pedirDataEnvio(n, n.enviadaEm);
          if (!envio) return;
          await atualizarCampos('notificacoes', n.id, (o) => aplicarEnvio(o, envio.data));
          verificarPrazos(); redesenhar();
        } }, 'Corrigir data de envio'),
        !n.respondidaEm ? h('button', { class: 'btn peq perigo', onclick: async () => {
          if (!(await confirmar('Desfazer o registro de envio? O prazo deixa de ser contado.', 'Desfazer', true))) return;
          await atualizarCampos('notificacoes', n.id, (o) => { delete o.enviadaEm; delete o.prazoFinal; delete o.prazoDiasEnvio; delete o.enviadaPor; });
          verificarPrazos(); redesenhar();
        } }, 'Desfazer envio') : null));
    }
    return card;
  }

  async function telaNotificacao(id) {
    const original = await DB.get('notificacoes', id);
    if (!original || original.excluido) { rc($main, h('div', { class: 'vazio' }, 'Notificação não encontrada.')); return; }
    const r = await DB.get('registros', original.registroId);
    if (!r) { rc($main, h('div', { class: 'vazio' }, 'Cadastro desta notificação não encontrado.')); return; }
    marcarNav('notificacoes');
    const n = JSON.parse(JSON.stringify(original));
    let nBase = clonar(original);
    const emitida = n.status === 'emitida';
    const ro = emitida || !pode.notificar();
    titulo(n.ordinal + 'ª Notificação · ' + r.apelido, true);
    const pessoas = await pessoasMap();
    const todasFotos = await fotosDe(r.id);
    const mapaFotos = new Map(todasFotos.map((f) => [f.id, f]));
    const fotosReg = todasFotos.filter((f) => !(f.irregular && situacao(f) === 'sanada') || (n.fotos || []).some((s) => s.fotoId === f.id));
    // irregularidades pendentes com foto nova (verificacao "nao sanada"): na grade, aparecem uma vez so, com a foto nova
    const atualDe = new Map();
    for (const f of fotosReg) {
      if (!f.irregular || situacao(f) !== 'pendente') continue;
      const a = await fotoAtualIrr(f, mapaFotos);
      if (a.id !== f.id) atualDe.set(f.id, a);
    }
    const idsAtuais = new Set([...atualDe.values()].map((a) => a.id));
    const irrPorFoto = new Map([...atualDe.entries()].map(([irrId, a]) => [a.id, mapaFotos.get(irrId)]));
    const fotosGrade = fotosReg.map((f) => {
      if (idsAtuais.has(f.id)) return null; // ja representada pela irregularidade
      const a = atualDe.get(f.id);
      return a ? Object.assign({}, a, { irregular: true, descricao: f.descricao, _irr: f }) : f;
    }).filter(Boolean);
    const descSel = (s) => { const irr = (s.irrId && mapaFotos.get(s.irrId)) || irrPorFoto.get(s.fotoId); return ((irr || mapaFotos.get(s.fotoId) || {}).descricao) || ''; };
    const temIrr = (f) => (n.fotos || []).some((s) => s.irrId === f.id || s.fotoId === f.id || (atualDe.get(f.id) && s.fotoId === atualDe.get(f.id).id));
    let sujo = false;
    // rascunho: troca a foto antiga de uma irregularidade pela foto nova da verificacao
    if (n.status !== 'emitida') {
      let trocou = 0;
      for (const s of n.fotos || []) {
        const irr = s.irrId ? mapaFotos.get(s.irrId) : ((mapaFotos.get(s.fotoId) || {}).irregular ? mapaFotos.get(s.fotoId) : null);
        const a = irr && atualDe.get(irr.id);
        if (a && s.fotoId !== a.id) { s.fotoId = a.id; s.irrId = irr.id; trocou++; }
      }
      if (trocou) { sujo = true; setTimeout(() => toast(trocou + ' foto(s) de irregularidade atualizada(s) para a foto mais recente — salve o rascunho.'), 300); }
    }
    const marcar = () => { sujo = true; };

    /* --- cabecalho --- */
    const ordInp = h('input', { type: 'number', min: '1', value: n.ordinal, readonly: ro, oninput: (e) => { n.ordinal = parseInt(e.target.value, 10) || n.ordinal; marcar(); } });
    const numInp = inputTxt(n, 'numero', { readonly: ro, oninput: (e) => { n.numero = e.target.value; marcar(); } });
    const secCab = h('div', { class: 'card' },
      emitida ? h('div', { class: 'aviso' }, '🔒 Notificação emitida em ' + dataHoraBR(n.emitidaEm) + ' por ' + (n.emitidaPor || '—') + '. O conteúdo está bloqueado para preservar o histórico.') : null,
      h('div', { class: 'grade2' },
        campo('Ordem (ª notificação)', ordInp),
        campo('Número da notificação', numInp, ro ? null : 'Gerado automaticamente — pode ser alterado.'),
        campo('Data da notificação', h('input', { type: 'date', value: n.data, readonly: ro, oninput: (e) => { n.data = e.target.value; marcar(); } })),
        campo('Data da vistoria (in loco)', h('input', { type: 'date', value: n.data_vistoria, readonly: ro, oninput: (e) => { n.data_vistoria = e.target.value; marcar(); } }))));

    /* --- fatos --- */
    const itensBox = h('div', { class: 'lista-ord' });
    const desenharItens = () => {
      rc(itensBox, ...(n.itens || []).map((t, i) => h('div', { class: 'li' },
        (() => { const ta = h('textarea', { readonly: ro, oninput: (e) => { n.itens[i] = e.target.value; marcar(); } }); ta.value = t; return ta; })(),
        ro ? null : h('div', { class: 'ctl' },
          h('button', { class: 'btn peq', disabled: i === 0, onclick: () => { n.itens.splice(i - 1, 0, n.itens.splice(i, 1)[0]); marcar(); desenharItens(); } }, '▲'),
          h('button', { class: 'btn peq', disabled: i === n.itens.length - 1, onclick: () => { n.itens.splice(i + 1, 0, n.itens.splice(i, 1)[0]); marcar(); desenharItens(); } }, '▼'),
          h('button', { class: 'btn peq perigo', onclick: () => { n.itens.splice(i, 1); marcar(); desenharItens(); } }, '✕')))),
      ro ? null : h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', onclick: () => { n.itens = n.itens || []; n.itens.push(''); marcar(); desenharItens(); const t = itensBox.querySelectorAll('textarea'); if (t.length) t[t.length - 1].focus(); } }, '+ Item'),
        h('button', { class: 'btn peq', onclick: async () => {
          const descs = (n.fotos || []).map(descSel).filter((d) => d && d.trim());
          const unicos = [...new Set(descs.map((d) => d.trim().replace(/[.;]?$/, ';')))].filter((d) => !(n.itens || []).includes(d));
          if (!unicos.length) { toast('Nenhuma descrição nova nas fotos selecionadas.'); return; }
          n.itens = (n.itens || []).concat(unicos); marcar(); desenharItens();
        } }, '⇩ Usar descrições das fotos selecionadas'),
        h('button', { class: 'btn peq', onclick: async () => {
          const pend = fotosReg.filter((f) => f.irregular && situacao(f) === 'pendente' && !temIrr(f))
            .sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
          if (!pend.length) { toast('Todas as irregularidades pendentes já estão na notificação.'); return; }
          const novas = [];
          for (const f of pend) novas.push(await selIrregularidade(f, mapaFotos));
          n.fotos = (n.fotos || []).concat(novas);
          const novos = [...new Set(pend.map((f) => (f.descricao || '').trim().replace(/[.;]?$/, ';')).filter((d) => d !== ';'))].filter((d) => !(n.itens || []).includes(d));
          n.itens = (n.itens || []).concat(novos);
          marcar(); desenharItens(); desenharFotos();
          toast(pend.length + ' irregularidade(s) pendente(s) incluída(s)');
        } }, '⇩ Incluir irregularidades pendentes da obra')));
    };
    desenharItens();
    const secFatos = h('div', { class: 'card' }, h('h2', {}, '1. Dos fatos e irregularidades'),
      h('p', { class: 'sub' }, '“…visto que em diligência efetuada in loco no dia ' + (X.dataBR(n.data_vistoria) || '__') + ', ” + texto abaixo'),
      campo('Constatação', inputArea(n, 'constatacao', { readonly: ro, oninput: (e) => { n.constatacao = e.target.value; marcar(); } }), 'Use **texto** para negrito.'),
      h('h3', {}, 'Itens (lista com marcadores)'), itensBox);

    /* --- providencias --- */
    const secProv = h('div', { class: 'card' }, h('h2', {}, '2. Providências'),
      r.tipo === 'contrato' ? h('p', { class: 'sub' }, 'O parágrafo padrão do modelo (prazo, contrato nº, protocolo) é preenchido automaticamente. Abaixo, texto complementar opcional.') : null,
      campo(r.tipo === 'contrato' ? 'Providências complementares (opcional)' : 'Texto das providências', inputArea(n, 'providencias', { readonly: ro, oninput: (e) => { n.providencias = e.target.value; marcar(); } }), 'Use **texto** para negrito. Cada linha vira um parágrafo.'),
      campo('Prazo para manifestação (dias úteis)', h('input', { type: 'number', min: '1', value: n.prazo_dias, readonly: ro, oninput: (e) => { n.prazo_dias = parseInt(e.target.value, 10) || 3; marcar(); } })));

    /* --- assinaturas --- */
    const edFiscais = (n.fiscais || []).map((f) => ({ pessoaId: f.pessoaId, funcao: f.funcao }));
    const edCoord = (n.coordenadores || []).map((c) => ({ pessoaId: c.pessoaId }));
    const equipeAuto = () => DocGen.textoEquipe(snapshotAssinantes(edFiscais, pessoas, true));
    const equipeInp = inputArea(n, 'equipe', { readonly: ro, placeholder: equipeAuto(), style: { minHeight: '56px' }, oninput: (e) => { n.equipe = e.target.value; marcar(); } });
    const secAss = h('div', { class: 'card' }, h('h2', {}, 'Assinaturas e equipe'),
      ro ? h('div', {},
        h('h3', {}, 'Fiscais'), ...(n.fiscais || []).map((f) => h('div', { class: 'sub' }, f.nome + ' — ' + (f.funcao || ''))),
        h('h3', {}, 'Coordenadores'), ...(n.coordenadores || []).map((c) => h('div', { class: 'sub' }, c.nome)))
        : h('div', { onchange: () => { marcar(); equipeInp.placeholder = equipeAuto(); }, onclick: (e) => { if (e.target.tagName === 'BUTTON') { marcar(); equipeInp.placeholder = equipeAuto(); } } },
          h('h3', {}, 'Fiscais'), editorAssinantes(edFiscais, pessoas, 'fiscal', true, r.tipo),
          h('h3', {}, 'Coordenadores'), editorAssinantes(edCoord, pessoas, 'coordenador', false, r.tipo)),
      campo('Texto da equipe (“representada pelo …”)', equipeInp, 'Deixe vazio para gerar a partir dos fiscais.'));

    /* --- fotos --- */
    const fotosBox = h('div');
    const desenharFotos = () => {
      const selIds = (n.fotos || []).map((s) => s.fotoId);
      const ordenada = h('div', { class: 'lista-ord' }, ...(n.fotos || []).map((s, i) => {
        const f = mapaFotos.get(s.fotoId) || { id: s.fotoId };
        const img = h('img');
        urlFoto(f).then((u) => { img.src = u; });
        const ta = h('textarea', { readonly: ro, placeholder: 'Legenda', oninput: (e) => { s.legenda = e.target.value; marcar(); } });
        ta.value = s.legenda || '';
        const nova = s.irrId && s.irrId !== s.fotoId && f.dataHora ? ' · foto atualizada em ' + dataHoraBR(f.dataHora).slice(0, 10) : '';
        return h('div', { class: 'li' }, img, h('div', { style: { flex: 1 } }, h('div', { class: 'sub' }, 'Imagem ' + (i + 1) + nova), ta),
          ro ? null : h('div', { class: 'ctl' },
            h('button', { class: 'btn peq', disabled: i === 0, onclick: () => { n.fotos.splice(i - 1, 0, n.fotos.splice(i, 1)[0]); marcar(); desenharFotos(); } }, '▲'),
            h('button', { class: 'btn peq', disabled: i === n.fotos.length - 1, onclick: () => { n.fotos.splice(i + 1, 0, n.fotos.splice(i, 1)[0]); marcar(); desenharFotos(); } }, '▼'),
            h('button', { class: 'btn peq perigo', onclick: () => { n.fotos.splice(i, 1); marcar(); desenharFotos(); } }, '✕')));
      }));
      rc(fotosBox, 
        ro ? null : h('p', { class: 'sub' }, 'Toque nas fotos para incluir/remover do anexo (a ordem de toque define a numeração).'),
        ro ? null : gradeFotos(fotosGrade, { selecionadas: selIds, onclick: (f) => {
          const irr = f._irr;
          const i = irr ? (n.fotos || []).findIndex((s) => s.fotoId === f.id || s.irrId === irr.id || s.fotoId === irr.id) : selIds.indexOf(f.id);
          if (i >= 0) n.fotos.splice(i, 1);
          else { n.fotos = n.fotos || []; n.fotos.push(irr ? { fotoId: f.id, irrId: irr.id, legenda: legendaPadrao(irr) } : { fotoId: f.id, legenda: legendaPadrao(f) }); }
          marcar(); desenharFotos();
        } }),
        !fotosReg.length && !ro ? h('div', { class: 'vazio' }, 'Nenhuma foto coletada para esta obra. ', h('a', { href: '#/coleta/' + r.id }, 'Coletar fotos')) : null,
        (n.fotos || []).length ? h('h3', {}, 'Anexos (' + n.fotos.length + ')') : null, ordenada);
    };
    desenharFotos();
    const secFotos = h('div', { class: 'card' }, h('h2', {}, 'Anexos — fotos'), fotosBox);

    /* --- acoes --- */
    async function salvar(silencioso) {
      if (original.status === 'emitida' && ro) return;
      if (!ro) {
        // emitida em outro aparelho enquanto esta tela estava aberta: não altera o documento emitido
        const atualDB = await DB.get('notificacoes', id);
        if (atualDB && atualDB.status === 'emitida' && nBase.status !== 'emitida') {
          sujo = false; toast('Esta notificação foi emitida em outro aparelho; as alterações desta tela não foram gravadas.', true);
          App._sairNotif = null; return;
        }
      }
      if (!ro) {
        n.fiscais = snapshotAssinantes(edFiscais, pessoas, true);
        n.coordenadores = snapshotAssinantes(edCoord, pessoas, false);
        n.itens = (n.itens || []).map((t) => t.trim()).filter(Boolean);
      }
      const salvo = await salvarMudancas('notificacoes', nBase, n);
      Object.assign(original, salvo);
      nBase = clonar(n);
      sujo = false;
      if (!silencioso) toast('Rascunho salvo');
    }
    function validar() {
      const erros = [];
      if (!n.data) erros.push('data da notificação');
      if (!n.data_vistoria) erros.push('data da vistoria');
      if (!n.numero) erros.push('número');
      if (!edFiscais.length && !(n.fiscais || []).length) erros.push('ao menos um fiscal');
      if (erros.length) { toast('Preencha: ' + erros.join(', '), true); return false; }
      return true;
    }
    async function numeroDuplicado() {
      if (!n.numero) return false;
      const outras = await DB.listar('notificacoes', (o) => o.id !== n.id && o.numero === n.numero && o.tipo === n.tipo && (o.ano === n.ano || !n.ano) && (n.tipo !== 'contrato' || o.registroId === n.registroId));
      return outras.length > 0;
    }
    async function gerar(compartilhar) {
      if (!validar()) return;
      if (!ro) await salvar(true);
      return gerarDireto(compartilhar);
    }
    async function gerarDireto(compartilhar) {
      const st = h('div', {}, h('span', { class: 'carregando' }), ' Gerando documento…');
      const fundo = h('div', { class: 'modal-fundo' }, h('div', { class: 'modal' }, st));
      document.body.appendChild(fundo);
      try {
        const { blob, nome } = await gerarDocx(original, r);
        fundo.remove();
        if (compartilhar) await compartilharBlob(blob, nome, nome);
        else baixarBlob(blob, nome);
        toast('Documento gerado: ' + nome);
      } catch (e) {
        fundo.remove();
        console.error(e);
        toast(e.message, true);
      }
    }
    let emitindo = false;
    async function emitir(comEnvio) {
      if (emitindo) return;
      emitindo = true;
      try { await emitirInterno(comEnvio); } finally { emitindo = false; }
    }
    async function emitirInterno(comEnvio) {
      if (!validar()) return;
      const atualDB = await DB.get('notificacoes', id);
      if (atualDB && atualDB.status === 'emitida') { toast('Esta notificação já foi emitida (em outro aparelho).', true); telaNotificacao(id); return; }
      if (await numeroDuplicado() && !(await confirmar('Já existe outra notificação com o número ' + n.numero + '. Emitir mesmo assim?', 'Emitir'))) return;
      if (!(n.fotos || []).length && !(await confirmar('Esta notificação não tem fotos anexas. Emitir mesmo assim?', 'Emitir'))) return;
      let envio = null;
      if (comEnvio) {
        envio = await pedirDataEnvio(n);
        if (!envio) return;
      } else if (!(await confirmar('Ao emitir, o conteúdo fica bloqueado e registrado no histórico. Continuar?', 'Emitir'))) return;
      await salvar(true);
      const snap = Object.assign({}, r);
      for (const k of ['_pendente', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor']) delete snap[k];
      n.status = 'emitida'; n.emitidaEm = new Date().toISOString(); n.emitidaPor = email();
      sujo = false;
      const emit = await atualizarCampos('notificacoes', id, (o) => {
        o.registroSnapshot = snap; o.status = n.status; o.emitidaEm = n.emitidaEm; o.emitidaPor = n.emitidaPor;
        if (envio) aplicarEnvio(o, envio.data);
      });
      Object.assign(original, emit);
      App._sairNotif = null;
      await gerarDireto();
      await telaNotificacao(id);
    }

    const acoes = h('div', { class: 'card' }, h('div', { class: 'acoes', style: { marginTop: 0 } },
      !ro ? h('button', { class: 'btn', onclick: () => salvar() }, '💾 Salvar rascunho') : null,
      h('button', { class: 'btn pri', onclick: () => gerar(false) }, '⬇️ Baixar Word (.docx)'),
      h('button', { class: 'btn', onclick: () => gerar(true) }, '📤 Compartilhar'),
      !ro ? h('button', { class: 'btn ok', onclick: () => emitir(false) }, '✅ Emitir') : null,
      !ro ? h('button', { class: 'btn', onclick: () => emitir(true), title: 'Emite a notificação e registra o envio com a data de hoje' }, '📨 Enviado') : null,
      emitida && !original.enviadaEm && pode.notificar() ? h('button', { class: 'btn pri', onclick: async () => {
        const envio = await pedirDataEnvio(original);
        if (!envio) return;
        await atualizarCampos('notificacoes', id, (o) => aplicarEnvio(o, envio.data));
        toast('Envio registrado — prazo até ' + X.dataBR(prazoFinalUteis(envio.data, +original.prazo_dias || 3)));
        verificarPrazos(); telaNotificacao(id);
      } }, '📨 Enviado') : null),
      h('div', { class: 'acoes' },
        emitida && pode.notificar() ? h('button', { class: 'btn peq', onclick: () => criarNotificacao(r.id, n) }, '↻ Nova notificação a partir desta (reiteração)') : null,
        emitida && pode.admin() ? h('button', { class: 'btn peq', onclick: async () => {
          if (!(await confirmar('Reabrir para edição? A notificação voltará a ser rascunho' + (original.enviadaEm ? ' e o registro de envio/resposta será apagado (registre o envio de novo ao reemitir).' : '.'), 'Reabrir'))) return;
          await atualizarCampos('notificacoes', id, (o) => { o.status = 'rascunho'; delete o.emitidaEm; for (const k of ['enviadaEm', 'prazoFinal', 'prazoDiasEnvio', 'enviadaPor', 'respondidaEm', 'respostaObs', 'respondidaPor']) delete o[k]; });
          verificarPrazos(); telaNotificacao(id);
        } }, '🔓 Reabrir') : null,
        (!emitida && pode.notificar()) || pode.admin() ? h('button', { class: 'btn peq perigo', onclick: async () => {
          if (!(await confirmar('Excluir esta notificação?', 'Excluir', true))) return;
          await DB.excluir('notificacoes', id, email()); verificarPrazos(); location.replace('#/registro/' + r.id);
        } }, 'Excluir') : null),
      h('p', { class: 'dica' }, 'Dica: para PDF, abra o .docx no Word (celular ou computador) e use “Salvar como PDF”.'));

    rc($main, secCab, emitida ? cartaoEnvio(original, r, () => telaNotificacao(id)) : null, secFatos, secProv, secAss, secFotos, acoes);
    // salvamento automatico do rascunho ao sair da tela
    App._sairNotif = async () => { if (sujo && !ro) await salvar(true); };
  }

  /* ================================================================== */
  /* Ajustes                                                             */
  /* ================================================================== */
  async function telaConfig(sub) {
    titulo('Ajustes', !!sub);
    if (sub === 'pessoas') return telaPessoas();
    const u = App.usuario();
    const cards = [];

    /* conta */
    const contaCard = h('div', { class: 'card' }, h('h2', {}, 'Conta e sincronização'));
    if (!Sync.habilitado()) {
      const cfgArq = window.APP_CONFIG || null;
      const man = { apiUrl: '', clientId: '' };
      ap(contaCard,
        h('div', { class: 'aviso' }, 'Modo local: os dados ficam somente neste aparelho (sem login).'),
        h('p', { class: 'sub' }, 'Diagnóstico do config.js: ',
          !cfgArq ? h('b', {}, 'não foi lido (erro de digitação no arquivo — confira aspas e vírgulas).')
            : h('span', {}, 'API_URL ', h('b', {}, cfgArq.API_URL ? 'preenchida' : 'VAZIA'), ' · GOOGLE_CLIENT_ID ', h('b', {}, cfgArq.GOOGLE_CLIENT_ID ? 'preenchido' : 'VAZIO'))),
        h('button', { class: 'btn', onclick: forcarAtualizacao }, '🔄 Recarregar app sem cache'),
        h('h3', {}, 'Ou conecte manualmente neste aparelho'),
        campo('URL do Apps Script (/exec)', inputTxt(man, 'apiUrl', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec' })),
        campo('ID do cliente Google', inputTxt(man, 'clientId', { placeholder: '….apps.googleusercontent.com' })),
        h('button', { class: 'btn pri', onclick: () => {
          if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(man.apiUrl.trim())) { toast('A URL deve começar com https://script.google.com/ e terminar em /exec', true); return; }
          if (!/\.apps\.googleusercontent\.com$/.test(man.clientId.trim())) { toast('O ID do cliente deve terminar em .apps.googleusercontent.com', true); return; }
          Sync.salvarConfigLocal({ apiUrl: man.apiUrl.trim(), clientId: man.clientId.trim() });
          location.reload();
        } }, 'Conectar'));
    } else if (!Sync.token() && !u) {
      const alvo = h('div');
      ap(contaCard, h('p', { class: 'sub' }, 'Entre para sincronizar com o grupo.'), alvo);
      Sync.renderizarBotao(alvo);
    } else {
      const ult = await DB.kvGet('ultimaSync', null);
      const alvo = h('div', { style: { marginTop: '8px' } });
      ap(contaCard, 
        h('div', {}, h('b', {}, u ? u.nome || u.email : '—'), ' ', h('span', { class: 'badge' }, { admin: 'Administrador', fiscal: 'Fiscal', consulta: 'Consulta' }[perfil()] || perfil())),
        h('div', { class: 'sub' }, u ? u.email : ''),
        h('div', { class: 'sub' }, 'Última sincronização: ' + (ult ? dataHoraBR(ult) : 'nunca')),
        Sync.versaoServidor && Sync.versaoServidor < 5 ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, '⚠️ O servidor (Code.gs) está numa versão antiga, sujeita a perda de sincronismo. O administrador deve colar o Code.gs novo no Apps Script e publicar como nova versão (Guia de publicação, Parte G).') : null,
        Sync.estado === 'erro' ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, Sync.erro) : null,
        Sync.estado === 'sem_acesso' ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, 'Seu e-mail não está autorizado. Peça ao administrador para incluí-lo.') : null,
        !Sync.token() ? h('div', { class: 'sub', style: { marginTop: '8px' } }, 'Sessão expirada — entre novamente para sincronizar:') : null,
        !Sync.token() ? alvo : null,
        h('div', { class: 'acoes' },
          h('button', { class: 'btn pri', onclick: async () => { await Sync.sincronizar(); telaConfig(); } }, '🔄 Sincronizar agora'),
          h('button', { class: 'btn', onclick: async () => { if (await confirmar('Sair da conta neste aparelho? Os dados locais continuam guardados.', 'Sair')) { Sync.sair(); rotear(); } } }, 'Sair'),
          h('button', { class: 'btn', onclick: forcarAtualizacao }, 'Recarregar app'),
          h('button', { class: 'btn peq', onclick: async () => {
            if (!(await confirmar('Reenviar ao servidor todos os dados guardados neste aparelho? Use se algo registrado aqui não aparece nos outros celulares. Nada é apagado.', 'Reenviar'))) return;
            const n = await Sync.reenviarTudo();
            toast(n + ' registro(s) marcados para reenvio');
            await Sync.sincronizar(); telaConfig();
          } }, 'Reenviar dados deste aparelho')));
      if (!Sync.token()) Sync.renderizarBotao(alvo);
    }
    cards.push(contaCard);

    /* diagnostico */
    if (Sync.habilitado()) {
      const pendPor = {};
      for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config']) pendPor[e] = (await DB.all(e)).filter((o) => o._pendente).length;
      const fotosSemDrive = (await DB.all('fotos')).filter((f) => !f.driveId && !f.excluido);
      let semArquivo = 0;
      for (const f of fotosSemDrive) if (!(await DB.blobGet(f.id))) semArquivo++;
      const log = Sync.lerLog().slice().reverse();
      const resumo = {
        app: '3.2.2', servidor: Sync.versaoServidor || '?', usuario: (u || {}).email, perfil: perfil(), estado: Sync.estado, erro: Sync.erro || '',
        online: navigator.onLine, ultimaSync: await DB.kvGet('ultimaSync', null), cursor: await DB.kvGet('servidorDesde', 0),
        pendentes: pendPor, fotosAguardandoEnvio: fotosSemDrive.length - semArquivo, fotosDeOutroAparelhoSemEnvio: semArquivo,
        aparelho: navigator.userAgent, log,
      };
      const txtDiag = JSON.stringify(resumo, null, 1);
      cards.push(h('details', { class: 'card' },
        h('summary', { style: { fontWeight: '600', cursor: 'pointer' } }, 'Diagnóstico da sincronização'),
        h('div', { class: 'sub', style: { marginTop: '8px' } }, 'Pendentes neste aparelho: ' + (Object.entries(pendPor).filter((x) => x[1]).map(([k, v]) => v + ' ' + k).join(', ') || 'nenhum')),
        h('div', { class: 'sub' }, 'Fotos aguardando envio: ' + resumo.fotosAguardandoEnvio + (semArquivo ? ' · ' + semArquivo + ' foto(s) registradas em outro aparelho ainda não enviadas por ele' : '')),
        h('div', { class: 'sub' }, 'Servidor: versão ' + resumo.servidor + ' · estado: ' + (Sync.estado || '—')),
        h('h3', {}, 'Últimos eventos'),
        log.length ? h('div', { class: 'lista-log' }, log.slice(0, 15).map((x) => h('div', { class: 'sub', style: { borderBottom: '1px solid var(--linha)', padding: '4px 0' } },
          h('b', {}, dataHoraBR(x.em) + ' · ' + x.tipo), ' — ', x.msg, x.extra ? h('div', { style: { fontSize: '11px', opacity: 0.8, wordBreak: 'break-word' } }, x.extra.slice(0, 200)) : null)))
          : h('div', { class: 'sub' }, 'Nenhum problema registrado.'),
        h('div', { class: 'acoes' },
          h('button', { class: 'btn peq', onclick: async () => {
            try { await navigator.clipboard.writeText(txtDiag); toast('Diagnóstico copiado — cole na conversa com o suporte'); }
            catch (e) { baixarBlob(new Blob([txtDiag], { type: 'text/plain' }), 'diagnostico-sincronizacao.txt'); }
          } }, '📋 Copiar diagnóstico'),
          h('button', { class: 'btn peq', onclick: () => { Sync.limparLog(); telaConfig(); } }, 'Limpar eventos')),
        h('p', { class: 'dica' }, 'Os erros do servidor também ficam na aba “log” da planilha.')));
    }

    /* aparencia e camera */
    const seg = (opcoes, atual, aoEscolher) => {
      const box = h('div', { class: 'seg' });
      const desenhar = (v) => rc(box, opcoes.map(([val, txt]) => h('button', { class: v === val ? 'ativo' : '', onclick: () => { aoEscolher(val); desenhar(val); } }, txt)));
      desenhar(atual);
      return box;
    };
    let temaAtual = 'auto'; try { temaAtual = localStorage.getItem('tema') || 'auto'; } catch (e) { /* */ }
    let rapida = false; try { rapida = localStorage.getItem('cam_rapida') === '1'; } catch (e) { /* */ }
    cards.push(h('div', { class: 'card' }, h('h2', {}, 'Aparência e câmera'),
      campoBloco('Tema', seg([['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']], temaAtual, aplicarTema)),
      campoBloco('Câmera nas visitas', seg([['app', 'Câmera do app'], ['aparelho', 'Câmera do celular']], prefCamera(), (v) => { try { localStorage.setItem('camera_pref', v); } catch (e) { /* */ } }),
        'Câmera do app: fica aberta para várias fotos seguidas, com troca de lente (grande angular quando o celular permite), zoom, toque para focar e flash. Câmera do celular: todos os recursos do aparelho, uma foto por vez.'),
      h('label', { class: 'linha sub' }, h('input', { type: 'checkbox', checked: rapida ? 'checked' : null, onchange: (e) => { try { localStorage.setItem('cam_rapida', e.target.checked ? '1' : '0'); } catch (er) { /* */ } } }),
        'Captura rápida (usa o quadro do vídeo, resolução menor)'),
      h('div', { class: 'acoes' }, h('button', { class: 'btn peq', onclick: testarCameras }, '🔍 Testar câmeras deste celular')),
      h('div', { class: 'dica' }, 'Mostra quais lentes o celular libera para o app (grande angular, principal, teleobjetiva) e permite escolher qual é usada no botão 0,5.')));

    /* assinantes */
    const pessoas = await DB.listar('pessoas');
    const pmap = {}; pessoas.forEach((p) => { pmap[p.id] = p; });
    cards.push(h('div', { class: 'card' }, h('h2', {}, 'Assinantes'),
      h('p', { class: 'sub' }, pessoas.length + ' pessoa(s) cadastrada(s): ' + pessoas.map((p) => p.nome.split(' ')[0]).join(', ')),
      h('a', { class: 'btn', href: '#/config/pessoas' }, pode.admin() ? 'Gerenciar assinantes' : 'Ver assinantes')));

    /* padroes */
    if (pode.admin()) {
      const c = JSON.parse(JSON.stringify(CONFIG));
      const baseCfg = clonar(CONFIG);
      const fisc = (c.fiscais_padrao || []).map((pid) => ({ pessoaId: pid }));
      const coord = (c.coordenadores_padrao || []).map((pid) => ({ pessoaId: pid }));
      const funcTxt = { contrato: (c.funcao_padrao.contrato || []).join('\n'), convenio: (c.funcao_padrao.convenio || []).join('\n') };
      const anoAtual = new Date().getFullYear();
      const seqObj = { v: (c.seq_base || {})[anoAtual] == null ? '' : c.seq_base[anoAtual] };
      cards.push(h('div', { class: 'card' }, h('h2', {}, 'Padrões'),
        h('p', { class: 'sub' }, 'Assinantes usados automaticamente em novos cadastros e notificações. Podem ser trocados em cada contrato/convênio.'),
        h('h3', {}, 'Fiscais padrão'), editorAssinantes(fisc, pmap, 'fiscal', false, 'contrato'),
        h('h3', {}, 'Coordenadores padrão'), editorAssinantes(coord, pmap, 'coordenador', false, 'contrato'),
        h('h3', {}, 'Funções dos fiscais'),
        h('div', { class: 'grade2' },
          campo('Contrato (uma por linha, na ordem)', inputArea(funcTxt, 'contrato')),
          campo('Convênio (uma por linha, na ordem)', inputArea(funcTxt, 'convenio'))),
        h('h3', {}, 'Numeração'),
        h('div', { class: 'grade2' },
          campo('Formato do nº — Convênio', inputTxt(c.formato_numero, 'convenio')),
          campo('Formato do nº — Contrato', inputTxt(c.formato_numero, 'contrato'))),
        h('div', { class: 'dica' }, 'Use {seq3} = sequencial do setor no ano (013), {ano} = ano, {ordinal2} = ordem da notificação do contrato (05).'),
        campo('Último nº sequencial emitido antes do app em ' + anoAtual, inputTxt(seqObj, 'v', { type: 'number', min: '0' })),
        h('h3', {}, 'Textos padrão'),
        campo('Constatação padrão — Contrato', inputArea(c.constatacao_padrao, 'contrato')),
        campo('Constatação padrão — Convênio', inputArea(c.constatacao_padrao, 'convenio')),
        campo('Providências padrão — Convênio', inputArea(c.providencias_padrao, 'convenio'), '{nome_texto} é trocado pelo nome da notificada. **texto** = negrito.'),
        campo('Providências complementares padrão — Contrato', inputArea(c.providencias_padrao, 'contrato')),
        campo('Prazo padrão (dias úteis)', inputTxt(c, 'prazo_padrao', { type: 'number', min: '1' })),
        campo('Feriados (não contam no prazo das notificações)', inputArea(c, 'feriados', { placeholder: '01/01/2026\n20/11/2026\n25/12/2026' }), 'Um por linha, no formato dd/mm/aaaa (nacionais, estaduais e municipais). Sábados e domingos já não contam.'),
        h('h3', {}, 'Fotos no Google Drive'),
        campo('Pastas das fotos', inputTxt(c, 'pasta_fotos', { placeholder: '{tipo}-{numero}/{data}' }),
          'Dentro da pasta Fotos. Use / para criar subpastas. {tipo} = Conv ou Contr · {numero} = nº do contrato/convênio · {apelido} = nome curto · {data} = data da visita (29.09.2026) · {ano} · {visita} = “Visita 3”. Ex.: {tipo}-{numero}/{data} → Conv-013-2023/29.09.2026. Vale para as próximas fotos enviadas.'),
        h('div', { class: 'acoes' }, h('button', { class: 'btn pri', onclick: async () => {
          c.fiscais_padrao = fisc.map((x) => x.pessoaId);
          c.coordenadores_padrao = coord.map((x) => x.pessoaId);
          c.funcao_padrao = { contrato: funcTxt.contrato.split('\n').map((s) => s.trim()).filter(Boolean), convenio: funcTxt.convenio.split('\n').map((s) => s.trim()).filter(Boolean) };
          c.prazo_padrao = parseInt(c.prazo_padrao, 10) || 3;
          c.pasta_fotos = String(c.pasta_fotos || '').trim() || CONFIG_PADRAO.pasta_fotos;
          c.seq_base = Object.assign({}, c.seq_base);
          if (seqObj.v === '' || seqObj.v === null) delete c.seq_base[anoAtual]; else c.seq_base[anoAtual] = parseInt(seqObj.v, 10) || 0;
          await salvarConfig((o) => { for (const k of Object.keys(c)) if (!CAMPOS_SISTEMA.includes(k) && JSON.stringify(baseCfg[k]) !== JSON.stringify(c[k])) o[k] = clonar(c[k]); });
          toast('Padrões salvos');
        } }, 'Salvar padrões'))));
    }

    /* modelos */
    const modCard = h('div', { class: 'card' }, h('h2', {}, 'Modelos do Word'));
    const ROT_MOD = { contrato: 'Notificação — Contrato', convenio: 'Notificação — Convênio', relatorio: 'Relatório fotográfico', irregularidades: 'Relatório de irregularidades' };
    for (const tipo of ['contrato', 'convenio', 'relatorio', 'irregularidades']) {
      const custom = await DB.arquivoGet('modelo_' + tipo);
      const inp = h('input', { type: 'file', accept: '.docx', class: 'oculto' });
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; inp.value = '';
        if (!f) return;
        try {
          const tags = await DocGen.listarMarcadores(await f.arrayBuffer());
          const essenciais = tipo === 'relatorio' ? ['obra', 'data_visita', '#tr:linhas'] : tipo === 'sanadas' || tipo === 'irregularidades' ? ['obra', '#itens'] : ['ordinal', 'numero_notificacao', 'n_nome', 'objeto', 'data_extenso', '#fotos'];
          const falta = essenciais.filter((t) => !tags.includes(t));
          if (falta.length && !(await confirmar('O modelo não contém os marcadores: ' + falta.map((t) => '{' + t + '}').join(', ') + '. Usar mesmo assim?', 'Usar'))) return;
          let driveId = null;
          if (Sync.habilitado()) {
            try { driveId = (await Sync.enviarArquivo('modelo_' + tipo + '.docx', f)).driveId; } catch (e) { toast('Modelo salvo só neste aparelho: ' + e.message, true); }
          }
          await DB.arquivoSet('modelo_' + tipo, f, { nome: f.name, driveId });
          if (driveId) await salvarConfig((o) => { o.modelos = Object.assign({}, o.modelos, { [tipo]: { driveId, nome: f.name, em: new Date().toISOString() } }); });
          toast('Modelo atualizado: ' + ROT_MOD[tipo]);
          telaConfig();
        } catch (e) { toast('Arquivo inválido: ' + e.message, true); }
      });
      ap(modCard, h('div', { class: 'linha', style: { margin: '8px 0' } },
        h('div', { class: 'cresce' }, h('b', {}, ROT_MOD[tipo]), h('div', { class: 'sub' }, custom ? 'Personalizado: ' + (custom.nome || 'modelo.docx') : 'Modelo original')),
        h('button', { class: 'btn peq', onclick: async () => baixarBlob(new Blob([await modeloDocx(tipo)]), 'modelo_' + tipo + '.docx') }, 'Baixar'),
        pode.admin() ? h('button', { class: 'btn peq', onclick: () => inp.click() }, 'Substituir') : null,
        pode.admin() && custom ? h('button', { class: 'btn peq perigo', onclick: async () => {
          await DB.del('arquivos', 'modelo_' + tipo);
          if (CONFIG.modelos && CONFIG.modelos[tipo]) await salvarConfig((o) => { o.modelos = Object.assign({}, o.modelos); delete o.modelos[tipo]; });
          telaConfig();
        } }, 'Restaurar') : null, inp));
    }
    ap(modCard, h('p', { class: 'dica' }, 'Para alterar textos fixos (ex.: cláusulas de sanções, dados do notificante), baixe o modelo, edite no Word mantendo os marcadores entre chaves { } e envie de volta com “Substituir”.'));
    cards.push(modCard);

    /* usuarios */
    if (Sync.habilitado() && pode.admin()) {
      const box = h('div', {}, h('span', { class: 'carregando' }));
      cards.push(h('div', { class: 'card' }, h('h2', {}, 'Usuários do grupo'), box));
      (async () => {
        try {
          const j = await Sync.chamar('usuarios');
          const novo = { email: '', nome: '', perfil: 'fiscal' };
          const sel = (obj) => h('select', { onchange: (e) => { obj.perfil = e.target.value; } },
            ['admin', 'fiscal', 'consulta'].map((p) => h('option', { value: p, selected: obj.perfil === p ? 'selected' : null }, { admin: 'Administrador', fiscal: 'Fiscal', consulta: 'Consulta' }[p])));
          rc(box, 
            ...j.usuarios.map((us) => h('div', { class: 'linha', style: { borderBottom: '1px solid var(--linha)', padding: '6px 0' } },
              h('div', { class: 'cresce' }, h('div', {}, us.nome || us.email), h('div', { class: 'sub' }, us.email + (us.ativo ? '' : ' · desativado'))),
              (() => { const s = sel(us); s.style.width = 'auto'; return s; })(),
              h('button', { class: 'btn peq', onclick: async () => { await Sync.chamar('salvarUsuario', { usuario: us }); toast('Salvo'); } }, 'Salvar'),
              h('button', { class: 'btn peq ' + (us.ativo ? 'perigo' : ''), onclick: async () => { us.ativo = !us.ativo; await Sync.chamar('salvarUsuario', { usuario: us }); telaConfig(); } }, us.ativo ? 'Desativar' : 'Ativar'))),
            h('h3', {}, 'Adicionar'),
            h('div', { class: 'grade2' }, campo('E-mail (conta Google)', inputTxt(novo, 'email', { type: 'email' })), campo('Nome', inputTxt(novo, 'nome'))),
            campo('Perfil', sel(novo)),
            h('button', { class: 'btn pri', onclick: async () => {
              if (!/@/.test(novo.email)) { toast('E-mail inválido', true); return; }
              novo.ativo = true;
              await Sync.chamar('salvarUsuario', { usuario: novo }); toast('Usuário adicionado'); telaConfig();
            } }, 'Adicionar usuário'),
            h('p', { class: 'dica' }, 'Administrador: tudo. Fiscal: coleta fotos e cria/emite notificações. Consulta: apenas visualiza.'));
        } catch (e) { rc(box, h('div', { class: 'aviso' }, e.message)); }
      })();
    }

    /* backup */
    cards.push(h('div', { class: 'card' }, h('h2', {}, 'Cópia de segurança'),
      h('p', { class: 'sub' }, Sync.habilitado() ? 'Os dados já ficam na planilha e no Drive do grupo. A cópia abaixo é um arquivo extra (útil para trocar de aparelho no modo local).' : 'No modo local, faça cópias periodicamente: se o app for desinstalado ou os dados do navegador forem apagados, tudo se perde.'),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn', onclick: exportarBackup }, '⬇️ Exportar (.zip)'),
        pode.admin() ? h('button', { class: 'btn', onclick: importarBackup }, '⬆️ Importar') : null,
        pode.admin() ? h('button', { class: 'btn', onclick: carregarExemplos }, 'Carregar exemplos dos modelos') : null)));

    cards.push(h('p', { class: 'dica', style: { textAlign: 'center' } }, 'Fiscalização de Obras · v3.2.2 · dados salvos no aparelho' + (Sync.habilitado() ? ' e no Google Drive do administrador' : '') + ' · ', h('a', { href: 'privacidade.html' }, 'Política de privacidade')));
    rc($main, ...cards);
  }

  /* Lista as câmeras que o navegador libera, com o zoom de cada uma, e permite escolher a do botão 0,5 */
  async function testarCameras() {
    const corpo = h('div', {}, h('p', {}, h('span', { class: 'carregando' }), ' Verificando as câmeras…'));
    const fechar = modal('Câmeras deste celular', corpo, [{ txt: 'Fechar', valor: true }]);
    const info = [];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Este navegador não permite usar a câmera no app.');
      try { localStorage.removeItem('cam_perfil'); } catch (e) { /* a câmera do app reconhece as lentes de novo */ }
      const s0 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const principal = (s0.getVideoTracks()[0].getSettings() || {}).deviceId;
      const c0 = s0.getVideoTracks()[0].getCapabilities ? s0.getVideoTracks()[0].getCapabilities() : {};
      s0.getTracks().forEach((t) => t.stop());
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      for (const d of devs) {
        const it = { label: d.label || '(sem nome)', id: d.deviceId, principal: d.deviceId === principal };
        try {
          const st = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: d.deviceId } }, audio: false });
          const t = st.getVideoTracks()[0];
          const c = t.getCapabilities ? t.getCapabilities() : {};
          it.facing = (c.facingMode || [])[0] || (t.getSettings() || {}).facingMode || '';
          it.zmin = c.zoom ? c.zoom.min : null;
          it.zoom = c.zoom ? 'zoom ' + String(c.zoom.min).replace('.', ',') + '–' + String(c.zoom.max).replace('.', ',') : 'sem zoom';
          it.res = c.width && c.height ? c.width.max + '×' + c.height.max : '';
          it.foco = (c.focusMode || []).join('/') || '—';
          st.getTracks().forEach((x) => x.stop());
        } catch (e) { it.erro = e.name || e.message; }
        info.push(it);
      }
      const escolhida = localStorage.getItem('lente_05');
      const logico = c0.zoom && c0.zoom.min < 1;
      const combinada = !logico && info.find((x) => x.zmin != null && x.zmin < 1 && x.facing !== 'user');
      rc(corpo,
        h('p', { class: 'sub', style: { marginTop: 0 } }, devs.length + ' câmera(s) liberada(s) para o app. ' + (logico
          ? 'A câmera principal tem zoom abaixo de 1x (' + c0.zoom.min + '): o botão ' + String(c0.zoom.min).replace('.', ',') + ' usa esse zoom.'
          : combinada ? 'A câmera “' + combinada.label + '” tem zoom a partir de ' + String(combinada.zmin).replace('.', ',') + 'x: a câmera do app passa a usá-la, com o botão ' + String(combinada.zmin).replace('.', ',') + ' (grande angular).'
            : 'Nenhuma câmera tem zoom abaixo de 1x: o botão 0,5 troca para outra câmera traseira.')),
        info.map((it) => h('div', { class: 'item' },
          h('div', { class: 't' }, it.label, it.principal ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, 'principal') : null,
            escolhida === it.label ? h('span', { class: 'badge ok', style: { marginLeft: '6px' } }, 'botão 0,5') : null),
          h('div', { class: 'd' }, [it.facing === 'user' ? 'frontal' : it.facing === 'environment' ? 'traseira' : it.facing, it.zoom, it.res && 'máx. ' + it.res, it.foco && 'foco ' + it.foco, it.erro && 'erro: ' + it.erro].filter(Boolean).join(' · ')),
          !it.principal && it.facing !== 'user' ? h('button', { class: 'btn peq', style: { marginTop: '6px' }, onclick: (e) => {
            try { localStorage.setItem('lente_05', it.label); } catch (er) { /* */ }
            toast('“' + it.label + '” será usada no botão 0,5'); e.target.textContent = '✓ Usada no botão 0,5';
          } }, 'Usar esta no botão 0,5') : null)),
        !info.some((x) => !x.principal && x.facing !== 'user')
          ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, 'Este celular só libera a câmera traseira principal (e a frontal) para aplicativos da web — a grande angular fica disponível só na câmera do próprio celular. Para fotos com grande angular, use o ícone de celular dentro da câmera do app, ou escolha “Câmera do celular” acima.')
          : null,
        h('button', { class: 'btn peq', style: { marginTop: '8px' }, onclick: async () => {
          const txt = navigator.userAgent + '\n' + JSON.stringify({ zoomPrincipal: c0.zoom || null, cameras: info.map((x) => Object.assign({}, x, { id: undefined })) }, null, 1);
          try { await navigator.clipboard.writeText(txt); toast('Copiado'); } catch (er) { baixarBlob(new Blob([txt], { type: 'text/plain' }), 'cameras.txt'); }
        } }, '📋 Copiar resultado'));
    } catch (e) {
      rc(corpo, h('div', { class: 'aviso' }, 'Não foi possível verificar as câmeras: ' + (e.message || e.name)));
    }
    await fechar;
  }

  async function telaPessoas() {
    titulo('Assinantes', true);
    const pessoas = (await DB.listar('pessoas')).sort((a, b) => (a.papel + a.nome).localeCompare(b.papel + b.nome));
    const editar = async (p) => {
      const o = Object.assign({ papel: 'fiscal' }, p || {});
      const corpo = h('div', {},
        campo('Nome completo', inputTxt(o, 'nome')),
        campo('Papel', h('select', { onchange: (e) => { o.papel = e.target.value; } },
          h('option', { value: 'fiscal', selected: o.papel === 'fiscal' ? 'selected' : null }, 'Fiscal'),
          h('option', { value: 'coordenador', selected: o.papel === 'coordenador' ? 'selected' : null }, 'Coordenador'))),
        campo('Tratamento no texto', inputTxt(o, 'tratamento', { placeholder: 'Ex.: Eng. Civil' }), 'Usado em “representada pelo Eng. Civil Fulano…”.'),
        campo('Cargo / registro (2ª linha da assinatura)', inputTxt(o, 'cargo', { placeholder: 'Ex.: Engenheiro Civil – CREA 48846/MT' })),
        campo('Lotação (linha seguinte)', inputTxt(o, 'lotacao', { placeholder: 'Ex.: CIPI-SNP/SEDUC/MT' })),
        campo('Linha extra (opcional)', inputTxt(o, 'extra', { placeholder: 'Ex.: PORTARIA/SEDUC/00035/2026' })));
      const r = await modal(p ? 'Editar assinante' : 'Novo assinante', corpo, [
        p ? { txt: 'Excluir', cls: 'perigo', valor: 'excluir' } : null, { txt: 'Cancelar', valor: null }, { txt: 'Salvar', cls: 'pri', valor: 'salvar' }].filter(Boolean));
      if (r === 'salvar') {
        if (!o.nome) { toast('Informe o nome', true); return; }
        if (p) await salvarMudancas('pessoas', p, o); else await DB.salvar('pessoas', o, email());
        toast('Salvo');
      } else if (r === 'excluir' && await confirmar('Excluir ' + o.nome + '? Notificações já emitidas não mudam.', 'Excluir', true)) {
        await DB.excluir('pessoas', o.id, email());
      }
      telaPessoas();
    };
    const bloco = (papel) => pessoas.filter((p) => p.papel === papel).map((p) => h('div', { class: 'item', style: { cursor: pode.admin() ? 'pointer' : 'default' }, onclick: () => pode.admin() && editar(p) },
      h('div', { class: 't' }, p.nome), h('div', { class: 'd' }, [p.cargo, p.lotacao, p.extra].filter(Boolean).join(' · '))));
    rc($main, 
      h('p', { class: 'sub' }, 'Alterações aqui valem para as próximas notificações. As já emitidas guardam os nomes da época.'),
      h('h3', { class: 'sub' }, 'Fiscais'), ...bloco('fiscal'),
      h('h3', { class: 'sub' }, 'Coordenadores'), ...bloco('coordenador'));
    if (pode.admin() && location.hash.indexOf('pessoas') >= 0) document.body.appendChild(h('button', { class: 'fab', onclick: () => editar(null) }, '+'));
  }

  async function forcarAtualizacao() {
    try {
      if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    } catch (e) { /* */ }
    location.replace(location.pathname + '?v=' + Date.now() + '#/config');
  }

  /* ---------------- backup ---------------- */
  async function exportarBackup() {
    const zip = new JSZip();
    const dados = {};
    for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config']) dados[e] = await DB.all(e);
    zip.file('dados.json', JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), dados }, null, 1));
    for (const f of dados.fotos) { const b = await DB.blobGet(f.id); if (b) zip.file('fotos/' + f.id + '.jpg', b); }
    for (const t of ['contrato', 'convenio', 'relatorio', 'sanadas', 'irregularidades']) { const m = await DB.arquivoGet('modelo_' + t); if (m && m.blob) zip.file('modelos/modelo_' + t + '.docx', m.blob); }
    const blob = await zip.generateAsync({ type: 'blob' });
    baixarBlob(blob, 'backup-notificacoes-' + X.hojeISO() + '.zip');
  }
  async function importarBackup() {
    const inp = h('input', { type: 'file', accept: '.zip' });
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const zip = await JSZip.loadAsync(f);
        const j = JSON.parse(await zip.file('dados.json').async('string'));
        if (!(await confirmar('Importar ' + (j.dados.registros || []).length + ' cadastro(s) e ' + (j.dados.notificacoes || []).length + ' notificação(ões)? Itens com o mesmo identificador serão substituídos.', 'Importar'))) return;
        // não substitui o que já está mais novo no aparelho (senão o celular "voltaria no tempo")
        let ignorados = 0;
        for (const e of Object.keys(j.dados)) {
          for (const o of j.dados[e]) {
            const local = await DB.get(e, o.id);
            if (local && (local.excluido || String(local.atualizadoEm || '') >= String(o.atualizadoEm || ''))) { ignorados++; continue; }
            o._pendente = true; await DB.put(e, o);
          }
        }
        if (ignorados) toast(ignorados + ' registro(s) do backup ignorados: o aparelho já tinha versão mais nova.');
        for (const name of Object.keys(zip.files)) {
          const m = /^fotos\/(.+)\.jpg$/.exec(name);
          if (m) await DB.blobSet(m[1], await zip.file(name).async('blob'));
          const mm = /^modelos\/modelo_(\w+)\.docx$/.exec(name);
          if (mm) await DB.arquivoSet('modelo_' + mm[1], await zip.file(name).async('blob'), { nome: 'modelo_' + mm[1] + '.docx' });
        }
        await carregarConfig();
        App.agendarSync();
        toast('Backup importado');
        rotear();
      } catch (e) { toast('Falha ao importar: ' + e.message, true); }
    });
    inp.click();
  }

  async function carregarExemplos() {
    if (!(await confirmar('Criar os dois cadastros de exemplo (contrato CEI DAURY RIVA e convênio 0961-2024 Cláudia) com os dados dos modelos enviados?', 'Criar'))) return;
    const fiscC = [{ pessoaId: 'p-talison', funcao: 'Fiscal do Contrato' }, { pessoaId: 'p-marcelo', funcao: 'Fiscal Suplente do Contrato' }, { pessoaId: 'p-hiago', funcao: 'Fiscal Suplente do Contrato' }];
    const fiscV = [{ pessoaId: 'p-marcelo', funcao: 'Fiscal do Convênio' }, { pessoaId: 'p-talison', funcao: 'Fiscal do Convênio' }, { pessoaId: 'p-hiago', funcao: 'Fiscal do Convênio' }];
    await DB.salvar('registros', {
      id: 'ex-contrato-daury', tipo: 'contrato', apelido: 'CEI DAURY RIVA',
      n_cnpj: '09.427.335/0001-65', n_nome: 'HFC CONSTRUTORA E ENGENHARIA LTDA', n_nome_texto: 'HFC CONSTRUTORA E ENGENHARIA LTDA',
      n_representante: 'LUCAS RECH CADAMURO', n_representante_cpf: '023.832.531-89', n_logradouro: 'RUA DAS PAINEIRAS, Nº 305N', n_cep: '78.450-000',
      n_bairro: 'DISTRITO INDUSTRIAL', n_municipio: 'NOVA MUTUM/MT', n_telefone: '(65) 3308-3050',
      objeto: 'CONTRATAÇÃO INTEGRADA DE EMPRESA ESPECIALIZADA EM ENGENHARIA E ARQUITETURA PARA ELABORAÇÃO DE SOLUÇÃO COMPLETA INCLUINDO O DESENVOLVIMENTO E EXECUÇÃO COMPLETA DOS PROJETOS BÁSICOS, COMPLEMENTARES E EXECUTIVOS PARA CONSTRUÇÃO DA ESCOLA ESTADUAL NOVA BAIRRO SANTA CECÍLIA E DA ESCOLA ESTADUAL NOVA BAIRRO DAURI RIVA, LOCALIZADAS NO MUNICÍPIO DE SINOP-MT.',
      numero: '013/2026', processo: 'SEDUC-PRO-2025/62764', os_numero: '02/2026',
      objeto_especifico: 'CONTRATAÇÃO INTEGRADA DE EMPRESA ESPECIALIZADA EM ENGENHARIA E ARQUITETURA PARA ELABORAÇÃO DE SOLUÇÃO COMPLETA INCLUINDO O DESENVOLVIMENTO E EXECUÇÃO COMPLETA DOS PROJETOS BÁSICOS, COMPLEMENTAR E EXECUTIVO PARA A CONSTRUÇÃO DA ESCOLA ESTADUAL DAURY RIVA, LOCALIZADO NO MUNICÍPIO DE SINOP, COM BLOCO EDUCACIONAL DE 24 SALAS DE AULA, REFEITÓRIO COM COZINHA, QUADRA POLIESPORTIVA COM VESTIÁRIO E PISCINA',
      valor: 41797391.43, valor_os: 20795119.72, fiscais: fiscC, coordenadores: ['p-norberto', 'p-andressa'], ultima_notif_anterior: 5, prazo_dias: 3,
      status_obra: 'Em execução', prazo_execucao: '2027-03-31', vigencia: '2027-06-30',
    }, email());
    await DB.salvar('registros', {
      id: 'ex-convenio-claudia', tipo: 'convenio', apelido: 'CONVÊNIO 0961-2024 - CLÁUDIA',
      n_cnpj: '01.310.499/0001-04', n_nome: 'PREFEITURA MUNICIPAL DE CLÁUDIA', n_nome_texto: 'Prefeitura Municipal de Cláudia',
      n_representante: 'ALTAMIR KURTEN', n_logradouro: 'Av. Gaspar Dutra, S/N', n_cep: '78540-000', n_bairro: 'Centro', n_municipio: 'Cláudia/MT', n_telefone: '(66) 3546-1250',
      objeto: 'Construção de Escola Estadual Florestan Fernandes', numero: '0961-2024', processo: 'SEDUC-PRO-2024/47906', valor: 8021795.36,
      valor_extenso: 'Oito milhões, vinte e um mil, setecentos e noventa e cinco reais e trinta e seis centavos', vigencia: '2026-11-05', status_obra: 'Paralisada',
      fiscais: fiscV, coordenadores: ['p-norberto', 'p-andressa'], ultima_notif_anterior: 2, prazo_dias: 3,
    }, email());
    toast('Exemplos criados');
    location.hash = '#/contratos';
  }

  /* ================================================================== */
  /* Inicializacao                                                       */
  /* ================================================================== */
  async function iniciar() {
    if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (e) { /* */ } }
    Sync.usuario = Sync.usuarioLocal();
    await carregarConfig();
    await repararConsistencia();
    atualizarChip();
    verificarPrazos();
    setInterval(verificarPrazos, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verificarPrazos(); });
    if (!location.hash) location.replace('#/contratos');
    await rotear();
    if (Sync.habilitado()) {
      Sync.on(async (s) => { if (s.estado === 'ok') { await garantirSemente(); await carregarConfig(); } });
      Sync.sincronizar();
      setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') Sync.sincronizar(); }, 5 * 60 * 1000);
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
      navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.hash) location.hash = e.data.hash; });
    }
  }
  iniciar();
})();
