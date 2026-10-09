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
    if (m) m.setAttribute('content', escuro ? '#0f1020' : '#f3f4fa');
  }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { let t = 'auto'; try { t = localStorage.getItem('tema') || 'auto'; } catch (e) { /* */ } if (t === 'auto') aplicarTema('auto'); });

  // imagem que não carregou (foto ainda não baixada do Drive): esconde o ícone de imagem quebrada
  document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG') t.classList.add('img-falhou'); }, true);
  document.addEventListener('load', (e) => { const t = e.target; if (t && t.tagName === 'IMG') t.classList.remove('img-falhou'); }, true);
  function toast(msg, erro) {
    const t = h('div', { class: 'toast' + (erro ? ' erro' : '') }, msg);
    document.body.appendChild(t);
    // vários avisos ao mesmo tempo: empilha (o mais novo embaixo) em vez de um cobrir o outro
    const empilhar = () => { let soma = 0; const ts = [...document.querySelectorAll('body > .toast')]; for (let i = ts.length - 1; i >= 0; i--) { ts[i].style.marginBottom = soma + 'px'; soma += ts[i].offsetHeight + 8; } };
    empilhar();
    setTimeout(() => { t.remove(); empilhar(); }, erro ? 5000 : 2600);
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
  // obra encerrada: prazo vencido não acende alerta
  const ENCERRA_PADRAO = ['Obra concluída', 'Contrato rescindido', 'Contrato rescindido – em processo de relicitação', 'Sem vigência'];
  const CORES_STATUS = [['ok', 'Verde'], ['alerta', 'Amarelo'], ['perigo', 'Vermelho'], ['info', 'Azul'], ['neutro', 'Cinza']];
  const statusPadrao = (tipo) => STATUS_OBRA[tipo].map((nome) => ({ nome, cor: COR_STATUS[nome] || 'neutro', encerra: ENCERRA_PADRAO.includes(nome) }));
  /* Lista de status (editável pelo administrador em Ajustes › Status das obras; vale para toda a equipe) */
  function listaStatus(tipo) {
    const l = CONFIG && CONFIG.status_obra && CONFIG.status_obra[tipo];
    return Array.isArray(l) && l.length ? l.filter((x) => x && x.nome) : statusPadrao(tipo);
  }
  function infoStatus(nome, tipo) {
    if (!nome) return null;
    const outro = tipo === 'convenio' ? 'contrato' : 'convenio';
    return listaStatus(tipo).find((x) => x.nome === nome) || listaStatus(outro).find((x) => x.nome === nome)
      || (STATUS_OBRA.contrato.includes(nome) || STATUS_OBRA.convenio.includes(nome) ? { nome, cor: COR_STATUS[nome] || 'neutro', encerra: ENCERRA_PADRAO.includes(nome) } : null);
  }
  const etq = (txt, cls, title) => h('span', { class: 'etq ' + (cls || ''), title: title || null }, txt);
  const etqStatus = (r) => (r.status_obra ? etq(r.status_obra, ((infoStatus(r.status_obra, r.tipo) || {}).cor || '').replace('neutro', '')) : null);

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
    const encerrada = !!(infoStatus(r.status_obra, r.tipo) || {}).encerra;
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
      else if ((m = /(\d{1,2})\/(\d{1,2})\/(\d{2})\b/.exec(t))) set.add('20' + m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'));
      else if ((m = /(\d{1,2})\/(\d{1,2})(?!\/?\d)/.exec(t))) set.add(m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')); // "25/12": todo ano
    });
    return set;
  }
  function ehDiaUtil(d, fer) { const w = d.getDay(), iso = isoDe(d); return w !== 0 && w !== 6 && !fer.has(iso) && !fer.has(iso.slice(5)); }
  /* prazo final sempre recalculado (um feriado cadastrado depois do envio passa a contar) */
  const prazoDe = (n) => (n.enviadaEm ? prazoFinalUteis(n.enviadaEm, n.prazoDiasEnvio || n.prazo_dias) : n.prazoFinal);
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
      const atraso = prazoDe(n) && n.respondidaEm > prazoDe(n);
      return { k: 'respondida', txt: 'Respondida em ' + X.dataBR(n.respondidaEm) + (atraso ? ' (fora do prazo)' : ''), cls: 'ok', ordem: 3 };
    }
    const pf = prazoDe(n);
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
    status_obra: { contrato: statusPadrao('contrato'), convenio: statusPadrao('convenio') },
    fila_atendidos: 'ENCAMINHADO - CCP', // STATUS da planilha da fila que significam "já atendido pela Fiscalização" (um por linha)
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
  function segmentosPasta(f, r, v, padrao, rotulo) {
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
      visita: v ? 'Visita ' + v.numero : rotulo || 'Sem visita',
    };
    return String(padrao || CONFIG_PADRAO.pasta_fotos).split('/').map((seg) => nomeArquivo(seg.replace(/\{(\w+)\}/g, (m, k) => (val[k] != null ? val[k] : '')))).filter(Boolean);
  }
  App.infoFotoDrive = async function (f) {
    const r = await DB.get('registros', f.registroId);
    const v = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
    const md = !v && f.medicaoId ? await DB.get('medicoes', f.medicaoId) : null; // enviada para o relatório fotográfico da medição
    const dt = f.dataHora ? new Date(f.dataHora) : null;
    const hora = dt ? doisDig(dt.getHours()) + '.' + doisDig(dt.getMinutes()) + '.' + doisDig(dt.getSeconds()) : '';
    const nome = [hora, f.irregular ? 'IRREGULARIDADE' : '', f.projetoDe ? 'PROJETO' : '', String(f.descricao || '').slice(0, 60)].filter(Boolean).join(' - ');
    return { pastas: segmentosPasta(f, r, v, (CONFIG || {}).pasta_fotos, md ? 'Medição ' + md.numero : null), nome: nomeArquivo(nome) };
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
    try { if (Sync.habilitado()) for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes']) pend += (await DB.all(e)).filter((o) => o._pendente).length; } catch (e) { /* */ }
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
    Sync._atividade = Date.now(); // há movimento: procura novidades dos colegas com mais frequência
    timerSync = setTimeout(() => Sync.sincronizar(), 2500);
  };
  /* Dados novos de outro aparelho: redesenha a tela sem voltar ao topo, sem apagar o que foi digitado na
     busca e sem fechar o teclado (se o usuário estiver digitando, espera ele terminar). */
  let redesenhoPendente = false;
  async function redesenharSeSeguro() {
    const r = location.hash;
    if (document.querySelector('.modal-fundo') || document.querySelector('.cv')) return; // não mexe na tela com janela ou câmera abertas
    if (!/notificacao|editar|novo|config|visita|coleta|irregularidade/.test(r)) redesenharMantendo();
    else if (App._atualizarTela) { try { await App._atualizarTela(); } catch (e) { /* */ } } // telas com edição: atualiza só as partes seguras
  }
  function redesenharMantendo() {
    const ativo = document.activeElement;
    if (ativo && $main.contains(ativo) && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName)) {
      if (!redesenhoPendente) {
        redesenhoPendente = true;
        const seq = rotaSeq;
        ativo.addEventListener('blur', () => { setTimeout(() => { if (!redesenhoPendente || seq !== rotaSeq) return; redesenhoPendente = false; redesenharSeSeguro(); }, 300); }, { once: true });
      }
      return;
    }
    const hash = location.hash, y = window.scrollY;
    const buscas = [...$main.querySelectorAll('input[type=search]')].map((i) => i.value);
    manterRolagem = true;
    Promise.resolve(rotear()).finally(() => {
      manterRolagem = false;
      if (location.hash !== hash) return;
      $main.querySelectorAll('input[type=search]').forEach((i, k) => { if (buscas[k] && !i.value) { i.value = buscas[k]; i.dispatchEvent(new Event('input')); } });
      window.scrollTo(0, y);
    });
  }
  App.aoReceberDados = async function () {
    await carregarConfig();
    await repararConsistencia();
    verificarPrazos();
    const r = location.hash;
    if (document.querySelector('.modal-fundo') || document.querySelector('.cv')) return; // não mexe na tela com janela ou câmera abertas
    await redesenharSeSeguro();
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

  /* Cada navegação recebe um número. Uma tela lenta que termina depois de o usuário ter ido para outra
     não desenha por cima da nova (nem liga temporizadores): rcT lança RotaVelha e ela para ali. */
  let rotaSeq = 0, manterRolagem = false;
  function rcT(tk, ...k) {
    if (tk !== rotaSeq) { const e = new Error('rota antiga'); e.rotaVelha = true; throw e; }
    return rc($main, ...k);
  }
  async function rotear() {
    rotaSeq++;
    redesenhoPendente = false;
    App._atualizarTela = null;
    if (App._sairTela) { const f = App._sairTela; App._sairTela = null; try { f(); } catch (e) { console.error(e); } }
    if (App._sairNotif) { const f = App._sairNotif; App._sairNotif = null; try { await f(); } catch (e) { console.error(e); } }
    const partes = (location.hash || '#/contratos').slice(2).split('/');
    const [r, a, b] = partes;
    document.body.dataset.tela = r || 'contratos'; // o layout de computador muda conforme a tela
    if (!manterRolagem) window.scrollTo(0, 0);
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
      if (r === 'nova-medicao') { return await criarMedicao(a); }
      if (r === 'medicao') { return await telaMedicao(a, b); }
      if (r === 'medicao-fotos') { location.replace('#/medicao/' + a + '/fotos'); return; } // endereço da 3.15.5
      if (r === 'coleta') { marcarNav(''); return await telaColeta(a); }
      if (r === 'notificacoes') { marcarNav('notificacoes'); return await telaNotificacoes(); }
      if (r === 'fila') { marcarNav('fila'); return await telaFila(); }
      if (r === 'visita') { return await telaVisita(a); }
      if (r === 'irregularidade') { return await telaIrregularidade(a, b); }
      if (r === 'config') { marcarNav('config'); return await telaConfig(a); }
      location.hash = '#/contratos';
    } catch (e) {
      if (e && e.rotaVelha) return;
      console.error(e);
      rc($main, h('div', { class: 'card' }, h('h2', {}, 'Ocorreu um erro'), h('p', {}, e.message)));
    }
  }
  window.addEventListener('hashchange', rotear);

  function telaLogin(aviso) {
    App._login = !aviso;
    document.body.dataset.tela = 'login';
    titulo('Fiscalização de Obras');
    const alvo = h('div', { style: { display: 'flex', justifyContent: 'center', margin: '18px 0' } });
    rc($main, h('div', { class: 'card login-box' },
      h('div', { class: 'logo' }, '📋'),
      h('h2', {}, 'Fiscalização de Obras'),
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
    // (as enviadas da galeria só para o relatório fotográfico de uma medição ficam só nela)
    return (await DB.byIndex('fotos', 'registroId', registroId)).filter((f) => !f.excluido && !f.projetoDe && !(f.medicaoId && !f.visitaId))
      .sort((a, b) => String(b.dataHora).localeCompare(a.dataHora));
  }
  /* ---------- Linha de lista (formato caixa de entrada) ---------- */
  const COR_AVATAR = { ok: '#12b076', alerta: '#f59e0b', perigo: '#ef4462', info: '#4f8df7', neutro: '#9aa0bd', '': '#9aa0bd' };
  const dataCurtaLocal = (v) => { const s = String(v || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dataCurta(s); const d = new Date(s); return isNaN(d) ? '' : dataCurta(isoDe(d)); };
  const dataCurta = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) : ''; };
  // ícone de prédio (prefeitura), igual ao do menu Convênios
  const icoPredio = () => { const d = document.createElement('span'); d.className = 'lin-ico'; d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/></svg>'; return d; };
  const linha2 = (o, cls) => h('div', { class: cls },
    o.orgao ? h('span', { class: 'lin-org', title: o.orgao }, icoPredio(), h('span', { class: 'lin-org-t' }, o.orgao)) : null,
    o.objeto ? h('span', { class: 'lin-obj', title: o.objeto }, '“' + o.objeto + '”') : null);
  /** o: { href, de, titulo, pre, resumo, chips[], prazos[{rot, data, txt, cls}], objeto, pend, cls } */
  function linhaLista(o) {
    const corpo = [
      h('div', { class: 'lin-de' }, o.de),
      h('div', { class: 'lin-meio' },
        h('div', { class: 'lin-l1' }, h('span', { class: 'lin-t' }, o.titulo, o.pend ? h('span', { class: 'pend', title: 'Aguardando sincronização' }) : null), o.resumo ? h('span', { class: 'lin-s' }, o.pre ? h('span', { class: 'so-cel' }, o.pre) : null, o.resumo) : null),
        o.orgao || o.objeto ? linha2(o, o.orgao ? 'lin-l2 lin-l2-dentro' : 'lin-l2') : null,
        o.chips && o.chips.filter(Boolean).length ? h('div', { class: 'etqs lin-chips' }, ...o.chips) : null),
      // à direita: os prazos com o nome (ex.: Vigência do Convênio · 05/11/26 · faltam 35 dias)
      h('div', { class: 'lin-dir' }, ...(o.prazos || []).map((z) => h('div', { class: 'lin-pz ' + (z.cls || '') },
        h('span', { class: 'lin-pz-r' }, z.rot), h('b', { class: 'lin-pz-d' }, z.data), z.txt ? h('span', { class: 'lin-pz-t' }, z.txt) : null))),
      // no celular a prefeitura usa a largura toda da linha (nomes longos não são cortados)
      o.orgao ? linha2(o, 'lin-l2 lin-l2-fora') : null,
    ];
    return o.href ? h('a', { class: 'lin ' + (o.cls || ''), href: o.href }, ...corpo) : h('div', { class: 'lin ' + (o.cls || '') }, ...corpo);
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    titulo(PLURAL[tipo]);
    const regs = (await DB.listar('registros', (r) => r.tipo === tipo)).sort((a, b) => String(a.apelido || '').localeCompare(b.apelido || ''));
    const notifs = await DB.listar('notificacoes');
    const busca = h('input', { type: 'search', placeholder: 'Buscar por nome, número, empresa…' });
    const chaveFiltro = 'filtro_status_' + tipo;
    const filtroSt = h('select', { onchange: () => { sessionStorage.setItem(chaveFiltro, filtroSt.value); desenhar(); } },
      h('option', { value: '' }, 'Todos os status (' + regs.length + ')'),
      listaStatus(tipo).map((x) => x.nome).concat([...new Set(regs.map((r) => r.status_obra).filter((st) => st && !listaStatus(tipo).some((x) => x.nome === st)))])
        .map((st) => { const n = regs.filter((r) => r.status_obra === st).length; return n ? h('option', { value: st }, st + ' (' + n + ')') : null; }),
      regs.some((r) => !r.status_obra) ? h('option', { value: '__sem' }, 'Sem status informado (' + regs.filter((r) => !r.status_obra).length + ')') : null);
    filtroSt.value = sessionStorage.getItem(chaveFiltro) || '';
    if (filtroSt.selectedIndex < 0) filtroSt.value = '';
    const lista = h('div', { class: 'lista-obras lista-linhas' });
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
        const ps = prazosDoRegistro(r);
        const st = infoStatus(r.status_obra, r.tipo);
        return linhaLista({
          href: '#/registro/' + r.id, cls: 'item', pend: r._pendente,
          de: h('span', { class: 'lin-st' }, h('span', { class: 'lin-dot', style: { background: COR_AVATAR[st ? st.cor : 'neutro'] } }), h('span', { class: 'lin-st-t' }, r.status_obra || 'Sem status')),
          titulo: r.apelido || '(sem nome)',
          // convênio: a prefeitura vai numa linha própria (sempre visível); contrato: empresa no resumo
          orgao: r.tipo === 'convenio' ? String(r.n_nome || '').trim() : '',
          resumo: (r.tipo === 'convenio' ? ROTULO[r.tipo] + ' nº ' + (r.numero || '—') : descricaoRegistro(r)) + ' · ' + (ns.length ? ns.length + ' notificação(ões), última em ' + X.dataBR(ult.data) : 'nenhuma notificação no app'),
          pre: h('span', { class: 'lin-pre ' + ((st && st.cor) || '') }, (r.status_obra || 'Sem status') + ' · '),
          prazos: ps.map((p) => ({ rot: p.rot, data: dataCurta(p.data), txt: p.info.txt, cls: p.info.cls })),
          objeto: String(r.objeto || '').trim(),
          chips: [venc ? etq('⏰ ' + venc + ' notificação(ões) com prazo encerrado', 'perigo') : aguard.length ? etq(aguard.length + ' notificação(ões) aguardando resposta', 'info') : null],
        });
      }) : [h('div', { class: 'vazio' }, regs.length ? 'Nada encontrado.' : 'Nenhum ' + ROTULO[tipo].toLowerCase() + ' cadastrado ainda.',
        pode.cadastro() && !regs.length ? h('div', { style: { marginTop: '12px' } }, h('a', { class: 'btn pri', href: '#/novo/' + tipo }, '+ Cadastrar ' + ROTULO[tipo].toLowerCase())) : null)]));
    };
    busca.addEventListener('input', desenhar);
    desenhar();
    rcT(tk, h('div', { class: 'linha-busca' }, busca, filtroSt), lista);
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    const r = await DB.get('registros', id);
    if (!r || r.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Cadastro não encontrado.')); return; }
    titulo(r.apelido || ROTULO[r.tipo], true);
    marcarNav(r.tipo === 'convenio' ? 'convenios' : 'contratos');
    const notifs = await notificacoesDe(id);
    const fotos = await fotosDe(id);
    const visitas = await visitasDe(id);
    const medicoes = r.tipo === 'contrato' ? await medicoesDe(id) : [];
    let aba = sessionStorage.getItem('aba_reg2') || 'visitas';
    if (aba === 'medicoes' && r.tipo !== 'contrato') aba = 'visitas';

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
      r.tipo === 'contrato' ? aba2('medicoes', 'Medições (' + medicoes.length + ')') : null,
      aba2('fotos', 'Fotos (' + fotos.length + ')'));

    if (aba === 'visitas') {
      ap(conteudo, ...(visitas.length ? visitas.map((v) => {
        const fv = fotos.filter((f) => f.visitaId === v.id);
        const irr = fv.filter((f) => f.irregular).length;
        return h('a', { class: 'item', href: '#/visita/' + v.id },
          h('span', { class: 'badge ' + (v.status === 'concluida' ? 'emit' : 'rasc') }, v.status === 'concluida' ? 'Concluída' : 'Em andamento'),
          h('div', { class: 't' }, 'Visita nº ' + v.numero + ' · ' + X.dataBR(v.data), v._pendente ? h('span', { class: 'pend' }) : null),
          h('div', { class: 'd' }, [v.hora_inicio, v.hora_fim].filter(Boolean).join(' – ') + (v.hora_inicio ? ' · ' : '') + fv.length + ' foto(s)' + (irr ? ' · ⚠️ ' + irr + ' irregularidade(s)' : '')),
          h('div', { class: 'd' }, 'Por ' + (nomeDe(v.criadoPor) || '—')));
      }) : [h('div', { class: 'vazio' }, 'Nenhuma visita registrada.',
        pode.coletar() ? h('div', { style: { marginTop: '12px' } }, h('a', { class: 'btn pri', href: '#/coleta/' + id }, '▶ Iniciar visita')) : null)]));
    } else if (aba === 'medicoes') {
      ap(conteudo, pode.notificar() ? h('div', { class: 'acoes', style: { marginTop: 0, marginBottom: '10px' } }, h('a', { class: 'btn pri', href: '#/nova-medicao/' + id }, '+ Nova medição')) : null,
        ...(medicoes.length ? medicoes.map((m) => {
          const c = contarSituacao(m);
          return h('a', { class: 'item', href: '#/medicao/' + m.id },
            h('span', { class: 'badge ' + (m.status === 'concluida' ? 'emit' : 'rasc') }, m.status === 'concluida' ? 'Concluída' : 'Rascunho'),
            h('div', { class: 't' }, m.numero + 'ª Medição', m._pendente ? h('span', { class: 'pend' }) : null),
            h('div', { class: 'd' }, 'Período ' + X.dataBR(m.periodo_inicio) + ' a ' + X.dataBR(m.periodo_fim)),
            h('div', { class: 'd' }, '📄 ' + c.total + ' item(ns)' + (c.nao ? ' · ' + c.nao + ' não medido(s)' : '') + (c.parcial ? ' · ' + c.parcial + ' parcial(is)' : '') +
              '  ·  📷 ' + (((m.relFoto || {}).itens || []).length ? m.relFoto.itens.length + ' foto(s)' : 'sem fotos') + ' · por ' + (nomeDe(m.criadoPor) || '—')));
        }) : [h('div', { class: 'vazio' }, 'Nenhuma medição registrada para este contrato.')]));
    } else if (aba === 'irr') {
      ap(conteudo, await painelIrregularidades(r));
    } else if (aba === 'notif') {
      ap(conteudo, ...(notifs.length ? notifs.map((n) => h('a', { class: 'item', href: '#/notificacao/' + n.id },
        h('span', { class: 'badge ' + (n.status === 'emitida' ? 'emit' : 'rasc') }, n.status === 'emitida' ? 'Emitida' : 'Rascunho'),
        h('div', { class: 't' }, (n.ordinal || '?') + 'ª Notificação', n._pendente ? h('span', { class: 'pend' }) : null),
        h('div', { class: 'd' }, 'Nº ' + (n.numero || (n.status === 'emitida' ? '—' : 'a definir na emissão')) + ' · ' + X.dataBR(n.data)),
        n.status === 'emitida' ? h('div', { class: 'etqs' }, etq(situacaoNotif(n).txt, situacaoNotif(n).cls), n.enviadaEm && !n.respondidaEm ? etq('prazo até ' + X.dataBR(prazoDe(n)), '') : null) : null,
        h('div', { class: 'd' }, (n.itens && n.itens.length ? n.itens.length + ' item(ns) · ' : '') + ((n.fotos || []).length) + ' foto(s) · por ' + (nomeDe(n.criadoPor) || '—'))))
        : [h('div', { class: 'vazio' }, 'Nenhuma notificação registrada no app para este ' + ROTULO[r.tipo].toLowerCase() + '.',
          r.ultima_notif_anterior ? h('div', { class: 'sub' }, 'Notificações emitidas antes do app: ' + r.ultima_notif_anterior) : null)]));
    } else {
      ap(conteudo, gradeFotos(fotos, { onclick: (f) => abrirFoto(f, () => telaRegistro(id), fotos) }));
      if (!fotos.length) ap(conteudo, h('div', { class: 'vazio' }, 'Nenhuma foto coletada.'));
    }
    rcT(tk, cab, r.tipo === 'convenio' ? cartaoFilaConvenio(r) : null, abas, conteudo);
  }

  /* ---------------- fotos ---------------- */
  const cacheUrls = new Map();
  async function urlFoto(f, grande) {
    if (!grande && f.miniatura) return f.miniatura;
    if (cacheUrls.has(f.id)) { const u = cacheUrls.get(f.id); cacheUrls.delete(f.id); cacheUrls.set(f.id, u); return u; }
    let blob = await DB.blobGet(f.id);
    if (!blob && grande && Sync.habilitado() && navigator.onLine) { try { blob = await Sync.baixarFoto(f); } catch (e) { /* */ } }
    if (!blob) return f.miniatura || '';
    const u = URL.createObjectURL(blob);
    cacheUrls.set(f.id, u);
    // guarda só as 30 últimas fotos grandes abertas (antes ficavam todas na memória até fechar o app)
    while (cacheUrls.size > 30) { const [k, v] = cacheUrls.entries().next().value; cacheUrls.delete(k); setTimeout(() => URL.revokeObjectURL(v), 60000); }
    return u;
  }

  function gradeFotos(fotos, opts) {
    opts = opts || {};
    const g = h('div', { class: 'fotos' });
    for (const f of fotos) {
      const img = h('img', { alt: f.descricao || '', loading: 'lazy' });
      urlFoto(f).then((u) => { img.src = u; });
      const idx = opts.selecionadas ? opts.selecionadas.indexOf(f.id) : -1;
      ap(g, h('div', { 'data-id': f.id, class: 'foto' + (idx >= 0 ? ' sel' : '') + (f.irregular ? ' irr' : '') + (f.fora_relatorio && opts.marcarRelatorio ? ' fora' : ''), onclick: () => opts.onclick && opts.onclick(f) },
        img,
        idx >= 0 ? h('span', { class: 'num' }, idx + 1) : null,
        f.irregular ? h('span', { class: 'alerta', title: 'Irregularidade' }, '⚠️') : null,
        !f.driveId && Sync.habilitado() ? h('span', { class: 'nuvem', title: 'Ainda não enviada' }, '⏳') : null,
        h('div', { class: 'dt' }, dataHoraBR(f.dataHora))));
    }
    return g;
  }

  /* ---------------- ordem das fotos no relatório (arrastar) ---------------- */
  // posição da foto: a ordem escolhida arrastando ou, sem ela, a hora da foto
  const chaveOrdem = (f) => (f.ordem != null && isFinite(+f.ordem) ? +f.ordem : (Date.parse(f.dataHora) || 0));
  // 3.15: na tela a foto mais NOVA vem primeiro (o relatório usa a ordem inversa: a mais antiga primeiro). A chave continua crescendo
  // do mais antigo para o mais novo; só a apresentação é invertida (aparelhos em versões antigas não se confundem).
  const ordenarFotos = (l) => l.slice().sort((a, b) => chaveOrdem(b) - chaveOrdem(a) || String(b.dataHora).localeCompare(String(a.dataHora)) || String(b.id).localeCompare(String(a.id)));
  /* Grava a nova posição. Normalmente só a foto movida muda (fica entre as vizinhas): pouca coisa para
     sincronizar e, se outro aparelho mexer em outra foto ao mesmo tempo, as duas mudanças se juntam. */
  async function moverFoto(fotos, idsTela, id) {
    const ids = idsTela.slice().reverse(); // a tela mostra do mais novo ao mais antigo; a chave cresce no sentido contrário
    const mapa = new Map(fotos.map((f) => [f.id, f]));
    const i = ids.indexOf(id);
    if (i < 0) return;
    const ant = i > 0 ? mapa.get(ids[i - 1]) : null, prox = i < ids.length - 1 ? mapa.get(ids[i + 1]) : null;
    const ka = ant ? chaveOrdem(ant) : null, kp = prox ? chaveOrdem(prox) : null;
    if (ka == null && kp == null) return;
    const nova = ka == null ? kp - 1000 : kp == null ? ka + 1 : (ka + kp) / 2;
    if ((ka == null || nova > ka) && (kp == null || nova < kp)) { await atualizarCampos('fotos', id, (o) => { o.ordem = nova; }); return; }
    // sem espaço entre as vizinhas (fotos com a mesma hora): renumera a visita inteira
    const ks = ids.map((x) => chaveOrdem(mapa.get(x)));
    const min = Math.min(...ks), passo = Math.max(1, (Math.max(...ks) - min) / Math.max(1, ids.length - 1));
    for (let k = 0; k < ids.length; k++) {
      const v = min + k * passo;
      if (chaveOrdem(mapa.get(ids[k])) !== v || mapa.get(ids[k]).ordem == null) await atualizarCampos('fotos', ids[k], (o) => { o.ordem = v; });
    }
  }
  let arrastandoFoto = false;
  /* Arrastar para reordenar: no celular, segure a foto um instante e arraste (sem segurar, a tela rola
     normalmente); no computador, clique e arraste. Um toque/clique simples continua abrindo a foto. */
  function tornarOrdenavel(grade, aoSoltar) {
    grade.classList.add('ordenavel');
    let arr = null, inicio = null, espera = null, quadro = null, semClique = false;
    const itens = () => [...grade.children].filter((e) => e.classList.contains('foto'));
    function comecar(el, x, y) {
      const r = el.getBoundingClientRect();
      const fantasma = el.cloneNode(true);
      fantasma.classList.add('foto-fantasma');
      Object.assign(fantasma.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      document.body.appendChild(fantasma);
      el.classList.add('arrastando');
      document.body.classList.add('arrastando-foto');
      arr = { el, fantasma, dx: x - r.left, dy: y - r.top, x, y, ordemInicial: itens().map((e) => e.dataset.id).join() };
      arrastandoFoto = true;
      try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { /* */ }
      const rolar = () => {
        if (!arr) return;
        const borda = 70, baixo = innerHeight - (innerWidth < 1024 ? 110 : 40);
        const v = arr.y < borda ? -Math.ceil((borda - arr.y) / 5) : arr.y > baixo ? Math.ceil((arr.y - baixo) / 5) : 0;
        if (v) { scrollBy(0, Math.max(-24, Math.min(24, v))); trocar(); }
        quadro = requestAnimationFrame(rolar);
      };
      quadro = requestAnimationFrame(rolar);
    }
    function trocar() {
      // com o dedo sobre a barra de baixo (ou o topo) enquanto a tela rola, usa o ponto logo acima/abaixo dela
      const py = Math.min(Math.max(arr.y, 72), innerHeight - (innerWidth < 1024 ? 118 : 12));
      const alvo = document.elementFromPoint(arr.x, py);
      const f = alvo && alvo.closest ? alvo.closest('.foto') : null;
      if (!f || f === arr.el || f.parentNode !== grade) return;
      const l = itens();
      if (l.indexOf(arr.el) < l.indexOf(f)) grade.insertBefore(arr.el, f.nextSibling); else grade.insertBefore(arr.el, f);
    }
    function mover(x, y) {
      arr.x = x; arr.y = y;
      arr.fantasma.style.left = (x - arr.dx) + 'px'; arr.fantasma.style.top = (y - arr.dy) + 'px';
      trocar();
    }
    function terminar(cancelado) {
      cancelAnimationFrame(quadro);
      const { el, fantasma, ordemInicial } = arr;
      arr = null; arrastandoFoto = false;
      fantasma.remove(); el.classList.remove('arrastando'); document.body.classList.remove('arrastando-foto');
      semClique = true; setTimeout(() => { semClique = false; }, 450);
      const ids = itens().map((e) => e.dataset.id);
      // sem mudança (ou cancelado): só redesenha (volta ao lugar e mostra o que chegou durante o arraste)
      aoSoltar(!cancelado && ids.join() !== ordemInicial ? el.dataset.id : null, ids);
    }
    // depois de arrastar, o clique não abre a foto
    grade.addEventListener('click', (e) => { if (semClique) { e.stopPropagation(); e.preventDefault(); } }, true);
    grade.addEventListener('contextmenu', (e) => { if (arr || inicio) e.preventDefault(); });
    grade.addEventListener('dragstart', (e) => e.preventDefault());
    // toque
    grade.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || arr) return;
      const el = e.target.closest('.foto');
      if (!el || el.parentNode !== grade) return;
      const t = e.touches[0];
      inicio = { x: t.clientX, y: t.clientY, el };
      clearTimeout(espera);
      espera = setTimeout(() => { if (inicio) comecar(inicio.el, inicio.x, inicio.y); }, 350);
    }, { passive: true });
    grade.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (arr) { if (e.cancelable) e.preventDefault(); mover(t.clientX, t.clientY); return; }
      if (inicio && (Math.abs(t.clientX - inicio.x) > 8 || Math.abs(t.clientY - inicio.y) > 8)) { clearTimeout(espera); inicio = null; }
    }, { passive: false });
    const fimToque = (e) => {
      clearTimeout(espera); inicio = null;
      if (arr) { if (e.cancelable) e.preventDefault(); terminar(e.type === 'touchcancel'); }
    };
    grade.addEventListener('touchend', fimToque);
    grade.addEventListener('touchcancel', fimToque);
    // mouse
    grade.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || arr) return;
      const el = e.target.closest('.foto');
      if (!el || el.parentNode !== grade) return;
      e.preventDefault();
      const ini = { x: e.clientX, y: e.clientY };
      const mm = (ev) => {
        if (arr) { mover(ev.clientX, ev.clientY); return; }
        if (Math.abs(ev.clientX - ini.x) > 5 || Math.abs(ev.clientY - ini.y) > 5) { comecar(el, ini.x, ini.y); mover(ev.clientX, ev.clientY); }
      };
      const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); if (arr) terminar(false); };
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    });
  }

  /* ---------------- gravação sem apagar alterações de outros aparelhos ---------------- */
  const CAMPOS_SISTEMA = ['id', '_pendente', '_campos', '_base', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor'];
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
      const antes = JSON.parse(JSON.stringify(o));
      fn(o);
      o.atualizadoEm = DB.carimbo(o.atualizadoEm);
      o.atualizadoPor = quem;
      DB.marcarCampos(antes, o, o.atualizadoEm);
      o._pendente = true;
      return o;
    });
    if (!r) return null;
    if (App.agendarSync) App.agendarSync();
    return r;
  }
  async function salvarConfig(fn) {
    // já existe: lê e grava na mesma transação (uma sincronização no meio não é desfeita)
    if (await DB.get('config', 'geral')) { await atualizarCampos('config', 'geral', (o) => { fn(o); }); return carregarConfig(); }
    let o = null;
    if (!o) {
      // aparelho novo que ainda não recebeu os ajustes da equipe: gravar agora apagaria os ajustes de todos
      if (Sync.habilitado() && !(await DB.kvGet('ultimaSync', null))) throw new Error('Aguarde a primeira sincronização deste aparelho: os ajustes da equipe ainda não chegaram.');
      o = clonar(CONFIG);
    }
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
        for (const o of todas.values()) if (o.projetoDe === id) add(o.id);
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
    // foto do projeto usada numa notificação emitida também segura a exclusão (o documento emitido não pode mudar)
    const jaListadas = new Set(notifs.map((n) => n.id));
    const emitidasProj = (await DB.listar('notificacoes', (n) => n.status === 'emitida' && !jaListadas.has(n.id)))
      .filter((n) => (n.fotos || []).some((s) => s.projeto && excluir.has(s.projeto.fotoId)));
    const projetos = [...excluir].filter((id) => !iniciais.has(id) && (todas.get(id) || {}).projetoDe).length;
    return { todas, excluir, iniciais, removerVerif, ajustar, projetos, rascunhos: notifs.filter((n) => n.status !== 'emitida'), emitidas: notifs.filter((n) => n.status === 'emitida').concat(emitidasProj) };
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
    const extras = [...plano.excluir].filter((id) => !plano.iniciais.has(id)).length - (plano.projetos || 0);
    if (extras) linhas.push('Também será(ão) excluída(s) ' + extras + ' foto(s) do histórico de verificações da irregularidade.');
    if (plano.projetos) linhas.push('Também será excluída a foto do projeto da irregularidade.');
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
  /* LGPD (3.15): o CPF do representante não é mais usado. Apaga as cópias guardadas neste aparelho
     (cadastros e retratos do cadastro em notificações/medições). O servidor apaga as da planilha. */
  async function apagarCpfLocal() {
    try {
      if (await DB.kvGet('lgpd_cpf_local', false)) return;
      for (const e of ['registros', 'notificacoes', 'medicoes']) {
        for (const o of await DB.all(e)) {
          let mudou = false;
          if ('n_representante_cpf' in o) { delete o.n_representante_cpf; mudou = true; }
          if (o.registroSnapshot && typeof o.registroSnapshot === 'object' && 'n_representante_cpf' in o.registroSnapshot) { delete o.registroSnapshot.n_representante_cpf; mudou = true; }
          if (o._base && 'n_representante_cpf' in o._base) { delete o._base.n_representante_cpf; mudou = true; }
          if (o._campos && 'n_representante_cpf' in o._campos) { delete o._campos.n_representante_cpf; mudou = true; }
          if (mudou) await DB.put(e, o);
        }
      }
      await DB.kvSet('lgpd_cpf_local', true);
    } catch (err) { console.warn('apagarCpfLocal', err); }
  }
  async function repararConsistencia() {
    if (reparando || !pode.coletar()) return 0;
    reparando = true;
    let n = 0;
    try {
      const fotos = await DB.all('fotos');
      const mapa = new Map(fotos.map((f) => [f.id, f]));
      const visitas = new Map((await DB.all('visitas')).map((v) => [v.id, v]));
      const medicoes = new Map((await DB.all('medicoes')).map((x) => [x.id, x]));
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
        // foto enviada para o relatório fotográfico de uma medição que foi excluída (em outro aparelho, por ex.)
        if (f.medicaoId && !f.visitaId && (medicoes.get(f.medicaoId) || {}).excluido) { await atualizarCampos('fotos', f.id, (o) => { o.excluido = true; }); n++; continue; }
        if (f.projetoDe) {
          const irr = mapa.get(f.projetoDe);
          if (irr && irr.excluido) { await atualizarCampos('fotos', f.id, (o) => { o.excluido = true; }); n++; continue; }
        }
        // projeto cuja imagem foi excluída (ex.: apagada pelo visualizador de fotos na 3.15.1): some de todas as telas
        if (f.projeto && f.projeto.fotoId) {
          const fp = mapa.get(f.projeto.fotoId);
          if (fp && fp.excluido) { await atualizarCampos('fotos', f.id, (o) => { delete o.projeto; }); n++; }
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

  /* ------------------------------------------------------------------ */
  /* Visualizador em tela cheia (base comum de fotos e irregularidades):  */
  /* zoom (roda do mouse / pinça / duplo clique), arrastar a imagem       */
  /* ampliada, setas/teclado/deslizar para passar e tira de miniaturas.  */
  /* ------------------------------------------------------------------ */
  function visorBase(cfg) {
    // cfg: { total, idx, rotulo, miniatura(k)→Promise<url>, classeMini(k), mostrar(k, api), salvar()→Promise<bool>, aoFechar(), dica }
    let idx = cfg.idx || 0, total = cfg.total, fechado = false;
    const imgEl = h('img', { class: 'visor-img', alt: '', draggable: 'false' });
    const legendaImg = h('div', { class: 'visor-legimg' });
    const zoomTxt = h('span', { class: 'visor-zoom-v' }, '100%');
    const palco = h('div', { class: 'visor-palco' }, imgEl, legendaImg);
    const z = { s: 1, x: 0, y: 0, max: 6 };
    const limitar = () => {
      const r = palco.getBoundingClientRect(), w = imgEl.offsetWidth * z.s, hh = imgEl.offsetHeight * z.s;
      const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (hh - r.height) / 2);
      z.x = Math.max(-mx, Math.min(mx, z.x)); z.y = Math.max(-my, Math.min(my, z.y));
    };
    const aplicar = (anim) => {
      if (z.s <= 1.001) { z.s = 1; z.x = 0; z.y = 0; } else limitar();
      imgEl.style.transition = anim ? 'transform .18s ease' : 'none';
      imgEl.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.s + ')';
      palco.classList.toggle('ampliada', z.s > 1);
      rc(zoomTxt, Math.round(z.s * 100) + '%');
    };
    const zoomEm = (novo, cx, cy, anim) => {
      const r = palco.getBoundingClientRect();
      const px = cx == null ? 0 : cx - (r.left + r.width / 2), py = cy == null ? 0 : cy - (r.top + r.height / 2);
      novo = Math.max(1, Math.min(z.max, novo));
      z.x = px - (px - z.x) * (novo / z.s); z.y = py - (py - z.y) * (novo / z.s); z.s = novo;
      aplicar(anim);
    };
    const ajustar = () => { z.s = 1; aplicar(true); };
    palco.addEventListener('wheel', (e) => { e.preventDefault(); zoomEm(z.s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
    palco.addEventListener('dblclick', (e) => { if (z.s > 1) ajustar(); else zoomEm(2.5, e.clientX, e.clientY, true); });
    const ptrs = new Map(); let ini = null, pinca = null, toqueTempo = 0, ultimoToque = 0;
    palco.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      palco.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { ini = { x: e.clientX, y: e.clientY, zx: z.x, zy: z.y }; toqueTempo = Date.now(); }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), s: z.s }; ini = null; }
    });
    palco.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinca && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; zoomEm(pinca.s * Math.hypot(a.x - b.x, a.y - b.y) / pinca.d, (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
      if (ini && z.s > 1) { z.x = ini.zx + (e.clientX - ini.x); z.y = ini.zy + (e.clientY - ini.y); aplicar(); }
      else if (ini && e.pointerType !== 'mouse') imgEl.style.transform = 'translateX(' + (e.clientX - ini.x) * 0.6 + 'px)';
    });
    const soltar = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinca = null;
      if (ini && ptrs.size === 0) {
        const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
        if (z.s <= 1 && e.pointerType !== 'mouse' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { ir(dx < 0 ? 1 : -1); }
        else if (z.s <= 1) {
          aplicar(true);
          if (e.pointerType !== 'mouse' && Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - toqueTempo < 300) {
            if (Date.now() - ultimoToque < 320) { zoomEm(2.5, e.clientX, e.clientY, true); ultimoToque = 0; } else ultimoToque = Date.now();
          }
        }
        ini = null;
      }
    };
    palco.addEventListener('pointerup', soltar); palco.addEventListener('pointercancel', soltar);

    const contador = h('span', { class: 'visor-cont' });
    const infoTopo = h('span', { class: 'visor-info' });
    const btAnt = h('button', { class: 'visor-seta ant', title: 'Anterior (←)', onclick: () => ir(-1) }, '‹');
    const btProx = h('button', { class: 'visor-seta prox', title: 'Próxima (→)', onclick: () => ir(1) }, '›');
    ap(palco, btAnt, btProx);
    const barraZoom = h('div', { class: 'visor-zoom' },
      h('button', { title: 'Diminuir (−)', onclick: () => zoomEm(z.s / 1.5, null, null, true) }, '−'), zoomTxt,
      h('button', { title: 'Ampliar (+)', onclick: () => zoomEm(z.s * 1.5, null, null, true) }, '+'),
      h('button', { title: 'Ajustar à tela (0)', onclick: ajustar }, '⤢'));
    const lado = h('div', { class: 'visor-lado' });
    const tira = h('div', { class: 'visor-tira' });
    const novaMini = (k) => {
      const m = h('img', { alt: '', loading: 'lazy', draggable: 'false' }); cfg.miniatura(k).then((u) => { if (u) m.src = u; });
      const bt = h('button', { class: 'visor-mini ' + (cfg.classeMini ? cfg.classeMini(k) : ''), onclick: () => ir([...tira.children].indexOf(bt) - idx) }, m);
      return bt;
    };
    for (let k = 0; k < total; k++) tira.appendChild(novaMini(k));
    const fundo = h('div', { class: 'visor-fundo' + (cfg.classe ? ' ' + cfg.classe : '') }, h('div', { class: 'visor' },
      h('div', { class: 'visor-topo' }, contador, infoTopo, barraZoom, h('button', { class: 'visor-fechar', title: 'Fechar (Esc)', onclick: () => fechar() }, '✕')),
      h('div', { class: 'visor-corpo' }, palco, lado),
      total > 1 ? tira : null));
    document.body.appendChild(fundo);
    document.body.classList.add('com-visor');

    const api = {
      lado, get idx() { return idx; }, get total() { return total; },
      // imagem: mostra a miniatura na hora e troca pela grande quando carregar
      imagem(mini, grandeP, legenda) {
        z.s = 1; z.x = 0; z.y = 0; aplicar();
        const k = idx; imgEl.src = mini || '';
        if (grandeP) grandeP.then((u) => { if (k === idx && u) imgEl.src = u; });
        rc(legendaImg, legenda || ''); legendaImg.style.display = legenda ? '' : 'none';
      },
      topo(info) { rc(infoTopo, info || ''); },
      atualizarMini(k, classe) { const c = tira.children[k]; if (c) c.className = 'visor-mini ' + (classe || '') + (k === idx ? ' atual' : ''); },
      async remover(k) { // item excluído: tira da tira e mostra o próximo (ou fecha se acabou)
        if (tira.children[k]) tira.children[k].remove();
        total--;
        if (!total) { encerrar(true); if (history.state && history.state.visor) history.back(); return; }
        idx = Math.min(k, total - 1); await mostrar(true);
      },
      ir: (d) => ir(d), fechar: () => fechar(),
      redesenhar: () => mostrar(true),
      encerrar: (chamar) => encerrar(chamar),
    };
    async function mostrar(semSalvar) {
      rc(contador, (idx + 1) + ' de ' + total + (cfg.rotulo ? '' : ''));
      btAnt.disabled = idx === 0; btProx.disabled = idx === total - 1;
      [...tira.children].forEach((c, i) => c.classList.toggle('atual', i === idx));
      const m = tira.children[idx]; if (m) m.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      await cfg.mostrar(idx, api);
    }
    async function ir(delta) {
      const k = idx + delta;
      if (k < 0 || k >= total || k === idx || fechado) return;
      if (cfg.salvar && !(await cfg.salvar())) return;
      idx = k; await mostrar();
    }
    function encerrar(chamarDepois) {
      if (fechado) return;
      fechado = true;
      document.removeEventListener('keydown', teclas, true);
      removeEventListener('popstate', aoVoltar); removeEventListener('hashchange', aoMudarTela);
      fundo.remove(); document.body.classList.remove('com-visor');
      if (chamarDepois && cfg.aoFechar) cfg.aoFechar();
    }
    async function fechar() {
      if (fechado) return;
      if (cfg.salvar && !(await cfg.salvar())) return;
      encerrar(true);
      if (history.state && history.state.visor) history.back();
    }
    const aoVoltar = () => { if (fechado) return; (cfg.salvar ? cfg.salvar() : Promise.resolve()).catch(() => {}).finally(() => encerrar(true)); };
    const aoMudarTela = () => { if (fechado) return; if (cfg.salvar) cfg.salvar().catch(() => {}); encerrar(false); };
    try { history.pushState({ visor: true }, ''); } catch (e) { /* */ }
    addEventListener('popstate', aoVoltar); addEventListener('hashchange', aoMudarTela);
    function teclas(e) {
      if (fechado || document.querySelector('.modal-fundo')) return;
      const digitando = /^(TEXTAREA|INPUT|SELECT)$/.test((document.activeElement || {}).tagName || '');
      if (e.key === 'Escape') { e.preventDefault(); if (digitando) document.activeElement.blur(); else fechar(); return; }
      if (digitando) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
      else if (e.key === '+' || e.key === '=') zoomEm(z.s * 1.5, null, null, true);
      else if (e.key === '-') zoomEm(z.s / 1.5, null, null, true);
      else if (e.key === '0') ajustar();
    }
    document.addEventListener('keydown', teclas, true);
    api.iniciar = () => mostrar();
    return api;
  }

  /* Visualizador de fotos: legenda, irregularidade e "incluir no relatório" ao lado; salva ao passar de foto */
  async function abrirFoto(f0, depois, listaOrig) {
    let lista = (listaOrig && listaOrig.length ? listaOrig : [f0]).filter((x) => x && !x.excluido);
    let idx0 = Math.max(0, lista.findIndex((x) => x.id === f0.id));
    if (!lista.length) { lista = [f0]; idx0 = 0; }
    const podeEditar = pode.coletar();
    let atual = null; // { f, edit, base, nVer, irrDe }
    const classeMini = (k) => (lista[k].irregular ? 'irr ' : '') + (lista[k].fora_relatorio ? 'fora' : '');
    const mudou = () => atual && podeEditar && JSON.stringify(atual.edit) !== atual.base;
    async function salvar() {
      if (!mudou()) return true;
      const { f, edit, nVer } = atual;
      if (edit.irregular && !edit.descricao.trim()) { toast('Descreva a irregularidade.', true); return false; }
      if (f.irregular && !edit.irregular && nVer) {
        if (!(await confirmar('Esta irregularidade tem ' + nVer + ' registro(s) no histórico de verificações. Ao deixar de ser irregularidade, esse histórico é apagado (as fotos de verificação continuam como fotos comuns da visita). Continuar?', 'Continuar', true))) return false;
        for (const vf of f.verificacoes) if (vf.fotoId) await atualizarCampos('fotos', vf.fotoId, (o) => { delete o.verificacaoDe; });
      }
      const novo = await atualizarCampos('fotos', f.id, (o) => {
        o.descricao = edit.descricao.trim(); o.irregular = edit.irregular; o.fora_relatorio = !edit.incluir;
        if (!o.irregular) { delete o.verificacoes; delete o.situacao; delete o.sanadaEm; }
      });
      const k = v.idx;
      if (novo) { lista[k] = novo; atual.f = novo; }
      atual.base = JSON.stringify(edit);
      v.atualizarMini(k, classeMini(k));
      toast('Foto atualizada');
      return true;
    }
    const v = visorBase({
      total: lista.length, idx: idx0,
      miniatura: (k) => urlFoto(lista[k]), classeMini,
      salvar, aoFechar: () => { if (depois) depois(); },
      async mostrar(k, api) {
        const f = (await DB.get('fotos', lista[k].id)) || lista[k];
        if (k !== api.idx) return;
        api.imagem(f.miniatura, urlFoto(f, true));
        for (const n of [lista[k + 1], lista[k - 1]]) if (n) urlFoto(n, true);
        api.topo(dataHoraBR(f.dataHora));
        const edit = { descricao: f.descricao || '', irregular: !!f.irregular, incluir: !f.fora_relatorio };
        const irrDe = f.verificacaoDe ? await DB.get('fotos', f.verificacaoDe) : null;
        const nVer = (f.verificacoes || []).length;
        atual = { f, edit, base: JSON.stringify(edit), nVer, irrDe };
        const coord = f.lat != null ? h('a', { href: 'https://www.google.com/maps?q=' + f.lat + ',' + f.lng, target: '_blank', rel: 'noopener' }, Foto.textoCoord(f.lat, f.lng) + (f.precisao ? ' (±' + f.precisao + ' m)' : '')) : 'sem coordenadas';
        const rotDesc = h('span', {}, edit.irregular ? 'Descrição da irregularidade *' : 'Legenda (opcional)');
        const area = inputArea(edit, 'descricao', { readonly: !podeEditar, placeholder: 'Ex.: Telhas do refeitório amassadas' });
        const chkIrr = h('input', { type: 'checkbox', disabled: !podeEditar, checked: edit.irregular ? 'checked' : null,
          onchange: (e) => { edit.irregular = e.target.checked; rotDesc.textContent = edit.irregular ? 'Descrição da irregularidade *' : 'Legenda (opcional)'; } });
        const chkRel = h('input', { type: 'checkbox', disabled: !podeEditar, checked: edit.incluir ? 'checked' : null, onchange: (e) => { edit.incluir = e.target.checked; } });
        const sair = () => api.encerrar(false);
        rc(api.lado,
          h('div', { class: 'sub' }, '🕒 ', dataHoraBR(f.dataHora), ' · 📍 ', coord),
          h('div', { class: 'sub', style: { marginBottom: '10px' } }, 'Por ', nomeDe(f.criadoPor) || '—', f.origem === 'galeria' ? ' · importada da galeria' : ''),
          irrDe && !irrDe.excluido ? h('div', { class: 'aviso', style: { marginBottom: '8px' } }, '📋 Foto do histórico da irregularidade “' + (irrDe.descricao || '') + '”. ',
            h('a', { href: '#/irregularidade/' + irrDe.id, onclick: sair }, 'Ver histórico'))
            : h('label', { class: 'linha', style: { marginBottom: '8px' } }, chkIrr, h('b', {}, '⚠️ Registrar como irregularidade')),
          nVer ? h('div', { class: 'sub', style: { marginBottom: '8px' } }, 'Histórico: ' + nVer + ' verificação(ões) — ', h('a', { href: '#/irregularidade/' + f.id, onclick: sair }, 'abrir')) : null,
          f.irregular ? blocoProjetoVisor(f, async () => { if (!(await salvar())) return false; return true; }, async () => { lista[api.idx] = (await DB.get('fotos', f.id)) || f; await api.redesenhar(); }) : null,
          h('label', { class: 'campo' }, rotDesc, area),
          h('label', { class: 'linha sub' }, chkRel, 'Incluir no relatório fotográfico'),
          podeEditar ? h('div', { class: 'acoes' },
            h('button', { class: 'btn pri', onclick: async () => { if (!mudou()) { toast('Nada a salvar'); return; } await salvar(); } }, 'Salvar'),
            h('button', { class: 'btn perigo', onclick: async () => {
              const txt = f.irregular ? 'Excluir esta irregularidade (foto e descrição)? Ela não aparecerá mais para ninguém do grupo.'
                : irrDe ? 'Excluir esta foto? O registro de verificação ligado a ela será retirado do histórico da irregularidade.'
                  : 'Excluir esta foto? Ela não aparecerá mais para ninguém do grupo.';
              if (!(await excluirFotos([f.id], txt))) return;
              toast('Foto excluída'); atual = null; const kk = api.idx; lista.splice(kk, 1); await api.remover(kk);
            } }, 'Excluir')) : null,
          lista.length > 1 ? h('p', { class: 'dica visor-dica' }, podeEditar ? 'As alterações são salvas ao passar para outra foto. ' : '', 'Setas ← → do teclado passam as fotos; roda do mouse ou + / − ampliam; arraste para mover a foto ampliada.') : null);
      },
    });
    await v.iniciar();
  }

  /* Visualizador de irregularidades: mesma tela das fotos, com a situação, o histórico de verificações
     (fotos de antes e depois) e os botões Sanada / Não sanada. Depois de verificar, já vai para a próxima. */
  async function abrirIrregularidades(f0, listaOrig, rotulo, visitaId, depois) {
    const lista = listaOrig.filter((x) => x && !x.excluido);
    const idx0 = Math.max(0, lista.findIndex((x) => x.id === f0.id));
    const r = await DB.get('registros', f0.registroId);
    let atual = null; // { f, edit, base }
    const classeMini = (k) => 'irr ' + (situacao(lista[k]) === 'sanada' ? 'sanada' : '');
    const mudou = () => atual && pode.coletar() && atual.edit.descricao !== atual.base;
    async function salvar() {
      if (!mudou()) return true;
      if (!atual.edit.descricao.trim()) { toast('Descreva a irregularidade.', true); return false; }
      const novo = await atualizarCampos('fotos', atual.f.id, (o) => { o.descricao = atual.edit.descricao.trim(); });
      if (novo) { lista[v.idx] = novo; atual.f = novo; }
      atual.base = atual.edit.descricao;
      toast('Descrição atualizada');
      return true;
    }
    const v = visorBase({
      total: lista.length, idx: idx0, classe: 'visor-irr',
      miniatura: (k) => fotoAtualIrr(lista[k]).then((a) => urlFoto(situacao(lista[k]) === 'pendente' ? a : lista[k])), classeMini,
      salvar, aoFechar: () => { if (depois) depois(); },
      async mostrar(k, api) {
        const f = (await DB.get('fotos', lista[k].id)) || lista[k];
        if (k !== api.idx) return;
        lista[k] = f;
        const st = situacao(f);
        const visOrig = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
        // fotos da irregularidade: constatação + cada verificação com foto
        const fotos = [{ f, rot: 'Constatação · ' + dataHoraBR(f.dataHora).slice(0, 10) }];
        const verifs = f.verificacoes || [];
        for (const vf of verifs) {
          const fv = vf.fotoId ? await DB.get('fotos', vf.fotoId) : null;
          if (fv && !fv.excluido) fotos.push({ f: fv, rot: (vf.status === 'sanada' ? '✓ Sanada' : '✗ Não sanada') + ' · ' + dataHoraBR(vf.data).slice(0, 10), vf });
        }
        const pj = projetoDe(f), fpj = pj ? await DB.get('fotos', pj.fotoId) : null;
        const nReais = fotos.length;
        if (fpj && !fpj.excluido) fotos.push({ f: fpj, rot: '📐 Projeto', projeto: true });
        if (k !== api.idx) return;
        let sel = nReais - 1; // começa pela foto mais recente (o projeto fica por último, para consulta)
        const chips = h('div', { class: 'irr-chips' });
        const verFoto = (i) => {
          sel = i;
          api.imagem(fotos[i].f.miniatura, urlFoto(fotos[i].f, true), fotos[i].rot);
          [...chips.children].forEach((c, j) => c.classList.toggle('ativo', j === i));
        };
        fotos.forEach((x, i) => {
          const m = h('img', { alt: '' }); urlFoto(x.f).then((u) => { m.src = u; });
          chips.appendChild(h('button', { class: 'irr-chip', onclick: () => verFoto(i) }, m, h('span', {}, x.rot)));
        });
        verFoto(sel);
        api.topo(r ? r.apelido : '');
        const edit = { descricao: f.descricao || '' };
        atual = { f, edit, base: edit.descricao };
        const podeEd = pode.coletar();
        const historico = verifs.slice().reverse().map((vf) => h('div', { class: 'verif ' + vf.status },
          h('div', {}, h('b', {}, vf.status === 'sanada' ? '✓ Sanada' : '✗ Não sanada'), ' — ', dataHoraBR(vf.data), ' · ', nomeDe(vf.por) || '—'),
          vf.descricao ? h('div', { style: { margin: '4px 0 0' } }, vf.descricao) : null));
        const verificar = async (status) => {
          if (!(await salvar())) return;
          const ok = await verificarIrregularidade(f, r, status, visitaId, { semNavegar: true });
          if (!ok) return;
          const k2 = api.idx;
          lista[k2] = (await DB.get('fotos', f.id)) || f;
          api.atualizarMini(k2, classeMini(k2));
          if (k2 < api.total - 1) { toast((status === 'sanada' ? 'Sanada registrada' : 'Não sanada registrada') + ' — próxima (' + (k2 + 2) + ' de ' + api.total + ')'); atual = null; await api.ir(1); }
          else { toast(status === 'sanada' ? 'Sanada registrada — era a última' : 'Não sanada registrada — era a última'); atual = null; await api.fechar(); }
        };
        rc(api.lado,
          h('div', { class: 'irr-cab' }, h('span', { class: 'badge ' + st }, st === 'sanada' ? '✓ Sanada' : 'Pendente'), rotulo ? h('span', { class: 'sub' }, rotulo) : null),
          podeEd ? h('label', { class: 'campo', style: { marginTop: '8px' } }, h('span', {}, 'Irregularidade'), inputArea(edit, 'descricao', { rows: 2 }))
            : h('h3', { style: { margin: '8px 0' } }, f.descricao || '(sem descrição)'),
          h('div', { class: 'sub', style: { marginBottom: '10px' } }, 'Constatada em ' + dataHoraBR(f.dataHora) + (visOrig ? ' · Visita nº ' + visOrig.numero : '') + ' · por ' + (nomeDe(f.criadoPor) || '—')),
          fotos.length > 1 ? h('div', {}, h('div', { class: 'sub', style: { marginBottom: '4px' } }, 'Fotos (' + fotos.length + ') — toque para ver:'), chips) : null,
          podeEd ? h('div', { class: 'acoes', style: { marginTop: '6px' } }, h('button', { class: 'btn peq', onclick: async () => {
            if (!(await salvar())) return;
            if (await editarProjeto(f)) { lista[api.idx] = (await DB.get('fotos', f.id)) || f; await api.redesenhar(); }
          } }, pj ? '🔄 Trocar foto do projeto' : '📐 Incluir foto do projeto')) : null,
          podeEd && st === 'pendente' ? h('div', { class: 'grade-bt', style: { marginTop: '10px' } },
            h('button', { class: 'btn ok grande', onclick: () => verificar('sanada') }, '✓ Sanada'),
            h('button', { class: 'btn perigo grande', onclick: () => verificar('nao_sanada') }, '✗ Não sanada')) : null,
          h('h3', { class: 'sub', style: { margin: '14px 0 6px' } }, 'Histórico de verificações'),
          historico.length ? h('div', {}, ...historico) : h('div', { class: 'sub' }, 'Ainda não verificada em visita posterior.'),
          h('div', { class: 'acoes', style: { marginTop: '12px' } },
            h('a', { class: 'btn peq', href: '#/irregularidade/' + f.id + (visitaId ? '/' + visitaId : ''), onclick: () => api.encerrar(false) }, 'Abrir página completa'),
            podeEd && st === 'sanada' ? h('button', { class: 'btn peq', onclick: async () => {
              if (!(await confirmar('Reabrir esta irregularidade (voltar para pendente)?', 'Reabrir'))) return;
              await atualizarCampos('fotos', f.id, (o) => { o.verificacoes = (o.verificacoes || []).concat([{ id: DB.uuid(), data: new Date().toISOString(), status: 'nao_sanada', descricao: 'Reaberta.', fotoId: null, visitaId: visitaId || null, por: email() }]); recalcularSituacao(o); });
              lista[api.idx] = await DB.get('fotos', f.id); api.atualizarMini(api.idx, classeMini(api.idx)); atual = null; await v.iniciar();
            } }, '↺ Reabrir') : null,
            podeEd ? h('button', { class: 'btn peq perigo', onclick: async () => {
              if (!(await excluirFotos([f.id], 'Excluir esta irregularidade (foto, descrição e todo o histórico)? Ela não aparecerá mais para ninguém do grupo.'))) return;
              toast('Irregularidade excluída'); atual = null; const kk = api.idx; lista.splice(kk, 1); await api.remover(kk);
            } }, '🗑 Excluir') : null),
          h('p', { class: 'dica visor-dica' }, 'Setas ← → passam as irregularidades; roda do mouse ou + / − ampliam a foto.'));
      },
    });
    await v.iniciar();
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
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
    titulo((existente ? 'Editar ' : 'Novo ') + ROTULO[tipo].toLowerCase(), true); marcarNav(tipo === 'convenio' ? 'convenios' : 'contratos');

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
        campo('Telefone', inputTxt(r, 'n_telefone', { inputmode: 'tel' }))),
      campo('Representante legal', inputTxt(r, 'n_representante')),
      campo('Logradouro', inputTxt(r, 'n_logradouro')),
      h('div', { class: 'grade2' },
        campo('Bairro', inputTxt(r, 'n_bairro')),
        campo('CEP', inputTxt(r, 'n_cep', { inputmode: 'numeric' }))),
      campo('Município/UF', inputTxt(r, 'n_municipio', { placeholder: 'Ex.: Sinop/MT' })));

    const selStatus = h('select', { onchange: (e) => { r.status_obra = e.target.value; } },
      h('option', { value: '' }, '— não informado —'),
      listaStatus(tipo).map((x) => h('option', { value: x.nome, selected: r.status_obra === x.nome ? 'selected' : null }, x.nome)),
      r.status_obra && !listaStatus(tipo).some((x) => x.nome === r.status_obra) ? h('option', { value: r.status_obra, selected: 'selected' }, r.status_obra + ' (fora da lista atual)') : null);
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
    rcT(tk, secDados, secNotificada, secAss, secSanc, secPad, acoes);
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    if (!registroId) {
      titulo('Visita à obra');
      const regs = (await DB.listar('registros')).sort((a, b) => String(a.apelido).localeCompare(b.apelido));
      const recentes = (await DB.kvGet('coletaRecentes', [])).map((id) => regs.find((r) => r.id === id)).filter(Boolean);
      const andamento = (await DB.listar('visitas', (v) => v.status !== 'concluida' && v.criadoPor === email()));
      const bloco = (lista) => lista.map((r) => h('a', { class: 'item', href: '#/coleta/' + r.id },
        h('span', { class: 'badge' }, ROTULO[r.tipo]), h('div', { class: 't' }, r.apelido), h('div', { class: 'd' }, descricaoRegistro(r))));
      rcT(tk,
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
    if (!pode.coletar()) { rcT(tk, h('div', { class: 'aviso' }, 'Seu perfil permite apenas consulta.')); return; }
    const rec = (await DB.kvGet('coletaRecentes', [])).filter((x) => x !== registroId);
    rec.unshift(registroId);
    DB.kvSet('coletaRecentes', rec.slice(0, 5));
    const abertas = (await visitasDe(registroId)).filter((v) => v.status !== 'concluida');
    if (tk !== rotaSeq) return; // saiu da tela enquanto carregava
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
        const res = (origem === 'galeria' && !carimbar && await Foto.original(arq, exif)) || await Foto.processar(arq, { carimbo: linhas, angulo: arq.angulo, origemCamera: arq.angulo !== undefined });
        const foto = { id: DB.uuid(), registroId: r.id, visitaId: v ? v.id : null, tipo: r.tipo, dataHora, lat, lng, precisao, origem,
          carimbada: !!carimbar, largura: res.largura, altura: res.altura, miniatura: res.miniatura, descricao: '', irregular: !!opt.irregular };
        if (opt.medicaoId) foto.medicaoId = opt.medicaoId; // enviada para o relatório fotográfico da medição
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    const v0 = await DB.get('visitas', id);
    if (!v0 || v0.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Visita não encontrada.')); return; }
    const r = await DB.get('registros', v0.registroId);
    if (!r) { rcT(tk, h('div', { class: 'vazio' }, 'Obra desta visita não encontrada.')); return; }
    marcarNav(r.tipo === 'convenio' ? 'convenios' : 'contratos');
    titulo('Visita nº ' + v0.numero + ' · ' + r.apelido, true);
    const v = JSON.parse(JSON.stringify(v0));
    let vBase = clonar(v0);
    const podeEd = pode.coletar();
    const pessoas = await pessoasMap();
    let sujo = false, versao = 0, tAuto = null, filaSalvar = Promise.resolve();
    /* Salvamento automático (3.15.7): os dados da visita (observações gerais etc.) são gravados 1,5 s depois
       de parar de digitar, ao sair da tela e quando o app vai para segundo plano (tela apagada, outro app). */
    const statusAuto = h('span', { class: 'sub auto-status' }, podeEd ? 'As alterações são salvas automaticamente.' : '');
    const marcar = () => {
      sujo = true; versao++;
      if (!podeEd) return;
      clearTimeout(tAuto);
      rc(statusAuto, 'Alterações ainda não salvas…');
      tAuto = setTimeout(() => autoSalvar(), 1500);
    };
    // grava uma cópia do que está na tela; o que for digitado durante a gravação continua pendente
    const salvarVisita = (silencioso) => (filaSalvar = filaSalvar.catch(() => {}).then(async () => {
      clearTimeout(tAuto); tAuto = null;
      v.fiscais = snapshotAssinantes(edFiscais, pessoas, true);
      const vInicio = versao, copia = clonar(v);
      const salvo = await salvarMudancas('visitas', vBase, copia);
      Object.assign(v0, salvo);
      vBase = copia;
      sujo = versao !== vInicio;
      if (!silencioso) toast('Dados da visita salvos');
      if (!sujo) rc(statusAuto, '✓ Salvo às ' + horaAgora());
    }));
    const autoSalvar = async () => {
      if (!sujo || !podeEd) return;
      try { await salvarVisita(true); } catch (e) { rc(statusAuto, '⚠️ Não foi possível salvar: ' + e.message); }
    };
    // app indo para segundo plano (tela apagada, troca de app, fechar o navegador): grava na hora
    const aoEsconder = (e) => {
      if (!document.body.contains(statusAuto)) { document.removeEventListener('visibilitychange', aoEsconder); removeEventListener('pagehide', aoEsconder); return; }
      if (document.visibilityState === 'hidden' || (e && e.type === 'pagehide')) autoSalvar();
    };
    if (podeEd) { document.addEventListener('visibilitychange', aoEsconder); addEventListener('pagehide', aoEsconder); }
    App._sairNotif = async () => {
      document.removeEventListener('visibilitychange', aoEsconder); removeEventListener('pagehide', aoEsconder);
      if (sujo && podeEd) await salvarVisita(true);
    };

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
    let redesenharFotosDepois = false;
    async function desenharFotos() {
      if (arrastandoFoto) { redesenharFotosDepois = true; return; } // não desmancha a grade no meio de um arraste
      redesenharFotosDepois = false;
      const fotos = ordenarFotos((await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido));
      const irr = fotos.filter((f) => f.irregular);
      const grade = fotos.length ? gradeFotos(fotos, { marcarRelatorio: true, onclick: (f) => abrirFoto(f, desenharFotos, fotos) }) : null;
      const ordenar = podeEd && fotos.length > 1;
      if (ordenar) tornarOrdenavel(grade, async (fid, ids) => { if (fid) await moverFoto(fotos, ids, fid); desenharFotos(); });
      rc(boxFotos, h('h2', {}, 'Fotos da visita (' + fotos.length + ')'),
        grade || h('div', { class: 'vazio' }, 'Nenhuma foto ainda.'),
        ordenar ? h('div', { class: 'dica' }, 'No relatório, as fotos saem de baixo para cima: a de baixo é a primeira e a de cima, a última. Para mudar a ordem, segure a foto e arraste (no computador, clique e arraste).') : null,
        fotos.some((f) => f.fora_relatorio) ? h('div', { class: 'dica' }, 'Fotos esmaecidas não entram no relatório.') : null);
      const reverif = (await reverificadasNaVisita(r, id)).reverse(); // mais nova em cima, como as fotos
      const nIrr = irr.length + reverif.length;
      rc(boxIrr, h('h2', {}, '⚠️ Irregularidades (' + nIrr + ')'),
        nIrr ? h('div', { class: 'lista-ord' }, reverif.map((f) => {
          const img = h('img'); fotoAtualIrr(f).then(urlFoto).then((u) => { img.src = u; });
          return h('div', { class: 'li', style: { cursor: 'pointer' }, onclick: () => abrirIrregularidades(f, reverif, 'Não sanadas nesta visita', id, desenharFotos) }, img,
            h('div', { style: { flex: 1 } }, h('div', {}, f.descricao || '(sem descrição)'),
              h('div', { class: 'sub' }, '✗ Não sanada nesta visita · constatada em ' + dataHoraBR(f.dataHora).slice(0, 10))));
        }), irr.map((f) => {
          const img = h('img'); urlFoto(f).then((u) => { img.src = u; });
          return h('div', { class: 'li', style: { cursor: 'pointer' }, onclick: () => abrirFoto(f, desenharFotos, irr) }, img, h('div', { style: { flex: 1 } }, h('div', {}, f.descricao || '(sem descrição)'), h('div', { class: 'sub' }, dataHoraBR(f.dataHora))));
        })) : h('div', { class: 'sub' }, 'Nenhuma irregularidade registrada nesta visita.'),
        nIrr && pode.notificar() ? h('div', { class: 'acoes' }, h('button', { class: 'btn', onclick: async () => { await salvarVisita(true); notificarVisita(v0, r); } }, '📝 Gerar notificação com estas irregularidades')) : null,
        reverif.length ? h('div', { class: 'dica' }, 'Irregularidades não sanadas entram na notificação com a foto nova desta visita.') : null);
      boxIrr.className = 'card';
      boxFotos.className = 'card';
      const pend = (await irregularidadesDe(r.id)).filter((f) => situacao(f) === 'pendente' && f.visitaId !== id);
      rc(boxPend, h('h2', {}, '📋 Pendências de visitas anteriores (' + pend.length + ')'),
        pend.length ? h('p', { class: 'sub' }, 'Verifique cada uma e registre se foi sanada, com foto e descrição do que foi feito.') : h('div', { class: 'sub' }, 'Nenhuma irregularidade pendente nesta obra.'),
        pend.map((f) => itemIrregularidade(f, () => abrirIrregularidades(f, pend, 'Pendências a verificar', id, desenharFotos))));
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
        podeEd ? h('div', { class: 'linha', style: { flexWrap: 'wrap', gap: '10px', alignItems: 'center' } },
          h('button', { class: 'btn', onclick: () => salvarVisita() }, '💾 Salvar agora'), statusAuto) : null));

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

    rcT(tk, cab, v.status !== 'concluida' ? gps : null, captura, boxPend, boxFotos, boxIrr, dados, acoes);
    await desenharFotos();
    if (tk !== rotaSeq) return; // o usuário já foi para outra tela: não liga GPS nem registra limpeza
    // no computador, as fotos da visita que estão só no Drive já começam a baixar (o relatório fica pronto mais rápido)
    if (Sync.dispositivo === 'computador' && Sync.habilitado() && navigator.onLine) {
      setTimeout(async () => {
        if (tk !== rotaSeq) return;
        const fs = (await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido && f.driveId && !f.fora_relatorio);
        const tem = await Promise.all(fs.map((f) => DB.blobGet(f.id).then((b) => !!b)));
        const faltam = fs.filter((f, k) => !tem[k]);
        if (faltam.length) { Sync.log('fotos', 'baixando ' + faltam.length + ' foto(s) da visita em segundo plano'); obterFotos(faltam, null, 4).catch(() => {}); }
      }, 1500);
    }
    App._atualizarTela = () => (document.body.contains(boxFotos) ? desenharFotos() : null); // fotos de outros aparelhos aparecem sem sair da tela
    if (v.status !== 'concluida' && podeEd) {
      Foto.iniciarGPS();
      const off = Foto.onGPS((p, err) => {
        if (!document.body.contains(gps)) { off(); return; }
        if (p) { gps.className = 'gps ' + (p.precisao <= 30 ? 'bom' : ''); rc(gps, '📍 ' + Foto.textoCoord(p.lat, p.lng) + ' · precisão ±' + p.precisao + ' m'); }
        else if (err) { gps.className = 'gps ruim'; rc(gps, '⚠️ GPS indisponível: ' + (err.code === 1 ? 'permissão negada — libere a localização para este app.' : 'ative a localização do aparelho.')); }
      });
      // ao sair da visita o GPS é desligado (antes ficava ligado até fechar o app, gastando bateria)
      App._sairTela = () => { off(); Foto.pararGPS(); };
    } else Foto.pararGPS();
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

  /* Pega as fotos de uma lista (do aparelho ou, se faltar, do Drive), várias ao mesmo tempo.
     Antes eram baixadas uma por vez: no computador, 180 fotos tiradas no celular levavam mais de 10 minutos. */
  const baixandoFoto = new Map(); // a mesma foto não é baixada duas vezes ao mesmo tempo
  function obterFotos(lista, aoProgresso, paralelo, transformar) {
    const blobs = new Map(), faltando = [];
    let feitas = 0, baixadas = 0, i = 0;
    const umaFoto = async (f) => {
      let b = await DB.blobGet(f.id);
      if (!b && f.driveId && Sync.habilitado() && navigator.onLine) {
        if (!baixandoFoto.has(f.id)) baixandoFoto.set(f.id, Sync.baixarFoto(f).finally(() => baixandoFoto.delete(f.id)));
        try { b = await baixandoFoto.get(f.id); baixadas++; } catch (e) { b = null; }
      }
      if (b && transformar) b = await transformar(b, f); // ex.: reduz enquanto as próximas ainda estão chegando do Drive
      if (b) blobs.set(f.id, b); else faltando.push(f);
      feitas++;
      if (aoProgresso) aoProgresso(feitas, lista.length, baixadas);
    };
    const trabalhador = async () => { while (i < lista.length) await umaFoto(lista[i++]); };
    return Promise.all(Array.from({ length: Math.min(paralelo || 6, lista.length) }, trabalhador)).then(() => ({ blobs, faltando, baixadas }));
  }
  /* Janela de progresso de toda emissão de documento: título, etapa atual, barra, % e tempo restante.
     frac = null → barra "andando" (etapa sem medida, ex.: aguardando o servidor). A barra nunca volta. */
  function janelaProgresso(texto, titulo) {
    const idt = 'prog-' + Date.now().toString(36);
    const tit = h('h2', { class: 'prog-tit', id: idt }, titulo || 'Gerando documento');
    const txt = h('div', { class: 'prog-txt', 'aria-live': 'polite' }, texto), barra = h('div', { class: 'prog-barra' });
    const fundoBarra = h('div', { class: 'prog indet', role: 'progressbar', 'aria-labelledby': idt, 'aria-valuemin': '0', 'aria-valuemax': '100' }, barra);
    const pct = h('span', { class: 'prog-pct' }, ''), falta = h('span', { class: 'prog-falta' }, '');
    const fundo = h('div', { class: 'modal-fundo prog-fundo' }, h('div', { class: 'modal prog-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idt },
      tit, h('div', { class: 'linha' }, h('span', { class: 'carregando', 'aria-hidden': 'true' }), txt), fundoBarra, h('div', { class: 'prog-info', 'aria-hidden': 'true' }, pct, falta)));
    document.body.appendChild(fundo);
    const t0 = Date.now();
    let max = 0, ultEta = 0, eta = null;
    const textoFalta = (s) => s < 5 ? 'quase pronto' : s < 60 ? 'falta cerca de ' + Math.max(5, Math.round(s / 5) * 5) + ' s' : 'falta cerca de ' + Math.round(s / 60) + ' min';
    const jp = {
      set(t, frac) {
        if (t != null) rc(txt, t);
        if (frac == null) { fundoBarra.classList.add('indet'); fundoBarra.removeAttribute('aria-valuenow'); return; }
        fundoBarra.classList.remove('indet');
        max = Math.max(max, Math.max(0, Math.min(1, frac)));
        barra.style.width = (max * 100).toFixed(1) + '%';
        const p = Math.floor(max * 100);
        pct.textContent = p + '%';
        fundoBarra.setAttribute('aria-valuenow', String(p));
        // tempo restante: só depois de alguns segundos (antes disso a estimativa engana) e no máximo 1× por segundo
        const dec = (Date.now() - t0) / 1000;
        if (max >= 0.99) { falta.textContent = 'quase pronto'; return; }
        if (dec < 3 || max < 0.04 || Date.now() - ultEta < 1000) return;
        ultEta = Date.now();
        const bruto = dec * (1 - max) / max;
        eta = eta == null ? bruto : eta * 0.6 + bruto * 0.4;
        falta.textContent = textoFalta(eta);
      },
      fechar() { fundo.remove(); },
    };
    return jp;
  }
  // progresso da gravação do .docx (DocGen) dentro de uma faixa da barra
  const progGravar = (jp, de, ate) => (p) => jp.set('Gravando o arquivo…', de + (ate - de) * p / 100);
  const pausaTela = () => new Promise((ok) => setTimeout(ok, 30)); // deixa a tela mostrar o texto antes de um passo pesado
  // tamanho máximo das fotos no relatório, conforme o layout (impressão nítida, arquivo bem menor)
  const LADO_RELATORIO = { 2: 1600, 4: 1280, 6: 1024 };

  async function dialogoRelatorio(v, r) {
    // relatório: de baixo para cima da tela da visita (a foto de baixo, mais antiga, é a primeira; a de cima é a última)
    const fotos = ordenarFotos((await DB.byIndex('fotos', 'visitaId', v.id)).filter((f) => !f.excluido)).reverse();
    const incl = fotos.filter((f) => !f.fora_relatorio);
    const escolha = { layout: String(await DB.kvGet('layoutRelatorio', '4')), tamanho: String(await DB.kvGet('tamanhoFotosRelatorio', 'reduzidas')) };
    const radio = (grupo, val, txt, desc) => h('label', { class: 'item', style: { display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' } },
      h('input', { type: 'radio', name: grupo, value: val, checked: escolha[grupo] === val ? 'checked' : null, onchange: () => { escolha[grupo] = val; } }),
      h('div', {}, h('div', { class: 't' }, txt), h('div', { class: 'd' }, desc)));
    // já começa a baixar as fotos que não estão neste aparelho enquanto o usuário escolhe as opções
    const tem = await Promise.all(incl.map((f) => DB.blobGet(f.id).then((b) => !!b)));
    const faltamAqui = incl.filter((f, k) => !tem[k]);
    const avisoBaixa = h('div', { class: 'sub' });
    let preBaixa = null;
    if (faltamAqui.length && Sync.habilitado() && navigator.onLine) {
      rc(avisoBaixa, '⏳ Baixando do Drive as ' + faltamAqui.length + ' foto(s) que não estão neste aparelho…');
      preBaixa = obterFotos(faltamAqui, (k, n) => { rc(avisoBaixa, k < n ? '⏳ Baixando do Drive: ' + k + ' de ' + n + ' foto(s)…' : '✓ Fotos baixadas do Drive.'); });
    } else if (faltamAqui.length) rc(avisoBaixa, '⚠️ ' + faltamAqui.length + ' foto(s) não estão neste aparelho e não há internet para baixá-las.');
    const corpo = h('div', {},
      h('p', { class: 'sub' }, incl.length + ' de ' + fotos.length + ' foto(s) entrarão no relatório. Para retirar uma foto, abra-a e desmarque “Incluir no relatório”.'),
      faltamAqui.length ? avisoBaixa : null,
      radio('layout', '2', '2 fotos por página', 'Fotos grandes, uma abaixo da outra'),
      radio('layout', '4', '4 fotos por página', 'Grade 2 × 2 (recomendado)'),
      radio('layout', '6', '6 fotos por página', 'Grade 2 × 3, mais compacto'),
      h('h3', { class: 'sub', style: { margin: '12px 0 4px' } }, 'Fotos no arquivo'),
      radio('tamanho', 'reduzidas', 'Ajustadas ao relatório (recomendado)', 'No tamanho em que aparecem na página: nítidas na impressão, arquivo até 3× menor e geração mais rápida'),
      radio('tamanho', 'originais', 'Tamanho original', 'Arquivo bem maior; use só se alguém precisar das fotos em resolução total dentro do Word'));
    const acao = await modal('Relatório fotográfico', corpo, [{ txt: 'Cancelar', valor: null }, { txt: '📤 Compartilhar', valor: 'comp' }, { txt: '⬇️ Baixar Word', cls: 'pri', valor: 'baixar' }]);
    if (!acao) return; // o que já foi baixado fica guardado no aparelho (a próxima vez é mais rápida)
    DB.kvSet('layoutRelatorio', escolha.layout);
    DB.kvSet('tamanhoFotosRelatorio', escolha.tamanho);
    const jp = janelaProgresso('Preparando as fotos…', 'Relatório fotográfico');
    jp.set(null, 0);
    const t0 = Date.now();
    try {
      // 1) fotos: do aparelho ou do Drive (as que faltavam já estavam sendo baixadas) e, ao mesmo tempo,
      //    ajustadas ao tamanho do relatório — a redução de uma acontece enquanto as outras ainda chegam
      const lado = LADO_RELATORIO[+escolha.layout] || 1280;
      const reduzir = escolha.tamanho === 'reduzidas' ? (b) => Foto.reduzir(b, lado, 0.85) : null;
      const { blobs, faltando } = await obterFotos(incl, (k, n, bx) => jp.set((reduzir ? 'Preparando as fotos' : 'Carregando as fotos') + ': ' + k + ' de ' + n + (bx ? ' · ' + bx + ' baixada(s) do Drive' : '') + '…', k / n * 0.8), 8, reduzir);
      if (preBaixa) await preBaixa;
      if (faltando.length && !(await confirmar(faltando.length + ' foto(s) não estão neste aparelho e não foi possível baixá-las do Drive (sem internet ou ainda não enviadas pelo celular que as tirou). Gerar o relatório sem elas?', 'Gerar sem elas'))) { jp.fechar(); return; }
      const usar = incl.filter((f) => blobs.has(f.id));
      const itens = usar.map((f) => ({ img: blobs.get(f.id), legenda: f.irregular ? 'IRREGULARIDADE: ' + (f.descricao || '') : (f.descricao || ''), irregular: !!f.irregular, descricao: f.descricao || '',
        meta: dataHoraBR(f.dataHora) + (f.lat != null ? ' · ' + Foto.textoCoord(f.lat, f.lng) : '') }));
      // 3) monta o Word
      jp.set('Montando o documento (' + itens.length + ' fotos)…', 0.8);
      await pausaTela();
      const dados = DocGen.montarDadosRelatorio(r, v, itens, { layout: +escolha.layout });
      jp.set(null, 0.85);
      const blob = await DocGen.gerar(await modeloDocx('relatorio'), dados, { type: 'blob', aoProgresso: progGravar(jp, 0.85, 1) });
      const nome = nomeArquivo('RELATÓRIO FOTOGRÁFICO - ' + r.apelido + ' - VISITA ' + v.numero + ' - ' + X.dataBR(v.data).replace(/\//g, '-')) + '.docx';
      jp.fechar();
      if (acao === 'comp') await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      Sync.log('relatorio', itens.length + ' fotos, ' + (blob.size / 1048576).toFixed(1) + ' MB, ' + Math.round((Date.now() - t0) / 1000) + ' s');
      toast('Relatório gerado: ' + nome + ' (' + (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB)');
    } catch (e) {
      jp.fechar();
      console.error(e);
      toast(e.message, true);
    }
  }

  /* ================================================================== */
  /* Historico de irregularidades (pendente / sanada)                    */
  /* ================================================================== */
  const situacao = (f) => (f.situacao === 'sanada' ? 'sanada' : 'pendente');

  /* ================================================================== */
  /* Foto do projeto de uma irregularidade (referência: como deveria ser) */
  /* ================================================================== */
  /* Fica na própria irregularidade: irr.projeto = { fotoId, legenda, em, por }. A imagem é uma foto
     "auxiliar" (projetoDe = id da irregularidade): não aparece nas visitas nem no relatório fotográfico.
     Na notificação, vai logo abaixo da foto da irregularidade (Imagem N-A). */
  const projetoDe = (irr) => (irr && irr.projeto && irr.projeto.fotoId ? irr.projeto : null);
  function escolherImagem() {
    return new Promise((res) => {
      const inp = h('input', { type: 'file', accept: 'image/*', class: 'oculto' });
      inp.addEventListener('change', () => { res(inp.files[0] || null); inp.remove(); });
      inp.addEventListener('cancel', () => { res(null); inp.remove(); });
      document.body.appendChild(inp); inp.click();
    });
  }
  // recorte: retângulo arrastável (cantos e o meio) sobre a imagem; devolve o recorte em pixels da imagem
  async function recortarImagem(bm, legendaIni) {
    const W = bm.width, H = bm.height;
    const cv = h('canvas', { class: 'rec-img' }); cv.width = Math.min(W, 1400); cv.height = Math.round(H * cv.width / W);
    cv.getContext('2d').drawImage(bm, 0, 0, cv.width, cv.height);
    const caixa = h('div', { class: 'rec-caixa' });
    const alcas = ['nw', 'ne', 'sw', 'se'].map((k) => h('span', { class: 'rec-alca ' + k, 'data-k': k }));
    alcas.forEach((a) => caixa.appendChild(a));
    const area = h('div', { class: 'rec-area' }, cv, caixa);
    let r = { x: 0, y: 0, w: 1, h: 1 }; // frações da imagem
    const pintar = () => Object.assign(caixa.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
    pintar();
    let arr = null;
    area.addEventListener('pointerdown', (e) => {
      const bx = area.getBoundingClientRect();
      const cheio = r.w > 0.98 && r.h > 0.98; // imagem inteira marcada: arrastar desenha a área nova
      const k = e.target.dataset && e.target.dataset.k ? e.target.dataset.k : (e.target === caixa && !cheio ? 'mover' : 'novo');
      arr = { k, x0: (e.clientX - bx.left) / bx.width, y0: (e.clientY - bx.top) / bx.height, r0: Object.assign({}, r), bx };
      area.setPointerCapture(e.pointerId); e.preventDefault();
    });
    area.addEventListener('pointermove', (e) => {
      if (!arr) return;
      const x = Math.max(0, Math.min(1, (e.clientX - arr.bx.left) / arr.bx.width)), y = Math.max(0, Math.min(1, (e.clientY - arr.bx.top) / arr.bx.height));
      const r0 = arr.r0, MIN = 0.05;
      let x1 = r0.x, y1 = r0.y, x2 = r0.x + r0.w, y2 = r0.y + r0.h;
      if (arr.k === 'mover') { const dx = x - arr.x0, dy = y - arr.y0; x1 = Math.max(0, Math.min(1 - r0.w, r0.x + dx)); y1 = Math.max(0, Math.min(1 - r0.h, r0.y + dy)); x2 = x1 + r0.w; y2 = y1 + r0.h; }
      else if (arr.k === 'novo') { x1 = Math.min(arr.x0, x); x2 = Math.max(arr.x0, x); y1 = Math.min(arr.y0, y); y2 = Math.max(arr.y0, y); }
      else { if (arr.k.includes('w')) x1 = Math.min(x, x2 - MIN); if (arr.k.includes('e')) x2 = Math.max(x, x1 + MIN); if (arr.k.includes('n')) y1 = Math.min(y, y2 - MIN); if (arr.k.includes('s')) y2 = Math.max(y, y1 + MIN); }
      if (x2 - x1 < MIN || y2 - y1 < MIN) return;
      r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; pintar();
    });
    const soltar = () => { arr = null; };
    area.addEventListener('pointerup', soltar); area.addEventListener('pointercancel', soltar);
    const ed = { legenda: legendaIni || '' };
    const corpo = h('div', { class: 'rec' },
      h('p', { class: 'sub', style: { marginTop: 0 } }, 'Arraste o dedo sobre o trecho do projeto que interessa para recortá-lo (ou deixe a imagem inteira). Depois, ajuste pelos cantos ou arraste a área.'),
      area,
      h('div', { class: 'acoes', style: { margin: '8px 0' } }, h('button', { class: 'btn peq', onclick: () => { r = { x: 0, y: 0, w: 1, h: 1 }; pintar(); } }, 'Imagem inteira')),
      campo('Legenda na notificação', inputTxt(ed, 'legenda', { placeholder: 'Ex.: Projeto elétrico, prancha 05 — detalhe do aterramento do SPDA' }), 'Sai como “Imagem N-A – Projeto: …”, logo abaixo da foto da irregularidade.'));
    const ok = await modal('📐 Foto do projeto', corpo, [{ txt: 'Cancelar', valor: false }, { txt: 'Salvar', cls: 'pri', valor: true }]);
    if (!ok) return null;
    return { x: Math.round(r.x * W), y: Math.round(r.y * H), w: Math.max(1, Math.round(r.w * W)), h: Math.max(1, Math.round(r.h * H)), legenda: (ed.legenda || '').trim() };
  }
  // escolhe a imagem, recorta, grava como foto auxiliar e liga à irregularidade (substitui a anterior)
  async function editarProjeto(irr, opts) {
    opts = opts || {};
    const arq = opts.arquivo || await escolherImagem();
    if (!arq) return false;
    let bm;
    try { bm = await createImageBitmap(arq, { imageOrientation: 'from-image' }); } catch (e) { toast('Não foi possível abrir a imagem.', true); return false; }
    const atualP = projetoDe(irr);
    const rec = await recortarImagem(bm, atualP ? atualP.legenda : '');
    if (!rec) { if (bm.close) bm.close(); return false; }
    // recorte em resolução cheia (até 16 MP) e pouca compressão: o projeto precisa ficar legível
    const esc = Math.min(1, Math.sqrt(16000000 / (rec.w * rec.h)));
    const cv = document.createElement('canvas'); cv.width = Math.floor(rec.w * esc); cv.height = Math.floor(rec.h * esc);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingQuality = 'high'; g.drawImage(bm, rec.x, rec.y, rec.w, rec.h, 0, 0, cv.width, cv.height);
    if (bm.close) bm.close();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.93));
    const tw = 240, mc = document.createElement('canvas'); mc.width = tw; mc.height = Math.round(cv.height * tw / cv.width); mc.getContext('2d').drawImage(cv, 0, 0, mc.width, mc.height);
    const foto = { id: DB.uuid(), registroId: irr.registroId, visitaId: null, tipo: irr.tipo, projetoDe: irr.id, origem: 'projeto', dataHora: new Date().toISOString(),
      descricao: rec.legenda, largura: cv.width, altura: cv.height, miniatura: mc.toDataURL('image/jpeg', 0.6), carimbada: false, fora_relatorio: true };
    await DB.blobSet(foto.id, blob);
    await DB.salvar('fotos', foto, email());
    await atualizarCampos('fotos', irr.id, (o) => { o.projeto = { fotoId: foto.id, legenda: rec.legenda, em: foto.dataHora, por: email() }; });
    if (atualP && atualP.fotoId !== foto.id && !(await projetoEmUso(atualP.fotoId))) await atualizarCampos('fotos', atualP.fotoId, (o) => { o.excluido = true; });
    App.agendarSync && App.agendarSync();
    toast(atualP ? 'Foto do projeto substituída' : 'Foto do projeto incluída');
    return true;
  }
  async function editarLegendaProjeto(irr) {
    const p = projetoDe(irr); if (!p) return false;
    const ed = { legenda: p.legenda || '' };
    const ok = await modal('Legenda do projeto', campo('Legenda na notificação', inputTxt(ed, 'legenda')), [{ txt: 'Cancelar', valor: false }, { txt: 'Salvar', cls: 'pri', valor: true }]);
    if (!ok) return false;
    await atualizarCampos('fotos', irr.id, (o) => { if (o.projeto) o.projeto = Object.assign({}, o.projeto, { legenda: (ed.legenda || '').trim() }); });
    await atualizarCampos('fotos', p.fotoId, (o) => { o.descricao = (ed.legenda || '').trim(); });
    return true;
  }
  async function removerProjeto(irr) {
    const p = projetoDe(irr); if (!p) return false;
    if (!(await confirmar('Remover a foto do projeto desta irregularidade? Notificações já emitidas não mudam.', 'Remover', true))) return false;
    await atualizarCampos('fotos', irr.id, (o) => { delete o.projeto; });
    if (!(await projetoEmUso(p.fotoId))) await atualizarCampos('fotos', p.fotoId, (o) => { o.excluido = true; });
    toast('Foto do projeto removida');
    return true;
  }
  // mostra a foto do projeto (sem abrir o visualizador de fotos, que permitiria editá-la como foto comum)
  async function verProjeto(irr, aoMudar) {
    const p = projetoDe(irr); if (!p) return;
    const fp = await DB.get('fotos', p.fotoId);
    const img = h('img', { class: 'grande projeto-img', alt: 'Projeto', title: 'Abrir em tamanho real' });
    let url = '';
    if (fp) urlFoto(fp, true).then((u) => { url = u; img.src = u; });
    img.addEventListener('click', () => { if (url) window.open(url, '_blank'); });
    const podeEd = pode.coletar();
    const acao = await modal('📐 Foto do projeto', h('div', {}, h('p', { class: 'sub', style: { marginTop: 0 } }, irr.descricao || ''), img,
      h('div', { class: 'projeto-leg' }, p.legenda ? 'Projeto: ' + p.legenda : 'Projeto (sem legenda)'),
      h('div', { class: 'sub' }, 'Toque na imagem para ver em tamanho real.')),
      podeEd ? [{ txt: 'Remover', cls: 'perigo', valor: 'remover' }, { txt: '✏️ Legenda', valor: 'legenda' }, { txt: '🔄 Trocar', valor: 'trocar' }, { txt: 'Fechar', cls: 'pri', valor: null }] : [{ txt: 'Fechar', cls: 'pri', valor: null }]);
    let mudou = false;
    if (acao === 'trocar') mudou = await editarProjeto(irr);
    else if (acao === 'legenda') mudou = await editarLegendaProjeto(irr);
    else if (acao === 'remover') mudou = await removerProjeto(irr);
    if (mudou && aoMudar) aoMudar();
  }
  // bloco no painel do visualizador de fotos (foto que é irregularidade)
  function blocoProjetoVisor(irr, antes, depois) {
    const p = projetoDe(irr), podeEd = pode.coletar();
    if (!p && !podeEd) return null;
    const mini = h('img', { alt: 'Projeto' });
    if (p) DB.get('fotos', p.fotoId).then((fp) => (fp ? urlFoto(fp) : '')).then((u) => { if (u) mini.src = u; });
    const editar = async () => { if (!(await antes())) return; if (await editarProjeto(irr)) await depois(); };
    return h('div', { class: 'proj-linha' + (p ? '' : ' vazio-proj'), style: { margin: '4px 0 10px' } },
      p ? mini : null,
      p ? h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'proj-tit' }, '📐 Projeto' + (p.legenda ? ': ' + p.legenda : '')),
        h('div', { class: 'acoes', style: { marginTop: '4px' } },
          h('button', { class: 'btn peq', onclick: async () => { if (!(await antes())) return; await verProjeto(irr, depois); } }, 'Ver / editar')))
        : h('button', { class: 'btn peq', onclick: editar }, '📐 Incluir foto do projeto'));
  }
  // cartão usado na tela da irregularidade
  function cartaoProjeto(irr, aoMudar) {
    const p = projetoDe(irr), podeEd = pode.coletar();
    const box = h('div', { class: 'card projeto-card' }, h('h2', {}, '📐 Foto do projeto'));
    if (!p) {
      ap(box, h('p', { class: 'sub', style: { marginTop: 0 } }, 'Opcional. Um trecho do projeto que mostra como deveria ser. Na notificação, vai logo abaixo da foto da irregularidade. Pode ser incluída a qualquer momento.'),
        podeEd ? h('button', { class: 'btn', onclick: async () => { if (await editarProjeto(irr)) aoMudar(); } }, '📐 Incluir foto do projeto') : h('div', { class: 'sub' }, 'Nenhuma foto do projeto.'));
      return box;
    }
    const img = h('img', { class: 'grande projeto-img', alt: 'Projeto' });
    DB.get('fotos', p.fotoId).then((fp) => (fp ? urlFoto(fp, true) : '')).then((u) => { if (u) img.src = u; });
    img.addEventListener('click', () => verProjeto(irr, aoMudar));
    ap(box, img, h('div', { class: 'projeto-leg' }, p.legenda ? 'Projeto: ' + p.legenda : 'Projeto (sem legenda)'),
      h('div', { class: 'sub' }, 'Incluída em ' + dataHoraBR(p.em) + ' · por ' + (nomeDe(p.por) || '—')),
      podeEd ? h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', onclick: async () => { if (await editarLegendaProjeto(irr)) aoMudar(); } }, '✏️ Legenda'),
        h('button', { class: 'btn peq', onclick: async () => { if (await editarProjeto(irr)) aoMudar(); } }, '🔄 Trocar imagem'),
        h('button', { class: 'btn peq perigo', onclick: async () => { if (await removerProjeto(irr)) aoMudar(); } }, 'Remover')) : null);
    return box;
  }

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

  /* Passagem entre irregularidades: a tela da irregularidade lembra a lista de onde foi aberta
     (pendências da visita, filtro da obra…) para ir à anterior/próxima sem voltar. */
  function abrirIrregularidade(f, lista, rotulo, visitaId) {
    try { sessionStorage.setItem('nav_irr', JSON.stringify({ ids: lista.map((x) => x.id), rotulo, visitaId: visitaId || null })); } catch (e) { /* */ }
    location.hash = '#/irregularidade/' + f.id + (visitaId ? '/' + visitaId : '');
  }
  function navIrr() { try { return JSON.parse(sessionStorage.getItem('nav_irr') || 'null'); } catch (e) { return null; } }

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
      lista.length ? lista.map((f) => itemIrregularidade(f, () => abrirIrregularidades(f, lista, { pendente: 'Pendentes da obra', sanada: 'Sanadas da obra', todas: 'Irregularidades da obra' }[filtro], null, () => telaRegistro(r.id))))
        : h('div', { class: 'vazio' }, filtro === 'pendente' ? 'Nenhuma irregularidade pendente. 👍' : 'Nada por aqui.'));
  }

  async function telaIrregularidade(id, visitaId) {
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    const f = await DB.get('fotos', id);
    if (!f || f.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Irregularidade não encontrada.')); return; }
    const r = await DB.get('registros', f.registroId);
    if (!r) { rcT(tk, h('div', { class: 'vazio' }, 'Obra não encontrada.')); return; }
    titulo('Irregularidade · ' + r.apelido, true);
    marcarNav(r.tipo === 'convenio' ? 'convenios' : 'contratos');
    const st = situacao(f);
    const visOrig = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
    const img = h('img', { class: 'grande' });
    urlFoto(f, true).then((u) => { img.src = u; });

    const cab = h('div', { class: 'card' },
      h('span', { class: 'badge ' + st, style: { float: 'right' } }, st === 'sanada' ? '✓ Sanada' : 'Pendente'),
      h('div', { class: 'sub' }, 'Constatada em ' + dataHoraBR(f.dataHora) + (visOrig ? ' · Visita nº ' + visOrig.numero : '') + ' · por ' + (nomeDe(f.criadoPor) || '—')),
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
        h('div', {}, h('b', {}, vf.status === 'sanada' ? '✓ Sanada' : '✗ Não sanada'), ' — ', dataHoraBR(vf.data), ' · ', nomeDe(vf.por) || '—'),
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
    // anterior / próxima (na lista de onde veio; senão, todas as irregularidades da obra)
    let nav = navIrr();
    if (!nav || !nav.ids.includes(id)) nav = { ids: (await irregularidadesDe(r.id)).map((x) => x.id), rotulo: 'irregularidades da obra', visitaId: visitaId || null };
    const pos = nav.ids.indexOf(id);
    const irPara = (k) => { if (k < 0 || k >= nav.ids.length) return; location.replace('#/irregularidade/' + nav.ids[k] + (nav.visitaId ? '/' + nav.visitaId : '')); };
    const barraNav = nav.ids.length > 1 && pos >= 0 ? h('div', { class: 'nav-irr' },
      h('button', { class: 'btn', disabled: pos === 0, title: 'Anterior (←)', onclick: () => irPara(pos - 1) }, '‹ Anterior'),
      h('div', { class: 'nav-irr-meio' }, h('b', {}, (pos + 1) + ' de ' + nav.ids.length), h('span', { class: 'sub' }, nav.rotulo)),
      h('button', { class: 'btn', disabled: pos === nav.ids.length - 1, title: 'Próxima (→)', onclick: () => irPara(pos + 1) }, 'Próxima ›')) : null;
    // setas do teclado (computador) e deslizar na foto (celular)
    const teclas = (e) => {
      if (!document.body.contains(cab)) { document.removeEventListener('keydown', teclas); return; }
      if (document.querySelector('.modal-fundo, .visor-fundo') || /^(TEXTAREA|INPUT|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'ArrowRight') irPara(pos + 1); else if (e.key === 'ArrowLeft') irPara(pos - 1);
    };
    if (barraNav) {
      document.addEventListener('keydown', teclas);
      let x0 = null, y0 = 0;
      img.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
      img.addEventListener('touchend', (e) => { if (x0 == null) return; const t = e.changedTouches[0]; const dx = t.clientX - x0, dy = t.clientY - y0; x0 = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) irPara(pos + (dx < 0 ? 1 : -1)); });
    }
    rcT(tk, barraNav, cab, cartaoProjeto(f, () => telaIrregularidade(id, visitaId)), acoes, hist);
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

  async function verificarIrregularidade(f, r, status, visitaId, opts) {
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
    if (!ok) return false;
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
    if (opts && opts.semNavegar) return true; // quem chamou (o visualizador) decide para onde ir
    if (visitaId) {
      const nav = navIrr();
      const k = nav && nav.visitaId === visitaId ? nav.ids.indexOf(f.id) : -1;
      if (k >= 0 && k < nav.ids.length - 1) { toast((status === 'sanada' ? 'Sanada registrada' : 'Não sanada registrada') + ' — próxima pendência (' + (k + 2) + ' de ' + nav.ids.length + ')'); location.replace('#/irregularidade/' + nav.ids[k + 1] + '/' + visitaId); }
      else { toast(status === 'sanada' ? 'Irregularidade registrada como sanada' : 'Verificação registrada: não sanada'); history.back(); }
    } else { toast(status === 'sanada' ? 'Irregularidade registrada como sanada' : 'Verificação registrada: não sanada'); telaIrregularidade(f.id, visitaId); }
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
    const jp = janelaProgresso('Separando as fotos…', 'Relatório de irregularidades');
    jp.set(null, 0);
    try {
      const escolhidas = todas.filter((x) => sel.has(x.id));
      // 1) junta todas as fotos (constatação + verificações) e busca de uma vez, várias ao mesmo tempo
      const fotoDe = new Map();
      for (const f of escolhidas) {
        fotoDe.set(f.id, f);
        for (const vf of f.verificacoes || []) if (vf.fotoId && !fotoDe.has(vf.fotoId)) { const fv = await DB.get('fotos', vf.fotoId); if (fv) fotoDe.set(fv.id, fv); }
      }
      const buscar = [...fotoDe.values()].filter((x) => !x.excluido);
      const { blobs, faltando } = await obterFotos(buscar, (k, n, bx) => jp.set('Carregando as fotos: ' + k + ' de ' + n + (bx ? ' · ' + bx + ' baixada(s) do Drive' : '') + '…', k / n * 0.8));
      const img = (id) => (id && blobs.get(id)) || null;
      if (faltando.length && !(await confirmar(faltando.length + ' foto(s) ainda não estão neste aparelho (sem internet para baixá-las). Gerar o relatório sem elas?', 'Gerar sem elas'))) { jp.fechar(); return; }
      // 2) monta os itens
      jp.set('Montando o documento (' + escolhidas.length + ' irregularidade(s))…', 0.8);
      await pausaTela();
      const visitas = new Map();
      const visitaTxt = async (vid) => { if (!vid) return ''; if (!visitas.has(vid)) visitas.set(vid, await DB.get('visitas', vid)); const v = visitas.get(vid); return v ? 'Visita nº ' + v.numero : ''; };
      const itens = [];
      for (const f of escolhidas) {
        const historico = [];
        for (const vf of f.verificacoes || []) {
          historico.push({
            data: vf.data ? dataHoraBR(vf.data) : '',
            status: vf.status === 'sanada' ? 'SANADA' : 'NÃO SANADA',
            descricao: vf.descricao || '',
            visita: await visitaTxt(vf.visitaId),
            por: nomeDe(vf.por) || '',
            img: img(vf.fotoId),
          });
        }
        itens.push({
          descricao: f.descricao || '',
          sanada: situacao(f) === 'sanada',
          sanada_em: f.sanadaEm ? dataLocalBR(f.sanadaEm) : '',
          constatada_data: dataHoraBR(f.dataHora),
          constatada_visita: await visitaTxt(f.visitaId),
          constatada_por: nomeDe(f.criadoPor) || '',
          img: f.excluido ? null : img(f.id),
          historico,
        });
      }
      const pessoas = await pessoasMap();
      const fiscais = snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao(r.tipo), pessoas, true);
      const dados = DocGen.montarDadosIrregularidades(r, itens, fiscais, X.hojeISO());
      // 3) grava o Word
      jp.set(null, 0.85);
      const blob = await DocGen.gerar(await modeloDocx('irregularidades'), dados, { type: 'blob', aoProgresso: progGravar(jp, 0.85, 1) });
      const nome = nomeArquivo('RELATÓRIO DE IRREGULARIDADES - ' + r.apelido + ' - ' + X.dataBR(X.hojeISO()).replace(/\//g, '-')) + '.docx';
      jp.fechar();
      if (acao === 'comp') await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      toast('Relatório gerado: ' + nome);
    } catch (e) {
      jp.fechar();
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
    const jp = janelaProgresso('Separando as fotos…', 'Relatório de irregularidades sanadas');
    jp.set(null, 0);
    try {
      const escolhidas = sanadas.filter((x) => sel.has(x.id));
      const ultimaSanada = (f) => (f.verificacoes || []).filter((x) => x.status === 'sanada').pop() || {};
      // 1) fotos de antes e depois, buscadas de uma vez
      const buscar = [], fotoV = new Map();
      for (const f of escolhidas) {
        buscar.push(f);
        const vf = ultimaSanada(f);
        const fv = vf.fotoId ? await DB.get('fotos', vf.fotoId) : null;
        if (fv) { fotoV.set(f.id, fv); buscar.push(fv); }
      }
      const { blobs, faltando } = await obterFotos(buscar, (k, n, bx) => jp.set('Carregando as fotos: ' + k + ' de ' + n + (bx ? ' · ' + bx + ' baixada(s) do Drive' : '') + '…', k / n * 0.8));
      if (faltando.length) throw new Error('Há fotos que ainda não estão neste aparelho. Conecte-se à internet e tente de novo.');
      // 2) monta os itens
      jp.set('Montando o documento (' + escolhidas.length + ' irregularidade(s))…', 0.8);
      await pausaTela();
      const itens = [];
      for (const f of escolhidas) {
        const vf = ultimaSanada(f), fv = fotoV.get(f.id) || null;
        const visA = f.visitaId ? await DB.get('visitas', f.visitaId) : null;
        const visD = vf.visitaId ? await DB.get('visitas', vf.visitaId) : null;
        itens.push({
          antes_img: blobs.get(f.id), antes_desc: f.descricao || '', antes_data: dataHoraBR(f.dataHora).slice(0, 10), antes_visita: visA ? 'Visita nº ' + visA.numero : '',
          depois_img: fv ? blobs.get(fv.id) : null, depois_desc: vf.descricao || '', depois_data: vf.data ? dataLocalBR(vf.data) : '—',
          depois_visita: visD ? 'Visita nº ' + visD.numero : (fv ? '' : 'sem foto'), verificado_por: nomeDe(vf.por) || '',
        });
      }
      const pessoas = await pessoasMap();
      const fiscais = snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao(r.tipo), pessoas, true);
      const dados = DocGen.montarDadosSanadas(r, itens, fiscais, X.hojeISO());
      // 3) grava o Word
      jp.set(null, 0.85);
      const blob = await DocGen.gerar(await modeloDocx('sanadas'), dados, { type: 'blob', aoProgresso: progGravar(jp, 0.85, 1) });
      const nome = nomeArquivo('IRREGULARIDADES SANADAS - ' + r.apelido + ' - ' + X.dataBR(X.hojeISO()).replace(/\//g, '-')) + '.docx';
      jp.fechar();
      if (acao === 'comp') await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      toast('Relatório gerado: ' + nome);
    } catch (e) {
      jp.fechar();
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

  // e-mail de quem registrou → nome cadastrado em Usuários do grupo (se não houver, fica o e-mail)
  const nomeDe = (e) => (Sync.nomeDe ? Sync.nomeDe(e) : e);
  const usaSequencial = (fmt) => /\{seq\d?\}/.test(fmt || '');
  // lê um número digitado no formato configurado (ex.: "016/2026/CIPISNP/DRE-SINOP" → seq 16, ano 2026)
  function lerNumero(fmt, txt) {
    if (!fmt || !txt) return null;
    const nomes = [];
    const re = String(fmt).replace(/\{(seq|ordinal)\d?\}|\{ano\}|[.*+?^$()|[\]\\{}\/]/g, (m, k) => {
      if (m === '{ano}') { nomes.push('ano'); return '(\\d{4})'; }
      if (k) { nomes.push(k); return '(\\d{1,5})'; }
      return '\\' + m;
    });
    const m = new RegExp('^\\s*' + re + '\\s*$', 'i').exec(String(txt));
    if (!m) return null;
    const out = {}; nomes.forEach((k, i) => { out[k] = +m[i + 1]; });
    return out;
  }
  // texto do número enquanto rascunho (vai no Word gerado antes de emitir)
  function numeroRascunho(n, r) {
    const fmt = (CONFIG.formato_numero || {})[(r || {}).tipo || n.tipo] || '';
    return n.numero || (usaSequencial(fmt) ? fmt.replace(/\{seq(\d?)\}/g, (m, p) => '_'.repeat(+p || 3)).replace(/\{ordinal(\d?)\}/g, (m, p) => String(n.ordinal || '').padStart(+p || 0, '0')).replace(/\{ano\}/g, String(n.ano || X.hojeISO().slice(0, 4))) : '');
  }
  // chave para achar números repetidos entre notificações emitidas
  const chaveNumero = (n) => n.numero ? [n.tipo, n.tipo === 'contrato' ? n.registroId : '', String(n.numero).trim().toUpperCase()].join('|') : null;
  async function numerosRepetidos() {
    const cont = new Map(), rep = new Set();
    const emit = await DB.listar('notificacoes', (o) => o.status === 'emitida' && o.numero);
    for (const o of emit) { const k = chaveNumero(o); cont.set(k, (cont.get(k) || []).concat(o)); }
    for (const l of cont.values()) if (l.length > 1) for (const o of l) rep.add(o.id);
    return { rep, cont };
  }

  /* Define o número na hora de emitir. Com o servidor ligado, quem distribui é o servidor (sob trava):
     dois aparelhos nunca recebem o mesmo número. Devolve { numero, seq, ano, ordinal, avisos } ou null. */
  async function numerarNaEmissao(n, r) {
    const fmt = (CONFIG.formato_numero || {})[r.tipo] || '';
    const usaSeq = usaSequencial(fmt);
    const anoHoje = +X.hojeISO().slice(0, 4);
    const auto = !n.numero || n.numero === formatarNumero(fmt, { seq: n.seq, ano: n.ano, ordinal: n.ordinal });
    const lido = auto ? null : lerNumero(fmt, n.numero);
    const proprio = !auto && !lido; // número livre, fora do formato: fica como foi digitado
    // já numerada antes (reaberta para correção, ou rascunho de versão anterior): mantém o ano e pede o mesmo número
    const ano = lido && lido.ano ? lido.ano : (auto && n.seq && n.ano ? +n.ano : anoHoje);
    const pedSeq = usaSeq ? (lido && lido.seq ? lido.seq : (auto && n.seq ? +n.seq : 0)) : 0;
    const pedOrd = lido && lido.ordinal ? lido.ordinal : +n.ordinal || 0;
    const emit = await DB.listar('notificacoes', (o) => o.id !== n.id && o.status === 'emitida');
    const base = (CONFIG.seq_base || {})[ano];
    let minSeq = Math.max(+base || 0, ...emit.filter((o) => +o.ano === ano && o.seq).map((o) => +o.seq || 0));
    const minOrd = Math.max(+r.ultima_notif_anterior || 0, ...emit.filter((o) => o.registroId === r.id).map((o) => +o.ordinal || 0));
    const semBase = usaSeq && !pedSeq && !minSeq && (base === undefined || base === null);
    const perguntarBase = async () => {
      const b = await perguntarNumero('Numeração do setor ' + ano,
        'Esta é a primeira notificação numerada pelo app em ' + ano + '. Qual foi o último número de notificação emitido pelo setor em ' + ano + '? (Ex.: informe 12 se a última foi 012/' + ano + '. Informe 0 se nenhuma.)', 0);
      if (b === null) return null;
      if (pode.admin()) await salvarConfig((o) => { o.seq_base = Object.assign({}, o.seq_base, { [ano]: b }); });
      return b;
    };
    const fim = (seq, ordinal, avisos) => ({ seq: usaSeq && !proprio ? seq : (n.seq || null), ano, ordinal, avisos: avisos || [],
      numero: proprio ? n.numero : formatarNumero(fmt, { seq, ano, ordinal }) });

    // sem servidor (uso em um aparelho só): numera no próprio aparelho, como antes
    const local = async (motivo) => {
      if (motivo) Sync.log('aviso', motivo);
      let seq = pedSeq;
      if (usaSeq && !proprio && !seq) {
        const todas = await DB.listar('notificacoes', (o) => o.id !== n.id && +o.ano === ano && o.seq);
        if (!todas.length && semBase) { const b = await perguntarBase(); if (b === null) return null; minSeq = b; }
        seq = Math.max(minSeq, ...todas.map((o) => +o.seq || 0)) + 1;
      }
      return fim(seq, pedOrd || minOrd + 1);
    };
    if (!Sync.habilitado()) return local();
    if (!navigator.onLine) { await avisoSemRedeNumero(); return null; }

    const itens = () => [{ chave: 'ord:' + r.id, notificacao: n.id, desejado: pedOrd, minimo: minOrd }]
      .concat(usaSeq && !proprio ? [{ chave: 'seq:' + ano, notificacao: n.id, desejado: pedSeq, minimo: minSeq, semBase: semBase && !minSeq }] : []);
    // etapa sem medida (depende do servidor): barra "andando"; remove()/appendChild mantêm o uso antigo
    let jpNum = null;
    const espera = {
      remove() { if (jpNum) { jpNum.fechar(); jpNum = null; } },
      abrir() { if (!jpNum) { jpNum = janelaProgresso('Reservando o número da notificação no servidor…', 'Emitindo a notificação'); jpNum.set(null, null); } },
    };
    let j;
    try {
      espera.abrir();
      j = await Sync.chamar('numerar', { itens: itens() });
      if ((j.itens || []).some((x) => x.precisaBase)) {
        espera.remove();
        const b = await perguntarBase(); if (b === null) return null;
        minSeq = b;
        espera.abrir();
        j = await Sync.chamar('numerar', { itens: itens().map((x) => Object.assign(x, { semBase: false })) });
      }
    } catch (e) {
      // servidor ainda na versão anterior: numera no aparelho (e o aviso de número repetido continua valendo)
      if (/A[çc][ãa]o desconhecida/i.test(e.message || '')) return local('Servidor sem numeração central (atualize o Code.gs): número calculado no aparelho.');
      if (e.rede || !navigator.onLine) { espera.remove(); await avisoSemRedeNumero(); return null; }
      toast(e.message || String(e), true); return null;
    } finally { espera.remove(); }
    const res = {}; for (const x of j.itens || []) res[x.chave.slice(0, 3)] = x;
    if (!res.ord || (usaSeq && !proprio && !res.seq)) { toast('Resposta inesperada do servidor ao numerar. Tente de novo.', true); return null; }
    const ordinal = res.ord.valor, seq = res.seq ? res.seq.valor : null;
    const avisos = [];
    if (res.ord.ocupado) avisos.push('a ' + res.ord.pedido + 'ª notificação desta obra já tinha sido emitida por outro aparelho — esta passou a ser a ' + ordinal + 'ª');
    if (res.seq && res.seq.ocupado) {
      const antes = formatarNumero(fmt, { seq: res.seq.pedido, ano, ordinal }), depois = formatarNumero(fmt, { seq, ano, ordinal });
      if (lido) { // número digitado à mão já usado: pergunta
        if (!(await confirmar('O número ' + antes + ' já foi usado em outra notificação. Usar o próximo número livre, ' + depois + '?', 'Usar ' + depois))) return null;
      } else avisos.push('o número ' + antes + ' do rascunho já tinha sido usado — esta ficou com ' + depois);
    }
    return fim(seq, ordinal, avisos);
  }
  function avisoSemRedeNumero() {
    return modal('Sem conexão', h('div', {},
      h('p', {}, 'Para emitir, o número da notificação é reservado no servidor — assim duas notificações nunca saem com o mesmo número.'),
      h('p', {}, 'O rascunho continua salvo no aparelho. Emita quando estiver com internet.'),
      h('p', { class: 'dica' }, 'Dica: se for entregar a notificação em campo, emita antes de sair (o documento emitido fica no aparelho e abre sem internet).')),
      [{ txt: 'Entendi', valor: true, cls: 'pri' }]);
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
    // número: com sequencial do setor, só é definido ao emitir (o servidor distribui, sem repetir);
    // só com a ordem (contratos), já aparece no rascunho e é confirmado ao emitir
    const hoje = X.hojeISO();
    const ano = +hoje.slice(0, 4);
    const fmt = (CONFIG.formato_numero || {})[r.tipo] || '';
    const seq = null;
    const pessoas = await pessoasMap();
    const ultima = notifs[0];
    const provPadrao = ((CONFIG.providencias_padrao || {})[r.tipo] || '').replace(/\{nome_texto\}/g, r.n_nome_texto || r.n_nome || '');
    const n = {
      id: DB.uuid(), registroId, tipo: r.tipo, ordinal, seq, ano,
      numero: usaSequencial(fmt) ? '' : formatarNumero(fmt, { seq, ano, ordinal }),
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

  async function gerarDocx(n, r, jp) {
    const prog = jp || { set() {} };
    const reg = n.status === 'emitida' && n.registroSnapshot ? n.registroSnapshot : r;
    const sels = n.fotos || [];
    // foto do projeto de cada irregularidade (emitida: a que ficou registrada na emissão)
    const projs = await Promise.all(sels.map((sel) => (n.status === 'emitida' ? Promise.resolve(sel.projeto || null) : projetoDaSel(sel))));
    const projRegs = await Promise.all(projs.map((p) => (p && !p.semProjeto ? DB.get('fotos', p.fotoId) : null)));
    // fotos: do aparelho ou do Drive, várias ao mesmo tempo (0–70% da barra)
    const regs = await Promise.all(sels.map((sel) => DB.get('fotos', sel.fotoId)));
    const lista = sels.map((sel, i) => regs[i] || { id: sel.fotoId }).concat(projRegs.filter(Boolean));
    prog.set(sels.length ? 'Carregando as fotos…' : 'Montando o documento…', 0);
    const { blobs } = await obterFotos(lista, (k, t, bx) => prog.set('Carregando as fotos: ' + k + ' de ' + t + (bx ? ' · ' + bx + ' baixada(s) do Drive' : '') + '…', k / t * 0.7));
    const fotosDoc = [];
    const faltando = [];
    let num = 0;
    sels.forEach((sel, i) => {
      const f = regs[i], blob = blobs.get(sel.fotoId);
      if (!blob && (!f || f.excluido)) return; // foto excluida: fica fora do documento
      if (!blob) { faltando.push(sel); return; }
      num++;
      fotosDoc.push({ n: num, legenda: sel.legenda || '', imagem: blob });
      const p = projs[i], fp = projRegs[i];
      if (p && fp) {
        const bp = blobs.get(fp.id);
        if (bp) fotosDoc.push({ n: num + '-A', legenda: 'Projeto' + (p.legenda ? ': ' + p.legenda.replace(/[.;]?$/, '.') : '.'), imagem: bp });
        else if (!fp.excluido) faltando.push(p);
      }
    });
    if (faltando.length) throw new Error(faltando.length + ' foto(s) ainda não estão neste aparelho. Conecte-se à internet para baixá-las (ou peça a quem registrou para sincronizar).');
    prog.set('Montando o documento…', 0.7);
    await pausaTela();
    const dados = DocGen.montarDados(reg, Object.assign({}, n, { fotosDoc }));
    prog.set(null, 0.75);
    const blob = await DocGen.gerar(await modeloDocx(reg.tipo), dados, { type: 'blob', larguraFotoCm: 13, aoProgresso: jp ? progGravar(jp, 0.75, 1) : undefined });
    const nome = nomeArquivo(n.ordinal + 'ª NOTIFICAÇÃO - ' + (reg.apelido || ROTULO[reg.tipo])) + '.docx';
    return { blob, nome };
  }

  // rascunho: projeto atual da irregularidade da foto anexada (a menos que tenha sido desmarcado)
  async function projetoDaSel(sel) {
    if (sel.semProjeto) return null;
    let irr = sel.irrId ? await DB.get('fotos', sel.irrId) : null;
    if (!irr) { const f = await DB.get('fotos', sel.fotoId); if (f && f.irregular) irr = f; else if (f && f.verificacaoDe) irr = await DB.get('fotos', f.verificacaoDe); }
    const p = projetoDe(irr);
    return p ? { fotoId: p.fotoId, legenda: p.legenda || '' } : null;
  }
  // na emissão, cada anexo guarda a foto do projeto usada (baixar de novo depois dá o mesmo documento)
  async function fotosComProjeto(fotos) {
    const out = [];
    for (const s of fotos || []) {
      const p = await projetoDaSel(s);
      const c = Object.assign({}, s); delete c.projeto;
      if (p) c.projeto = p;
      out.push(c);
    }
    return out;
  }
  // a imagem do projeto continua guardada enquanto alguma notificação emitida usa
  async function projetoEmUso(fotoId) {
    return (await DB.listar('notificacoes', (o) => o.status === 'emitida' && (o.fotos || []).some((s) => s.projeto && s.projeto.fotoId === fotoId))).length > 0;
  }
  function legendaPadrao(f) {
    if (f.descricao && f.descricao.trim()) return f.descricao.trim().replace(/[.;:]?$/, '.');
    return 'Foto registrada em ' + (dataLocalBR(f.dataHora) || X.dataBR(X.hojeISO())) + '.';
  }

  /* ---------- Tela "Notificações": todas, com prazo de resposta ---------- */
  async function telaNotificacoes() {
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    titulo('Notificações');
    const regs = new Map((await DB.all('registros')).map((r) => [r.id, r]));
    const todas = (await DB.listar('notificacoes')).filter((n) => { const r = regs.get(n.registroId); return r && !r.excluido; })
      .map((n) => ({ n, sit: situacaoNotif(n), r: regs.get(n.registroId) }));
    const repetidos = (await numerosRepetidos()).rep;
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
      || (a.sit.k === 'vencida' || a.sit.k === 'aguardando' ? String(prazoDe(a.n)).localeCompare(String(prazoDe(b.n))) : String(b.n.data || '').localeCompare(String(a.n.data || ''))));
    const filtros = h('div', { class: 'filtros' }, grupos.map(([k, rot, f]) => {
      const c = todas.filter(f).length;
      return h('button', { class: k === g[0] ? 'ativo' : '', onclick: () => { sessionStorage.setItem('filtro_notifs', k); telaNotificacoes(); } }, rot + ' (' + c + ')');
    }));
    const avisoPermissao = ('Notification' in window) && Notification.permission === 'default' && todas.some((x) => x.sit.k === 'aguardando' || x.sit.k === 'vencida')
      ? h('div', { class: 'aviso' }, '🔔 Quer ser avisado no celular quando um prazo terminar? ',
        h('button', { class: 'btn peq', onclick: async () => { try { await Notification.requestPermission(); } catch (e) { /* */ } telaNotificacoes(); } }, 'Ativar avisos'))
      : null;
    rcT(tk, avisoPermissao, filtros,
      lista.length ? h('div', { class: 'lista-linhas' }, ...lista.map(({ n, sit, r }) => linhaLista({
        href: '#/notificacao/' + n.id, cls: 'item', pend: n._pendente,
        de: r.apelido || ROTULO[r.tipo],
        titulo: h('span', {}, (n.ordinal || '?') + 'ª Notificação', h('span', { class: 'so-cel' }, ' · ' + (r.apelido || ROTULO[r.tipo]))),
        resumo: ROTULO[r.tipo] + ' nº ' + (r.numero || '—') + ' · Nº ' + (n.numero || (n.status === 'emitida' ? '—' : 'a definir na emissão')) + (n.status === 'emitida' ? ' · emitida em ' + dataLocalBR(n.emitidaEm || n.data) : ' · rascunho'),
        prazos: [n.enviadaEm && !n.respondidaEm
          ? { rot: 'Prazo de resposta', data: dataCurta(prazoDe(n)), cls: sit.k === 'vencida' ? 'perigo' : sit.restante <= 1 ? 'alerta' : 'info',
            txt: sit.k === 'vencida' ? 'encerrado há ' + -sit.restante + (sit.restante === -1 ? ' dia' : ' dias') : sit.restante === 0 ? 'termina hoje' : sit.restante === 1 ? 'falta 1 dia útil' : 'faltam ' + sit.restante + ' dias úteis' }
          : { rot: n.status === 'emitida' ? 'Emitida em' : 'Criada em', data: dataCurtaLocal(n.emitidaEm || n.data), cls: '' }],
        chips: [repetidos.has(n.id) ? etq('nº repetido', 'perigo') : null, sit.k === 'vencida' || sit.k === 'aguardando' ? null : etq(sit.txt, sit.cls), n.enviadaEm ? etq('enviada ' + X.dataBR(n.enviadaEm), '') : null],
      })))
        : h('div', { class: 'vazio' }, g[0] === 'pendentes' ? 'Nenhuma notificação aguardando resposta. 👍' : 'Nada por aqui.'),
      h('p', { class: 'dica' }, 'O prazo conta em dias úteis a partir do dia seguinte ao envio (sábados, domingos e os feriados cadastrados em Ajustes › Padrões não contam). Para registrar envio ou resposta, abra a notificação.'));
    App._atualizarTela = () => telaNotificacoes();
  }

  /* ================================================================== */
  /* Fila de atendimento (planilha externa, SOMENTE LEITURA)             */
  /* ================================================================== */
  // O app nunca escreve na planilha da fila: o servidor só lê os valores exibidos (ação "fila").
  const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // "0961-2024", "961/2024", "Conv. nº 0961/2024" -> "961/2024"
  function chaveConvenio(s) {
    const t = String(s || '').replace(/(\d)\.(\d)/g, '$1$2');
    // primeiro "número/ano" do texto ("0961/2024 - 1º TA", "961-2024 lote 03")
    const na = /(\d+)\s*[\/-]\s*((?:19|20)\d{2}|\d{2})(?!\d)/.exec(t);
    if (na) return String(parseInt(na[1], 10)) + '/' + (na[2].length === 2 ? '20' + na[2] : na[2]);
    const m = t.match(/\d+/g);
    if (!m) return '';
    if (m.length >= 2) {
      const ano = m[m.length - 1], num = m[m.length - 2];
      if (ano.length === 4 || ano.length === 2) return String(parseInt(num, 10)) + '/' + (ano.length === 2 ? '20' + ano : ano);
    }
    return String(parseInt(m[0], 10));
  }
  function corSituacao(t) {
    const s = semAc(t);
    if (!s) return '';
    if (/indeferid|cancelad|reprovad|vencid|devolvid|arquivad.*sem/.test(s)) return 'perigo';
    if (/aguardando|sem retorno|inconsist|pendent|diligencia|paralisad/.test(s)) return 'alerta';
    if (/juntad|conclu|finaliz|aprovad|deferid|assinad|publicad|atendid/.test(s)) return 'ok';
    if (/elabora|analise|andamento|encaminhad|tramit/.test(s)) return 'info';
    return '';
  }
  let filaMem = null; // última leitura (também guardada no aparelho em kv 'fila_cache')
  let filaLendo = null;
  // LGPD: só ficam as "outras colunas" que o administrador liberou (servidor antigo manda todas → nenhuma fica)
  function limparExtrasFila(d) {
    if (!d || !Array.isArray(d.linhas)) return d;
    const ok = new Set((d.extrasPermitidas || []).map((c) => semAc(c)));
    for (const l of d.linhas) l.extras = (l.extras || []).filter(([k]) => ok.has(semAc(k)));
    return d;
  }
  async function filaDoCache() {
    if (!filaMem) {
      const bruto = await DB.kvGet('fila_cache', null);
      const antes = bruto ? JSON.stringify(bruto.linhas || []) : '';
      filaMem = limparExtrasFila(bruto);
      if (filaMem && JSON.stringify(filaMem.linhas || []) !== antes) await DB.kvSet('fila_cache', filaMem); // apaga do aparelho o que não pode ficar
    }
    return filaMem;
  }
  /** Lê a fila no servidor. Devolve { dados, erro }: se falhar, "dados" é a última leitura salva. */
  function lerFila() {
    if (!filaLendo) filaLendo = (async () => {
      if (!Sync.habilitado()) return { dados: null, erro: 'local' };
      if (!navigator.onLine) return { dados: await filaDoCache(), erro: 'Sem internet' };
      try {
        const j = await Sync.chamar('fila');
        const d = { configurada: !!j.configurada, titulo: j.titulo, aba: j.aba, colunas: j.colunas || [], linhas: j.linhas || [], lidoEm: j.lidoEm || new Date().toISOString(), contaServidor: j.contaServidor,
          outrasColunas: j.outrasColunas || null, extrasPermitidas: j.extrasPermitidas || [] };
        limparExtrasFila(d);
        filaMem = d;
        await DB.kvSet('fila_cache', d);
        return { dados: d, erro: null };
      } catch (e) {
        const antigo = /desconhecida/i.test(e.message || '');
        return { dados: await filaDoCache(), erro: antigo ? 'servidor_antigo' : e.message || String(e), antigo };
      }
    })().finally(() => { filaLendo = null; });
    return filaLendo;
  }
  function linhasDoConvenio(dados, r) {
    const k = chaveConvenio(r.numero);
    if (!k || !dados || !dados.linhas) return [];
    return dados.linhas.filter((l) => chaveConvenio(l.convenio) === k);
  }
  // Processos já atendidos pela Fiscalização (ex.: STATUS "ENCAMINHADO - CCP") ficam no histórico, ocultos por padrão
  const chaveSt = (s) => semAc(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const statusAtendidos = () => String((CONFIG && CONFIG.fila_atendidos != null) ? CONFIG.fila_atendidos : CONFIG_PADRAO.fila_atendidos).split(/\n/).map(chaveSt).filter(Boolean);
  const atendido = (l) => { const k = chaveSt(l.status); return !!k && statusAtendidos().includes(k); };
  const btnHistorico = (aberto, n, onclick) => h('button', { class: 'btn peq btn-hist', onclick }, (aberto ? '▾ Ocultar' : '▸ Ver') + ' histórico de atendimento (' + n + ')');
  function itemFila(l, reg) {
    const conv = l.convenio ? 'Convênio ' + l.convenio : 'Convênio não informado';
    return linhaLista({
      href: reg ? '#/registro/' + reg.id : null, cls: 'item fila-item' + (atendido(l) ? ' atendida' : ''),
      
      de: [l.convenio, l.municipio].filter(Boolean).join(' · ') || conv,
      titulo: h('span', {}, l.solicitacao || 'Solicitação não informada', h('span', { class: 'so-cel' }, ' · ' + [conv, l.municipio].filter(Boolean).join(' · '))),
      resumo: [l.escola, l.protocolo ? 'Protocolo nº ' + l.protocolo : '', 'linha ' + l.linha + ' da planilha', ...(l.extras || []).map(([k, v]) => k + ': ' + v)].filter(Boolean).join(' · '),
      chips: [l.status ? etq(l.status, atendido(l) ? 'ok' : '') : null, l.situacao ? etq(l.situacao, corSituacao(l.situacao)) : null,
        reg ? h('span', { class: 'lin-link' }, 'Abrir “' + (reg.apelido || reg.numero) + '” no app ›') : null],
    });
  }
  const avisoLeitura = (dados, erro) => {
    if (!erro || erro === 'local') return null;
    const quando = dados && dados.lidoEm ? ' Mostrando a leitura de ' + dataHoraBR(dados.lidoEm) + '.' : '';
    if (erro === 'servidor_antigo') return h('div', { class: 'aviso' }, 'O servidor ainda não tem a Fila: o administrador precisa atualizar o Code.gs e publicar uma “Nova versão” da implantação.');
    return h('div', { class: 'aviso' }, (erro === 'Sem internet' ? 'Sem internet.' : 'Não foi possível ler a planilha agora: ' + erro) + quando);
  };

  async function telaFila() {
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    titulo('Fila de atendimento');
    if (!Sync.habilitado()) {
      rcT(tk, h('div', { class: 'vazio' }, 'A Fila de atendimento lê uma planilha do Google pelo servidor do app, então só funciona no modo compartilhado (com login).'));
      return;
    }
    const regs = (await DB.listar('registros')).filter((r) => r.tipo === 'convenio');
    const porChave = new Map();
    for (const r of regs) { const k = chaveConvenio(r.numero); if (k && !porChave.has(k)) porChave.set(k, r); }
    const regDa = (l) => porChave.get(chaveConvenio(l.convenio)) || null;

    let dados = await filaDoCache();
    let erro = null;
    const topo = h('div');
    const resumo = h('div', { class: 'filtros' });
    const busca = h('input', { type: 'search', placeholder: 'Buscar convênio, município, escola, protocolo…' });
    const selSol = h('select', {});
    const selSt = h('select', {});
    const soApp = h('input', { type: 'checkbox' });
    const lista = h('div', { class: 'lista-fila lista-linhas' });
    const historico = h('div');
    const st = (() => { try { return JSON.parse(sessionStorage.getItem('fila_filtros') || '{}'); } catch (e) { return {}; } })();
    let verHist = !!st.hist, primeiraMontagem = true;
    busca.value = st.q || ''; soApp.checked = !!st.soApp;
    let sit = st.sit || '';
    const guardar = () => { try { sessionStorage.setItem('fila_filtros', JSON.stringify({ q: busca.value, sol: selSol.value, st: selSt.value, sit, soApp: soApp.checked, hist: verHist })); } catch (e) { /* */ } };
    const opcoes = (sel, campo, rotuloTodos, valor) => {
      const ls = (dados && dados.linhas) || [];
      const cont = new Map();
      for (const l of ls) { const v = l[campo] || ''; if (v) cont.set(v, (cont.get(v) || 0) + 1); }
      rc(sel, h('option', { value: '' }, rotuloTodos), ...[...cont.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([v, n]) => h('option', { value: v }, v + ' (' + n + ')')));
      sel.value = valor || '';
      if (sel.selectedIndex < 0) sel.value = '';
    };
    const desenhar = () => {
      guardar();
      const ls = (dados && dados.linhas) || [];
      const q = semAc(busca.value).trim();
      const filtradas = ls.filter((l) => (!selSol.value || l.solicitacao === selSol.value) && (!selSt.value || l.status === selSt.value) && (!soApp.checked || regDa(l))
        && (!q || semAc([l.convenio, l.protocolo, l.municipio, l.escola, l.solicitacao, l.status, l.situacao, ...(l.extras || []).map((x) => x[1])].join(' ')).includes(q)));
      const base = filtradas.filter((l) => !atendido(l));
      const hist = filtradas.filter(atendido);
      const cont = new Map();
      for (const l of base) { const v = l.situacao || '(sem situação)'; cont.set(v, (cont.get(v) || 0) + 1); }
      if (sit && !cont.has(sit)) sit = '';
      rc(resumo, h('button', { class: sit ? '' : 'ativo', onclick: () => { sit = ''; desenhar(); } }, 'Todas (' + base.length + ')'),
        ...[...cont.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => h('button', { class: sit === v ? 'ativo' : '', onclick: () => { sit = sit === v ? '' : v; desenhar(); } }, v + ' (' + n + ')')));
      const vis = base.filter((l) => !sit || (l.situacao || '(sem situação)') === sit);
      rc(lista, ...(vis.length ? vis.map((l) => itemFila(l, regDa(l))) : [h('div', { class: 'vazio' }, !ls.length ? 'A planilha não tem linhas preenchidas.' : hist.length && !base.length ? 'Nenhum processo pendente com esses filtros. 👍' : 'Nada encontrado com esses filtros.')]));
      const abrir = verHist;
      rc(historico, hist.length ? h('div', { class: 'fila-hist' },
        btnHistorico(abrir, hist.length, () => { verHist = !abrir; desenhar(); }),
        abrir ? h('div', {}, h('h3', {}, 'Histórico de atendimento'), h('p', { class: 'dica', style: { marginTop: 0 } }, 'Processos já atendidos pela Fiscalização (status: ' + String(CONFIG.fila_atendidos || '').split(/\n/).filter((x) => x.trim()).join(', ') + ').'), h('div', { class: 'lista-linhas' }, ...hist.map((l) => itemFila(l, regDa(l))))) : null) : null);
    };
    const montar = () => {
      if (!dados || !dados.configurada) {
        rc(topo, avisoLeitura(dados, erro), dados || !erro ? h('div', { class: 'vazio' }, 'A planilha da fila ainda não foi vinculada.',
          pode.admin() ? h('div', { style: { marginTop: '12px' } }, h('a', { class: 'btn pri', href: '#/config' }, 'Vincular em Ajustes')) : h('div', { class: 'sub' }, 'Peça ao administrador para vincular em Ajustes.')) : null);
        rc(resumo); rc(lista); rc(historico); controles.classList.add('oculto');
        return;
      }
      controles.classList.remove('oculto');
      rc(topo, avisoLeitura(dados, erro),
        h('div', { class: 'linha', style: { marginBottom: '10px' } },
          h('div', { class: 'cresce sub' }, '📄 ' + (dados.titulo || 'Planilha') + (dados.aba ? ' › ' + dados.aba : '') + ' · ' + dados.linhas.filter((l) => !atendido(l)).length + ' pendente(s) · ' + dados.linhas.filter(atendido).length + ' atendido(s)', h('br'), 'Lido em ' + dataHoraBR(dados.lidoEm)),
          h('button', { class: 'btn peq', onclick: () => atualizar(true) }, '↻ Atualizar')));
      // o filtro salvo só vale ao abrir a tela; depois, vale o que o usuário escolheu (inclusive "Todas")
      opcoes(selSol, 'solicitacao', 'Todas as solicitações', primeiraMontagem ? st.sol : selSol.value);
      opcoes(selSt, 'status', 'Todos os status', primeiraMontagem ? st.st : selSt.value);
      primeiraMontagem = false;
      desenhar();
    };
    const controles = h('div', {},
      h('div', { class: 'linha-busca' }, busca, selSol, selSt),
      h('label', { class: 'linha', style: { gap: '6px', marginBottom: '10px', fontSize: '14px' } }, soApp, 'Só convênios cadastrados no app'),
      resumo);
    busca.addEventListener('input', desenhar);
    selSol.addEventListener('change', desenhar);
    // escolher um status "já atendido" no filtro abre o histórico (e o botão continua podendo fechá-lo)
    selSt.addEventListener('change', () => { if (selSt.value && atendido({ status: selSt.value })) verHist = true; desenhar(); });
    soApp.addEventListener('change', desenhar);
    const rodape = h('p', { class: 'dica' }, 'Somente leitura: estas informações vêm da planilha da fila de atendimento. Para alterar algo, edite a própria planilha no Google Planilhas — o app busca de novo a cada minuto enquanto esta tela está aberta.');
    rcT(tk, topo, controles, lista, historico, rodape);
    if (!dados) rc(topo, h('div', { class: 'vazio' }, h('span', { class: 'carregando' }), ' Lendo a planilha…'));
    else montar();

    let ativo = true;
    const atualizar = async (manual) => {
      if (!ativo) return;
      if (manual) toast('Atualizando…');
      const r = await lerFila();
      if (!ativo || !document.contains(lista)) return;
      dados = r.dados; erro = r.erro;
      montar();
      if (manual && !r.erro) toast('Fila atualizada');
    };
    const timer = setInterval(() => { if (document.visibilityState === 'visible') atualizar(false); }, 60000);
    const aoVoltar = () => { if (document.visibilityState === 'visible' && (!dados || Date.now() - new Date(dados.lidoEm).getTime() > 30000)) atualizar(false); };
    document.addEventListener('visibilitychange', aoVoltar);
    App._sairTela = () => { ativo = false; clearInterval(timer); document.removeEventListener('visibilitychange', aoVoltar); };
    if (!manterRolagem || !dados) atualizar(false); // redesenho por dados de outro aparelho: não precisa reler a planilha
  }

  /* Cartão "Fila de atendimento" dentro de um convênio */
  function cartaoFilaConvenio(r) {
    const box = h('div', { class: 'card oculto' });
    let verHist = false;
    let ultimo = null;
    const linha = (l) => h('div', { class: 'fila-linha' + (atendido(l) ? ' atendida' : '') },
      h('div', { class: 'etqs' }, l.solicitacao ? etq(l.solicitacao, 'info') : null, l.status ? etq(l.status, atendido(l) ? 'ok' : '') : null, l.situacao ? etq(l.situacao, corSituacao(l.situacao)) : null),
      h('div', { class: 'sub' }, [l.protocolo ? 'Protocolo nº ' + l.protocolo : '', l.escola].filter(Boolean).join(' · ')),
      ...(l.extras || []).map(([k, v]) => h('div', { class: 'sub' }, k + ': ' + v)));
    const pintar = (dados, erro) => {
      ultimo = [dados, erro];
      if (!dados || !dados.configurada) { box.classList.add('oculto'); return; }
      const ls = linhasDoConvenio(dados, r);
      const pend = ls.filter((l) => !atendido(l)), hist = ls.filter(atendido);
      box.classList.remove('oculto');
      rc(box, h('h2', {}, 'Fila de atendimento'),
        !chaveConvenio(r.numero) ? h('p', { class: 'sub' }, 'Informe o número do convênio no cadastro para ver os processos dele na fila.')
          : !ls.length ? h('p', { class: 'sub' }, 'Nenhum processo deste convênio (' + r.numero + ') na planilha da fila.')
            : pend.length ? pend.map(linha) : h('p', { class: 'sub' }, 'Nenhum processo pendente deste convênio na fila. 👍'),
        hist.length ? h('div', { class: 'fila-hist' }, btnHistorico(verHist, hist.length, () => { verHist = !verHist; pintar(...ultimo); }),
          verHist ? h('div', {}, ...hist.map(linha)) : null) : null,
        erro && erro !== 'local' ? h('div', { class: 'dica' }, 'Última leitura: ' + dataHoraBR(dados.lidoEm) + ' (sem atualização agora).') : h('div', { class: 'dica' }, 'Somente leitura · atualizado em ' + dataHoraBR(dados.lidoEm) + ' · ', h('a', { href: '#/fila' }, 'ver fila completa')));
    };
    if (r.tipo !== 'convenio' || !Sync.habilitado()) return box;
    (async () => {
      pintar(await filaDoCache(), null);
      const ult = filaMem && filaMem.lidoEm ? new Date(filaMem.lidoEm).getTime() : 0;
      if (Date.now() - ult < 60000) return;
      const x = await lerFila();
      pintar(x.dados, x.erro);
    })().catch((e) => console.error(e));
    return box;
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
      const pf = prazoDe;
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
        h('tr', {}, h('td', {}, 'Enviada em'), h('td', {}, X.dataBR(n.enviadaEm) + (n.enviadaPor ? ' · por ' + nomeDe(n.enviadaPor) : ''))),
        h('tr', {}, h('td', {}, 'Prazo para resposta'), h('td', {}, (n.prazoDiasEnvio || n.prazo_dias || 3) + ' dia(s) útil(eis) → até ' + X.dataBR(prazoDe(n)))),
        n.respondidaEm ? h('tr', {}, h('td', {}, 'Respondida em'), h('td', {}, X.dataBR(n.respondidaEm) + (n.respondidaPor ? ' · registrado por ' + nomeDe(n.respondidaPor) : ''))) : null,
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    const original = await DB.get('notificacoes', id);
    if (!original || original.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Notificação não encontrada.')); return; }
    const r = await DB.get('registros', original.registroId);
    if (!r) { rcT(tk, h('div', { class: 'vazio' }, 'Cadastro desta notificação não encontrado.')); return; }
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
    const fmtNum = (CONFIG.formato_numero || {})[r.tipo] || '';
    const seqAuto = usaSequencial(fmtNum);
    const ordInp = h('input', { type: 'number', min: '1', value: n.ordinal, readonly: ro, oninput: (e) => {
      const antes = formatarNumero(fmtNum, { seq: n.seq, ano: n.ano, ordinal: n.ordinal });
      n.ordinal = parseInt(e.target.value, 10) || n.ordinal;
      // número automático (só com a ordem): acompanha a ordem
      if (n.numero && n.numero === antes) { n.numero = formatarNumero(fmtNum, { seq: n.seq, ano: n.ano, ordinal: n.ordinal }); numInp.value = n.numero; }
      marcar();
    } });
    const numInp = inputTxt(n, 'numero', { readonly: ro, placeholder: !ro && seqAuto ? 'Definido ao emitir' : '', oninput: (e) => { n.numero = e.target.value.trim() ? e.target.value : ''; marcar(); } });
    const repetido = emitida ? (await numerosRepetidos()).cont.get(chaveNumero(n)) : null;
    const avisoRepetido = repetido && repetido.length > 1
      ? h('div', { class: 'aviso perigo' }, '⚠️ Número repetido: ' + (repetido.length - 1) + ' outra(s) notificação(ões) emitida(s) também têm o nº ' + n.numero + ' (' +
        repetido.filter((o) => o.id !== n.id).map((o) => (o.ordinal || '?') + 'ª, emitida em ' + dataLocalBR(o.emitidaEm || o.data) + ' por ' + (nomeDe(o.emitidaPor) || '—')).join('; ') +
        '). Um administrador pode reabrir uma delas e corrigir o número.')
      : null;
    const secCab = h('div', { class: 'card' },
      avisoRepetido,
      emitida ? h('div', { class: 'aviso' }, '🔒 Notificação emitida em ' + dataHoraBR(n.emitidaEm) + ' por ' + (nomeDe(n.emitidaPor) || '—') + '. O conteúdo está bloqueado para preservar o histórico.') : null,
      h('div', { class: 'grade2' },
        campo('Ordem (ª notificação)', ordInp),
        campo('Número da notificação', numInp, ro ? null : seqAuto
          ? 'Definido pelo servidor ao emitir — nunca se repete. Se precisar de um número específico, digite aqui.'
          : 'Gerado automaticamente e confirmado ao emitir — pode ser alterado.'),
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
    // foto do projeto da irregularidade: vai logo abaixo desta imagem (Imagem N-A)
    const irrDaSel = (s) => (s.irrId && mapaFotos.get(s.irrId)) || irrPorFoto.get(s.fotoId) || ((mapaFotos.get(s.fotoId) || {}).irregular ? mapaFotos.get(s.fotoId) : null);
    const linhaProjeto = (s, i) => {
      const irr = irrDaSel(s);
      const p = ro ? s.projeto : projetoDe(irr);
      if (!irr && !p) return null;
      if (!p) {
        return ro ? null : h('div', { class: 'proj-linha vazio-proj' }, h('button', { class: 'btn peq', onclick: async () => {
          if (await editarProjeto(irr)) { mapaFotos.set(irr.id, await DB.get('fotos', irr.id)); s.semProjeto = false; marcar(); desenharFotos(); }
        } }, '📐 Incluir foto do projeto'));
      }
      const mini = h('img', { alt: 'Projeto' });
      DB.get('fotos', p.fotoId).then((fp) => (fp ? urlFoto(fp) : '')).then((u) => { if (u) mini.src = u; });
      const chk = h('input', { type: 'checkbox', checked: s.semProjeto ? null : 'checked', disabled: ro ? 'disabled' : null, onchange: (e) => { s.semProjeto = !e.target.checked; marcar(); desenharFotos(); } });
      return h('div', { class: 'proj-linha' + (s.semProjeto ? ' desligado' : '') }, mini,
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'proj-tit' }, 'Imagem ' + (i + 1) + '-A · 📐 Projeto' + (p.legenda ? ': ' + p.legenda : '')),
          h('label', { class: 'linha sub' }, chk, ' incluir na notificação')));
    };
    const desenharFotos = () => {
      const selIds = (n.fotos || []).map((s) => s.fotoId);
      const ordenada = h('div', { class: 'lista-ord' }, ...(n.fotos || []).map((s, i) => {
        const f = mapaFotos.get(s.fotoId) || { id: s.fotoId };
        const img = h('img');
        urlFoto(f).then((u) => { img.src = u; });
        const ta = h('textarea', { readonly: ro, placeholder: 'Legenda', oninput: (e) => { s.legenda = e.target.value; marcar(); } });
        ta.value = s.legenda || '';
        const nova = s.irrId && s.irrId !== s.fotoId && f.dataHora ? ' · foto atualizada em ' + dataHoraBR(f.dataHora).slice(0, 10) : '';
        return h('div', { class: 'li' }, img, h('div', { style: { flex: 1 } }, h('div', { class: 'sub' }, 'Imagem ' + (i + 1) + nova), ta, linhaProjeto(s, i)),
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
        const limpos = (n.itens || []).map((t) => t.trim()).filter(Boolean);
        // itens vazios saem: a tela é redesenhada, senão o que se digitasse depois iria para a posição errada
        if (JSON.stringify(limpos) !== JSON.stringify(n.itens || [])) { n.itens = limpos; desenharItens(); }
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
      if (!n.numero && !seqAuto) erros.push('número');
      if (!edFiscais.length && !(n.fiscais || []).length) erros.push('ao menos um fiscal');
      if (erros.length) { toast('Preencha: ' + erros.join(', '), true); return false; }
      return true;
    }
    async function numeroDuplicado() {
      if (!n.numero) return false;
      const k = chaveNumero(n);
      const outras = await DB.listar('notificacoes', (o) => o.id !== n.id && o.status === 'emitida' && chaveNumero(o) === k);
      return outras.length > 0;
    }
    async function gerar(compartilhar) {
      if (!validar()) return;
      if (!ro) await salvar(true);
      return gerarDireto(compartilhar);
    }
    async function gerarDireto(compartilhar) {
      const jp = janelaProgresso('Preparando…', (original.status === 'emitida' ? '' : 'Rascunho · ') + (original.ordinal ? original.ordinal + 'ª ' : '') + 'Notificação extrajudicial');
      const fundo = { remove: () => jp.fechar() };
      try {
        const alvo = original.status === 'emitida' ? original : Object.assign({}, original, { numero: numeroRascunho(original, r) });
        const { blob, nome } = await gerarDocx(alvo, r, jp);
        if (original.status !== 'emitida' && !original.numero && seqAuto) setTimeout(() => toast('Rascunho: o número fica “___” até a notificação ser emitida.'), 2700);
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
      if (!(n.fotos || []).length && !(await confirmar('Esta notificação não tem fotos anexas. Emitir mesmo assim?', 'Emitir'))) return;
      let envio = null;
      if (comEnvio) {
        envio = await pedirDataEnvio(n);
        if (!envio) return;
      } else if (!(await confirmar('Ao emitir, o conteúdo fica bloqueado e registrado no histórico. Continuar?', 'Emitir'))) return;
      // número: reservado no servidor agora (nunca se repete entre aparelhos)
      const num = await numerarNaEmissao(n, r);
      if (!num) return;
      const atual2 = await DB.get('notificacoes', id);
      if (atual2 && atual2.status === 'emitida') { toast('Esta notificação já foi emitida (em outro aparelho).', true); telaNotificacao(id); return; }
      n.numero = num.numero; n.seq = num.seq; n.ano = num.ano; n.ordinal = num.ordinal;
      numInp.value = n.numero; ordInp.value = n.ordinal;
      if (await numeroDuplicado() && !(await confirmar('Já existe outra notificação com o número ' + n.numero + '. Emitir mesmo assim?', 'Emitir'))) return;
      await salvar(true);
      const snap = Object.assign({}, r);
      for (const k of ['_pendente', '_campos', '_base', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor']) delete snap[k];
      n.status = 'emitida'; n.emitidaEm = new Date().toISOString(); n.emitidaPor = email();
      sujo = false;
      const fotosEmit = await fotosComProjeto(n.fotos);
      const emit = await atualizarCampos('notificacoes', id, (o) => {
        o.registroSnapshot = snap; o.status = n.status; o.emitidaEm = n.emitidaEm; o.emitidaPor = n.emitidaPor;
        o.fotos = fotosEmit;
        if (envio) aplicarEnvio(o, envio.data);
      });
      Object.assign(original, emit);
      App._sairNotif = null;
      await gerarDireto();
      await telaNotificacao(id);
      if (num.avisos.length) toast('Número ajustado: ' + num.avisos.join('; ') + '.', true);
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

    rcT(tk, secCab, emitida ? cartaoEnvio(original, r, () => telaNotificacao(id)) : null, secFatos, secProv, secAss, secFotos, acoes);
    // salvamento automatico do rascunho ao sair da tela
    App._sairNotif = async () => { if (sujo && !ro) await salvar(true); };
  }

  /* ================================================================== */
  /* Medições (só contratos): Relatório de Elaboração de Medição         */
  /* ================================================================== */
  async function medicoesDe(registroId) {
    return (await DB.byIndex('medicoes', 'registroId', registroId)).filter((m) => !m.excluido).sort((a, b) => (+b.numero || 0) - (+a.numero || 0));
  }
  function contarSituacao(m) {
    const c = { total: 0, medido: 0, parcial: 0, nao: 0 };
    for (const it of m.itens || []) { if (!(it.descricao || '').trim()) continue; c.total++; if (c[it.situacao] !== undefined) c[it.situacao]++; }
    return c;
  }
  const novoItemMed = (descricao) => ({ id: DB.uuid(), descricao: descricao || '', quantitativo: '', situacao: '', comentario: '', memorial: '' });
  const somaDia = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  async function criarMedicao(registroId) {
    if (!pode.notificar()) { toast('Seu perfil não permite criar medições.', true); history.back(); return; }
    const r = await DB.get('registros', registroId);
    if (!r || r.tipo !== 'contrato') { history.back(); return; }
    const ant = (await medicoesDe(registroId))[0];
    let numero;
    if (ant) numero = (+ant.numero || 0) + 1;
    else {
      const n = await perguntarNumero('Primeira medição no app', 'Qual é o número desta medição de “' + r.apelido + '”? (Ex.: 1 para a 1ª medição.)', 1);
      if (n === null) { history.back(); return; }
      numero = Math.max(1, n);
    }
    const hoje = X.hojeISO();
    const inicio = ant && ant.periodo_fim ? somaDia(ant.periodo_fim, 1) : hoje.slice(0, 8) + '01';
    const m = {
      registroId, numero, periodo_inicio: inicio, periodo_fim: hoje, data_vistoria: hoje, data: hoje, status: 'rascunho',
      // os itens costumam se repetir de uma medição para a outra: copia as descrições (e os memoriais) da anterior
      itens: ant && (ant.itens || []).length ? ant.itens.filter((it) => (it.descricao || '').trim()).map((it) => Object.assign(novoItemMed(it.descricao), { memorial: it.memorial || '' })) : [novoItemMed()],
      observacoes: '',
      fiscais: ant && (ant.fiscais || []).length ? ant.fiscais.map((f) => Object.assign({}, f)) : snapshotAssinantes(r.fiscais && r.fiscais.length ? r.fiscais : fiscaisPadrao('contrato'), await pessoasMap(), true),
    };
    const salvo = await DB.salvar('medicoes', m, email());
    location.replace('#/medicao/' + salvo.id);
  }

  /* A medição tem dois documentos: o Relatório de Medição (itens, Word) e o Relatório Fotográfico
     (fotos, Excel). O cabeçalho comum mostra os dois lado a lado; tocar num deles troca o conteúdo.
     Concluir / Reabrir / Excluir valem para a medição inteira (os dois documentos). */
  async function hubMedicao(m, r, aba, ctx) {
    const concluida = m.status === 'concluida';
    const c = contarSituacao(m);
    const d = await dadosRelFoto(m, r);
    const n = d.itens.length;
    const doc = (k, ico, tit, fmt, resumo, href) => h('a', { class: 'med-doc' + (aba === k ? ' ativo' : ''), href, 'aria-current': aba === k ? 'page' : null },
      h('span', { class: 'med-doc-ico', 'aria-hidden': 'true' }, ico),
      h('span', { class: 'med-doc-txt' }, h('b', {}, tit), h('span', { class: 'med-doc-res' }, h('span', { class: 'med-doc-fmt' }, fmt), ' · ', ...resumo)));
    const concluir = async () => {
      if (!(await confirmar('Concluir a medição? Os itens e a escolha de fotos ficam bloqueados (um administrador pode reabrir). Os dois relatórios continuam podendo ser gerados.', 'Concluir'))) return;
      if (ctx && ctx.antes) await ctx.antes();
      const snap = Object.assign({}, r); for (const k of ['_pendente', '_campos', '_base', '_versaoBase', 'atualizadoEm', 'atualizadoPor', 'criadoEm', 'criadoPor']) delete snap[k];
      await atualizarCampos('medicoes', m.id, (o) => { o.status = 'concluida'; o.concluidaEm = new Date().toISOString(); o.concluidaPor = email(); o.registroSnapshot = snap; });
      App._sairNotif = null; telaMedicao(m.id, aba);
    };
    const acoes = h('div', { class: 'med-hub-acoes' },
      !concluida && pode.notificar() ? h('button', { class: 'btn ok peq', onclick: concluir }, '✅ Concluir', h('span', { class: 'med-pc' }, ' medição')) : null,
      concluida && pode.admin() ? h('button', { class: 'btn peq', onclick: async () => {
        if (!(await confirmar('Reabrir a medição para edição?', 'Reabrir'))) return;
        await atualizarCampos('medicoes', m.id, (o) => { o.status = 'rascunho'; delete o.concluidaEm; delete o.concluidaPor; delete o.registroSnapshot; });
        App._sairNotif = null; telaMedicao(m.id, aba);
      } }, '🔓 Reabrir') : null,
      (!concluida && pode.notificar()) || pode.admin() ? h('button', { class: 'btn peq perigo', title: 'Excluir a medição', onclick: async () => {
        if (!(await confirmar('Excluir esta medição? Sai junto o relatório de medição e a escolha de fotos (as fotos das visitas continuam).', 'Excluir', true))) return;
        App._sairNotif = null;
        await DB.excluir('medicoes', m.id, email());
        for (const f of await DB.byIndex('fotos', 'registroId', r.id)) if (f.medicaoId === m.id && !f.visitaId && !f.excluido) await atualizarCampos('fotos', f.id, (o) => { o.excluido = true; });
        sessionStorage.setItem('aba_reg2', 'medicoes'); location.replace('#/registro/' + r.id);
      } }, h('span', { class: 'med-pc' }, 'Excluir'), h('span', { class: 'med-cel', 'aria-label': 'Excluir' }, '🗑')) : null);
    return h('div', { class: 'card med-hub' },
      h('div', { class: 'med-hub-topo' },
        h('div', { class: 'med-hub-id' },
          h('div', { class: 'med-hub-t' }, m.numero + 'ª Medição'),
          h('div', { class: 'sub' }, h('span', { class: 'badge ' + (concluida ? 'emit' : 'rasc') }, concluida ? 'Concluída' : 'Rascunho'), ' Período ' + dataCurta(m.periodo_inicio) + ' a ' + dataCurta(m.periodo_fim) + (m.data_vistoria ? ' · vistoria ' + dataCurta(m.data_vistoria) : ''))),
        acoes),
      concluida ? h('div', { class: 'aviso med-hub-aviso' }, '🔒 Concluída em ' + dataHoraBR(m.concluidaEm) + ' por ' + (nomeDe(m.concluidaPor) || '—') + '. Para alterar, um administrador reabre.') : null,
      h('div', { class: 'med-docs', role: 'tablist' },
        doc('itens', '📄', 'Relatório de Medição', 'Word', c.total ? [c.total + ' ite' + (c.total === 1 ? 'm' : 'ns'), h('span', { class: 'med-pc' }, ' · ' + c.medido + ' medido' + (c.medido === 1 ? '' : 's'))] : ['nenhum item'], '#/medicao/' + m.id),
        doc('fotos', '📷', 'Relatório Fotográfico', 'Excel', n ? [n + ' foto' + (n === 1 ? '' : 's'), h('span', { class: 'med-pc' }, ' · ' + folhasDe(n) + ' folha' + (folhasDe(n) === 1 ? '' : 's'))] : ['nenhuma foto'], '#/medicao/' + m.id + '/fotos')));
  }

  async function telaMedicao(id, aba) {
    const tk = rotaSeq;
    const original = await DB.get('medicoes', id);
    if (!original || original.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Medição não encontrada.')); return; }
    const r = await DB.get('registros', original.registroId);
    if (!r) { rcT(tk, h('div', { class: 'vazio' }, 'Contrato desta medição não encontrado.')); return; }
    marcarNav('contratos');
    titulo(original.numero + 'ª Medição · ' + r.apelido, true);
    aba = aba === 'fotos' ? 'fotos' : 'itens';
    if (aba === 'fotos') {
      const ctx = {};
      const hub = await hubMedicao(original, r, 'fotos', ctx); // antes do corpo: o corpo é desenhado e entra na tela sem esperar
      const corpo = await corpoMedFotos(original, r, ctx);
      rcT(tk, hub, ...corpo);
      App._sairNotif = ctx.sair;
      return;
    }
    delete document.body.dataset.rfAba;
    const m = clonar(original);
    let base = clonar(original);
    m.itens = m.itens || [];
    const concluida = m.status === 'concluida';
    const ro = concluida || !pode.notificar();
    const pessoas = await pessoasMap();
    const edFiscais = (m.fiscais || []).map((f) => ({ pessoaId: f.pessoaId, funcao: f.funcao }));
    let sujo = false;
    const marcar = () => { sujo = true; };
    const data = (k) => h('input', { type: 'date', value: m[k] || '', readonly: ro, oninput: (e) => { m[k] = e.target.value; marcar(); } });

    const cab = h('div', { class: 'card' }, h('h2', {}, 'Dados da medição'),
      h('div', { class: 'grade2' },
        campo('Medição nº', h('input', { type: 'number', min: '1', value: m.numero, readonly: ro, oninput: (e) => { m.numero = parseInt(e.target.value, 10) || m.numero; marcar(); } })),
        campo('Data da vistoria', data('data_vistoria')),
        campo('Período: de', data('periodo_inicio')),
        campo('Período: até', data('periodo_fim'))));

    /* --- itens --- */
    const SIT = [['medido', 'Medido'], ['parcial', 'Parcial'], ['nao', 'Não medido']];
    const boxItens = h('div', { class: 'med-itens' });
    const tituloItens = h('h2', {});
    // no celular a caixa do quantitativo (uma linha) fica baixa; as outras, com no mínimo 64 px
    const crescer = (t) => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, t.closest('.med-qtd') && innerWidth < 1024 ? 46 : 64) + 'px'; };
    const area = (it, k, ph, attrs) => { const t = h('textarea', Object.assign({ rows: 2, readonly: ro, placeholder: ro ? '' : ph, oninput: (e) => { it[k] = e.target.value; crescer(e.target); marcar(); } }, attrs || {})); t.value = it[k] || ''; return t; };
    const desenharItens = () => {
      const c = contarSituacao(m);
      rc(tituloItens, 'Itens da medição (' + m.itens.length + ')');
      rc(boxItens, ...m.itens.map((it, i) => {
        const memAberto = !!(it.memorial || '').trim() || it._memAberto;
        const sit = h('div', { class: 'seg med-sit' }, SIT.map(([k, t]) => h('button', { type: 'button', disabled: ro, class: (it.situacao === k ? 'ativo ' : '') + 'sit-' + k,
          onclick: () => { it.situacao = it.situacao === k ? '' : k; marcar(); desenharItens(); } }, t)));
        return h('div', { class: 'med-item' + (it.situacao ? ' sit-' + it.situacao : '') },
          h('div', { class: 'med-topo' }, h('b', {}, 'Item ' + (i + 1)), sit,
            ro ? null : h('div', { class: 'ctl' },
              h('button', { class: 'btn peq', disabled: i === 0, title: 'Subir', onclick: () => { m.itens.splice(i - 1, 0, m.itens.splice(i, 1)[0]); marcar(); desenharItens(); } }, '▲'),
              h('button', { class: 'btn peq', disabled: i === m.itens.length - 1, title: 'Descer', onclick: () => { m.itens.splice(i + 1, 0, m.itens.splice(i, 1)[0]); marcar(); desenharItens(); } }, '▼'),
              h('button', { class: 'btn peq perigo', title: 'Excluir item', onclick: async () => { if ((it.descricao || it.quantitativo || it.comentario || it.memorial) && !(await confirmar('Excluir o item ' + (i + 1) + '?', 'Excluir', true))) return; m.itens.splice(i, 1); marcar(); desenharItens(); } }, '✕'))),
          h('div', { class: 'med-cols' },
            h('label', { class: 'campo' }, h('span', {}, 'Descrição do item'), area(it, 'descricao', 'Ex.: 3.1 Alvenaria de vedação em bloco cerâmico')),
            // o que a empresa apresentou na medição (opcional), ao lado da descrição — sai em coluna própria no Word
            h('label', { class: 'campo med-qtd' }, h('span', {}, h('span', { class: 'med-pc', title: 'Quantitativo apresentado pela empresa (opcional)' }, 'Quant. empresa'), h('span', { class: 'med-cel' }, 'Quantitativo da empresa (opcional)')),
              area(it, 'quantitativo', 'Ex.: 40 h', { rows: 1, title: 'Quantitativo apresentado pela empresa na medição (opcional). Ex.: 40 h, 85,00 m², 30%' })),
            h('label', { class: 'campo' }, h('span', {}, 'Comentário'), area(it, 'comentario', 'Ex.: não medido — serviço iniciado, aguardando conclusão do pano')),
            memAberto
              ? h('label', { class: 'campo' }, h('span', {}, 'Memorial de cálculo (opcional)'), area(it, 'memorial', 'Ex.: Parede eixo A: 12,40 × 2,80 = 34,72 m²\nDescontar porta: 0,80 × 2,10 = 1,68 m²\nTotal = 33,04 m²', { class: 'mono' }))
              : (ro ? h('label', { class: 'campo med-semmem' }, h('span', {}, 'Memorial de cálculo'), h('div', { class: 'sub' }, '—'))
                : h('label', { class: 'campo med-semmem' }, h('span', {}, 'Memorial de cálculo (opcional)'), h('button', { class: 'btn peq', onclick: () => { it._memAberto = true; desenharItens(); const t = boxItens.querySelectorAll('.med-item')[i].querySelector('textarea.mono'); if (t) t.focus(); } }, '+ Adicionar memorial')))));
      }),
      m.itens.length ? null : h('div', { class: 'vazio' }, 'Nenhum item.'),
      h('div', { class: 'sub', style: { marginTop: '6px' } }, c.total ? [c.medido + ' medido(s)', c.parcial + ' parcial(is)', c.nao + ' não medido(s)'].join(' · ') : ''));
    };
    desenharItens();
    // ajusta a altura das caixas de texto ao conteúdo depois de desenhar (e quando a largura muda)
    const ajustarAlturas = () => boxItens.querySelectorAll('textarea').forEach(crescer);
    new MutationObserver(() => requestAnimationFrame(ajustarAlturas)).observe(boxItens, { childList: true });
    setTimeout(ajustarAlturas, 0);
    const aoRedimensionar = () => { if (!document.body.contains(boxItens)) { removeEventListener('resize', aoRedimensionar); return; } ajustarAlturas(); };
    addEventListener('resize', aoRedimensionar);
    const secItens = h('div', { class: 'card' }, tituloItens, boxItens,
      ro ? null : h('div', { class: 'acoes' },
        h('button', { class: 'btn', onclick: () => { m.itens.push(novoItemMed()); marcar(); desenharItens(); const t = boxItens.querySelectorAll('.med-item'); if (t.length) t[t.length - 1].querySelector('textarea').focus(); } }, '+ Item'),
        h('button', { class: 'btn', onclick: async () => {
          const ta = h('textarea', { placeholder: 'Um item por linha (pode colar da planilha de medição)', style: { minHeight: '160px' } });
          const ok = await modal('Colar vários itens', h('div', {}, h('p', { class: 'sub' }, 'Cada linha vira um item. Linhas em branco são ignoradas.'), ta), [{ txt: 'Cancelar', valor: false }, { txt: 'Adicionar', cls: 'pri', valor: true }]);
          if (!ok) return;
          const linhas = ta.value.split(/\r?\n/).map((l) => l.replace(/\t+/g, ' — ').trim()).filter(Boolean);
          if (!linhas.length) return;
          // tira o item vazio inicial, se houver
          m.itens = m.itens.filter((it) => (it.descricao || it.quantitativo || it.comentario || it.memorial || '').trim()).concat(linhas.map((l) => novoItemMed(l)));
          marcar(); desenharItens(); toast(linhas.length + ' item(ns) adicionado(s)');
        } }, '📋 Colar vários itens')));

    const obs = h('div', { class: 'card' }, h('h2', {}, 'Observações gerais (opcional)'),
      (() => { const t = h('textarea', { readonly: ro, placeholder: ro ? '' : 'Observações que valem para a medição como um todo.', oninput: (e) => { m.observacoes = e.target.value; marcar(); } }); t.value = m.observacoes || ''; return t; })());
    const equipe = h('div', { class: 'card' }, h('h2', {}, 'Equipe de fiscalização (assinaturas)'),
      ro ? h('div', { class: 'sub' }, (m.fiscais || []).map((f) => f.nome).join(', ') || '—')
        : h('div', { onchange: marcar, onclick: (e) => { if (e.target.tagName === 'BUTTON') marcar(); } }, editorAssinantes(edFiscais, pessoas, 'fiscal', true, 'contrato')));

    async function salvar(silencioso) {
      if (ro) return;
      m.fiscais = snapshotAssinantes(edFiscais, pessoas, true);
      // grava uma cópia limpa: os itens na tela continuam sendo os mesmos objetos. Antes m.itens era trocado por
      // cópias e o que se digitava DEPOIS de tocar em "Salvar" ia para os objetos antigos e se perdia ao sair.
      const paraSalvar = Object.assign({}, m, { itens: m.itens.map((it) => { const c = Object.assign({}, it); delete c._memAberto; return c; }) });
      const salvo = await salvarMudancas('medicoes', base, paraSalvar);
      Object.assign(original, salvo);
      base = clonar(paraSalvar);
      sujo = false;
      if (!silencioso) toast('Medição salva');
    }
    async function gerar(compartilhar) {
      if (!ro) await salvar(true);
      const atual = await DB.get('medicoes', id);
      if (!contarSituacao(atual).total) { toast('Inclua ao menos um item com descrição.', true); return; }
      const jp = janelaProgresso('Montando o documento…', 'Relatório de medição nº ' + atual.numero);
      jp.set(null, 0.05);
      const fundo = { remove: () => jp.fechar() };
      try {
        await pausaTela();
        const dados = DocGen.montarDadosMedicao(atual.registroSnapshot || r, atual, atual.fiscais || []);
        jp.set(null, 0.3);
        const modelo = await modeloDocx('medicao');
        // modelo personalizado sem a coluna do quantitativo: ele sai junto da descrição do item
        try {
          if (!(await DocGen.listarMarcadores(modelo)).includes('quantitativo'))
            for (const it of dados.itens) if (it.quantitativo && it.quantitativo !== '—') it.descricao += '\nQuantitativo da empresa: ' + it.quantitativo;
        } catch (e) { /* segue sem */ }
        const blob = await DocGen.gerar(modelo, dados, { type: 'blob', aoProgresso: progGravar(jp, 0.3, 1) });
        const nome = nomeArquivo('RELATÓRIO DE MEDIÇÃO ' + atual.numero + ' - ' + r.apelido) + '.docx';
        fundo.remove();
        if (compartilhar) await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
        toast('Relatório gerado: ' + nome);
      } catch (e) { fundo.remove(); console.error(e); toast(e.message, true); }
    }
    const acoes = h('div', { class: 'card' }, h('h2', {}, 'Gerar o Relatório de Medição'),
      h('div', { class: 'acoes', style: { marginTop: 0 } },
        !ro ? h('button', { class: 'btn', onclick: () => salvar() }, '💾 Salvar') : null,
        h('button', { class: 'btn pri', onclick: () => gerar(false) }, '⬇️ Baixar Word (.docx)'),
        h('button', { class: 'btn', onclick: () => gerar(true) }, '📤 Compartilhar')),
      h('p', { class: 'dica' }, 'Os itens da próxima medição já vêm com as descrições (e memoriais) desta. Para PDF, abra o .docx no Word e use “Salvar como PDF”.'));
    const barra = h('div', { class: 'rf-barra' }, h('span', { class: 'rf-barra-t' }, h('b', {}, 'Relatório de Medição')), h('button', { class: 'btn pri', onclick: () => gerar(false) }, '⬇️ Baixar Word'));
    const hub = await hubMedicao(original, r, 'itens', { antes: () => salvar(true) });
    rcT(tk, hub, cab, secItens, obs, equipe, acoes, barra);
    requestAnimationFrame(ajustarAlturas); // as caixas de texto só têm altura depois de entrar na tela
    // salva o rascunho ao sair da tela
    App._sairNotif = async () => { if (sujo && !ro) await salvar(true); };
  }

  /* ================================================================== */
  /* Relatório fotográfico da medição (Excel, no modelo "Registro        */
  /* Fotográfico dos Serviços Executados"): fotos de quaisquer visitas   */
  /* do contrato + fotos enviadas da galeria/computador só para ela.     */
  /* Fica na medição: m.relFoto = { visitas: [ids], itens: [{ fotoId,   */
  /* servico }], coordModo: 'foto'|'fixa', coordObra?: { lat, lng } }    */
  /* ================================================================== */
  const ORGAO_RELFOTO = 'SEDUC/MT  -  Secretaria de Estado de Educação';
  const folhasDe = (n) => Math.max(1, Math.ceil(n / 6));
  const servicoPadrao = (f) => String(f.descricao || '').trim().toUpperCase();
  const dmsLat = (v) => RelFotoXlsx.dms(v, 'N', 'S'), dmsLng = (v) => RelFotoXlsx.dms(v, 'E', 'W');
  const textoDMS = (c) => (c && c.lat != null ? dmsLat(c.lat) + '  ' + dmsLng(c.lng) : '');

  async function dadosRelFoto(m, r) {
    const rf = m.relFoto || {};
    const visitas = await visitasDe(r.id);
    const ini = m.periodo_inicio || '', fim = m.periodo_fim || '9999-12-31';
    const noPeriodo = (v) => !!v.data && v.data >= ini && v.data <= fim;
    const vivas = new Set(visitas.map((v) => v.id));
    const marcadas = Array.isArray(rf.visitas) ? rf.visitas.filter((id) => vivas.has(id)) : visitas.filter(noPeriodo).map((v) => v.id);
    // fotos das visitas (não excluídas) + as enviadas para esta medição
    const todas = (await DB.byIndex('fotos', 'registroId', r.id))
      .filter((f) => !f.excluido && !f.projetoDe && (f.visitaId ? vivas.has(f.visitaId) : f.medicaoId === m.id));
    const mapa = new Map(todas.map((f) => [f.id, f]));
    const itens = (rf.itens || []).filter((it) => mapa.has(it.fotoId));
    // coordenada da obra: a digitada ou a da 1ª foto (mais antiga) do contrato com GPS
    let obra = rf.coordObra && isFinite(rf.coordObra.lat) && isFinite(rf.coordObra.lng) ? { lat: +rf.coordObra.lat, lng: +rf.coordObra.lng, digitada: true } : null;
    if (!obra) {
      const c = todas.filter((f) => f.lat != null && f.lng != null).sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)))[0];
      if (c) obra = { lat: c.lat, lng: c.lng };
    }
    return { rf, visitas, noPeriodo, marcadas, todas, mapa, itens, obra };
  }
  // coordenada que sai na planilha: a da foto ou, sem GPS (ou "a mesma em todas"), a da obra
  const coordItem = (f, obra, modo) => (modo !== 'fixa' && f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : obra ? { lat: obra.lat, lng: obra.lng, daObra: true } : null);

  async function gerarRelFoto(id, compartilhar) {
    const m = await DB.get('medicoes', id);
    if (!m || m.excluido) return;
    const r = await DB.get('registros', m.registroId);
    if (!r) { toast('Contrato desta medição não encontrado.', true); return; }
    const reg = m.registroSnapshot || r; // concluída: os dados do contrato daquele momento
    const d = await dadosRelFoto(m, r);
    if (!d.itens.length) { toast('Escolha ao menos uma foto para o relatório.', true); return; }
    const semServ = d.itens.filter((it) => !String(it.servico || '').trim()).length;
    if (semServ && !(await confirmar(semServ + ' foto(s) estão sem o “Serviço”. Gerar assim mesmo?', 'Gerar assim mesmo'))) return;
    const jp = janelaProgresso('Preparando as fotos…', 'Relatório fotográfico · ' + m.numero + 'ª medição');
    jp.set(null, 0);
    const t0 = Date.now();
    try {
      const fotos = d.itens.map((it) => d.mapa.get(it.fotoId));
      // do aparelho ou do Drive, já no tamanho da folha (a planilha fica leve e nítida na impressão)
      const { blobs, faltando } = await obterFotos(fotos, (k, n, bx) => jp.set('Preparando as fotos: ' + k + ' de ' + n + (bx ? ' · ' + bx + ' baixada(s) do Drive' : '') + '…', k / n * 0.6), 6, (b) => Foto.reduzir(b, 1800, 0.88));
      if (faltando.length && !(await confirmar(faltando.length + ' foto(s) não estão neste aparelho e não foi possível baixá-las do Drive (sem internet ou ainda não enviadas pelo aparelho que as registrou). Gerar o relatório sem elas?', 'Gerar sem elas'))) { jp.fechar(); return; }
      const modo = d.rf.coordModo || 'foto';
      const itens = [];
      for (const it of d.itens) {
        const f = d.mapa.get(it.fotoId), b = blobs.get(f.id);
        if (!b) continue;
        const c = coordItem(f, d.obra, modo);
        itens.push({ img: new Uint8Array(await b.arrayBuffer()), lat: c ? dmsLat(c.lat) : '', lng: c ? dmsLng(c.lng) : '', local: reg.local_obra || '', servico: it.servico || '' });
      }
      let logo = null;
      try { const resp = await fetch('modelos/logo_relfoto.png'); if (resp.ok) logo = new Uint8Array(await resp.arrayBuffer()); } catch (e) { /* sem o logotipo */ }
      const cab = {
        orgao: ORGAO_RELFOTO,
        medicao: m.numero + 'ª Medição   -   Período:  ' + dataCurta(m.periodo_inicio) + '  a  ' + dataCurta(m.periodo_fim),
        obra: reg.objeto || '', local: reg.local_obra || '', contratada: reg.n_nome || '', cnpj: reg.n_cnpj || '', contrato: reg.numero || '', os: reg.os_numero || '',
      };
      jp.set('Montando a planilha (' + itens.length + ' fotos)…', 0.62);
      await pausaTela();
      const titulo = 'RELATÓRIO FOTOGRÁFICO - ' + m.numero + 'ª MEDIÇÃO - ' + r.apelido;
      const blob = await RelFotoXlsx.gerar({ cab, itens, logo, titulo }, { aoProgresso: (p) => jp.set(null, 0.62 + 0.38 * p) });
      const nome = nomeArquivo(titulo) + '.xlsx';
      jp.fechar();
      if (compartilhar) await compartilharBlob(blob, nome, nome); else baixarBlob(blob, nome);
      Sync.log('relfoto', itens.length + ' fotos, ' + (blob.size / 1048576).toFixed(1) + ' MB, ' + Math.round((Date.now() - t0) / 1000) + ' s');
      toast('Relatório gerado: ' + nome + ' (' + (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB)');
    } catch (e) { jp.fechar(); console.error(e); toast(e.message, true); }
  }

  /* Tela de escolha das fotos */
  async function corpoMedFotos(m, r, ctx) {
    const reg = m.registroSnapshot || r;
    const ro = m.status === 'concluida' || !pode.notificar();
    const d = await dadosRelFoto(m, r);
    const marc = new Set(d.marcadas);
    let itens = d.itens.map((it) => ({ fotoId: it.fotoId, servico: it.servico || '' }));
    const rf = { coordModo: d.rf.coordModo === 'fixa' ? 'fixa' : 'foto', coordObra: d.rf.coordObra || null };
    let verFora = d.visitas.some((v) => !d.noPeriodo(v) && marc.has(v.id));
    let aba = sessionStorage.getItem('rf_aba') || 'visitas';
    if (!['visitas', 'fotos', 'ordem'].includes(aba)) aba = 'visitas';
    document.body.dataset.rfAba = aba;

    /* gravação: logo depois de cada mudança e ao sair da tela */
    let espera = null, sujo = false;
    const gravarAgora = async () => {
      clearTimeout(espera); espera = null;
      if (!sujo || ro) return;
      sujo = false;
      const novo = { visitas: [...marc], itens: itens.map((it) => ({ fotoId: it.fotoId, servico: it.servico || '' })), coordModo: rf.coordModo };
      if (rf.coordObra) novo.coordObra = { lat: rf.coordObra.lat, lng: rf.coordObra.lng };
      await atualizarCampos('medicoes', m.id, (o) => { o.relFoto = novo; });
    };
    const mudou = () => { if (ro) return; sujo = true; clearTimeout(espera); espera = setTimeout(gravarAgora, 700); };

    const sel = () => itens.map((it) => it.fotoId);
    const fotosVis = (vid) => ordenarFotos(d.todas.filter((f) => f.visitaId === vid));
    const enviadas = () => ordenarFotos(d.todas.filter((f) => !f.visitaId && f.medicaoId === m.id));
    const alternar = (f) => {
      if (ro) return;
      const i = itens.findIndex((it) => it.fotoId === f.id);
      if (i >= 0) itens.splice(i, 1); else itens.push({ fotoId: f.id, servico: servicoPadrao(f) });
      mudou(); desenhar();
    };

    const boxVis = h('div'), boxFotos = h('div'), boxOrdem = h('div'), tituloOrdem = h('h2'), resumo = h('span');
    const linhaVis = (v) => {
      const fs = d.todas.filter((f) => f.visitaId === v.id), esc = fs.filter((f) => sel().includes(f.id)).length;
      return h('label', { class: 'rf-vis' + (marc.has(v.id) ? ' on' : '') },
        h('input', { type: 'checkbox', disabled: ro, checked: marc.has(v.id) ? 'checked' : null, onchange: async (e) => {
          if (e.target.checked) marc.add(v.id);
          else {
            const minhas = itens.filter((it) => fs.some((f) => f.id === it.fotoId));
            if (minhas.length) {
              const resp = await modal('Desmarcar a visita nº ' + v.numero + '?', h('p', {}, minhas.length + ' foto(s) desta visita estão no relatório.'),
                [{ txt: 'Cancelar', valor: null }, { txt: 'Manter as fotos', valor: 'manter' }, { txt: 'Tirar do relatório', cls: 'perigo', valor: 'tirar' }]);
              if (!resp) { e.target.checked = true; return; }
              if (resp === 'tirar') itens = itens.filter((it) => !minhas.includes(it));
            }
            marc.delete(v.id);
          }
          mudou(); desenhar();
        } }),
        h('div', { class: 'rf-vis-t' }, h('b', {}, 'Visita nº ' + v.numero), h('span', { class: 'sub' }, ' · ' + dataCurta(v.data)),
          h('div', { class: 'sub' }, fs.length + ' foto(s)' + (esc ? ' · ' + esc + ' escolhida(s)' : ''))),
        d.noPeriodo(v) ? etq('no período', 'ok') : etq('fora do período'));
    };

    /* enviar da galeria / computador (ou arrastar os arquivos) */
    const status = h('div', { class: 'sub' });
    const enviar = async (lista) => {
      const arqs = Array.from(lista || []).filter((a) => /^image\//.test(a.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(a.name || ''));
      if (!arqs.length) return;
      const salvas = await salvarFotos(arqs, 'galeria', r, null, { medicaoId: m.id }, status);
      rc(status);
      for (const f of salvas) { d.todas.push(f); d.mapa.set(f.id, f); itens.push({ fotoId: f.id, servico: '' }); }
      if (salvas.length) { toast(salvas.length + ' foto(s) incluída(s) no relatório — escreva o “Serviço” de cada uma na aba Ordem.'); mudou(); desenhar(); }
    };
    const inpArq = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, onchange: (e) => { const l = e.target.files; enviar(l).finally(() => { e.target.value = ''; }); } });

    const desenhar = () => {
      const dentro = d.visitas.filter(d.noPeriodo), fora = d.visitas.filter((v) => !d.noPeriodo(v));
      rc(boxVis,
        h('div', { class: 'sub', style: { margin: '-4px 0 8px' } }, 'Período da medição: ' + dataCurta(m.periodo_inicio) + ' a ' + dataCurta(m.periodo_fim)),
        ...dentro.map(linhaVis),
        dentro.length ? null : h('div', { class: 'vazio' }, 'Nenhuma visita no período.'),
        fora.length ? h('button', { class: 'btn peq', style: { marginTop: '8px' }, onclick: () => { verFora = !verFora; desenhar(); } }, verFora ? 'Esconder visitas fora do período' : 'Mostrar visitas fora do período (' + fora.length + ')') : null,
        ...(verFora ? fora.map(linhaVis) : []));

      const s = sel();
      const grupos = d.visitas.filter((v) => marc.has(v.id)).map((v) => {
        const fs = fotosVis(v.id);
        const todasSel = fs.length && fs.every((f) => s.includes(f.id));
        return h('div', { class: 'rf-grupo' },
          h('div', { class: 'rf-grupo-t' }, h('b', {}, 'Visita nº ' + v.numero + ' · ' + dataCurta(v.data)),
            fs.length && !ro ? h('button', { class: 'btn peq', onclick: () => {
              if (todasSel) itens = itens.filter((it) => !fs.some((f) => f.id === it.fotoId));
              else for (const f of fs.slice().reverse()) if (!s.includes(f.id)) itens.push({ fotoId: f.id, servico: servicoPadrao(f) }); // da mais antiga para a mais nova
              mudou(); desenhar();
            } }, todasSel ? 'Desmarcar todas' : 'Marcar todas') : null),
          fs.length ? gradeFotos(fs, { selecionadas: s, onclick: alternar }) : h('div', { class: 'sub' }, 'Sem fotos.'));
      });
      const env = enviadas();
      const naoUsadas = env.filter((f) => !s.includes(f.id));
      rc(boxFotos,
        grupos.length ? h('p', { class: 'sub', style: { marginTop: 0 } }, ro ? 'Fotos das visitas marcadas. O número é a posição no relatório.' : 'Toque nas fotos para incluir no relatório (ou tirar). O número é a posição no relatório.')
          : h('div', { class: 'vazio' }, 'Marque ao menos uma visita.'),
        ...grupos,
        env.length || !ro ? h('div', { class: 'rf-grupo' },
          h('div', { class: 'rf-grupo-t' }, h('b', {}, 'Enviadas da galeria / computador'),
            !ro && naoUsadas.length ? h('button', { class: 'btn peq perigo', onclick: async () => {
              if (!(await confirmar('Apagar ' + naoUsadas.length + ' foto(s) enviada(s) que não estão no relatório? Elas só existem nesta medição.', 'Apagar', true))) return;
              for (const f of naoUsadas) { await atualizarCampos('fotos', f.id, (o) => { o.excluido = true; }); d.mapa.delete(f.id); }
              d.todas = d.todas.filter((f) => !naoUsadas.includes(f));
              desenhar();
            } }, '🗑 Apagar as não usadas (' + naoUsadas.length + ')') : null),
          env.length ? gradeFotos(env, { selecionadas: s, onclick: alternar }) : null,
          ro ? null : h('label', { class: 'rf-envio',
            ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('sobre'); },
            ondragleave: (e) => { e.currentTarget.classList.remove('sobre'); },
            ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('sobre'); enviar(e.dataTransfer && e.dataTransfer.files); } },
          inpArq, h('span', { class: 'btn' }, '📁 Enviar fotos da galeria ou do computador'), h('span', { class: 'sub rf-arraste' }, 'ou arraste os arquivos para cá')),
          status,
          ro ? null : h('div', { class: 'dica' }, 'Ficam guardadas só nesta medição (e no Drive, na pasta do contrato). A coordenada vem do GPS gravado na foto, quando houver.')) : null);

      const n = itens.length;
      rc(tituloOrdem, 'Ordem no relatório (' + n + ' foto' + (n === 1 ? '' : 's') + ' · ' + folhasDe(n) + ' folha' + (folhasDe(n) === 1 ? '' : 's') + ')');
      rc(resumo, h('b', {}, n + ' foto' + (n === 1 ? '' : 's')), ' · ' + folhasDe(n) + ' folha' + (folhasDe(n) === 1 ? '' : 's'));
      if (abas.children[1]) rc(abas.children[1].lastChild, 'Fotos' + (n ? ' (' + n + ')' : ''));
      const lista = [];
      itens.forEach((it, i) => {
        const f = d.mapa.get(it.fotoId);
        if (i % 6 === 0) lista.push(h('div', { class: 'rf-folha' }, 'Folha ' + (i / 6 + 1) + '/' + folhasDe(n)));
        const img = h('img', { alt: '' });
        urlFoto(f).then((u) => { img.src = u; });
        const ta = h('textarea', { rows: 1, class: 'rf-serv', readonly: ro, placeholder: ro ? '' : 'Serviço (ex.: EXECUÇÃO DE PISCINA)', oninput: (e) => { it.servico = e.target.value; e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; mudou(); } });
        ta.value = it.servico || '';
        const v = d.visitas.find((x) => x.id === f.visitaId);
        const c = coordItem(f, d.obra, rf.coordModo);
        lista.push(h('div', { class: 'rf-item' },
          h('div', { class: 'rf-mini' }, img, h('span', { class: 'num' }, i + 1)),
          h('div', { class: 'rf-cont' }, h('span', { class: 'rf-rot' }, 'Serviço'), ta),
          h('div', { class: 'sub rf-meta' },
            h('div', {}, c ? h('span', { class: c.daObra && rf.coordModo !== 'fixa' ? 'rf-semgps' : '' }, '📍 ' + textoDMS(c) + (c.daObra && rf.coordModo !== 'fixa' ? ' (sem GPS: a da obra)' : '')) : h('span', { class: 'rf-semgps' }, '📍 sem coordenada')),
            h('div', {}, v ? 'Visita nº ' + v.numero + ' · ' + dataCurta(v.data) : '📁 enviada da galeria')),
          ro ? h('div') : h('div', { class: 'ctl' },
            h('button', { class: 'btn peq', disabled: i === 0, title: 'Subir', onclick: () => { itens.splice(i - 1, 0, itens.splice(i, 1)[0]); mudou(); desenhar(); } }, '▲'),
            h('button', { class: 'btn peq', disabled: i === n - 1, title: 'Descer', onclick: () => { itens.splice(i + 1, 0, itens.splice(i, 1)[0]); mudou(); desenhar(); } }, '▼'),
            h('button', { class: 'btn peq perigo', title: 'Tirar do relatório', onclick: () => { itens.splice(i, 1); mudou(); desenhar(); } }, '✕'))));
      });
      rc(boxOrdem, n ? h('p', { class: 'sub', style: { marginTop: 0 } }, 'A legenda “Serviço” vem da descrição da foto e sai em maiúsculas. Altere aqui sem mudar a foto na visita.') : h('div', { class: 'vazio' }, 'Nenhuma foto escolhida.'), ...lista);
      requestAnimationFrame(() => boxOrdem.querySelectorAll('textarea').forEach((t) => { if (t.offsetParent) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; } }));
      rc(boxCoord, linhaCoord());
    };

    /* cabeçalho e coordenada */
    const lin = (rot, val) => h('div', { class: 'rf-cab-l' }, h('span', {}, rot), h('b', {}, val || '—'));
    const boxCoord = h('div');
    const obraDe = () => {
      if (rf.coordObra) return { lat: rf.coordObra.lat, lng: rf.coordObra.lng, digitada: true };
      const c = d.todas.filter((f) => f.lat != null && f.lng != null).sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)))[0];
      return c ? { lat: c.lat, lng: c.lng } : null;
    };
    const linhaCoord = () => h('div', { class: 'rf-coord' },
      h('div', { class: 'sub' }, 'Coordenada da obra: ', h('b', {}, d.obra ? textoDMS(d.obra) : 'nenhuma'), d.obra && !d.obra.digitada ? ' (da 1ª foto do contrato com GPS)' : ''),
      ro ? null : h('button', { class: 'btn peq', onclick: async () => {
        const inp = h('input', { type: 'text', value: d.obra ? textoDMS(d.obra) : '', placeholder: '11°49\'59.7"S 55°32\'07.6"W  ou  -11.833250, -55.535444' });
        const botoes = [{ txt: 'Cancelar', valor: null }];
        if (rf.coordObra) botoes.push({ txt: 'Usar a da 1ª foto', valor: 'auto' });
        botoes.push({ txt: 'Salvar', cls: 'pri', valor: () => inp.value, antes: () => { if (!RelFotoXlsx.lerCoord(inp.value)) { toast('Coordenada não reconhecida. Ex.: -11.833250, -55.535444', true); return false; } } });
        const resp = await modal('Coordenada da obra', h('div', {}, h('p', { class: 'sub' }, 'Vale para as fotos sem GPS e para a opção “A mesma em todas”. Pode colar do Google Maps.'), inp), botoes);
        if (resp == null) return;
        rf.coordObra = resp === 'auto' ? null : RelFotoXlsx.lerCoord(resp);
        d.obra = obraDe();
        mudou(); desenhar();
      } }, 'Alterar'));
    const segCoord = h('div', { class: 'seg' }, [['foto', 'GPS de cada foto'], ['fixa', 'A mesma em todas']].map(([k, t]) => h('button', { type: 'button', disabled: ro, class: rf.coordModo === k ? 'ativo' : '',
      onclick: () => { rf.coordModo = k; [...segCoord.children].forEach((b, j) => b.classList.toggle('ativo', j === (k === 'foto' ? 0 : 1))); mudou(); desenhar(); } }, t)));
    const cab = h('div', { class: 'card rf-cab' }, h('h2', {}, 'Cabeçalho das folhas'),
      lin('Medição', m.numero + 'ª Medição — Período: ' + dataCurta(m.periodo_inicio) + ' a ' + dataCurta(m.periodo_fim)),
      lin('Obra', reg.objeto), lin('Localização', reg.local_obra), lin('Contratada', reg.n_nome), lin('CNPJ', reg.n_cnpj),
      h('div', { class: 'grade2' }, lin('Contrato N.º', reg.numero), lin('O.S. Nº', reg.os_numero)),
      h('div', { class: 'sub', style: { marginTop: '6px' } }, m.registroSnapshot ? 'Dados do contrato gravados ao concluir a medição.' : 'Vem do cadastro do contrato. ', !m.registroSnapshot && pode.cadastro() ? h('a', { href: '#/editar/' + r.id }, 'Editar cadastro') : null),
      h('h3', {}, 'Coordenada nas fotos'), segCoord, boxCoord);
    const gerar = async (comp) => { await gravarAgora(); await gerarRelFoto(m.id, comp); };
    const acoes = h('div', { class: 'card' }, h('h2', {}, 'Gerar o Relatório Fotográfico'),
      h('div', { class: 'acoes', style: { marginTop: 0 } },
        h('button', { class: 'btn pri', onclick: () => gerar(false) }, '⬇️ Baixar Excel (.xlsx)'),
        h('button', { class: 'btn', onclick: () => gerar(true) }, '📤 Compartilhar')),
      h('p', { class: 'dica' }, 'A escolha fica salva na medição (sincroniza com os colegas). Para PDF, abra o .xlsx no Excel e use “Salvar como PDF”.'));

    const abas = h('div', { class: 'rf-abas' }, [['visitas', 'Visitas'], ['fotos', 'Fotos'], ['ordem', 'Ordem']].map(([k, t], i) => h('button', { type: 'button', class: aba === k ? 'ativo' : '',
      onclick: (e) => { document.body.dataset.rfAba = k; sessionStorage.setItem('rf_aba', k); [...abas.children].forEach((b) => b.classList.toggle('ativo', b === e.currentTarget)); window.scrollTo(0, 0); if (k === 'ordem') desenhar(); } }, h('span', { class: 'rf-n' }, i + 1), h('span', { class: 'rf-et' }, t))));
    const prox = (k, t) => h('button', { class: 'btn rf-prox', onclick: () => abas.children[k].click() }, t + ' ›');
    const barra = h('div', { class: 'rf-barra' }, h('span', { class: 'rf-barra-t' }, resumo), h('button', { class: 'btn pri', onclick: () => gerar(false) }, '⬇️ Baixar Excel'));
    const esq = h('div', { class: 'rf-esq' },
      h('div', { class: 'card rf-p-visitas' }, h('h2', {}, 'De quais visitas?'), boxVis, prox(1, 'Próximo: escolher as fotos')),
      h('div', { class: 'card rf-p-fotos' }, h('h2', {}, 'Escolha as fotos'), boxFotos, prox(2, 'Próximo: ordem e legendas')));
    const dir = h('div', { class: 'rf-dir' },
      h('div', { class: 'card rf-p-ordem' }, tituloOrdem, boxOrdem),
      h('div', { class: 'rf-p-ordem' }, cab), h('div', { class: 'rf-p-ordem' }, acoes));
    desenhar();
    ctx.antes = gravarAgora;
    ctx.sair = async () => { delete document.body.dataset.rfAba; await gravarAgora(); };
    return [!pode.notificar() ? h('div', { class: 'aviso' }, 'Seu perfil permite apenas consultar e gerar o relatório.') : null,
      abas, h('div', { class: 'rf' }, esq, dir), barra];
  }

  /* ================================================================== */
  /* Ajustes                                                             */
  /* ================================================================== */
  /* Ajustes › Status das obras: o administrador acrescenta, renomeia, reordena ou tira status e escolhe a cor */
  function cartaoStatusObras() {
    const ed = {};
    const carregar = (lista) => lista.map((x) => ({ nome: x.nome, cor: x.cor || 'neutro', encerra: !!x.encerra, orig: x.nome }));
    for (const t of ['convenio', 'contrato']) ed[t] = carregar(listaStatus(t));
    const box = { convenio: h('div'), contrato: h('div') };
    const resumo = { convenio: h('span'), contrato: h('span') };
    const desenhar = (t, focar) => {
      const l = ed[t];
      rc(box[t], ...l.map((x, i) => {
        const nome = h('input', { type: 'text', value: x.nome, placeholder: 'Nome do status', oninput: (e) => { x.nome = e.target.value; } });
        const cor = h('select', { onchange: (e) => { x.cor = e.target.value; amostra.className = 'etq ' + x.cor.replace('neutro', ''); } },
          CORES_STATUS.map(([v, rot]) => h('option', { value: v, selected: x.cor === v ? 'selected' : null }, rot)));
        const amostra = h('span', { class: 'etq ' + x.cor.replace('neutro', '') }, '●');
        const mover = (d) => { const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; desenhar(t); };
        if (focar && i === l.length - 1) setTimeout(() => nome.focus(), 30);
        return h('div', { class: 'status-ed' },
          h('div', { class: 'linha' }, amostra, nome,
            h('button', { class: 'btn peq perigo', title: 'Tirar da lista', onclick: () => { l.splice(i, 1); desenhar(t); } }, '✕')),
          h('div', { class: 'linha status-ed-op' }, cor,
            h('label', { class: 'linha', title: 'Obra encerrada: prazo vencido não aparece como alerta' }, h('input', { type: 'checkbox', checked: x.encerra ? 'checked' : null, onchange: (e) => { x.encerra = e.target.checked; } }), 'encerra'),
            h('span', { class: 'cresce' }),
            h('button', { class: 'btn peq', title: 'Subir', disabled: i === 0 ? 'disabled' : null, onclick: () => mover(-1) }, '↑'),
            h('button', { class: 'btn peq', title: 'Descer', disabled: i === l.length - 1 ? 'disabled' : null, onclick: () => mover(1) }, '↓')));
      }), h('button', { class: 'btn peq', onclick: () => { l.push({ nome: '', cor: 'neutro', encerra: false, orig: null }); desenhar(t, true); } }, '+ Acrescentar status'));
      if (resumo[t]) resumo[t].textContent = PLURAL[t] + ' (' + l.length + ' status)';
    };
    const salvar = async (ev) => {
      const limpo = {}, trocas = [];
      for (const t of ['convenio', 'contrato']) {
        const vistos = new Set();
        limpo[t] = [];
        for (const x of ed[t]) {
          const nome = String(x.nome || '').replace(/\s+/g, ' ').trim();
          if (!nome) continue;
          const k = nome.toLowerCase();
          if (vistos.has(k)) { toast('Status repetido em ' + PLURAL[t] + ': ' + nome, true); return; }
          vistos.add(k);
          limpo[t].push({ nome, cor: x.cor || 'neutro', encerra: !!x.encerra });
          if (x.orig && x.orig !== nome) trocas.push({ t, de: x.orig, para: nome }); // renomeado
        }
        if (!limpo[t].length) { toast('A lista de ' + PLURAL[t].toLowerCase() + ' não pode ficar vazia.', true); return; }
      }
      // obras que usam status que saíram da lista: o administrador escolhe o que fazer
      const regs = await DB.listar('registros');
      const fora = [];
      for (const t of ['convenio', 'contrato']) {
        const cont = new Map();
        for (const r of regs) if (r.tipo === t && r.status_obra && !limpo[t].some((x) => x.nome === r.status_obra)) cont.set(r.status_obra, (cont.get(r.status_obra) || 0) + 1);
        for (const [de, n] of cont) fora.push({ t, de, n, para: (trocas.find((x) => x.t === t && x.de === de) || {}).para || '' });
      }
      if (fora.length) {
        const conteudo = h('div', {}, h('p', {}, 'Estas obras usam status que não estão mais na lista. Escolha o novo status de cada uma (ou deixe como está):'),
          ...fora.map((f) => campo(f.n + ' ' + ROTULO[f.t].toLowerCase() + '(s) com “' + f.de + '”', h('select', { onchange: (e) => { f.para = e.target.value; } },
            h('option', { value: '' }, 'Deixar como está'),
            limpo[f.t].map((x) => h('option', { value: x.nome, selected: x.nome === f.para ? 'selected' : null }, 'Trocar por: ' + x.nome))))));
        const ok = await modal('Obras com status fora da lista', conteudo, [{ txt: 'Cancelar', valor: false }, { txt: 'Salvar', valor: true, cls: 'pri' }]);
        if (!ok) return;
      }
      if (ev && ev.target) ev.target.disabled = true;
      try {
        await salvarConfig((o) => { o.status_obra = clonar(limpo); });
        let n = 0;
        for (const f of fora) {
          if (!f.para) continue;
          for (const r of regs) if (r.tipo === f.t && r.status_obra === f.de) { await atualizarCampos('registros', r.id, (o) => { if (o.status_obra === f.de) o.status_obra = f.para; }); n++; }
        }
        toast('Status salvos' + (n ? ' · ' + n + ' obra(s) atualizada(s)' : ''));
        telaConfig();
      } catch (e) { toast(e.message, true); if (ev && ev.target) ev.target.disabled = false; }
    };
    const card = h('div', { class: 'card' }, h('h2', {}, 'Status das obras'),
      h('p', { class: 'sub' }, 'Lista que aparece em “Status da obra” no cadastro e no filtro das listas. Vale para toda a equipe. “Encerra”: prazos vencidos da obra com esse status deixam de aparecer como alerta (ex.: concluída, rescindida).'),
      h('details', { class: 'status-grupo' }, h('summary', {}, resumo.convenio), box.convenio),
      h('details', { class: 'status-grupo' }, h('summary', {}, resumo.contrato), box.contrato),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn pri', onclick: salvar }, 'Salvar status'),
        h('button', { class: 'btn', onclick: () => { for (const t of ['convenio', 'contrato']) { ed[t] = statusPadrao(t).map((x) => Object.assign(x, { orig: x.nome })); desenhar(t); } toast('Lista original carregada — toque em “Salvar status” para confirmar'); } }, 'Restaurar lista original')));
    desenhar('convenio'); desenhar('contrato');
    return card;
  }

  async function telaConfig(sub) {
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    titulo('Ajustes', !!sub);
    if (sub === 'pessoas') return telaPessoas();
    const u = App.usuario();
    const cards = [];

    /* conta */
    const medPend = Sync.habilitado() ? (await DB.all('medicoes')).filter((o) => o._pendente).length : 0;
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
        Sync.versaoServidor && Sync.versaoServidor < 11 && medPend ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, '⚠️ ' + medPend + ' medição(ões) aguardando: o servidor (Code.gs) precisa ser atualizado para a versão 3.11 para as medições irem para a equipe. Até lá, elas ficam guardadas neste aparelho.') : null,
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
      for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes']) pendPor[e] = (await DB.all(e)).filter((o) => o._pendente).length;
      const fotosSemDrive = (await DB.all('fotos')).filter((f) => !f.driveId && !f.excluido);
      let semArquivo = 0;
      for (const f of fotosSemDrive) if (!(await DB.blobGet(f.id))) semArquivo++;
      const log = Sync.lerLog().slice().reverse();
      const resumo = {
        app: '3.15.7', servidor: Sync.versaoServidor || '?', usuario: (u || {}).email, perfil: perfil(), estado: Sync.estado, erro: Sync.erro || '',
        online: navigator.onLine, ultimaSync: await DB.kvGet('ultimaSync', null), cursor: await DB.kvGet('servidorDesde', 0),
        pendentes: pendPor, fotosAguardandoEnvio: fotosSemDrive.length - semArquivo, fotosDeOutroAparelhoSemEnvio: semArquivo,
        aparelho: navigator.userAgent, log,
      };
      const txtDiag = JSON.stringify(resumo, null, 1);
      cards.push(h('details', { class: 'card secao' },
        h('summary', {}, h('h2', {}, 'Diagnóstico da sincronização')),
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
      campoBloco('Qualidade das fotos', seg([['normal', 'Normal'], ['alta', 'Alta'], ['maxima', 'Máxima']], Foto.qualidadeAtual(), (v) => { try { localStorage.setItem('foto_qualidade', v); } catch (e) { /* */ } }),
        'Normal: até 2000 px (cerca de 0,4 a 1 MB por foto). Alta (padrão): até 3000 px e menos compressão (2 a 3 vezes maior). Máxima: a foto fica no tamanho original da câmera (até 16 megapixels), com o mínimo de compressão e as cores originais (cerca de 3 a 6 MB por foto) — o envio ao Drive demora mais. O relatório continua leve: as fotos são ajustadas ao tamanho da página. Vale para as próximas fotos deste aparelho.'),
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
        campo('Feriados (não contam no prazo das notificações)', inputArea(c, 'feriados', { placeholder: '01/01/2026\n20/11/2026\n25/12/2026' }), 'Um por linha: dd/mm/aaaa, ou só dd/mm para os que se repetem todo ano (ex.: 25/12). Nacionais, estaduais e municipais. Sábados e domingos já não contam.'),
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

    /* status das obras (lista editável) */
    if (pode.admin()) cards.push(cartaoStatusObras());

    /* fila de atendimento (planilha externa somente leitura) */
    if (Sync.habilitado() && pode.admin()) {
      const box = h('div', {}, h('span', { class: 'carregando' }));
      cards.push(h('div', { class: 'card' }, h('h2', {}, 'Fila de atendimento (somente leitura)'), box));
      const f = { url: '', aba: '' };
      const at = { v: CONFIG.fila_atendidos == null ? CONFIG_PADRAO.fila_atendidos : CONFIG.fila_atendidos };
      const passos = (conta) => h('ol', { class: 'sub', style: { paddingLeft: '20px', margin: '6px 0' } },
        h('li', {}, 'Abra a planilha da fila no Google Planilhas e copie o endereço da barra do navegador.'),
        h('li', {}, conta ? h('span', {}, 'Se a planilha não for da conta ', h('b', {}, conta), ', clique em Compartilhar e adicione essa conta como ', h('b', {}, 'Leitor'), '.') : h('span', {}, 'Se a planilha for de outra conta, compartilhe-a como ', h('b', {}, 'Leitor'), ' com a conta que publicou o servidor do app.')),
        h('li', {}, 'Cole o endereço abaixo e toque em “Salvar e testar”.'));
      const previa = (d) => h('div', {},
        h('div', { class: 'ok-box', style: { margin: '8px 0' } }, '✔ Lendo “' + d.titulo + '” › ' + d.aba + ': ' + d.linhas.length + ' linha(s). Colunas: ' + d.colunas.filter(Boolean).join(', ')),
        d.linhas.slice(0, 3).map((l) => h('div', { class: 'sub' }, '• ' + [l.convenio, l.municipio, l.solicitacao, l.situacao].filter(Boolean).join(' · '))));
      // LGPD: o administrador escolhe se alguma coluna além das usadas pelo app pode ser lida
      const colunasFila = (d) => {
        const caixa = h('div', { style: { margin: '12px 0' } }, h('b', {}, 'Outras colunas da planilha'),
          h('p', { class: 'sub', style: { margin: '4px 0 8px' } }, 'Por proteção de dados (LGPD), o app só traz da planilha Convênio, Protocolo, Município, Escola, Solicitação, Status e Situação. Marque outra coluna apenas se a equipe precisar dela e se ela não tiver dados pessoais (nome de pessoas, CPF, telefone, e-mail).'));
        if (!Array.isArray(d.outrasColunas)) { ap(caixa, h('div', { class: 'aviso' }, 'Atualize o servidor (Code.gs, versão 3.15) para escolher colunas. Até lá, nenhuma coluna a mais é mostrada.')); return caixa; }
        if (!d.outrasColunas.length) { ap(caixa, h('div', { class: 'sub' }, 'A planilha não tem outras colunas.')); return caixa; }
        const marc = new Set(d.extrasPermitidas || []);
        ap(caixa, d.outrasColunas.map((c) => h('label', { class: 'linha', style: { gap: '8px', margin: '4px 0' } },
          h('input', { type: 'checkbox', checked: marc.has(c) ? 'checked' : null, onchange: (e) => { if (e.target.checked) marc.add(c); else marc.delete(c); } }), c)),
          h('button', { class: 'btn peq', style: { marginTop: '6px' }, onclick: async (e) => {
            e.target.disabled = true;
            try { const j = await Sync.chamar('filaColunas', { colunas: [...marc] }); filaMem = null; await DB.kvSet('fila_cache', null); toast(marc.size ? 'Colunas liberadas: ' + [...marc].join(', ') : 'Nenhuma coluna a mais será lida'); desenharFila(Object.assign({}, j, { contaServidor: d.contaServidor }), null); }
            catch (err) { e.target.disabled = false; toast(/desconhecida/i.test(err.message) ? 'Atualize o servidor (Code.gs) para escolher colunas.' : err.message, true); }
          } }, 'Salvar colunas'));
        return caixa;
      };
      const desenharFila = (d, msgErro) => {
        const conta = d && d.contaServidor;
        rc(box,
          h('p', { class: 'sub' }, 'Mostra na aba “Fila” e em cada convênio a situação dos processos, lida de uma planilha do Google. O app só LÊ essa planilha — nunca altera nada nela. Compartilhando como Leitor, o próprio Google impede qualquer alteração.'),
          d && d.configurada ? previa(d) : h('div', { class: 'aviso' }, 'Nenhuma planilha vinculada.'),
          msgErro ? h('div', { class: 'aviso' }, msgErro) : null,
          d && d.configurada ? h('div', { style: { margin: '10px 0' } },
            campo('STATUS que significam “já atendido pela Fiscalização” (um por linha)', inputArea(at, 'v', { rows: 2, placeholder: 'ENCAMINHADO - CCP' }),
              'Processos com esses status ficam ocultos e só aparecem em “Ver histórico de atendimento”. Maiúsculas, acentos e traços não importam.'),
            h('button', { class: 'btn peq', onclick: async () => { await salvarConfig((o) => { o.fila_atendidos = String(at.v || '').split(/\n/).map((x) => x.trim()).filter(Boolean).join('\n'); }); toast('Status de atendido salvos'); } }, 'Salvar status de atendido')) : null,
          d && d.configurada ? colunasFila(d) : null,
          passos(conta),
          campo('Endereço (link) da planilha da fila', inputTxt(f, 'url', { placeholder: 'https://docs.google.com/spreadsheets/d/…' })),
          campo('Nome da aba (opcional)', inputTxt(f, 'aba', { placeholder: 'ex.: CONVÊNIOS — em branco usa a primeira aba' })),
          h('div', { class: 'acoes' },
            h('button', { class: 'btn pri', onclick: async (e) => {
              if (!f.url.trim()) { toast('Cole o endereço da planilha', true); return; }
              e.target.disabled = true;
              try {
                const j = await Sync.chamar('filaConfig', { url: f.url.trim(), aba: f.aba.trim() });
                filaMem = null; await DB.kvSet('fila_cache', null);
                f.url = ''; f.aba = '';
                toast('Planilha da fila vinculada');
                desenharFila(j, null);
              } catch (err) { e.target.disabled = false; desenharFila(d, /desconhecida/i.test(err.message) ? 'O servidor ainda não tem a Fila: atualize o Code.gs e publique uma “Nova versão”.' : err.message); }
            } }, 'Salvar e testar'),
            (d && d.configurada) || msgErro ? h('button', { class: 'btn perigo', onclick: async () => {
              if (!(await confirmar('Desvincular a planilha da fila? A planilha em si não é alterada; o app apenas deixa de mostrá-la.', 'Desvincular', true))) return;
              try { const j = await Sync.chamar('filaConfig', { url: '' }); filaMem = null; await DB.kvSet('fila_cache', null); toast('Desvinculada'); desenharFila(j, null); } catch (err) { toast(err.message, true); }
            } }, 'Desvincular') : null));
      };
      (async () => {
        if (!navigator.onLine) { desenharFila(null, 'Sem internet.'); return; }
        try { desenharFila(await Sync.chamar('fila'), null); }
        catch (err) { desenharFila(null, /desconhecida/i.test(err.message) ? 'O servidor ainda não tem a Fila: atualize o Code.gs e publique uma “Nova versão” da implantação.' : err.message); }
      })();
    }

    /* modelos */
    const modCard = h('div', { class: 'card' }, h('h2', {}, 'Modelos do Word'));
    const ROT_MOD = { contrato: 'Notificação — Contrato', convenio: 'Notificação — Convênio', relatorio: 'Relatório fotográfico', irregularidades: 'Relatório de irregularidades', medicao: 'Relatório de medição (contratos)' };
    for (const tipo of ['contrato', 'convenio', 'relatorio', 'irregularidades', 'medicao']) {
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
      const box = h('div', { class: 'usr-lista' }, h('span', { class: 'carregando' }));
      cards.push(h('div', { class: 'card' }, h('h2', {}, 'Usuários do grupo'), box));
      (async () => {
        try {
          const j = await Sync.chamar('usuarios');
          if (Array.isArray(j.usuarios)) Sync.guardarEquipe(j.usuarios);
          // status de acesso: atualiza sozinho (a cada 45 s) enquanto esta tela estiver aberta
          const linhasAcesso = new Map();
          const acessoDe = (us) => { const el = h('div', {}, j.acessos ? textoAcesso(us) : null); linhasAcesso.set(us.email, el); return el; };
          if (j.acessos) {
            const timer = setInterval(async () => {
              if (!document.body.contains(box)) { clearInterval(timer); return; }
              if (document.visibilityState !== 'visible' || !navigator.onLine || !box.offsetParent) return; // seção fechada: não consulta
              try { const k = await Sync.chamar('usuarios'); for (const us of k.usuarios || []) { const el = linhasAcesso.get(us.email); if (el) rc(el, textoAcesso(us)); } } catch (e) { /* tenta na próxima */ }
            }, 45000);
          }
          const novo = { email: '', nome: '', perfil: 'fiscal' };
          const sel = (obj) => h('select', { onchange: (e) => { obj.perfil = e.target.value; } },
            ['admin', 'fiscal', 'consulta'].map((p) => h('option', { value: p, selected: obj.perfil === p ? 'selected' : null }, { admin: 'Administrador', fiscal: 'Fiscal', consulta: 'Consulta' }[p])));
          rc(box, 
            ...j.usuarios.map((us) => h('div', { class: 'usr-linha' },
              h('div', { class: 'usr-info' }, h('div', { class: 'usr-nome' }, us.nome || us.email), h('div', { class: 'sub usr-email' }, us.email + (us.ativo ? '' : ' · desativado')), acessoDe(us)),
              sel(us),
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

    // a partir de "Aparência e câmera", cada seção vira uma lista suspensa (fechada; lembra as abertas)
    const iniSecoes = cards.findIndex((c) => c.querySelector && (c.querySelector(':scope > h2') || {}).textContent === 'Aparência e câmera');
    if (iniSecoes >= 0) for (let i = iniSecoes; i < cards.length; i++) cards[i] = secaoRecolhivel(cards[i]);
    cards.push(h('p', { class: 'dica', style: { textAlign: 'center' } }, 'Fiscalização de Obras · v3.15.7 · dados salvos no aparelho' + (Sync.habilitado() ? ' e no Google Drive do administrador' : '') + ' · ', h('a', { href: 'privacidade.html' }, 'Política de privacidade')));
    rcT(tk, ...cards);
  }

  // "Online agora · celular" (usou o app nos últimos 2 min) ou "Último acesso hoje às 14:32 · computador"
  function textoAcesso(us) {
    if (!us.ativo) return null;
    const onde = us.disp ? ' · ' + us.disp : '';
    if (us.online) return h('div', { class: 'acesso on' }, 'Online agora' + onde);
    if (!us.ultimoAcesso) return h('div', { class: 'acesso' }, 'Ainda não acessou');
    const d = new Date(us.ultimoAcesso), hoje = new Date(), ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);
    const mesmo = (a, b) => a.toDateString() === b.toDateString();
    const hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const dia = mesmo(d, hoje) ? 'hoje' : mesmo(d, ontem) ? 'ontem' : 'em ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    return h('div', { class: 'acesso' }, 'Último acesso ' + dia + ' às ' + hora + onde);
  }

  // Ajustes: transforma um cartão (div.card com h2) em seção que abre e fecha; lembra as abertas durante a sessão
  function secaoRecolhivel(card) {
    const h2 = card.tagName === 'DIV' && card.classList.contains('card') ? card.querySelector(':scope > h2') : null;
    if (!h2) return card;
    const chave = 'ajuste_aberto_' + h2.textContent;
    const d = h('details', { class: card.className + ' secao' });
    try { if (sessionStorage.getItem(chave) === '1') d.open = true; } catch (e) { /* */ }
    d.addEventListener('toggle', () => { try { sessionStorage.setItem(chave, d.open ? '1' : '0'); } catch (e) { /* */ } });
    d.appendChild(h('summary', {}, h2));
    while (card.firstChild) d.appendChild(card.firstChild);
    return d;
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
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
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
    rcT(tk, 
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
    const jp = janelaProgresso('Lendo os dados do aparelho…', 'Exportando backup');
    jp.set(null, 0);
    try {
      const zip = new JSZip();
      const dados = {};
      for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes']) dados[e] = await DB.all(e);
      zip.file('dados.json', JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), dados }, null, 1));
      let k = 0;
      for (const f of dados.fotos) {
        const b = await DB.blobGet(f.id); if (b) zip.file('fotos/' + f.id + '.jpg', b);
        if (++k % 10 === 0 || k === dados.fotos.length) jp.set('Juntando as fotos: ' + k + ' de ' + dados.fotos.length + '…', k / dados.fotos.length * 0.4);
      }
      for (const t of ['contrato', 'convenio', 'relatorio', 'sanadas', 'irregularidades', 'medicao']) { const m = await DB.arquivoGet('modelo_' + t); if (m && m.blob) zip.file('modelos/modelo_' + t + '.docx', m.blob); }
      jp.set('Gravando o arquivo…', 0.4);
      const blob = await zip.generateAsync({ type: 'blob' }, (m) => jp.set('Gravando o arquivo…', 0.4 + m.percent / 100 * 0.6));
      jp.fechar();
      baixarBlob(blob, 'backup-notificacoes-' + X.hojeISO() + '.zip');
    } catch (e) { jp.fechar(); console.error(e); toast('Falha ao exportar: ' + e.message, true); }
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
            delete o._campos; delete o._base; o._pendente = true;
            delete o.n_representante_cpf; if (o.registroSnapshot && typeof o.registroSnapshot === 'object') delete o.registroSnapshot.n_representante_cpf; // LGPD
            await DB.put(e, o);
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
      n_representante: 'LUCAS RECH CADAMURO', n_logradouro: 'RUA DAS PAINEIRAS, Nº 305N', n_cep: '78.450-000',
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
    await apagarCpfLocal();
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
