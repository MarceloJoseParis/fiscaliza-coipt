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

  // 3.17.2: a câmera é sempre a do app (o botão "Câmera do celular" da visita abre a do aparelho).
  // A escolha em Ajustes saiu; o valor antigo guardado no aparelho é ignorado.
  const prefCamera = () => { try { return localStorage.getItem('camera_forcar_aparelho') === '1' ? 'aparelho' : 'app'; } catch (e) { return 'app'; } };
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
    if (input && input.classList && input.classList.contains('rt')) return campoBloco(rotulo, input, dica); // campo com B/I/U: o <label> repassaria o clique ao botão B
    return h('label', { class: 'campo' }, h('span', {}, rotulo), input, dica ? h('div', { class: 'dica' }, dica) : null);
  }
  /* campo sem <label>: necessario quando o conteudo tem varios botoes (um <label> repassa o clique ao 1o botao) */
  function campoBloco(rotulo, conteudo, dica) {
    return h('div', { class: 'campo-bloco' }, h('span', {}, rotulo), conteudo, dica ? h('div', { class: 'dica' }, dica) : null);
  }
  /* app minimizado / fechado no celular: grava o que estiver pendente (o sistema pode encerrar o app em segundo plano) */
  function salvarAoEsconder(salvarFn, vivo) {
    const ao = (e) => {
      if (!vivo()) { tirar(); return; }
      if (document.visibilityState === 'hidden' || (e && e.type === 'pagehide')) { try { const p = salvarFn(); if (p && p.catch) p.catch((err) => console.error(err)); } catch (err) { console.error(err); } }
    };
    const tirar = () => { document.removeEventListener('visibilitychange', ao); removeEventListener('pagehide', ao); };
    document.addEventListener('visibilitychange', ao); addEventListener('pagehide', ao);
    return tirar;
  }
  function inputTxt(obj, chave, attrs) {
    return h('input', Object.assign({ type: 'text', value: obj[chave] == null ? '' : obj[chave], oninput: (e) => { obj[chave] = e.target.value; } }, attrs || {}));
  }
  function inputArea(obj, chave, attrs) {
    const t = h('textarea', Object.assign({ oninput: (e) => { obj[chave] = e.target.value; } }, attrs || {}));
    t.value = obj[chave] == null ? '' : obj[chave];
    return t;
  }

  /* ---- campo de texto com negrito, itálico e sublinhado (3.18.6) ----
     Mostra o texto já formatado (sem asteriscos) e guarda na marcação do app:
     **negrito**, *itálico*, __sublinhado__ — a mesma que o gerador do Word entende. Uma linha = um parágrafo. */
  const RT_BLOCO = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE)$/;
  function rtParaNos(texto) {
    return String(texto == null ? '' : texto).split('\n').map((l) => {
      const linha = h('div');
      const partes = (window.DocGen && DocGen.partesRicas) ? DocGen.partesRicas(l) : [{ t: l }];
      for (const pc of partes) {
        if (!pc.t) continue;
        let no = document.createTextNode(pc.t);
        if (pc.u) { const e = h('u'); e.appendChild(no); no = e; }
        if (pc.i) { const e = h('i'); e.appendChild(no); no = e; }
        if (pc.b) { const e = h('b'); e.appendChild(no); no = e; }
        linha.appendChild(no);
      }
      if (!linha.childNodes.length) linha.appendChild(h('br'));
      return linha;
    });
  }
  function rtParaTexto(raiz) {
    // asterisco/sublinhado soltos digitados são texto (ex.: "nota (*)", "5*3"): vão com barra e não viram formatação.
    // "**texto**" e "__texto__" digitados continuam valendo como negrito/sublinhado (era assim antes da barra B/I/U)
    const esc = (t) => t.replace(/\*+/g, (m) => (m.length === 1 ? '\\*' : m)).replace(/_+/g, (m) => (m.length === 1 ? '\\_' : m));
    const escTudo = (t) => t.replace(/([*_])/g, '\\$1'); // dentro de um trecho já formatado, todo asterisco é texto
    const linhas = []; let cur = [], sujo = false;
    const quebra = () => { linhas.push(cur); cur = []; sujo = false; };
    const walk = (no, f) => {
      for (const c of no.childNodes) {
        if (c.nodeType === 3) { const t = c.textContent.replace(/ /g, ' ').replace(/[\r\n]+/g, ' '); if (t) { cur.push({ t, b: !!f.b, i: !!f.i, u: !!f.u }); sujo = true; } continue; }
        if (c.nodeType !== 1) continue;
        const tg = c.tagName;
        if (tg === 'BR') { if (c === no.lastChild && (no === raiz || RT_BLOCO.test(no.tagName)) && (sujo || no !== raiz)) continue; quebra(); continue; }
        const nf = Object.assign({}, f), st = c.style || {};
        const peso = st.fontWeight;
        if (tg === 'B' || tg === 'STRONG' || peso === 'bold' || +peso >= 600) nf.b = true;
        if (peso === 'normal' || (+peso && +peso < 600)) nf.b = false;
        if (tg === 'I' || tg === 'EM' || st.fontStyle === 'italic') nf.i = true;
        if (st.fontStyle === 'normal') nf.i = false;
        if (tg === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) nf.u = true;
        if (RT_BLOCO.test(tg)) { if (sujo) quebra(); const antes = linhas.length; walk(c, nf); if (sujo || linhas.length === antes) quebra(); }
        else walk(c, nf);
      }
    };
    walk(raiz, {});
    if (sujo) quebra();
    // cada linha: junta trechos com a mesma formatação e escreve os marcadores só onde a formatação muda
    const txt = linhas.map((segs) => {
      const m = [];
      for (const s of segs) { const u = m[m.length - 1]; if (u && u.b === s.b && u.i === s.i && u.u === s.u) u.t += s.t; else m.push(Object.assign({}, s)); }
      let out = '', at = { b: false, i: false, u: false };
      const MK = { b: '**', i: '*', u: '__' };
      const muda = (nv) => { let x = ''; for (const k of ['u', 'i', 'b']) if (at[k] && !nv[k]) x += MK[k]; for (const k of ['b', 'i', 'u']) if (!at[k] && nv[k]) x += MK[k]; at = nv; return x; };
      for (const s of m) {
        if (!(s.b || s.i || s.u) || !s.t.trim()) { out += muda({ b: false, i: false, u: false }) + esc(s.t); continue; }
        // espaços das pontas ficam fora dos marcadores
        const ini = s.t.match(/^\s*/)[0], fim = s.t.match(/\s*$/)[0], meio = s.t.slice(ini.length, s.t.length - fim.length);
        out += muda({ b: false, i: false, u: false }) + ini + muda({ b: s.b, i: s.i, u: s.u }) + escTudo(meio); if (fim) out += muda({ b: false, i: false, u: false }) + fim;
      }
      return out + muda({ b: false, i: false, u: false });
    }).join('\n');
    return txt.replace(/\s+$/, '') ? txt.replace(/\n+$/, '') : '';
  }
  let rtOuvindo = false;
  function rtEstado() {
    const sel = document.getSelection(); const no = sel && sel.anchorNode;
    const ed = no && (no.nodeType === 1 ? no : no.parentElement); const rt = ed && ed.closest && ed.closest('.rt');
    for (const b of document.querySelectorAll('.rt-bar button.on')) if (!rt || !rt.contains(b)) b.classList.remove('on');
    if (!rt) return;
    for (const b of rt.querySelectorAll('.rt-bar button')) { let on = false; try { on = document.queryCommandState(b.dataset.c); } catch (e) { /* */ } b.classList.toggle('on', !!on); }
  }
  /* editorRico({ valor, aoMudar(texto), rotulo, placeholder, mini, attrs }) → elemento .rt
     el.ed é o campo; el.valor() devolve a marcação; el.definir(texto) troca o conteúdo */
  function editorRico(o) {
    o = o || {};
    if (!rtOuvindo) { rtOuvindo = true; document.addEventListener('selectionchange', rtEstado); }
    const ed = h('div', Object.assign({ class: 'rt-ed', contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': o.rotulo || 'Texto', 'data-ph': o.placeholder || '' }, o.attrs || {}));
    const vazio = () => ed.classList.toggle('vazio', !ed.textContent.trim());
    const mudou = () => { vazio(); if (o.aoMudar) o.aoMudar(rtParaTexto(ed)); };
    const botao = (c, txt, nome, atalho) => h('button', { type: 'button', class: 'rt-' + c[0], 'data-c': c, title: nome + ' (Ctrl+' + atalho + ')', 'aria-label': nome, tabindex: '-1',
      onmousedown: (e) => e.preventDefault(), // não tira a seleção do campo
      onclick: () => {
        const sel = document.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed || !ed.contains(sel.anchorNode) || !ed.contains(sel.focusNode)) { toast('Selecione o trecho primeiro'); ed.focus(); return; }
        try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* */ }
        document.execCommand(c); mudou(); rtEstado();
      } }, txt);
    if (o.ro) { ed.setAttribute('contenteditable', 'false'); ed.removeAttribute('role'); }
    const el = h('div', { class: 'rt' + (o.mini ? ' rt-mini' : '') + (o.ro ? ' rt-ro' : '') },
      h('div', { class: 'rt-bar', role: 'toolbar', 'aria-label': 'Formatação' }, botao('bold', 'B', 'Negrito', 'B'), botao('italic', 'I', 'Itálico', 'I'), botao('underline', 'U', 'Sublinhado', 'U'),
        o.mini ? null : h('span', { class: 'rt-dica' }, 'selecione o trecho e toque')),
      ed);
    ed.addEventListener('input', mudou);
    el.addEventListener('click', (e) => { if (el.parentElement && el.parentElement.closest('label')) e.preventDefault(); }); // dentro de <label>: não repassa o clique
    ed.addEventListener('focus', () => { try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) { /* */ } });
    ed.addEventListener('paste', (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
    ed.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes('text/html')) { e.preventDefault(); } });
    const definir = (t) => { ed.textContent = ''; if (String(t || '') !== '') for (const l of rtParaNos(t)) ed.appendChild(l); vazio(); };
    definir(o.valor);
    Object.defineProperty(ed, 'valorMarcado', { get: () => rtParaTexto(ed) });
    ed.definirMarcado = (t) => { definir(t); mudou(); }; // para testes e para "restaurar"
    Object.defineProperty(el, 'value', { get: () => rtParaTexto(ed), set: (t) => definir(t) }); // usado como um textarea
    el.ed = ed; el.valor = () => rtParaTexto(ed); el.definir = definir;
    el.focus = () => ed.focus();
    return el;
  }
  /* troca direta de inputArea por um campo com B/I/U: o oninput recebe { target } com .value (a marcação) */
  function areaRica(obj, chave, attrs) {
    attrs = Object.assign({}, attrs || {});
    const oninput = attrs.oninput; delete attrs.oninput;
    const ro = !!attrs.readonly; delete attrs.readonly;
    const ph = attrs.placeholder || ''; delete attrs.placeholder;
    const rot = attrs['aria-label']; delete attrs['aria-label'];
    const est = attrs.style; delete attrs.style; delete attrs.rows;
    let el = null;
    el = editorRico({ valor: obj[chave] == null ? '' : obj[chave], ro, placeholder: ro ? '' : ph, rotulo: rot, mini: attrs.mini, attrs: Object.assign({ class: 'rt-ed' }, (() => { const a = Object.assign({}, attrs); delete a.mini; return a; })()),
      aoMudar: (t) => { obj[chave] = t; if (oninput) oninput({ target: el }); } });
    if (est && est.minHeight) el.ed.style.minHeight = est.minHeight;
    return el;
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
  /* Feriados (3.18): os nacionais (e os de Mato Grosso) entram sozinhos, calculados para cada ano — inclusive
     a Sexta-feira Santa, que muda com a Páscoa. Em Ajustes dá para desligar algum, ligar os pontos
     facultativos do Governo de MT e acrescentar outros (municipais, emendas). */
  function pascoa(ano) { // algoritmo de Meeus/Jones/Butcher
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451),
      mes = Math.floor((hh + l - 7 * m + 114) / 31), dia = ((hh + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia, 12);
  }
  // { iso: { nome, tipo: 'nacional' | 'facultativo' } } de um ano
  function feriadosDoAno(ano) {
    const out = {};
    const fx = (mm, dd, nome, tipo) => { out[ano + '-' + mm + '-' + dd] = { nome, tipo: tipo || 'nacional' }; };
    const px = (dias, nome, tipo) => { const d = pascoa(ano); d.setDate(d.getDate() + dias); out[isoDe(d)] = { nome, tipo: tipo || 'nacional' }; };
    fx('01', '01', 'Confraternização Universal');
    px(-2, 'Paixão de Cristo (Sexta-feira Santa)');
    fx('04', '21', 'Tiradentes');
    fx('05', '01', 'Dia do Trabalho');
    fx('09', '07', 'Independência do Brasil');
    fx('10', '12', 'Nossa Senhora Aparecida');
    fx('11', '02', 'Finados');
    fx('11', '15', 'Proclamação da República');
    if (ano >= 2024) fx('11', '20', 'Dia Nacional de Zumbi e da Consciência Negra'); // nacional pela Lei 14.759/2023 (antes, feriado estadual em MT)
    fx('12', '25', 'Natal');
    // pontos facultativos do Governo de Mato Grosso (só contam se ligados em Ajustes)
    px(-48, 'Carnaval', 'facultativo'); px(-47, 'Carnaval', 'facultativo'); px(-46, 'Quarta-feira de Cinzas', 'facultativo');
    px(60, 'Corpus Christi', 'facultativo');
    fx('10', '28', 'Dia do Servidor Público', 'facultativo'); fx('12', '24', 'Véspera de Natal', 'facultativo'); fx('12', '31', 'Véspera de Ano-Novo', 'facultativo');
    return out;
  }
  // feriados digitados (um por linha: dd/mm/aaaa Nome, ou dd/mm Nome para os que se repetem todo ano)
  function feriadosManuais() {
    const out = {};
    String((CONFIG && CONFIG.feriados) || '').split(/[\n;]+/).forEach((t) => {
      t = t.trim(); if (!t) return;
      let m, chave = null;
      if ((m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t))) chave = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      else if ((m = /\d{4}-\d{2}-\d{2}/.exec(t))) chave = m[0];
      else if ((m = /(\d{1,2})\/(\d{1,2})\/(\d{2})\b/.exec(t))) chave = '20' + m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      else if ((m = /(\d{1,2})\/(\d{1,2})(?!\/?\d)/.exec(t))) chave = m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); // "25/12": todo ano
      if (!chave) return;
      const nome = t.slice(m.index + m[0].length).replace(/^[\s\-–—:·,]+/, '').trim();
      out[chave] = { nome: nome || 'Feriado', tipo: 'manual' };
    });
    return out;
  }
  let cacheFer = null;
  // todos os dias que não contam (iso ou mm-dd) → { nome, tipo }
  function mapaFeriados() {
    const auto = !CONFIG || CONFIG.feriados_auto !== false;
    const fac = !!(CONFIG && CONFIG.feriados_facultativos);
    const desl = (CONFIG && CONFIG.feriados_desligados) || [];
    const chave = [auto, fac, desl.join(','), (CONFIG && CONFIG.feriados) || '', new Date().getFullYear()].join('|');
    if (cacheFer && cacheFer.chave === chave) return cacheFer.mapa;
    const mapa = new Map();
    if (auto) {
      const ano = new Date().getFullYear();
      for (let y = ano - 2; y <= ano + 3; y++) {
        const f = feriadosDoAno(y);
        for (const [k, v] of Object.entries(f)) if ((v.tipo !== 'facultativo' || fac) && !desl.includes(k)) mapa.set(k, v);
      }
    }
    for (const [k, v] of Object.entries(feriadosManuais())) mapa.set(k, v);
    cacheFer = { chave, mapa };
    return mapa;
  }
  function feriados() { return new Set(mapaFeriados().keys()); }
  App.feriadosDoAno = (ano) => feriadosDoAno(ano);
  App.diasUteisAte = (ini, n) => prazoFinalUteis(ini, n);
  const nomeFeriado = (iso) => { const m = mapaFeriados(); const v = m.get(iso) || m.get(String(iso).slice(5)); return v ? v.nome : ''; };
  function ehDiaUtil(d, fer) { const w = d.getDay(), iso = isoDe(d); return w !== 0 && w !== 6 && !fer.has(iso) && !fer.has(iso.slice(5)); }
  /* prazo final sempre recalculado (um feriado cadastrado depois do envio passa a contar) */
  const prazoOriginal = (n) => (n.enviadaEm ? prazoFinalUteis(n.enviadaEm, n.prazoDiasEnvio || n.prazo_dias) : n.prazoFinal);
  /* 3.18.6: contrarresposta — depois da resposta, a nossa réplica com novo prazo. Enquanto a última não for
     respondida, é o prazo dela que vale (Prazos, Início, avisos). */
  const rodadaAberta = (n) => { const l = (n && n.rodadas) || []; const u = l[l.length - 1]; return n && n.respondidaEm && u && u.enviadaEm && !u.respondidaEm ? u : null; };
  const prazoDe = (n) => { const ro = rodadaAberta(n); return ro ? prazoFinalUteis(ro.enviadaEm, ro.prazoDias || 3) : prazoOriginal(n); };
  /* 3.18.2: o prazo conta a partir da data E do horário do envio — vence no último dia útil do prazo, no mesmo horário.
     Notificações registradas antes (sem horário) continuam vencendo no fim do dia. */
  const horaValida = (x) => (/^\d\d:\d\d$/.test(String(x || '')) ? x : '');
  const horaEnvio = (n) => { if (!n) return ''; const ro = rodadaAberta(n); return horaValida(ro ? ro.enviadaHora : n.enviadaHora); };
  const horaEnv0 = (n) => horaValida(n && n.enviadaHora); // horário do envio da notificação (não da contrarresposta)
  const agoraHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const comHora = (n) => (horaEnvio(n) ? ' às ' + horaEnvio(n) : '');
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
    if (!n.enviadaEm) return n.assinaturaEm
      ? { k: 'nao_enviada', assinatura: true, txt: 'Inserida para assinatura · não enviada', cls: 'info', ordem: 2 }
      : { k: 'nao_enviada', txt: 'Emitida · aguardando assinatura', cls: 'info', ordem: 2 };
    const ro = rodadaAberta(n);
    if (n.respondidaEm && !ro) {
      const rods = n.rodadas || [], ult = rods[rods.length - 1];
      if (ult && ult.respondidaEm) return { k: 'respondida', txt: 'Contrarresposta respondida em ' + X.dataBR(ult.respondidaEm), cls: 'ok', ordem: 3 };
      const po = prazoOriginal(n), atraso = po && n.respondidaEm > po;
      return { k: 'respondida', txt: 'Respondida em ' + X.dataBR(n.respondidaEm) + (atraso ? ' (fora do prazo)' : ''), cls: 'ok', ordem: 3 };
    }
    const pf = prazoDe(n);
    const r = uteisRestantes(pf);
    const hh = horaEnvio(n);
    const pre = ro ? 'Contrarresposta: ' : '';
    if (r < 0) return { k: 'vencida', contra: !!ro, txt: pre + 'Prazo encerrado em ' + X.dataBR(pf) + comHora(n) + ' (há ' + -r + (r === -1 ? ' dia)' : ' dias)'), cls: 'perigo', ordem: 0, restante: r };
    if (r === 0 && hh && pf === X.hojeISO() && agoraHM() >= hh) return { k: 'vencida', contra: !!ro, txt: pre + 'Prazo encerrado hoje às ' + hh, cls: 'perigo', ordem: 0, restante: 0, hoje: true };
    return { k: 'aguardando', contra: !!ro, txt: pre + (r === 0 ? 'Prazo termina hoje' + comHora(n) : r === 1 ? 'Falta 1 dia útil' : 'Faltam ' + r + ' dias úteis'), cls: r <= 1 ? 'alerta' : 'info', ordem: 1, restante: r };
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
    pasta_fotos: '{tipo}-{numero}/{os}/{data}',
    feriados: '',
    feriados_auto: true, // nacionais e de MT calculados pelo app (3.18)
    feriados_facultativos: false,
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
  const PASTA_ANTIGA = '{tipo}-{numero}/{data}';
  // um campo vazio não deixa " - " sobrando no nome da pasta (mesma regra do Code.gs, limparSeparadores_)
  const limparSep = (t) => String(t || '').replace(/(\s*[-–·]\s*){2,}/g, ' - ').replace(/^[\s\-–·]+|[\s\-–·]+$/g, '').trim();
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
      // 3.18.4: O.S. do cadastro do contrato (convênio ou contrato sem O.S.: o nível é pulado)
      os: r.tipo !== 'convenio' && String(r.os_numero || '').trim() ? 'OS ' + nomeArquivo(r.os_numero) : '',
    };
    if (padrao === PASTA_ANTIGA) padrao = CONFIG_PADRAO.pasta_fotos; // padrão antigo guardado: passa a separar por O.S.
    return String(padrao || CONFIG_PADRAO.pasta_fotos).split('/').map((seg) => limparSep(nomeArquivo(seg.replace(/\{(\w+)\}/g, (m, k) => (val[k] != null ? val[k] : ''))))).filter(Boolean);
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
    try { if (Sync.habilitado()) for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes', 'atividades']) pend += (await DB.all(e)).filter((o) => o._pendente).length; } catch (e) { /* */ }
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
    Sync.sincronizar({ forcar: true });
  });
  let timerSync = null;
  App.agendarSync = function () {
    atualizarChip();
    if (!Sync.habilitado()) return;
    clearTimeout(timerSync);
    Sync._atividade = Date.now(); // há movimento: procura novidades dos colegas com mais frequência
    timerSync = setTimeout(() => Sync.sincronizar({ rapido: true }), 1200);
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
    if (ativo && $main.contains(ativo) && (/^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName) || ativo.isContentEditable)) {
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
  // seção da barra de navegação de cada tela (no celular, Fila e Ajustes ficam dentro de "Mais")
  const SECAO_NAV = { inicio: 'inicio', obras: 'obras', contratos: 'obras', convenios: 'obras', registro: 'obras', prazos: 'prazos', notificacoes: 'prazos', notificacao: 'prazos', fila: 'fila', config: 'config', mais: 'mais' };
  function marcarNav(r) {
    const pc = matchMedia('(min-width: 1024px)').matches;
    let sec = SECAO_NAV[r] || r;
    if (pc && (r === 'notificacoes' || r === 'notificacao')) sec = 'notificacoes';
    if (!pc && (sec === 'fila' || sec === 'config')) sec = 'mais';
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.r === sec));
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
    const partes = (location.hash || '#/inicio').slice(2).split('/');
    const [r, a, b] = partes;
    document.body.dataset.tela = r || 'inicio'; // o layout de computador muda conforme a tela
    delete document.body.dataset.foco;
    if (!manterRolagem) window.scrollTo(0, 0);
    document.querySelectorAll('.fab').forEach((f) => f.remove());
    // "Ver documento" da notificação aberto em tela cheia (ex.: botão Voltar do Android): fecha junto
    document.querySelectorAll('.nf-doc-tela').forEach((f) => f.remove()); document.body.classList.remove('nf-doc-aberto');
    if (Sync.habilitado() && !App.usuario() && r !== 'config') return telaLogin();
    if (Sync.habilitado() && Sync.estado === 'sem_acesso' && r !== 'config') return telaLogin(Sync.erro);
    atualizarNavCam();
    try {
      if (r === 'inicio' || !r) { marcarNav('inicio'); return await telaInicio(); }
      if (r === 'obras' || r === 'contratos' || r === 'convenios') { marcarNav('obras'); return await telaObras(r === 'contratos' ? 'contrato' : r === 'convenios' ? 'convenio' : null); }
      if (r === 'prazos') { marcarNav('prazos'); return await telaPrazos(); }
      if (r === 'mais') { marcarNav('mais'); return await telaMais(); }
      if (r === 'registro') { return await telaRegistro(a, b); }
      if (r === 'editar') { return await telaFormRegistro(a); }
      if (r === 'novo') { return await telaFormRegistro(null, a); }
      if (r === 'notificacao') { return await telaNotificacao(a); }
      if (r === 'nova-notificacao') { return await criarNotificacao(a); }
      if (r === 'nova-medicao') { return await criarMedicao(a); }
      if (r === 'medicao') { return await telaMedicao(a, b); }
      if (r === 'medicao-fotos') { location.replace('#/medicao/' + a + '/fotos'); return; } // endereço da 3.15.5
      if (r === 'coleta') { marcarNav('obras'); return await telaColeta(a); }
      if (r === 'notificacoes') { marcarNav('notificacoes'); return await telaNotificacoes(); }
      if (r === 'fila') { marcarNav('fila'); return await telaFila(); }
      if (r === 'visita') { return await telaVisita(a, b); }
      if (r === 'irregularidade') { return await telaIrregularidade(a, b); }
      if (r === 'config') { marcarNav('config'); return await telaConfig(a); }
      location.hash = '#/inicio';
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
    // a configuração da equipe chegou mas não pôde ser gravada neste aparelho: não cria a padrão por cima dela
    const falhos = (await DB.kvGet('recebidosFalhos', {})) || {};
    if (Object.keys(falhos).some((k) => /^(config|pessoas):/.test(k))) return;
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
      h('div', { class: 'lin-de' }, ...[].concat(o.de)),
      h('div', { class: 'lin-meio' },
        h('div', { class: 'lin-l1' }, h('span', { class: 'lin-t' }, o.titulo, o.pend ? h('span', { class: 'pend', title: 'Aguardando sincronização' }) : null), o.selo || null, o.resumo ? h('span', { class: 'lin-s' }, o.pre ? h('span', { class: 'so-cel' }, o.pre) : null, o.resumo) : null),
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
  /* 3.16 — novo fluxo: Início, Obras, Prazos, Mais e atividade da obra  */
  /* ================================================================== */
  // classes dos componentes novos têm o prefixo n- (css/novo.css), para não mexer nas telas antigas
  const nc = (s) => String(s || '').split(/\s+/).filter(Boolean).map((c) => 'n-' + c).join(' ');
  const ICO = {
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    obra: '<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-5h6v5"/><path d="M9 11h.01M15 11h.01"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    busca: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>', voltar: '<path d="m15 5-7 7 7 7"/>', dir: '<path d="m9 5 7 7-7 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alerta: '<path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4.5M12 17.5h.01"/>', doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    regua: '<path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>', ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', mais2: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>', relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14.2A5.5 5.5 0 0 1 20.5 20"/>', fila: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', foto: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-9 9"/>',
    envio: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21 10 14 3 9.5z"/>', baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    resp: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/>', lapis: '<path d="m4 20 4-1L19 8l-3-3L5 16z"/>', pausa: '<path d="M9 5v14M15 5v14"/>',
  };
  function ico(n, cls) {
    const t = document.createElement('template');
    t.innerHTML = '<svg class="n-i' + (cls ? ' ' + nc(cls) : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICO[n] || '') + '</svg>';
    return t.content.firstChild;
  }
  const DIAS_C = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const DIAS_L = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataD = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00');
  const dMes = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] : ''; };
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  // cor do status em classe nova (ok, al, er, in)
  const COR_N = { ok: 'ok', alerta: 'al', perigo: 'er', info: 'in', neutro: '', '': '' };
  const corSt = (r) => COR_N[((infoStatus(r.status_obra, r.tipo) || {}).cor) || ''] || '';
  const encerrada = (r) => !!(infoStatus(r.status_obra, r.tipo) || {}).encerra;
  // data e hora local de um registro (visita: data + hora de início; o resto: quando foi criado)
  const quandoDe = (iso, hora) => {
    if (hora && /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return new Date(iso + 'T' + (hora.length === 5 ? hora : '00:00') + ':00');
    const d = new Date(iso || 0); return isNaN(d) ? new Date(0) : d;
  };
  function quandoTxt(d) {
    if (!d || isNaN(d) || d.getTime() === 0) return '';
    const di = isoDe(d), n = diasAte(di), hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return (n === 0 ? 'Hoje' : n === -1 ? 'Ontem' : dataCurta(di)) + ' às ' + hh;
  }
  const haQuanto = (iso) => { const n = -diasAte(iso); return n === 0 ? 'hoje' : n === 1 ? 'ontem' : n > 0 ? 'há ' + n + ' dias' : 'em ' + -n + ' dias'; };
  const iniciais = (nome) => String(nome || '?').replace(/^(Eng\.|Arq\.|Dr\.|Dra\.)\s*/i, '').split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p)).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  const meuNome = () => { const u = App.usuario() || {}; return u.nome || (Sync.nomeDe ? Sync.nomeDe(u.email) : '') || u.email || ''; };

  /* ---------- prazos da obra: barra de execução e de vigência ---------- */
  function barraPrazo(r, campo) {
    const fim = r[campo];
    const info = infoPrazo(fim);
    if (!info) return null;
    // sem a data de início: a barra mostra o último ano antes do fim do prazo
    const ini = r.data_inicio || (() => { const d = dataD(fim); d.setFullYear(d.getFullYear() - 1); return isoDe(d); })();
    const tot = Math.max(1, Math.round((dataD(fim) - dataD(ini)) / 864e5));
    const pc = Math.min(100, Math.max(4, Math.round(100 * (tot - Math.max(info.n, 0)) / tot)));
    const fechada = encerrada(r);
    const cls = fechada ? 'in' : info.n < 0 ? 'er' : info.n <= 30 ? 'al' : '';
    return { fim, n: info.n, pc: fechada ? 100 : pc, cls, txt: info.txt, rot: campo === 'prazo_execucao' ? 'Execução' : 'Vigência' };
  }
  const barrasDe = (r) => [r.tipo === 'contrato' ? barraPrazo(r, 'prazo_execucao') : null, barraPrazo(r, 'vigencia')].filter(Boolean);
  function blocoBarra(b, longo) {
    return h('div', { class: nc('prazo') },
      h('div', { class: nc('pl') }, h('span', {}, b.rot + (longo ? ' · ' + b.txt : '')), h('b', { class: nc('num') }, dataCurta(b.fim))),
      h('div', { class: nc('barra ' + b.cls) }, h('i', { style: { width: b.pc + '%' } })),
      longo ? null : h('div', { class: nc('pr ' + b.cls) }, b.txt));
  }

  /* ---------- aniversário do contrato (data-base do reajuste) ---------- */
  function proxAniv(r) {
    if (!r || r.tipo !== 'contrato' || !r.aniv_data || encerrada(r)) return null;
    const b = dataD(r.aniv_data);
    if (isNaN(b)) return null;
    const hoje = dataD(X.hojeISO());
    let ano = hoje.getFullYear(), d = new Date(ano, b.getMonth(), b.getDate(), 12);
    if (isoDe(d) < X.hojeISO()) d = new Date(++ano, b.getMonth(), b.getDate(), 12);
    const anos = ano - b.getFullYear();
    if (anos < 1) return null;
    const n = diasAte(isoDe(d));
    return { iso: isoDe(d), n, anos, txt: n === 0 ? 'hoje' : 'em ' + plural(n, 'dia', 'dias'), perto: n <= 60 };
  }

  /* ---------- dados do painel (Início, Prazos, Obras) ---------- */
  async function carregarPainel() {
    const [regs, notifs, visitas, medicoes] = await Promise.all([DB.listar('registros'), DB.listar('notificacoes'), DB.listar('visitas'), DB.listar('medicoes')]);
    const porId = new Map(regs.map((r) => [r.id, r]));
    const ok = (x) => porId.has(x.registroId);
    return { regs, porId, notifs: notifs.filter(ok), visitas: visitas.filter(ok), medicoes: medicoes.filter(ok) };
  }
  // visitas abertas por mim (a mais recente primeiro)
  const minhasAbertas = (visitas) => visitas.filter((v) => v.status !== 'concluida' && (!Sync.habilitado() || v.criadoPor === email()))
    .sort((a, b) => String(b.data + (b.hora_inicio || '')).localeCompare(a.data + (a.hora_inicio || '')));
  async function visitaAbertaMinha() {
    try { return minhasAbertas(await DB.listar('visitas'))[0] || null; } catch (e) { return null; }
  }

  /* Tudo o que tem prazo, agrupado: venc (vencido), prox (até 30 dias), aniv (aniversário em até 60 dias),
     rasc (rascunhos de notificação e medição) e depois. */
  function itensPrazo(d) {
    const out = [];
    for (const n of d.notifs) {
      const r = d.porId.get(n.registroId); if (!r) continue;
      const s = situacaoNotif(n), nome = r.apelido || ROTULO[r.tipo];
      const tit = (n.ordinal || '?') + 'ª notificação · ' + nome;
      if (s.k === 'vencida') out.push({ grupo: 'venc', ord: -1000 + s.restante, ic: 'sino', c: 'er', t: tit, d: (s.contra ? 'Contrarresposta · ' : '') + 'Sem resposta ' + (r.tipo === 'convenio' ? 'da prefeitura' : 'da empresa') + ' · prazo terminou ' + dataCurta(prazoDe(n)) + comHora(n), n: s.hoje ? 'hoje' : -s.restante, u: s.hoje ? 'às ' + horaEnvio(n) : 'dias atrás', href: '#/notificacao/' + n.id });
      else if (s.k === 'aguardando') out.push({ grupo: s.restante <= 30 ? 'prox' : 'depois', ord: s.restante, ic: 'sino', c: 'al', t: tit, d: (s.contra ? 'Contrarresposta · ' : '') + 'Resposta até ' + dataCurta(prazoDe(n)) + comHora(n) + ((n.aditivosPrazo || []).length ? ' · prazo aditado' : ''), n: s.restante, u: s.restante === 1 ? 'dia útil' : 'dias úteis', href: '#/notificacao/' + n.id });
      else if (s.k === 'nao_enviada') out.push(s.assinatura
        ? { grupo: 'prox', ord: -1, ic: 'lapis', c: 'acc', t: tit, d: 'Na assinatura desde ' + dataCurta(n.assinaturaEm) + ' · falta registrar o envio', n: '—', u: 'enviar', href: '#/notificacao/' + n.id }
        : { grupo: 'prox', ord: -2, ic: 'lapis', c: 'in', t: tit, d: 'Emitida, falta inserir para assinatura', n: '—', u: 'assinar', href: '#/notificacao/' + n.id });
      else if (s.k === 'rascunho') out.push({ grupo: 'rasc', ord: 0, ic: 'doc', c: '', t: 'Rascunho de notificação · ' + nome, d: 'Criada ' + haQuanto(n.criadoEm && !isNaN(new Date(n.criadoEm)) ? isoDe(new Date(n.criadoEm)) : String(n.data || '').slice(0, 10)), n: '—', u: 'concluir', href: '#/notificacao/' + n.id });
    }
    for (const r of d.regs) {
      const nome = r.apelido || ROTULO[r.tipo];
      const an = proxAniv(r);
      if (an) out.push({ grupo: an.perto ? 'aniv' : 'depois', ord: an.n, ic: 'cal', c: an.perto ? 'acc' : '', t: 'Aniversário · ' + nome, d: an.anos + 'º ano em ' + dataCurta(an.iso) + ' · reajuste' + (r.aniv_indice ? ' pelo ' + r.aniv_indice : ''), n: an.n, u: an.n === 1 ? 'dia' : 'dias', href: '#/registro/' + r.id });
      if (encerrada(r)) continue; // obra encerrada: prazo vencido não é alerta
      for (const b of barrasDe(r)) {
        const g = b.n < 0 ? 'venc' : b.n <= 30 ? 'prox' : 'depois';
        out.push({ grupo: g, ord: b.n, ic: 'relogio', c: b.n < 0 ? 'er' : b.n <= 30 ? 'al' : '', t: b.rot + ' · ' + nome, d: (b.n < 0 ? 'Venceu ' : 'Termina ') + dataCurta(b.fim) + (b.n >= 0 && b.n <= 30 && b.rot === 'Execução' ? ' · avaliar aditivo' : ''), n: Math.abs(b.n), u: b.n < 0 ? 'dias atrás' : b.n === 1 ? 'dia' : 'dias', href: '#/registro/' + r.id, dc: b.n < 0 ? 'er' : b.n <= 30 ? 'al' : 'ok' });
      }
    }
    for (const m of d.medicoes) {
      if (m.status === 'concluida') continue;
      const r = d.porId.get(m.registroId); if (!r) continue;
      out.push({ grupo: 'rasc', ord: 1, ic: 'regua', c: 'in', t: (m.numero || '?') + 'ª medição · ' + (r.apelido || ''), d: 'Rascunho · período ' + dMes(m.periodo_inicio) + ' a ' + dMes(m.periodo_fim), n: '—', u: 'concluir', href: '#/medicao/' + m.id });
    }
    return out.sort((a, b) => a.ord - b.ord);
  }
  // o que aparece em "Hoje · precisa de atenção"
  const itensAtencao = (d) => itensPrazo(d).filter((p) => p.grupo === 'venc' || p.grupo === 'aniv' || p.grupo === 'rasc' || (p.grupo === 'prox' && (p.ic !== 'relogio' || p.c === 'al'))).slice(0, 10);
  function liPrazo(p) {
    return h('a', { class: nc('li'), href: p.href || null },
      h('span', { class: nc('ic ' + (p.c || '')) }, ico(p.ic)),
      h('span', { class: nc('c') }, h('span', { class: nc('t') }, p.t), h('span', { class: nc('d') }, p.d)),
      p.n !== '' && p.n != null ? h('span', { class: nc('dir ' + (p.dc != null ? p.dc : p.c || '')) }, h('span', { class: nc('n num') }, String(p.n)), h('span', { class: nc('u') }, p.u || '')) : null,
      p.n === '' ? ico('dir', 'seta') : null);
  }

  /* ---------- agenda da semana (toque num dia para ver o que vence nele) ---------- */
  const agenda = { off: 0, sel: null };
  function eventosDia(d, di) {
    const ev = [];
    for (const n of d.notifs) {
      if (n.status !== 'emitida' || !n.enviadaEm || (n.respondidaEm && !rodadaAberta(n)) || prazoDe(n) !== di) continue;
      const r = d.porId.get(n.registroId);
      ev.push({ ic: 'sino', c: 'al', t: 'Vence a resposta da ' + (n.ordinal || '?') + 'ª notificação', d: (r.apelido || '') + ' · ' + (r.n_nome || ''), n: '', href: '#/notificacao/' + n.id });
    }
    for (const r of d.regs) {
      const rot = ROTULO[r.tipo] + ' nº ' + (r.numero || '—');
      if (r.tipo === 'contrato' && r.prazo_execucao === di) ev.push({ ic: 'relogio', c: 'er', t: 'Termina a execução · ' + r.apelido, d: rot + (encerrada(r) ? '' : ' · avaliar aditivo'), n: '', href: '#/registro/' + r.id });
      if (r.vigencia === di) ev.push({ ic: 'doc', c: 'er', t: 'Termina a vigência · ' + r.apelido, d: rot, n: '', href: '#/registro/' + r.id });
      const an = proxAniv(r);
      if (an && an.iso === di) ev.push({ ic: 'cal', c: 'acc', t: 'Aniversário do contrato · ' + r.apelido, d: an.anos + 'º ano · pode haver reajuste' + (r.aniv_indice ? ' (' + r.aniv_indice + ')' : ''), n: '', href: '#/registro/' + r.id });
    }
    const fer = feriados();
    if (fer.has(di) || fer.has(di.slice(5))) ev.push({ ic: 'cal', c: 'in', t: nomeFeriado(di) || 'Feriado', d: 'Feriado · não conta nos prazos em dias úteis', n: '', href: pode.admin() ? '#/config' : null });
    for (const v of d.visitas) {
      if (v.data !== di) continue;
      const r = d.porId.get(v.registroId);
      ev.push({ ic: v.status === 'concluida' ? 'cam' : 'play', c: v.status === 'concluida' ? 'ok' : 'er', t: 'Visita nº ' + v.numero + ' · ' + (r.apelido || ''), d: (v.status === 'concluida' ? 'Concluída' : 'Em andamento') + ' · por ' + (nomeDe(v.criadoPor) || '—'), n: '', href: '#/visita/' + v.id, visita: true });
    }
    return ev;
  }
  function agendaSemana(d, at) {
    const box = h('div', { class: nc('agenda') });
    const desenhar = () => {
      const hojeI = X.hojeISO(), sel = agenda.sel || hojeI;
      const base = dataD(hojeI);
      const dias = Array.from({ length: 7 }, (_, i) => { const x = new Date(base); x.setDate(x.getDate() + agenda.off * 7 + i); return x; });
      const cab = dias[0].getDate() + (dias[0].getMonth() !== dias[6].getMonth() ? ' de ' + MESES[dias[0].getMonth()] : '') + ' a ' + dias[6].getDate() + ' de ' + MESES[dias[6].getMonth()];
      const ir = (fn) => () => { fn(); desenhar(); };
      const dSel = dataD(sel), evs = eventosDia(d, sel), ehHoje = sel === hojeI, dist = diasAte(sel);
      const tit = ehHoje ? 'Hoje · o que precisa de atenção' : DIAS_L[dSel.getDay()].replace('-feira', '').replace(/^./, (c) => c.toUpperCase()) + ', ' + dSel.getDate() + ' de ' + MESES[dSel.getMonth()] + ' · ' + (dist > 0 ? 'daqui a ' + plural(dist, 'dia', 'dias') : 'há ' + plural(-dist, 'dia', 'dias'));
      const lista = ehHoje ? at.concat(evs.filter((e) => !e.visita)) : evs;
      rc(box,
        h('div', { class: nc('sem-cab') },
          h('button', { class: nc('ic-bt'), 'aria-label': 'Semana anterior', onclick: ir(() => { agenda.off--; }) }, ico('voltar')),
          h('b', {}, cab),
          agenda.off || !ehHoje ? h('button', { class: 'btn peq', onclick: ir(() => { agenda.off = 0; agenda.sel = null; }) }, 'Hoje') : null,
          h('button', { class: nc('ic-bt'), 'aria-label': 'Próxima semana', onclick: ir(() => { agenda.off++; }) }, ico('dir'))),
        h('div', { class: nc('semana') }, dias.map((x) => {
          const di = isoDe(x), ev = eventosDia(d, di), cores = [...new Set(ev.map((e) => e.c))];
          if (di === hojeI && at.length) cores.unshift('er');
          return h('button', { class: nc((di === sel ? 'sel ' : '') + (di === hojeI ? 'hoje ' : '') + (x.getDay() % 6 ? '' : 'fds')), 'aria-label': x.getDate() + ' de ' + MESES[x.getMonth()], onclick: ir(() => { agenda.sel = di; }) },
            DIAS_C[x.getDay()], h('b', { class: nc('num') }, String(x.getDate())),
            h('div', { class: nc('p') }, [...new Set(cores)].slice(0, 3).map((c) => h('i', { style: { background: 'var(--' + (c || 'txt2') + ')' } }))));
        })),
        h('div', { class: nc('sem-tit') }, tit),
        h('div', { class: nc('lista'), style: { boxShadow: 'none', border: '0', background: 'none' } }, lista.length ? lista.map(liPrazo) : h('div', { class: nc('vazio'), style: { textAlign: 'left' } }, ehHoje ? 'Nada pendente para hoje. 👍' : 'Nada vence neste dia.')));
    };
    desenhar();
    return box;
  }

  function bannerAniv(d) {
    const l = d.regs.map((r) => ({ r, an: proxAniv(r) })).filter((x) => x.an && x.an.perto).sort((a, b) => a.an.n - b.an.n);
    if (!l.length) return null;
    return h('div', { class: nc('card ban-aniv') },
      h('div', { class: nc('ban-cab') }, ico('cal'), h('b', {}, l.length === 1 ? '1 contrato faz aniversário em até 60 dias' : l.length + ' contratos fazem aniversário em até 60 dias')),
      h('div', { class: nc('ban-sub') }, 'Prepare a análise do reajuste antes da data-base.'),
      l.map(({ r, an }) => h('a', { class: nc('ban-li'), href: '#/registro/' + r.id },
        h('span', { class: nc('ban-n') }, h('b', { class: nc('num') }, String(an.n)), h('small', {}, an.n === 1 ? 'dia' : 'dias')),
        h('span', { class: nc('c') }, h('b', {}, r.apelido || ''), h('span', {}, an.anos + 'º ano em ' + dataCurta(an.iso) + (r.aniv_indice ? ' · ' + r.aniv_indice : ''))),
        ico('dir', 'seta'))));
  }

  /* ---------- cartão da visita em andamento ---------- */
  function cartaoVivo(v, r, nFotos, nIrr, pc) {
    if (!v) {
      if (!pode.coletar()) return null;
      return h('div', { class: nc('card vivo-vazio') },
        h('span', { class: nc('ic acc'), style: { width: '44px', height: '44px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'var(--acc-bg)', color: 'var(--acc)', flex: 'none' } }, ico('cam')),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('b', {}, 'Nenhuma visita aberta'), h('div', { class: nc('sub') }, 'Escolha a obra e comece a visita.')),
        h('a', { class: 'btn pri peq', href: '#/coleta' }, 'Iniciar'));
    }
    const rel = h('span', { class: nc('num') }, tempoVisita(v));
    const card = h('div', { class: nc('card vivo') },
      h('div', { class: nc('rot') }, 'Visita em andamento · ', rel),
      h('h3', {}, r.apelido || ''),
      h('div', { class: nc('meta') }, 'Visita nº ' + v.numero + ' · iniciada ' + (v.data === X.hojeISO() ? 'às ' : 'em ' + dataCurta(v.data) + ' às ') + (v.hora_inicio || '—')),
      h('div', { class: nc('stats') },
        h('div', {}, h('b', { class: nc('num') }, String(nFotos)), h('span', {}, 'fotos')),
        h('div', {}, h('b', { class: nc('num') }, String(nIrr)), h('span', {}, 'irregularidades')),
        h('div', {}, h('b', {}, String(v.observacoes || '').trim() ? '✓' : '—'), h('span', {}, 'observações'))),
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('a', { class: nc('btn') + ' ' + nc('cheio'), style: { flex: 1 }, href: '#/visita/' + v.id }, ico('play'), 'Continuar visita'),
        pc ? null : prefCamera() === 'aparelho'
          ? h('label', { class: nc('btn sec2'), style: { position: 'relative', overflow: 'hidden' }, 'aria-label': 'Abrir câmera' }, ico('cam'), (() => { const i = inputCameraVisita(() => v); i.style.cssText = 'position:absolute;inset:0;opacity:0;width:100%'; return i; })())
          : h('button', { class: nc('btn sec2'), 'aria-label': 'Abrir câmera', onclick: () => abrirCameraVisita(v.id) }, ico('cam'))));
    // relógio da visita
    const t = setInterval(() => { if (!document.body.contains(card)) { clearInterval(t); return; } rel.textContent = tempoVisita(v); }, 20000);
    return card;
  }
  function tempoVisita(v) {
    const ini = quandoDe(v.data, v.hora_inicio || '00:00');
    const s = Math.max(0, Math.floor((Date.now() - ini) / 1000));
    if (s > 86400) return Math.floor(s / 86400) + 'd ' + String(Math.floor(s / 3600) % 24).padStart(2, '0') + 'h';
    return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0');
  }

  /* ---------- botão da câmera no centro da barra ---------- */
  // com a visita aberta: abre a câmera direto (do app ou do celular, conforme Ajustes); sem visita: escolher a obra
  function abrirCameraVisita(vid) {
    try { sessionStorage.setItem('abrir_camera', vid); } catch (e) { /* */ }
    if (location.hash === '#/visita/' + vid) rotear(); else location.hash = '#/visita/' + vid;
  }
  let navVisita = null;
  async function atualizarNavCam() {
    const bt = document.getElementById('nav-cam');
    if (!bt) return;
    const v = pode.coletar() ? await visitaAbertaMinha() : null;
    navVisita = v;
    bt.classList.toggle('ativa', !!v);
    const txt = document.getElementById('nav-cam-t');
    if (txt) txt.textContent = v ? 'Visita aberta' : 'Iniciar visita';
    bt.setAttribute('aria-label', v ? 'Foto na visita aberta' : 'Iniciar visita');
    // câmera do celular: o próprio botão abre a câmera (o navegador só abre a câmera num toque direto)
    let inp = bt.querySelector('input');
    const celular = v && prefCamera() === 'aparelho' && !matchMedia('(min-width: 1024px)').matches;
    if (celular && !inp) bt.appendChild(inputCameraVisita(() => navVisita));
    else if (!celular && inp) inp.remove();
  }
  // <input> da câmera do próprio celular que grava as fotos na visita aberta (de qualquer tela)
  function inputCameraVisita(qual) {
    const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Abrir a câmera do celular' });
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('change', () => {
      const fs = Array.from(inp.files || []); inp.value = '';
      const v = qual();
      if (!fs.length || !v) return;
      App._fotosNativas = { visitaId: v.id, arquivos: fs, irregular: false };
      if (location.hash === '#/visita/' + v.id) rotear(); else location.hash = '#/visita/' + v.id;
    });
    return inp;
  }
  App.atualizarNavCam = atualizarNavCam;
  const navCam = document.getElementById('nav-cam');
  navCam.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navCam.click(); } });
  navCam.addEventListener('click', (e) => {
    if (navCam.querySelector('input')) return; // a câmera do celular abre pelo próprio campo
    e.preventDefault();
    if (!pode.coletar()) { toast('Seu perfil permite apenas consulta.'); return; }
    if (navVisita && !matchMedia('(min-width: 1024px)').matches) abrirCameraVisita(navVisita.id);
    else if (navVisita) location.hash = '#/visita/' + navVisita.id;
    else location.hash = '#/coleta';
  });

  /* ---------- Início ---------- */
  function saudacao() {
    const hr = new Date().getHours();
    const nome = String(meuNome() || '').replace(/^(Eng\.|Arq\.)\s*/i, '').split(/\s+/)[0];
    return (hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite') + (nome && nome !== 'Este' && !/@/.test(nome) ? ', ' + nome : '');
  }
  async function telaInicio() {
    const tk = rotaSeq;
    titulo(saudacao());
    const d = await carregarPainel();
    const hoje = dataD(X.hojeISO());
    const v = minhasAbertas(d.visitas)[0];
    let nF = 0, nI = 0;
    if (v) { const fs = (await DB.byIndex('fotos', 'visitaId', v.id)).filter((f) => !f.excluido); nF = fs.length; nI = fs.filter((f) => f.irregular).length; }
    const at = itensAtencao(d);
    const pc = matchMedia('(min-width: 1024px)').matches;
    const sub = h('div', { class: nc('sub') + ' ' + nc('saud') }, DIAS_L[hoje.getDay()] + ', ' + hoje.getDate() + ' de ' + MESES[hoje.getMonth()] + ' de ' + hoje.getFullYear());

    // perto de você: distância (GPS do aparelho) até cada obra, pela coordenada das fotos tiradas nela
    // (ou da visita); sem GPS (computador, permissão negada, obra sem coordenada) mostra as visitadas por último
    const perto = h('div', { class: nc('perto') });
    const titPerto = h('h2', {}, 'Visitadas recentemente');
    const ultimaVis = new Map();
    for (const x of d.visitas) { const u = ultimaVis.get(x.registroId); if (!u || String(x.data) > String(u.data)) ultimaVis.set(x.registroId, x); }
    const candidatas = d.regs.filter((r) => !encerrada(r) && !(v && v.registroId === r.id));
    let recentesCache = [];
    try { recentesCache = await DB.kvGet('coletaRecentes', []); } catch (e) { /* */ }
    const desenharPerto = (pos, coord, aviso) => {
      let l = [];
      if (pos && coord) l = candidatas.filter((r) => coord[r.id]).map((r) => ({ r, km: distKm(pos, coord[r.id]) })).sort((a, b) => a.km - b.km).slice(0, 2);
      const comGps = l.length > 0;
      if (!comGps) {
        const rec = recentesCache.map((id) => candidatas.find((r) => r.id === id)).filter(Boolean);
        const outras = candidatas.filter((r) => !rec.includes(r) && ultimaVis.has(r.id)).sort((a, b) => String(ultimaVis.get(b.id).data).localeCompare(ultimaVis.get(a.id).data));
        l = rec.concat(outras).slice(0, 2).map((r) => ({ r, km: null }));
      }
      rc(titPerto, comGps ? 'Perto de você' : 'Visitadas recentemente');
      rc(perto, l.map(({ r, km }, i) => {
        const u = ultimaVis.get(r.id);
        return h('div', { class: nc('card') },
          h('div', { class: nc('dist') }, ico(km != null ? 'pin' : 'relogio'), h('span', { class: nc('num') }, km != null ? (km < 1 ? Math.round(km * 1000) + ' m' : (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)) + ' km') : (u ? 'última ' + dataCurta(u.data) : 'sem visita'))),
          h('div', { class: nc('t') }, r.apelido || ''),
          h('div', { class: nc('sub') }, 'Visita ' + (u ? haQuanto(u.data) : 'nunca feita')),
          h('a', { class: 'btn ' + (i ? '' : 'pri'), href: '#/coleta/' + r.id }, 'Iniciar visita'));
      }), aviso ? h('div', { class: nc('dica'), style: { gridColumn: '1 / -1' } }, aviso) : null);
      if (!l.length) rc(perto, h('div', { class: nc('dica'), style: { gridColumn: '1 / -1' } }, aviso || 'Nenhuma visita feita ainda. Comece pelo botão da câmera.'));
    };
    desenharPerto(null);
    if (pode.coletar() && !pc && 'geolocation' in navigator) {
      (async () => {
        let estado = 'prompt';
        try { if (navigator.permissions && navigator.permissions.query) estado = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { /* */ }
        if (estado === 'denied') { desenharPerto(null, null, 'Para ver as obras mais perto, libere a localização para o app.'); return; }
        desenharPerto(null, null, 'Procurando sua localização…'); rc(titPerto, 'Perto de você');
        const [pos, coord] = await Promise.all([Foto.posicaoAtual(300000), coordenadasObras(d, candidatas)]);
        if (tk !== rotaSeq) return;
        const semCoord = candidatas.filter((r) => !coord[r.id]).length;
        desenharPerto(pos, coord, !pos ? 'Localização indisponível agora — mostrando as visitadas por último.' : semCoord === candidatas.length ? 'As obras ganham localização na primeira visita com fotos (GPS).' : '');
      })().catch((e) => console.warn('perto', e));
    }

    const blocoAgenda = h('div', { class: nc('card'), style: { padding: '12px' } }, agendaSemana(d, at));
    const ban = bannerAniv(d);
    const vivo = cartaoVivo(v, v ? d.porId.get(v.registroId) : null, nF, nI, pc);
    const secPerto = pode.coletar() && candidatas.length ? [h('div', { class: nc('sec') }, titPerto, h('a', { class: nc('lk'), href: '#/obras' }, 'Todas as obras')), perto] : [];
    if (!pc) {
      rcT(tk, h('div', { class: nc('pag') }, sub, vivo, secPerto, ban, h('div', { class: nc('sec') }, h('h2', {}, 'Agenda e atenção'), h('a', { class: nc('lk'), href: '#/prazos' }, 'Prazos')), blocoAgenda));
      return;
    }
    // computador: indicadores, agenda e atividade recente
    const exec = d.regs.filter((r) => /execu/i.test(r.status_obra || ''));
    const mes = X.hojeISO().slice(0, 7);
    const vMes = d.visitas.filter((x) => String(x.data).slice(0, 7) === mes);
    const tipoDe = (x) => (d.porId.get(x.registroId) || {}).tipo;
    const div = (c, cv) => h('div', { class: nc('kpi-div') }, plural(c, 'contrato', 'contratos') + ' · ' + plural(cv, 'convênio', 'convênios'));
    const ag = d.notifs.filter((n) => ['aguardando', 'vencida'].includes(situacaoNotif(n).k));
    const vencN = ag.filter((n) => situacaoNotif(n).k === 'vencida').length;
    const medR = d.medicoes.filter((m) => m.status !== 'concluida');
    const kpis = h('div', { class: nc('kpis') },
      h('a', { class: nc('card kpi'), href: '#/obras' }, h('span', {}, 'Obras em execução'), h('b', { class: nc('num') }, String(exec.length)), h('small', {}, 'de ' + d.regs.length + ' cadastradas'), div(exec.filter((r) => r.tipo === 'contrato').length, exec.filter((r) => r.tipo === 'convenio').length)),
      h('div', { class: nc('card kpi') }, h('span', {}, 'Visitas em ' + MESES[hoje.getMonth()]), h('b', { class: nc('num') }, String(vMes.length)), h('small', {}, plural(vMes.filter((x) => x.status !== 'concluida').length, 'em andamento', 'em andamento')), div(vMes.filter((x) => tipoDe(x) === 'contrato').length, vMes.filter((x) => tipoDe(x) === 'convenio').length)),
      h('a', { class: nc('card kpi'), href: '#/notificacoes' }, h('span', {}, 'Notificações aguardando'), h('b', { class: nc('num') }, String(ag.length)), h('small', { class: vencN ? nc('er') : '' }, vencN ? plural(vencN, 'com prazo encerrado', 'com prazo encerrado') : 'nenhuma com prazo encerrado')),
      h('a', { class: nc('card kpi'), href: '#/prazos' }, h('span', {}, 'Medições em rascunho'), h('b', { class: nc('num') }, String(medR.length)), h('small', {}, medR.length ? 'concluir e gerar Word/Excel' : 'nenhuma pendente')));
    const recentes = atividadeRecente(d).slice(0, 6);
    rcT(tk, h('div', { class: nc('pag larga') }, sub, kpis,
      h('div', { class: nc('g2'), style: { marginTop: '18px' } },
        h('div', {}, h('div', { class: nc('sec'), style: { marginTop: 0 } }, h('h2', {}, 'Precisa de atenção'), h('a', { class: nc('lk'), href: '#/prazos' }, 'Ver todos os prazos')), blocoAgenda),
        h('div', {},
          ban ? [h('div', { class: nc('sec'), style: { marginTop: 0 } }, h('h2', {}, 'Reajuste')), ban] : null,
          h('div', { class: nc('sec'), style: ban ? null : { marginTop: 0 } }, h('h2', {}, 'Visita em andamento')), vivo,
          secPerto,
          recentes.length ? [h('div', { class: nc('sec') }, h('h2', {}, 'Atividade recente')), h('div', { class: nc('lista') }, recentes.map(liPrazo))] : null))));
  }
  /* Coordenada de cada obra: a mediana das fotos com GPS da visita mais recente (as fotos são tiradas na obra;
     o início da visita pode ter sido marcado fora dela); sem fotos, a da visita. Guardada no aparelho e refeita
     quando há visita nova. */
  async function coordenadasObras(d, regs) {
    let cache = {};
    try { cache = (await DB.kvGet('coordObras', {})) || {}; } catch (e) { /* */ }
    const med = (l) => { const s = l.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const out = {};
    let mudou = false;
    for (const r of regs) {
      const vs = d.visitas.filter((x) => x.registroId === r.id).sort((a, b) => String(b.data).localeCompare(a.data));
      const chave = vs.map((x) => x.id + (x.atualizadoEm || '')).slice(0, 3).join('|');
      const c = cache[r.id];
      if (c && c.chave === chave && c.lat != null) { out[r.id] = c; continue; }
      if (c && c.chave === chave) continue; // já procurou e não tem coordenada
      let lat = null, lng = null;
      try {
        const fs = (await DB.byIndex('fotos', 'registroId', r.id)).filter((f) => !f.excluido && f.lat != null && f.lng != null && (f.precisao == null || f.precisao <= 100));
        if (fs.length) {
          const ult = fs.slice().sort((a, b) => String(b.dataHora).localeCompare(a.dataHora));
          const daVis = ult[0].visitaId ? ult.filter((f) => f.visitaId === ult[0].visitaId) : ult.slice(0, 15);
          lat = med(daVis.map((f) => f.lat)); lng = med(daVis.map((f) => f.lng));
        }
      } catch (e) { /* */ }
      if (lat == null) { const vc = vs.find((x) => x.lat != null && x.lng != null); if (vc) { lat = vc.lat; lng = vc.lng; } }
      cache[r.id] = { chave, lat, lng };
      if (lat != null) out[r.id] = cache[r.id];
      mudou = true;
    }
    if (mudou) { try { await DB.kvSet('coordObras', cache); } catch (e) { /* */ } }
    return out;
  }
  function distKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function atividadeRecente(d) {
    const ev = [];
    for (const v of d.visitas) { const r = d.porId.get(v.registroId); ev.push({ q: quandoDe(v.data, v.hora_inicio), ic: v.status === 'concluida' ? 'cam' : 'play', c: v.status === 'concluida' ? 'ok' : 'er', t: 'Visita nº ' + v.numero + (v.status === 'concluida' ? ' concluída' : ' em andamento'), d: (r.apelido || '') + ' · ' + (nomeDe(v.criadoPor) || ''), href: '#/visita/' + v.id }); }
    for (const n of d.notifs) {
      if (n.status !== 'emitida') continue;
      const r = d.porId.get(n.registroId);
      ev.push({ q: new Date(n.respondidaEm ? n.respondidaEm + 'T12:00:00' : n.enviadaEm ? n.enviadaEm + 'T12:00:00' : n.emitidaEm || n.criadoEm), ic: n.respondidaEm ? 'resp' : n.enviadaEm ? 'envio' : 'sino', c: 'acc', t: (n.ordinal || '?') + 'ª notificação ' + (n.respondidaEm ? 'respondida' : n.enviadaEm ? 'enviada' : 'emitida'), d: (r.apelido || '') + ' · ' + (r.n_nome || ''), href: '#/notificacao/' + n.id });
    }
    for (const m of d.medicoes) { const r = d.porId.get(m.registroId); ev.push({ q: new Date(m.atualizadoEm || m.criadoEm), ic: 'regua', c: m.status === 'concluida' ? 'ok' : 'in', t: (m.numero || '?') + 'ª medição ' + (m.status === 'concluida' ? 'concluída' : 'em rascunho'), d: r.apelido || '', href: '#/medicao/' + m.id }); }
    return ev.filter((e) => !isNaN(e.q)).sort((a, b) => b.q - a.q).map((e) => Object.assign(e, { n: quandoTxt(e.q).replace(' às ', ' · '), u: '', dc: '' }));
  }

  /* ---------- Obras (contratos e convênios juntos) ---------- */
  function cartaoObra(r, ctx, opc) {
    opc = opc || {};
    const ns = ctx.notifsPor.get(r.id) || [];
    const sits = ns.map(situacaoNotif);
    const aberta = ctx.abertas.find((v) => v.registroId === r.id);
    const u = ctx.ultimaVis.get(r.id);
    const an = proxAniv(r);
    const os = r.tipo === 'contrato' && String(r.os_numero || '').trim();
    const barras = barrasDe(r);
    const ir = () => { location.hash = '#/registro/' + r.id; };
    return h('div', { class: nc('card obra' + (opc.sel ? ' sel' : '')) + ' item-obra', role: 'link', tabindex: '0', 'data-id': r.id, onclick: ir, onkeydown: (e) => { if (e.key === 'Enter') ir(); } },
      h('div', { class: nc('t') }, r.apelido || '(sem nome)', r._pendente ? h('span', { class: 'pend', title: 'Aguardando sincronização' }) : null),
      h('div', { class: nc('d') }, ROTULO[r.tipo] + ' nº ' + (r.numero || '—') + (r.n_nome ? ' · ' + r.n_nome : '')),
      h('div', { class: nc('etqs') },
        h('span', { class: nc('etq ponto ' + corSt(r)) }, r.status_obra || 'Sem status'),
        os ? h('span', { class: nc('etq acc') }, 'O.S. nº ' + os) : null,
        r.tipo === 'convenio' ? h('span', { class: nc('etq in') }, 'Convênio') : null,
        sits.some((s) => s.k === 'vencida') ? h('span', { class: nc('etq er') }, 'Notificação vencida') : sits.some((s) => s.k === 'aguardando') ? h('span', { class: nc('etq al') }, 'Notificação aguardando') : null,
        aberta ? h('span', { class: nc('etq er ponto') }, 'Visita aberta') : null,
        an && an.perto ? h('span', { class: nc('etq aniv-chip') }, ico('cal'), 'Aniversário ' + an.txt) : null),
      barras.length ? h('div', { class: nc('prazos-c'), style: barras.length === 1 ? { gridTemplateColumns: '1fr' } : null }, barras.map((b) => blocoBarra(b))) : null,
      opc.compacto ? null : h('div', { class: nc('rod') },
        h('span', {}, u ? 'Última visita ' + haQuanto(u.data) : 'Nenhuma visita'),
        pode.coletar() ? h('button', { class: nc('acao'), onclick: (e) => { e.stopPropagation(); location.hash = aberta ? '#/visita/' + aberta.id : '#/coleta/' + r.id; } }, ico(aberta ? 'play' : 'cam'), aberta ? 'Continuar' : 'Visitar') : null));
  }
  function contextoObras(d) {
    const notifsPor = new Map();
    for (const n of d.notifs) { if (!notifsPor.has(n.registroId)) notifsPor.set(n.registroId, []); notifsPor.get(n.registroId).push(n); }
    const ultimaVis = new Map();
    for (const x of d.visitas) { const u = ultimaVis.get(x.registroId); if (!u || String(x.data) > String(u.data)) ultimaVis.set(x.registroId, x); }
    return { notifsPor, ultimaVis, abertas: minhasAbertas(d.visitas) };
  }
  const urgencia = (r) => { if (encerrada(r)) return 1e6; const ns = barrasDe(r).map((b) => b.n); return ns.length ? Math.min(...ns) : 1e5; };
  const semAcento = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function filtrarObras(regs, f) {
    const q = semAcento(f.busca || '');
    const l = regs.filter((r) => (f.tipo === 'todas' || !f.tipo || (f.tipo === 'vencendo' ? !encerrada(r) && barrasDe(r).some((b) => b.n <= 30) : r.tipo === f.tipo)) &&
      (!f.status || (f.status === '__sem' ? !r.status_obra : r.status_obra === f.status)) &&
      (!q || semAcento([r.apelido, r.numero, r.n_nome, r.objeto, r.processo, r.status_obra, r.local_obra, r.os_numero ? 'os ' + r.os_numero + ' o.s. ' + r.os_numero : ''].join(' ')).includes(q)));
    return f.ordem === 'nome' ? l.sort((a, b) => String(a.apelido || '').localeCompare(b.apelido || '')) : l.sort((a, b) => urgencia(a) - urgencia(b) || String(a.apelido || '').localeCompare(b.apelido || ''));
  }
  const filtroObras = () => { try { return JSON.parse(sessionStorage.getItem('filtro_obras') || 'null') || { tipo: 'todas', status: '', ordem: 'prazo', busca: '' }; } catch (e) { return { tipo: 'todas', status: '', ordem: 'prazo', busca: '' }; } };
  const guardarFiltroObras = (f) => { try { sessionStorage.setItem('filtro_obras', JSON.stringify(f)); } catch (e) { /* */ } };
  async function telaObras(tipoForcado) {
    const tk = rotaSeq;
    titulo('Obras');
    const d = await carregarPainel();
    const ctx = contextoObras(d);
    const f = filtroObras();
    if (tipoForcado) { f.tipo = tipoForcado; f.status = ''; guardarFiltroObras(f); }
    const regs = d.regs;
    const busca = h('input', { type: 'search', placeholder: 'Obra, contrato, O.S., empresa, cidade', value: f.busca || '', 'aria-label': 'Buscar obra' });
    const chips = h('div', { class: nc('chips') });
    const selSt = h('select', { 'aria-label': 'Status', onchange: () => { f.status = selSt.value; guardarFiltroObras(f); desenhar(); } });
    const selOrd = h('select', { 'aria-label': 'Ordem', onchange: () => { f.ordem = selOrd.value; guardarFiltroObras(f); desenhar(); } },
      h('option', { value: 'prazo' }, 'Por prazo (mais urgente primeiro)'), h('option', { value: 'nome' }, 'Por nome'));
    selOrd.value = f.ordem || 'prazo';
    const lista = h('div', { class: nc('pilha lista-obras') + ' lista-obras', style: { marginTop: '12px' } });
    const sub = h('div', { class: nc('sub'), style: { margin: '0 2px 10px' } });
    const desenhar = () => {
      const tipos = [['todas', 'Todas', regs.length], ['contrato', 'Contratos', regs.filter((r) => r.tipo === 'contrato').length], ['convenio', 'Convênios', regs.filter((r) => r.tipo === 'convenio').length], ['vencendo', 'Vencendo', regs.filter((r) => !encerrada(r) && barrasDe(r).some((b) => b.n <= 30)).length]];
      rc(chips, tipos.map(([k, t, n]) => h('button', { class: nc('chip' + (f.tipo === k ? ' on' : '')), onclick: () => { f.tipo = k; f.status = ''; guardarFiltroObras(f); desenhar(); } }, t, h('span', { class: nc('q') }, String(n)))));
      // status: só os que existem no tipo escolhido
      const base = regs.filter((r) => f.tipo === 'todas' || f.tipo === 'vencendo' || r.tipo === f.tipo);
      const nomes = [...new Set(base.map((r) => r.status_obra).filter(Boolean))];
      rc(selSt, h('option', { value: '' }, 'Todos os status (' + base.length + ')'),
        nomes.map((st) => h('option', { value: st }, st + ' (' + base.filter((r) => r.status_obra === st).length + ')')),
        base.some((r) => !r.status_obra) ? h('option', { value: '__sem' }, 'Sem status informado (' + base.filter((r) => !r.status_obra).length + ')') : null);
      selSt.value = f.status || '';
      if (selSt.selectedIndex < 0) { selSt.value = ''; f.status = ''; }
      const l = filtrarObras(regs, f);
      rc(sub, plural(regs.filter((r) => r.tipo === 'contrato').length, 'contrato', 'contratos') + ' · ' + plural(regs.filter((r) => r.tipo === 'convenio').length, 'convênio', 'convênios') + (f.ordem === 'nome' ? ' · por nome' : ' · por prazo'));
      rc(lista, l.length ? l.map((r) => cartaoObra(r, ctx)) : h('div', { class: 'vazio' }, regs.length ? 'Nenhuma obra encontrada.' : 'Nenhum contrato ou convênio cadastrado ainda.',
        pode.cadastro() && !regs.length ? h('div', { style: { marginTop: '12px' } }, h('a', { class: 'btn pri', href: '#/novo/contrato' }, '+ Cadastrar contrato'), ' ', h('a', { class: 'btn', href: '#/novo/convenio' }, '+ Cadastrar convênio')) : null));
    };
    let tBusca = null;
    busca.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(() => { f.busca = busca.value; guardarFiltroObras(f); desenhar(); }, 120); });
    desenhar();
    rcT(tk, h('div', { class: nc('pag larga') }, sub, h('div', { class: nc('busca') }, ico('busca'), busca), chips, h('div', { class: nc('filtros') }, selSt, selOrd), lista));
    if (pode.cadastro()) document.body.appendChild(h('button', { class: 'fab', title: 'Cadastrar obra', 'aria-label': 'Cadastrar obra', onclick: escolherTipoNovo }, '+'));
  }
  async function escolherTipoNovo() {
    const t = await modal('Cadastrar obra', h('p', { class: 'sub' }, 'O que você vai cadastrar?'), [{ txt: 'Cancelar', valor: null }, { txt: 'Convênio', valor: 'convenio' }, { txt: 'Contrato', cls: 'pri', valor: 'contrato' }]);
    if (t) location.hash = '#/novo/' + t;
  }

  /* ---------- Prazos ---------- */
  function segPrazos(ativo, nNotif) {
    return h('div', { class: nc('seg'), style: { marginBottom: '6px' } },
      h('button', { class: ativo === 'agenda' ? nc('on') : '', onclick: () => { if (ativo !== 'agenda') location.hash = '#/prazos'; } }, 'Agenda'),
      h('button', { class: ativo === 'notifs' ? nc('on') : '', onclick: () => { if (ativo !== 'notifs') location.hash = '#/notificacoes'; } }, 'Notificações', nNotif ? h('span', { class: nc('num'), style: { marginLeft: '4px', opacity: '.7' } }, String(nNotif)) : null));
  }
  async function telaPrazos() {
    const tk = rotaSeq;
    titulo('Prazos');
    const d = await carregarPainel();
    const l = itensPrazo(d);
    const nN = d.notifs.filter((n) => ['vencida', 'aguardando', 'nao_enviada'].includes(situacaoNotif(n).k)).length;
    const bl = (t, k) => { const a = l.filter((p) => p.grupo === k); return a.length ? [h('div', { class: nc('sec') }, h('h2', {}, t), h('span', { class: nc('sub') }, String(a.length))), h('div', { class: nc('lista') }, a.map(liPrazo))] : null; };
    const grupos = [bl('Vencidos', 'venc'), bl('Próximos 30 dias', 'prox'), bl('Aniversários de contrato · próximos 60 dias', 'aniv'), bl('Rascunhos a concluir', 'rasc'), bl('Depois', 'depois')];
    rcT(tk, h('div', { class: nc('pag') }, h('div', { class: nc('sub'), style: { margin: '0 2px 10px' } }, 'Contratos, convênios e notificações'), segPrazos('agenda', nN),
      grupos.some(Boolean) ? grupos : h('div', { class: 'vazio' }, 'Nenhum prazo cadastrado. Informe as datas de execução e vigência no cadastro das obras.'),
      h('div', { class: nc('dica'), style: { marginTop: '14px' } }, 'Prazos das notificações em dias úteis (fins de semana e feriados de Ajustes não contam). Execução e vigência em dias corridos.')));
  }

  /* ---------- Mais ---------- */
  async function telaMais() {
    const tk = rotaSeq;
    titulo('Mais');
    const u = App.usuario() || {};
    const abertas = pode.coletar() ? minhasAbertas(await DB.listar('visitas')) : [];
    const it = [
      ['fila', 'Fila de atendimento', 'Convênios na planilha da DRE · só leitura', '#/fila'],
      ['sino', 'Notificações', 'Todas, com filtros por situação', '#/notificacoes'],
      pode.coletar() ? ['cam', 'Visitas em andamento', abertas.length ? plural(abertas.length, 'visita aberta', 'visitas abertas') : 'Escolher a obra e iniciar', '#/coleta'] : null,
      pode.admin() ? ['pessoas', 'Pessoas e acessos', 'Fiscais, coordenadores e perfis', '#/config/pessoas'] : null,
      ['ajustes', 'Ajustes', 'Sincronização, aparência, câmera, modelos, feriados', '#/config'],
    ].filter(Boolean);
    rcT(tk, h('div', { class: nc('pag') },
      h('div', { class: nc('sub'), style: { margin: '0 2px 12px' } }, [u.nome || u.email, { admin: 'Administrador', fiscal: 'Fiscal', consulta: 'Consulta' }[perfil()]].filter(Boolean).join(' · ')),
      h('div', { class: nc('lista') }, it.map(([ic, t, dd, href]) => h('a', { class: nc('li'), href },
        h('span', { class: nc('ic') }, ico(ic)), h('span', { class: nc('c') }, h('span', { class: nc('t') }, t), h('span', { class: nc('d') }, dd)), ico('dir', 'seta'))))));
  }

  /* ================================================================== */
  /* Página da obra (contrato ou convênio)                               */
  /* ================================================================== */
  async function visitasDe(registroId) {
    return (await DB.byIndex('visitas', 'registroId', registroId)).filter((v) => !v.excluido)
      .sort((a, b) => (b.numero || 0) - (a.numero || 0));
  }
  async function atividadesDe(registroId) {
    return (await DB.byIndex('atividades', 'registroId', registroId)).filter((a) => !a.excluido);
  }
  /* Atividade da obra: comentários, termos aditivos e alterações do cadastro, com data, hora e autor.
     (entidade "atividades": sincroniza com o servidor 3.16 / Code.gs versão 14) */
  async function registrarAtividade(registroId, tipo, tituloTxt, texto, extra) {
    const a = Object.assign({ id: DB.uuid(), registroId, tipo, titulo: tituloTxt, texto: texto || '', em: new Date().toISOString(), quemNome: meuNome() }, extra || {});
    await DB.salvar('atividades', a, email());
    return a;
  }
  const ROT_ADIT = { prazo: 'prazo', valor: 'valor', prazo_valor: 'prazo e valor', outro: 'outro' };
  const textoAditivo = (a) => [a.execucao ? 'execução até ' + X.dataBR(a.execucao) : '', a.vigencia ? 'vigência até ' + X.dataBR(a.vigencia) : '', a.valor ? 'R$ ' + X.formatarMoeda(X.parseMoeda(a.valor)) : '', a.data ? 'assinado em ' + X.dataBR(a.data) : '', a.justificativa || ''].filter(Boolean).join(' · ');

  function eventosObra(r, x) {
    const ev = [];
    for (const v of x.visitas) {
      const fv = x.fotos.filter((f) => f.visitaId === v.id), nIrr = fv.filter((f) => f.irregular).length;
      ev.push({ k: 'visita', q: quandoDe(v.data, v.hora_inicio), quem: nomeDe(v.criadoPor), ic: v.status === 'concluida' ? 'cam' : 'play', c: v.status === 'concluida' ? '' : 'er',
        t: 'Visita nº ' + v.numero + (v.status === 'concluida' ? ' · concluída' : ' · em andamento'), s: plural(fv.length, 'foto', 'fotos') + (nIrr ? ' · ⚠️ ' + plural(nIrr, 'irregularidade', 'irregularidades') : ''), fotos: fv.slice(0, 5), href: '#/visita/' + v.id });
    }
    for (const m of x.medicoes) ev.push({ k: 'medicao', q: new Date(m.criadoEm || 0), quem: nomeDe(m.criadoPor), ic: 'regua', c: 'in', t: m.numero + 'ª Medição · ' + (m.status === 'concluida' ? 'concluída' : 'rascunho'), s: 'Período ' + X.dataBR(m.periodo_inicio) + ' a ' + X.dataBR(m.periodo_fim), href: '#/medicao/' + m.id });
    for (const n of x.notifs) {
      const s = situacaoNotif(n);
      ev.push({ k: 'notif', q: new Date(n.emitidaEm || n.criadoEm || 0), quem: nomeDe(n.emitidaPor || n.criadoPor), ic: 'sino', c: COR_N[s.cls] || 'acc', t: (n.ordinal || '?') + 'ª Notificação · ' + s.txt.charAt(0).toLowerCase() + s.txt.slice(1), s: (n.itens && n.itens.length ? plural(n.itens.length, 'item', 'itens') + ' · ' : '') + plural((n.fotos || []).length, 'foto', 'fotos') + (n.enviadaEm ? ' · enviada ' + X.dataBR(n.enviadaEm) : ''), href: '#/notificacao/' + n.id });
    }
    for (const a of x.atividades) ev.push({ k: a.tipo, id: a.id, a, q: new Date(a.em || a.criadoEm || 0), quem: a.quemNome || nomeDe(a.criadoPor), ic: a.tipo === 'comentario' ? 'resp' : a.tipo === 'aditivo' ? 'doc' : a.tipo === 'aditivo_prazo' ? 'relogio' : a.tipo === 'notif_etapa' ? 'sino' : 'lapis', c: a.tipo === 'aditivo' ? 'acc' : a.tipo === 'aditivo_prazo' ? 'al' : a.tipo === 'notif_etapa' ? 'in' : '', t: a.titulo || (a.tipo === 'comentario' ? 'Comentário' : 'Alteração'), s: a.texto, href: a.tipo === 'comentario' ? null : a.notificacaoId ? '#/notificacao/' + a.notificacaoId : '#/registro/' + r.id + '/dados' });
    return ev.sort((a, b) => b.q - a.q);
  }
  function linhaTempo(lista, aoMudar) {
    if (!lista.length) return h('div', { class: nc('vazio'), style: { textAlign: 'left' } }, 'Nada por aqui ainda.');
    return h('div', { class: nc('tl') }, lista.map((e) => {
      if (e.k === 'comentario') {
        const meu = e.a.criadoPor === email() || pode.admin();
        return h('div', { class: nc('ev coment') },
          h('span', { class: nc('ic av') }, iniciais(e.quem)),
          h('div', { class: nc('card') },
            h('div', { class: nc('ev-top') }, h('b', {}, e.quem || '—'),
              meu ? h('button', { class: nc('ev-del'), 'aria-label': 'Apagar comentário', title: 'Apagar comentário', onclick: async () => {
                if (!(await confirmar('Apagar este comentário?', 'Apagar', true))) return;
                await DB.excluir('atividades', e.id, email()); aoMudar();
              } }, ico('lixo')) : null),
            h('div', { class: nc('ev-txt') }, String(e.s || '').split('\n').map((l, i) => [i ? h('br') : null, l])),
            h('div', { class: nc('ev-meta') }, 'Comentário · ' + quandoTxt(e.q))));
      }
      const mini = e.fotos && e.fotos.length ? h('div', { class: nc('mini') }, e.fotos.map((f) => { const i = h('i'); urlFoto(f).then((u) => { if (u) i.style.backgroundImage = 'url("' + u + '")'; }); return i; })) : null;
      const corpo = [h('div', { class: nc('t') }, e.t), e.s ? h('div', { class: nc('d') }, String(e.s).split('\n').map((l, i) => [i ? h('br') : null, l])) : null, mini, h('div', { class: nc('ev-meta') }, quandoTxt(e.q) + (e.quem ? ' · ' + e.quem : ''))];
      return h('div', { class: nc('ev') }, h('span', { class: nc('ic ' + (e.c || '')) }, ico(e.ic)),
        e.href ? h('a', { class: nc('card'), href: e.href }, corpo) : h('div', { class: nc('card') }, corpo));
    }));
  }

  function heroObra(r, abertaAqui) {
    const an = proxAniv(r);
    const os = r.tipo === 'contrato' && String(r.os_numero || '').trim();
    let anivEl = null;
    if (an) {
      anivEl = h('div', { class: nc('aniv' + (an.perto ? ' acc' : '')) },
        an.perto ? h('span', { class: nc('aniv-n') }, h('b', { class: nc('num') }, String(an.n)), h('small', {}, an.n === 1 ? 'dia' : 'dias')) : ico('cal'),
        h('span', {}, h('b', {}, an.perto ? 'Aniversário do contrato' : 'Aniversário ' + an.txt), h('br'),
          an.anos + 'º ano em ' + dataCurta(an.iso) + ' · data-base ' + X.dataBR(r.aniv_data),
          r.aniv_indice ? [h('br'), h('small', {}, 'Reajuste pelo ' + r.aniv_indice)] : null));
    } else if (r.tipo === 'contrato' && !r.aniv_data && !encerrada(r) && pode.cadastro()) {
      anivEl = h('a', { class: nc('aniv vazio'), href: '#/editar/' + r.id }, ico('cal'), h('span', {}, 'Informar a data de aniversário (reajuste)'));
    }
    return h('div', { class: nc('card hero') },
      pode.cadastro() ? h('div', { class: nc('acoes-topo') }, h('a', { class: nc('ic-bt'), href: '#/editar/' + r.id, title: 'Editar cadastro', 'aria-label': 'Editar cadastro' }, ico('lapis'))) : null,
      h('div', { class: nc('etqs') },
        h('span', { class: nc('etq ponto ' + corSt(r)) }, r.status_obra || 'Sem status'),
        os ? h('span', { class: nc('etq acc') }, 'O.S. nº ' + os) : null,
        abertaAqui ? h('span', { class: nc('etq er ponto') }, 'Visita aberta') : null),
      h('h1', {}, r.apelido || ROTULO[r.tipo]),
      h('div', { class: nc('sub') }, [ROTULO[r.tipo] + ' nº ' + (r.numero || '—'), r.n_nome, r.local_obra].filter(Boolean).join(' · ')),
      r.objeto ? h('div', { class: nc('obj') }, '“' + r.objeto + '”') : null,
      barrasDe(r).length ? h('div', { style: { marginTop: '6px' } }, barrasDe(r).map((b) => blocoBarra(b, true))) : null,
      anivEl);
  }

  async function telaRegistro(id, abaUrl) {
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    const r = await DB.get('registros', id);
    if (!r || r.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Cadastro não encontrado.')); return; }
    titulo(r.apelido || ROTULO[r.tipo], true);
    marcarNav('registro');
    const [notifs, fotos, visitas, medicoes, atividades] = await Promise.all([notificacoesDe(id), fotosDe(id), visitasDe(id), r.tipo === 'contrato' ? medicoesDe(id) : [], atividadesDe(id)]);
    const abertas = minhasAbertas(visitas);
    const aberta = abertas[0];
    const ABAS = ['atividade', 'visitas', 'medicoes', 'notif', 'irr', 'fotos', 'dados'];
    let aba = abaUrl && ABAS.includes(abaUrl) ? abaUrl : sessionStorage.getItem('aba_reg2') || 'atividade';
    if (aba === 'medicoes' && r.tipo !== 'contrato') aba = 'atividade';
    const redesenhar = () => { manterRolagem = true; telaRegistro(id, aba).finally(() => { manterRolagem = false; }); };
    const irAba = (k) => { sessionStorage.setItem('aba_reg2', k); aba = k; manterRolagem = true; telaRegistro(id, k).then(() => { manterRolagem = false; const a = document.querySelector('.' + nc('abas')); if (a && a.getBoundingClientRect().top < 60) a.scrollIntoView({ block: 'start' }); }); };

    // fila de atendimento do convênio: fechada até tocar em "Atendimentos"
    let filaAberta = false;
    try { filaAberta = sessionStorage.getItem('fila_aberta_' + id) === '1'; } catch (e) { /* */ }
    const boxFila = h('div', { class: 'fila-convenio-box', style: { display: filaAberta ? '' : 'none' } });
    if (r.tipo === 'convenio') { const c = cartaoFilaConvenio(r); c.classList.add('fila-convenio', nc('fila-c')); boxFila.appendChild(c); }
    // ações rápidas
    const rasc = medicoes.find((m) => m.status !== 'concluida');
    const acao = (icn, txt, onclick, prim) => h('button', { class: prim ? nc('prim') : null, onclick }, h('span', { class: nc('ic') }, ico(icn)), txt);
    const acoes = h('div', { class: nc('acoes') },
      pode.coletar() ? acao(aberta ? 'play' : 'cam', aberta ? 'Continuar' : 'Visita', () => { location.hash = aberta ? '#/visita/' + aberta.id : '#/coleta/' + id; }, true) : null,
      r.tipo === 'contrato' && pode.notificar() ? acao('regua', 'Medição', () => { location.hash = rasc ? '#/medicao/' + rasc.id : '#/nova-medicao/' + id; }) : null,
      r.tipo === 'convenio' ? acao('fila', 'Atendimentos', () => {
        // a fila de atendimento do convênio só aparece depois de tocar no botão (toque de novo para fechar)
        const aberta2 = boxFila.style.display === 'none';
        boxFila.style.display = aberta2 ? '' : 'none';
        try { sessionStorage.setItem('fila_aberta_' + id, aberta2 ? '1' : ''); } catch (e) { /* */ }
        const c = boxFila.firstChild;
        if (aberta2 && c && c.classList.contains('oculto')) { boxFila.style.display = 'none'; location.hash = '#/fila'; return; }
        if (aberta2) setTimeout(() => boxFila.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }) : null,
      pode.notificar() ? acao('sino', 'Notificar', () => { location.hash = '#/nova-notificacao/' + id; }) : null,
      acao('foto', 'Fotos', () => irAba('fotos')));

    const nPend = fotos.filter((f) => f.irregular && situacao(f) === 'pendente').length;
    const abaBt = (k, t, n) => h('button', { class: aba === k ? nc('on') : null, onclick: () => irAba(k) }, t, n != null ? h('span', { class: nc('q') }, String(n)) : null);
    const abas = h('div', { class: nc('abas') },
      abaBt('atividade', 'Atividade'),
      abaBt('visitas', 'Visitas', visitas.length),
      r.tipo === 'contrato' ? abaBt('medicoes', 'Medições', medicoes.length) : null,
      abaBt('notif', 'Notificações', notifs.length),
      abaBt('irr', 'Irregularidades', nPend),
      abaBt('fotos', 'Fotos', fotos.length),
      abaBt('dados', 'Dados'));

    const conteudo = h('div', { class: 'aba-obra' });
    const ev = eventosObra(r, { visitas, notifs, medicoes, fotos, atividades });
    if (aba === 'atividade') {
      const filtro = sessionStorage.getItem('filtro_ativ') || 'tudo';
      const txt = h('textarea', { class: nc('txt'), rows: '1', placeholder: 'Comentar…', 'aria-label': 'Comentário',
        oninput: () => { txt.style.height = 'auto'; txt.style.height = Math.min(220, txt.scrollHeight) + 'px'; } });
      const publicar = async () => {
        const t = txt.value.trim();
        if (!t) { txt.focus(); return; }
        await registrarAtividade(id, 'comentario', 'Comentário', t);
        toast('Comentário publicado');
        redesenhar();
      };
      const caixa = pode.coletar() ? h('div', { class: nc('card com-box') }, h('span', { class: nc('ic av') }, iniciais(meuNome())), txt, h('button', { class: 'btn pri peq', onclick: publicar }, 'Publicar')) : null;
      const fBt = (k, t) => h('button', { class: nc('chip' + (filtro === k ? ' on' : '')), onclick: () => { sessionStorage.setItem('filtro_ativ', k); redesenhar(); } }, t);
      const lista = ev.filter((e) => filtro === 'tudo' || (filtro === 'comentario' && e.k === 'comentario') || (filtro === 'aditivo' && (e.k === 'aditivo' || e.k === 'aditivo_prazo' || e.k === 'edicao')));
      ap(conteudo, caixa, h('div', { class: nc('chips'), style: { margin: '12px 0 0' } }, fBt('tudo', 'Tudo'), fBt('comentario', 'Comentários'), fBt('aditivo', 'Aditivos e edições')), linhaTempo(lista, redesenhar),
        Sync.habilitado() && Sync.versaoServidor && Sync.versaoServidor < 14 && atividades.some((a) => a._pendente) ? h('div', { class: 'aviso', style: { marginTop: '10px' } }, '⚠️ Comentários e histórico ficam neste aparelho até o administrador atualizar o servidor (Code.gs versão 14).') : null);
    } else if (aba === 'visitas') {
      ap(conteudo, h('div', { style: { height: '12px' } }), ...(visitas.length ? visitas.map((v) => {
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
      ap(conteudo, pode.notificar() ? h('div', { class: 'acoes', style: { marginTop: '12px', marginBottom: '10px' } }, h('a', { class: 'btn pri', href: '#/nova-medicao/' + id }, '+ Nova medição')) : h('div', { style: { height: '12px' } }),
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
      ap(conteudo, h('div', { style: { height: '12px' } }), await painelIrregularidades(r));
    } else if (aba === 'notif') {
      ap(conteudo, pode.notificar() ? h('div', { class: 'acoes', style: { marginTop: '12px', marginBottom: '10px' } }, h('a', { class: 'btn pri', href: '#/nova-notificacao/' + id }, '+ Nova notificação')) : h('div', { style: { height: '12px' } }),
        ...(notifs.length ? notifs.map((n) => h('a', { class: 'item', href: '#/notificacao/' + n.id },
          h('span', { class: 'badge ' + (n.status === 'emitida' ? 'emit' : 'rasc') }, n.status === 'emitida' ? 'Emitida' : 'Rascunho'),
          h('div', { class: 't' }, (n.ordinal || '?') + 'ª Notificação', n._pendente ? h('span', { class: 'pend' }) : null),
          h('div', { class: 'd' }, 'Nº ' + (n.numero || (n.status === 'emitida' ? '—' : 'a definir na emissão')) + ' · ' + X.dataBR(n.data)),
          n.status === 'emitida' ? h('div', { class: 'etqs' }, etq(situacaoNotif(n).txt, situacaoNotif(n).cls), n.enviadaEm && !n.respondidaEm ? etq('prazo até ' + X.dataBR(prazoDe(n)) + comHora(n), '') : null) : null,
          h('div', { class: 'd' }, (n.itens && n.itens.length ? n.itens.length + ' item(ns) · ' : '') + ((n.fotos || []).length) + ' foto(s) · por ' + (nomeDe(n.criadoPor) || '—'))))
          : [h('div', { class: 'vazio' }, 'Nenhuma notificação registrada no app para este ' + ROTULO[r.tipo].toLowerCase() + '.',
            r.ultima_notif_anterior ? h('div', { class: 'sub' }, 'Notificações emitidas antes do app: ' + r.ultima_notif_anterior) : null)]));
    } else if (aba === 'fotos') {
      ap(conteudo, h('div', { style: { height: '12px' } }), gradeFotos(fotos, { onclick: (f) => abrirFoto(f, () => telaRegistro(id, 'fotos'), fotos) }));
      if (!fotos.length) ap(conteudo, h('div', { class: 'vazio' }, 'Nenhuma foto coletada.'));
    } else {
      ap(conteudo, dadosObra(r));
    }
    // uso sem internet: fotos em tamanho real das pendências e das visitas recentes
    const boxOffline = h('div', { class: nc('offline') });
    const pintarOffline = async () => {
      if (!Sync.habilitado() || !pode.coletar()) return;
      const x = await fotosParaPreparar(id).catch(() => null);
      if (!x || !x.ids.length) { rc(boxOffline); return; }
      if (!x.baixar.length) {
        rc(boxOffline, h('button', { class: nc('off-ok'), onclick: () => prepararSemInternet(r, pintarOffline) }, ico('ok'), h('span', {}, h('b', {}, 'Disponível sem internet'), ' · ' + plural(x.prontas, 'foto', 'fotos') + ' no aparelho' + (x.semDrive.length ? ' · ' + x.semDrive.length + ' ainda não enviada(s) por outro aparelho' : ''))));
      } else {
        rc(boxOffline, h('button', { class: nc('off-bt'), onclick: () => prepararSemInternet(r, pintarOffline) }, ico('baixar'),
          h('span', {}, h('b', {}, 'Preparar para usar sem internet'), h('br'), h('small', {}, plural(x.baixar.length, 'foto', 'fotos') + ' · cerca de ' + mb(x.estimativa) + (x.pend ? ' · ' + plural(x.pend, 'pendência', 'pendências') : '')))));
      }
    };
    pintarOffline();
    const corpo = h('div', { class: nc('md-r') }, heroObra(r, !!aberta), boxOffline, acoes, boxFila, abas, conteudo);
    // computador: a lista de obras fica à esquerda
    let esquerda = null;
    if (matchMedia('(min-width: 1024px)').matches) {
      const d = await carregarPainel();
      const ctx = contextoObras(d);
      const l = filtrarObras(d.regs, filtroObras());
      if (!l.some((x) => x.id === id)) l.unshift(r);
      esquerda = h('div', { class: nc('md-l') }, h('div', { class: nc('sec'), style: { marginTop: '2px' } }, h('h2', {}, 'Obras'), h('a', { class: nc('lk'), href: '#/obras' }, 'Filtros')), l.map((x) => cartaoObra(x, ctx, { compacto: true, sel: x.id === id })));
    }
    rcT(tk, h('div', { class: nc('md2') }, esquerda, corpo));
    if (esquerda) { const s = esquerda.querySelector('.' + nc('sel')); if (s && !manterRolagem) s.scrollIntoView({ block: 'nearest' }); }
  }

  function dadosObra(r) {
    const conv = r.tipo === 'convenio';
    const kv = (rot, val, larga) => (val ? h('div', { class: larga ? nc('larga') : null }, h('span', {}, rot), h('b', {}, val)) : null);
    const ads = r.aditivos || [];
    return h('div', { class: nc('card'), style: { marginTop: '14px' } },
      h('div', { class: nc('kv') },
        kv(conv ? 'Convenente' : 'Contratada', r.n_nome, true),
        kv('Número', r.numero), kv('Processo', r.processo),
        kv('Local da obra', r.local_obra, true),
        kv('Status', r.status_obra),
        kv('Valor', r.valor ? 'R$ ' + X.formatarMoeda(X.parseMoeda(r.valor)) : ''),
        kv('Início', r.data_inicio ? X.dataBR(r.data_inicio) : ''),
        conv ? null : kv('Prazo de execução', r.prazo_execucao ? X.dataBR(r.prazo_execucao) : ''),
        kv(conv ? 'Vigência do Convênio' : 'Vigência Contratual', r.vigencia ? X.dataBR(r.vigencia) : ''),
        conv ? null : kv('Ordem de Serviço', r.os_numero),
        conv ? null : kv('Valor da O.S.', r.valor_os ? 'R$ ' + X.formatarMoeda(X.parseMoeda(r.valor_os)) : ''),
        conv ? null : kv('Objeto específico da O.S.', r.objeto_especifico, true),
        conv ? null : kv('Aniversário (reajuste)', r.aniv_data ? X.dataBR(r.aniv_data) : '—'),
        conv ? null : kv('Índice de reajuste', r.aniv_indice || '—'),
        kv('Objeto', r.objeto, true),
        kv('Sanções', r.sancoes && r.sancoes.trim() ? 'Personalizadas' : 'Padrão do modelo'),
        h('div', { class: nc('larga') }, h('span', {}, 'Termos aditivos'), ads.length ? ads.map((a, i) => h('b', { style: { display: 'block' } }, (i + 1) + 'º · ' + ROT_ADIT[a.tipo || 'outro'] + (textoAditivo(a) ? ' · ' + textoAditivo(a) : ''))) : h('b', {}, 'Nenhum'))),
      pode.cadastro() ? h('a', { class: 'btn', style: { marginTop: '14px', display: 'flex', justifyContent: 'center' }, href: '#/editar/' + r.id }, '✏️ Editar cadastro') : null);
  }

  /* ---------- situação da obra: escolha em cartões coloridos ---------- */
  const DICA_ST = {
    'Obra não iniciada': 'Contrato assinado, sem O.S. ou sem início no canteiro', 'Em execução': 'Obra andando; prazos geram alertas', 'Paralisada': 'Parada temporariamente (prazos continuam valendo)',
    'Contrato rescindido': 'Encerrado antes do fim', 'Sem vigência': 'Prazo de vigência acabou sem aditivo', 'Em recebimento provisório': 'Obra entregue, em recebimento', 'Obra concluída': 'Recebida definitivamente',
    'Em licitação': 'Prefeitura licitando a obra', 'Contrato rescindido – em processo de relicitação': 'Prefeitura licitando de novo', 'Em prestação de contas': 'Obra pronta, prestação de contas em análise',
  };
  function escolherStatus(tipo, atual) {
    return new Promise((res) => {
      const lista = listaStatus(tipo);
      let escolhido;
      const box = h('div', { class: nc('st-opc') },
        lista.map((x) => h('button', { type: 'button', class: x.nome === atual ? nc('on') : null, onclick: () => { escolhido = x.nome; fechar(); } },
          h('span', { class: nc('st-bola ' + (COR_N[x.cor] || '')) }),
          h('span', { class: nc('c') }, h('b', {}, x.nome), h('span', {}, (DICA_ST[x.nome] || '') + (x.encerra ? (DICA_ST[x.nome] ? ' · ' : '') + 'prazos param de gerar alerta' : ''))),
          x.nome === atual ? ico('ok') : null)),
        h('button', { type: 'button', class: !atual ? nc('on') : null, onclick: () => { escolhido = ''; fechar(); } }, h('span', { class: nc('st-bola') }), h('span', { class: nc('c') }, h('b', {}, 'Não informado'), h('span', {}, 'Sem situação definida'))));
      let fechar = () => {};
      const p = modal('Situação da obra', box, [{ txt: 'Cancelar', valor: undefined }]);
      // fecha o modal quando escolhe (clica no botão Cancelar do próprio modal, que resolve a promessa)
      fechar = () => { const fundo = box.closest('.modal-fundo'); const bt = fundo && fundo.querySelector('.acoes button'); if (bt) bt.click(); };
      p.then(() => res(escolhido));
    });
  }

  /* ---------- termo aditivo ---------- */
  async function dialogoAditivo(r, n) {
    const a = { id: DB.uuid(), tipo: 'prazo', data: X.hojeISO(), execucao: '', vigencia: '', valor: '', justificativa: '' };
    const tipoSel = h('select', { onchange: (e) => { a.tipo = e.target.value; ver(); } }, Object.entries({ prazo: 'Prazo', valor: 'Valor', prazo_valor: 'Prazo e valor', outro: 'Outro' }).map(([k, t]) => h('option', { value: k }, t)));
    const exec = campo('Nova data final de execução', h('input', { type: 'date', oninput: (e) => { a.execucao = e.target.value; } }));
    const vig = campo('Nova data final de vigência', h('input', { type: 'date', oninput: (e) => { a.vigencia = e.target.value; } }));
    const val = campo('Valor do aditivo (R$)', h('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', oninput: (e) => { a.valor = X.parseMoeda(e.target.value); } }), 'Acréscimo (ou supressão, com sinal de menos).');
    const ver = () => {
      const pz = a.tipo === 'prazo' || a.tipo === 'prazo_valor', vl = a.tipo === 'valor' || a.tipo === 'prazo_valor';
      exec.style.display = pz && r.tipo === 'contrato' ? '' : 'none'; vig.style.display = pz ? '' : 'none'; val.style.display = vl ? '' : 'none';
    };
    const corpo = h('div', {},
      h('p', { class: 'sub', style: { marginTop: 0 } }, n + 'º termo aditivo. As datas do cadastro passam a ser as novas e o histórico fica guardado na atividade da obra.'),
      h('div', { class: 'grade2' }, campo('Tipo', tipoSel), campo('Assinado em', h('input', { type: 'date', value: a.data, oninput: (e) => { a.data = e.target.value; } }))),
      exec, vig, val,
      campo('Justificativa / observação', h('textarea', { rows: '2', style: { minHeight: '60px' }, placeholder: 'Ex.: chuvas acima da média', oninput: (e) => { a.justificativa = e.target.value; } })));
    ver();
    const ok = await modal('Registrar termo aditivo', corpo, [{ txt: 'Cancelar', valor: false }, { txt: 'Registrar', cls: 'pri', valor: true, antes: () => {
      if ((a.tipo === 'prazo' || a.tipo === 'prazo_valor') && !a.execucao && !a.vigencia) { toast('Informe a nova data de execução ou de vigência.', true); return false; }
      if ((a.tipo === 'valor' || a.tipo === 'prazo_valor') && !a.valor) { toast('Informe o valor do aditivo.', true); return false; }
    } }]);
    if (!ok) return null;
    if (a.tipo === 'valor' || a.tipo === 'outro') { a.execucao = ''; a.vigencia = ''; }
    if (a.tipo === 'prazo' || a.tipo === 'outro') a.valor = '';
    if (r.tipo !== 'contrato') a.execucao = '';
    a.em = new Date().toISOString(); a.por = email();
    return a;
  }


  /* ================================================================== */
  /* Fotos no aparelho (3.17): o que fica guardado em tamanho real       */
  /* ================================================================== */
  /* Ficam em tamanho real: as fotos das irregularidades pendentes (a constatação e a última verificação
     "não sanada", e a foto do projeto), as da visita em andamento e das visitas dos últimos 7 dias, e as
     anexadas a rascunhos de notificação e de medição. Foto ainda não enviada ao Drive nunca sai.
     As demais saem do aparelho sozinhas (a miniatura e os dados continuam; com internet, a foto é
     baixada de novo ao abrir). */
  const DIAS_GUARDA = 7;
  const mb = (b) => (b >= 1024 * 1024 * 1024 ? (b / 1024 / 1024 / 1024).toFixed(1).replace('.', ',') + ' GB' : Math.max(b > 0 ? 1 : 0, Math.round(b / 1024 / 1024)) + ' MB');
  async function fotosNecessarias(registroId) {
    // de uma obra só (página da obra) ou de todas (limpeza, Ajustes)
    const [regs, fotos, visitas, notifs, meds] = registroId
      ? await Promise.all([DB.get('registros', registroId).then((r) => (r ? [r] : [])), DB.byIndex('fotos', 'registroId', registroId), DB.byIndex('visitas', 'registroId', registroId), DB.byIndex('notificacoes', 'registroId', registroId), DB.byIndex('medicoes', 'registroId', registroId)])
      : await Promise.all([DB.all('registros'), DB.all('fotos'), DB.all('visitas'), DB.all('notificacoes'), DB.all('medicoes')]);
    const porReg = new Map(regs.map((r) => [r.id, r]));
    const mapa = new Map(fotos.map((f) => [f.id, f]));
    const fechada = (id) => { const r = porReg.get(id); return !r || r.excluido || encerrada(r); };
    const desde = isoDe(new Date(Date.now() - DIAS_GUARDA * 864e5));
    const fixas = new Set(), recentes = new Set(), porObra = new Map(), pendAtual = new Map(), irr = new Set();
    const add = (set, id, regId) => {
      if (!id) return;
      set.add(id);
      if (regId) { if (!porObra.has(regId)) porObra.set(regId, new Set()); porObra.get(regId).add(id); }
    };
    const visPor = new Map(visitas.filter((v) => !v.excluido).map((v) => [v.id, v]));
    for (const f of fotos) {
      if (f.excluido) continue;
      if (f.irregular && situacao(f) === 'pendente' && !fechada(f.registroId)) {
        add(fixas, f.id, f.registroId); irr.add(f.id);
        const vs = (f.verificacoes || []).filter((x) => x.status === 'nao_sanada' && x.fotoId);
        const ult = vs[vs.length - 1];
        if (ult) { add(fixas, ult.fotoId, f.registroId); irr.add(ult.fotoId); }
        if (f.projeto && f.projeto.fotoId) { add(fixas, f.projeto.fotoId, f.registroId); irr.add(f.projeto.fotoId); }
        pendAtual.set(f.id, ult ? ult.fotoId : f.id);
      }
      const v = f.visitaId && visPor.get(f.visitaId);
      if (v && v.status !== 'concluida') add(fixas, f.id, f.registroId);
      else if (v && String(v.data) >= desde && !fechada(f.registroId)) add(recentes, f.id, f.registroId);
    }
    for (const n of notifs) if (!n.excluido && n.status !== 'emitida') for (const x of n.fotos || []) add(fixas, x.fotoId, n.registroId);
    for (const m of meds) if (!m.excluido && m.status !== 'concluida') for (const it of ((m.relFoto || {}).itens || [])) add(fixas, it.fotoId, m.registroId);
    // última visita de cada obra (para "Preparar para usar sem internet" › fotos da última visita)
    const ultimaVisita = new Map();
    for (const v of visPor.values()) { const u = ultimaVisita.get(v.registroId); if (!u || String(v.data) > String(u.data) || (v.data === u.data && (+v.numero || 0) > (+u.numero || 0))) ultimaVisita.set(v.registroId, v); }
    // fotos da última visita baixadas de propósito ficam enquanto ela continuar sendo a última visita da obra
    let prep = {};
    try { prep = (await DB.kvGet('fotosPreparadas', {})) || {}; } catch (e) { /* */ }
    for (const [id, vid] of Object.entries(prep)) {
      const f = mapa.get(id); const u = f && ultimaVisita.get(f.registroId);
      if (f && !f.excluido && u && u.id === vid && !fechada(f.registroId)) fixas.add(id);
    }
    return { mapa, fixas, recentes, porObra, pendAtual, visPor, irr, ultimaVisita };
  }
  // espaço do navegador para o app (o celular quase cheio pausa os downloads automáticos)
  async function espacoAparelho() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const e = await navigator.storage.estimate();
      const livre = Math.max(0, (e.quota || 0) - (e.usage || 0));
      return { usado: e.usage || 0, quota: e.quota || 0, livre, pouco: !!e.quota && (livre < 250 * 1024 * 1024 || e.usage / e.quota > 0.92) };
    } catch (e) { return null; }
  }
  App.espacoAparelho = espacoAparelho;
  // pede ao navegador para não apagar os dados do app quando o aparelho fica sem espaço (fotos para uso sem internet)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((ja) => { if (!ja) navigator.storage.persist().catch(() => {}); }).catch(() => {}); } catch (e) { /* */ }

  let limpezaEmAndamento = null;
  /* Limpeza aos poucos (lotes pequenos com pausa entre eles: o app não trava).
     Devolve { removidas, liberado, total }. */
  function limparFotosAparelho(opc) {
    if (limpezaEmAndamento) return limpezaEmAndamento;
    limpezaEmAndamento = (async () => {
      const nec = await fotosNecessarias();
      const chaves = await DB.chaves('blobs');
      let removidas = 0, liberado = 0, total = 0;
      const pausa = () => new Promise((ok) => setTimeout(ok, 40));
      for (let i = 0; i < chaves.length; i++) {
        const k = chaves[i];
        const f = nec.mapa.get(k);
        const info = await DB.blobInfo(k).catch(() => null);
        if (!info) continue;
        // foto sem registro (acabou de ser tirada e ainda está sendo gravada) ou não enviada ao Drive: nunca sai
        const podeSair = f && f.driveId && !nec.fixas.has(k) && !nec.recentes.has(k);
        if (podeSair) { await DB.del('blobs', k); removidas++; liberado += info.tam; if (cacheUrls.has(k)) { URL.revokeObjectURL(cacheUrls.get(k)); cacheUrls.delete(k); } }
        else total += info.tam;
        if (i % 12 === 11) await pausa();
      }
      if (removidas) Sync.log('fotos', removidas + ' foto(s) saíram do aparelho (' + mb(liberado) + '); continuam no Drive');
      try { await DB.kvSet('ultimaLimpezaFotos', Date.now()); } catch (e) { /* */ }
      return { removidas, liberado, total };
    })().finally(() => { limpezaEmAndamento = null; });
    return limpezaEmAndamento;
  }
  App.limparFotosAparelho = limparFotosAparelho;
  // com o app aberto: 1 minuto depois de abrir e a cada 30 minutos
  setTimeout(async () => {
    limparFotosAparelho().catch((e) => console.warn('limpeza', e));
    // celular quase sem memória: avisa (uma vez por dia)
    const esp = await espacoAparelho();
    if (esp && esp.pouco) {
      const hoje = X.hojeISO();
      if ((await DB.kvGet('avisoEspaco', '')) !== hoje) { await DB.kvSet('avisoEspaco', hoje); toast('⚠️ O aparelho está quase sem espaço (' + mb(esp.livre) + ' livres para o app). Os downloads automáticos de fotos foram pausados. Veja Ajustes › Fotos no aparelho.', true); }
    }
  }, 60000);
  setInterval(() => { if (document.visibilityState === 'visible') limparFotosAparelho().catch(() => {}); }, 30 * 60000);

  async function resumoFotosAparelho() {
    const nec = await fotosNecessarias();
    const chaves = new Set(await DB.chaves('blobs'));
    let total = 0;
    for (const k of chaves) { const i = await DB.blobInfo(k).catch(() => null); if (i) total += i.tam; }
    const pend = [...nec.pendAtual.values()];
    const guardadas = pend.filter((id) => chaves.has(id)).length;
    const naoEnviadas = [...nec.mapa.values()].filter((f) => !f.excluido && !f.driveId && chaves.has(f.id)).length;
    return { total, n: chaves.size, pendencias: pend.length, guardadas, naoEnviadas };
  }

  // fotos de uma obra que precisam estar no aparelho para uso sem internet e ainda não estão
  async function fotosParaPreparar(registroId) {
    const nec = await fotosNecessarias(registroId);
    const chaves = new Set(await DB.chaves('blobs'));
    const uv = nec.ultimaVisita.get(registroId);
    const fotosDe = (ids) => [...ids].map((id) => nec.mapa.get(id)).filter((f) => f && !f.excluido);
    const grupo = (ids) => {
      const fs = fotosDe(new Set(ids));
      const faltam = fs.filter((f) => !chaves.has(f.id));
      const baixar = faltam.filter((f) => f.driveId);
      // estimativa do tamanho: ~0,2 byte por pixel (JPEG do app); sem as medidas, 600 KB
      const estimativa = baixar.reduce((t, f) => t + (f.largura && f.altura ? f.largura * f.altura * 0.2 : 600 * 1024), 0);
      return { ids: fs.map((f) => f.id), baixar, semDrive: faltam.filter((f) => !f.driveId), estimativa, prontas: fs.length - faltam.length };
    };
    const daObra = [...nec.irr].filter((id) => (nec.mapa.get(id) || {}).registroId === registroId);
    const daUltima = uv ? [...nec.mapa.values()].filter((f) => f.visitaId === uv.id && !f.excluido).map((f) => f.id) : [];
    const necessarias = [...(nec.porObra.get(registroId) || [])];
    const irr = grupo(daObra), visita = grupo(daUltima), ambos = grupo(necessarias.concat(daUltima)), base = grupo(necessarias);
    const pend = [...nec.pendAtual.keys()].filter((id) => (nec.mapa.get(id) || {}).registroId === registroId).length;
    // o resumo da página da obra: o que o app guarda sozinho (pendências, visitas recentes, rascunhos)
    return Object.assign({}, necessarias.length ? base : ambos, { pend, grupos: { irr, visita, ambos }, ultimaVisita: uv || null });
  }
  async function prepararSemInternet(r, aoTerminar) {
    const x = await fotosParaPreparar(r.id);
    const g = x.grupos, uv = x.ultimaVisita;
    if (!x.ids.length) {
      await modal('Preparar para usar sem internet', h('p', {}, 'Esta obra ainda não tem fotos de irregularidades pendentes nem de visitas. As miniaturas de todas as fotos já ficam no aparelho.'));
      return;
    }
    // escolha: só as irregularidades, só a última visita ou ambos
    const ops = [
      ['irr', 'Só as irregularidades pendentes', plural(x.pend, 'pendência', 'pendências') + ' · constatação, última verificação e projeto', g.irr],
      ['visita', 'Só as fotos da última visita', uv ? 'Visita nº ' + uv.numero + ' · ' + X.dataBR(uv.data) : 'nenhuma visita', g.visita],
      ['ambos', 'Ambos', 'Irregularidades, última visita, visitas dos últimos ' + DIAS_GUARDA + ' dias e rascunhos', g.ambos],
    ];
    let esc = g.ambos.baixar.length ? 'ambos' : g.irr.baixar.length ? 'irr' : 'visita';
    const esp = await espacoAparelho();
    const caixa = h('div', { class: nc('st-opc') + ' prep-opc' });
    const resumo = h('p', { class: 'sub', style: { margin: '10px 2px 0' } });
    const pintar = () => {
      rc(caixa, ops.map(([k, t, d, q]) => h('button', { type: 'button', 'data-op': k, class: esc === k ? nc('on') : null, disabled: !q.ids.length ? true : null, onclick: () => { esc = k; pintar(); } },
        h('span', { class: nc('st-bola ' + (k === 'irr' ? 'er' : k === 'visita' ? 'in' : 'ok')) }),
        h('span', { class: nc('c') }, h('b', {}, t), h('span', {}, d),
          h('span', { style: { color: 'var(--txt)', fontWeight: 600, marginTop: '3px' } }, !q.ids.length ? 'nada para baixar' : q.baixar.length ? plural(q.baixar.length, 'foto', 'fotos') + ' · cerca de ' + mb(q.estimativa) : 'já está no aparelho')),
        esc === k ? ico('ok') : null)));
      const q = g[esc];
      rc(resumo, q.prontas ? plural(q.prontas, 'foto desta escolha já está', 'fotos desta escolha já estão') + ' no aparelho.' : '', q.semDrive.length ? ' ' + plural(q.semDrive.length, 'foto ainda não foi enviada', 'fotos ainda não foram enviadas') + ' pelo aparelho que a(s) tirou.' : '');
    };
    pintar();
    const corpo = h('div', {},
      h('p', { style: { marginTop: 0 } }, 'O que baixar para este aparelho, em tamanho real, para ver na obra sem internet?'),
      caixa, resumo,
      esp && esp.pouco ? h('div', { class: 'aviso', style: { marginTop: '10px' } }, '⚠️ O aparelho está quase sem espaço para o app (' + mb(esp.livre) + ' livres). Libere espaço no celular ou em Ajustes › Fotos no aparelho.') : null,
      h('p', { class: 'dica' }, 'Elas saem do aparelho sozinhas quando a irregularidade for sanada ou a visita deixar de ser a mais recente (continuam no Drive).'));
    const ok = await modal('Preparar para usar sem internet', corpo, [{ txt: 'Cancelar', valor: false }, { txt: 'Baixar', cls: 'pri', valor: true, antes: () => {
      if (!g[esc].baixar.length) { toast(g[esc].ids.length ? 'Essas fotos já estão no aparelho.' : 'Nada para baixar nessa opção.'); return false; }
      if (!navigator.onLine || !Sync.habilitado()) { toast('Precisa de internet para baixar as fotos. Faça isso antes de ir para a obra.', true); return false; }
    } }]);
    if (!ok) return;
    const lista = g[esc].baixar;
    const jp = janelaProgresso('Baixando 0 de ' + lista.length + '…', 'Preparando para usar sem internet');
    jp.set(null, 0);
    try {
      const res = await obterFotos(lista, (feitas, tot) => jp.set('Baixando ' + feitas + ' de ' + tot + '…', feitas / tot), 4);
      // as fotos da última visita ficam guardadas enquanto ela for a última visita da obra
      if (uv && esc !== 'irr') {
        try { const prep = (await DB.kvGet('fotosPreparadas', {})) || {}; for (const f of lista) if (f.visitaId === uv.id) prep[f.id] = uv.id; await DB.kvSet('fotosPreparadas', prep); } catch (e) { /* */ }
      }
      jp.fechar();
      if (res.faltando.length) toast(res.faltando.length + ' foto(s) não puderam ser baixadas agora (conexão). Tente de novo.', true);
      else toast('Pronto: ' + plural(lista.length, 'foto baixada', 'fotos baixadas') + ' para usar sem internet.');
    } catch (e) { jp.fechar(); toast('Falha ao baixar: ' + e.message, true); }
    if (aoTerminar) aoTerminar();
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
    const g = h('div', { class: 'fotos' + (opts.marcar ? ' marcavel' : '') });
    for (const f of fotos) {
      const img = h('img', { alt: f.descricao || '', loading: 'lazy' });
      urlFoto(f).then((u) => { img.src = u; });
      const idx = opts.selecionadas ? opts.selecionadas.indexOf(f.id) : -1;
      const marcada = opts.marcar && opts.marcar.has(f.id);
      ap(g, h('div', { 'data-id': f.id, class: 'foto' + (idx >= 0 ? ' sel' : '') + (marcada ? ' marcada' : '') + (f.irregular ? ' irr' : '') + (f.fora_relatorio && opts.marcarRelatorio ? ' fora' : ''), onclick: (ev) => opts.onclick && opts.onclick(f, ev) },
        img,
        opts.marcar ? h('span', { class: 'marca', 'aria-hidden': 'true' }) : null,
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
  /* 3.18.4: move as fotos já enviadas para as pastas da regra atual (ex.: separar por O.S.). O app calcula o destino de
     cada foto e manda em lotes; o servidor só mexe na que está fora do lugar e, no fim, apaga as pastas que ficaram vazias. */
  async function reorganizarFotosDrive() {
    if (!Sync.habilitado() || !navigator.onLine) { toast('Precisa de internet e do servidor configurado.', true); return; }
    if (Sync.versaoServidor && Sync.versaoServidor < 15) { toast('Atualize o servidor (Code.gs versão 15) para reorganizar as fotos.', true); return; }
    const fotos = (await DB.all('fotos')).filter((f) => f.driveId && !f.excluido);
    if (!fotos.length) { toast('Nenhuma foto enviada ao Drive ainda.'); return; }
    if (!(await confirmar('Reorganizar ' + plural(fotos.length, 'foto', 'fotos') + ' no Google Drive conforme a regra de pastas atual (' + (((CONFIG || {}).pasta_fotos && CONFIG.pasta_fotos !== PASTA_ANTIGA) ? CONFIG.pasta_fotos : CONFIG_PADRAO.pasta_fotos) + ')? As fotos que já estão no lugar certo não são mexidas e as pastas que ficarem vazias vão para a lixeira do Drive. Pode levar alguns minutos; deixe o app aberto.', 'Reorganizar'))) return;
    const jp = janelaProgresso('Calculando o destino das fotos…', 'Reorganizar as fotos do Drive');
    jp.set(null, 0);
    const tot = { movidas: 0, renomeadas: 0, certas: 0, erros: [] };
    try {
      const itens = [];
      for (const f of fotos) { const inf = await App.infoFotoDrive(f); itens.push({ id: f.id, driveId: f.driveId, pastas: inf.pastas, nome: inf.nome }); }
      let i = 0, tam = 8, falhasSeg = 0;
      // pedidos curtos: o Google pode devolver incompleta a resposta de um pedido demorado; se acontecer, tenta de novo com menos fotos
      const chamarComRetentativa = async (acao, dados) => {
        for (let t = 0; ; t++) {
          try { const r = await Sync.chamar(acao, dados); falhasSeg = 0; return r; } catch (e) {
            if (/desconhecida|permiss|login|TOKEN/i.test(e.message || '') || t >= 4) throw e;
            Sync.log('reorganizar', acao + ': tentando de novo', e.message);
            falhasSeg++; if (dados.itens && dados.itens.length > 2) { dados = Object.assign({}, dados, { itens: dados.itens.slice(0, Math.max(2, Math.ceil(dados.itens.length / 2))) }); tam = dados.itens.length; }
            await new Promise((ok) => setTimeout(ok, 1500 * (t + 1)));
          }
        }
      };
      while (i < itens.length) {
        const lote = itens.slice(i, i + tam);
        const r = await chamarComRetentativa('moverFotos', { itens: lote });
        const feitos = Math.max(1, +r.feitos || 0);
        tot.movidas += +r.movidas || 0; tot.renomeadas += +r.renomeadas || 0; tot.certas += +r.certas || 0; tot.erros.push(...(r.erros || []));
        i += feitos;
        jp.set('Fotos conferidas: ' + Math.min(i, itens.length) + ' de ' + itens.length + ' · ' + tot.movidas + ' movida(s)', Math.min(i, itens.length) / itens.length * 0.92);
      }
      jp.set('Apagando as pastas que ficaram vazias…', 0.95);
      let lim = { removidas: 0, completo: false }, k = 0;
      do { const r = await chamarComRetentativa('limparPastasFotos', {}); lim.removidas += +r.removidas || 0; lim.completo = r.completo !== false; k++; jp.set('Apagando as pastas que ficaram vazias… (' + lim.removidas + ')', 0.95); } while (!lim.completo && k < 30);
      jp.fechar();
      await modal('Fotos reorganizadas', h('div', {},
        h('p', {}, plural(tot.movidas, 'foto mudou de pasta', 'fotos mudaram de pasta') + (tot.renomeadas ? ', ' + plural(tot.renomeadas, 'renomeada', 'renomeadas') : '') + ' e ' + plural(tot.certas, 'já estava no lugar', 'já estavam no lugar') + '.'),
        h('p', {}, plural(lim.removidas, 'pasta vazia foi para a lixeira', 'pastas vazias foram para a lixeira') + ' do Drive.'),
        tot.erros.length ? h('p', { class: 'aviso' }, plural(tot.erros.length, 'foto não pôde ser movida', 'fotos não puderam ser movidas') + ' (apagada no Drive ou sem acesso). Rode de novo mais tarde.') : null),
      [{ txt: 'OK', cls: 'pri', valor: true }]);
    } catch (e) { jp.fechar(); toast(/desconhecida/i.test(e.message || '') ? 'Atualize o servidor (Code.gs versão 15) para reorganizar as fotos.' : 'Não foi possível terminar: ' + e.message + '. Rode de novo: continua de onde parou.', true); }
  }

  /* Salva a foto em tamanho real no aparelho. iPhone/iPad: abre o menu de compartilhar (opção "Salvar Imagem"
     vai para o app Fotos). Android: o arquivo vai para Downloads e aparece na galeria (Google Fotos › Downloads).
     Computador: baixa o arquivo. Se a foto não está no aparelho, busca no Drive (precisa de internet). */
  const ehApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // nome do arquivo de uma foto salva/compartilhada: OBRA_AAAA-MM-DD_HHMMSS[_irregularidade] (sem a extensão)
  function nomeFotoArq(f, r) {
    const d = new Date(f.dataHora || Date.now());
    const carimbo = isNaN(d) ? '' : isoDe(d) + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
    return nomeArquivo([r ? r.apelido : 'foto', carimbo, f.irregular ? 'irregularidade' : ''].filter(Boolean).join('_')).replace(/\s+/g, '_').slice(0, 90);
  }
  const ehAndroid = () => /Android/i.test(navigator.userAgent);
  // o navegador deixa entregar arquivos ao menu de compartilhar do sistema? (iPhone, Android, Edge/Chrome no Windows, Safari no Mac)
  function compartilhaArquivos() {
    try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/jpeg' })], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) { return false; }
  }
  /* Várias fotos da visita de uma vez (3.18.1). modo 'compartilhar': menu do sistema. modo 'baixar': iPhone → menu do sistema
     ("Salvar N imagens" vai para o app Fotos); Android → um arquivo por foto em Downloads (aparece na galeria);
     computador → um .zip. Fotos que não estão no aparelho vêm do Drive. Devolve true se terminou. */
  async function exportarFotos(lista, r, v, modo) {
    if (!lista.length) return false;
    const n = lista.length;
    const viaMenu = modo === 'compartilhar' || (ehApple() && compartilhaArquivos());
    const zip = !viaMenu && !ehAndroid() && !ehApple();
    if (n > 40 && !(await confirmar((modo === 'compartilhar' ? 'Compartilhar ' : 'Baixar ') + n + ' fotos em tamanho real? As que não estão neste aparelho vêm da internet' + (zip ? '; o computador recebe um arquivo .zip' : '') + '.' + (viaMenu && n > 80 ? ' Com muitas fotos, o menu do celular pode demorar a abrir; se não abrir, escolha menos fotos de cada vez.' : ''), modo === 'compartilhar' ? 'Compartilhar' : 'Baixar'))) return false;
    const jp = janelaProgresso('Preparando as fotos…', modo === 'compartilhar' ? 'Compartilhar fotos' : 'Baixar fotos');
    jp.set(null, 0);
    let res;
    try { res = await obterFotos(lista, (k, t) => jp.set('Preparando as fotos: ' + k + ' de ' + t + '…', k / t * (zip ? 0.6 : 0.95)), 4); } catch (e) { jp.fechar(); toast('Não foi possível preparar as fotos: ' + e.message, true); return false; }
    const usados = new Map();
    const arqs = [];
    for (const f of lista) {
      const b = res.blobs.get(f.id); if (!b) continue;
      let nome = nomeFotoArq(f, r); const k = (usados.get(nome) || 0) + 1; usados.set(nome, k);
      if (k > 1) nome += '_' + k;
      arqs.push({ nome: nome + '.jpg', blob: b.type === 'image/jpeg' ? b : new Blob([b], { type: 'image/jpeg' }) });
    }
    const avisoFalta = () => { if (res.faltando.length) toast(plural(res.faltando.length, 'foto ficou', 'fotos ficaram') + ' de fora: ' + (navigator.onLine ? 'ainda não foram enviadas pelo aparelho que as tirou.' : 'não estão neste aparelho e estamos sem internet.'), true); };
    if (!arqs.length) { jp.fechar(); avisoFalta(); if (!res.faltando.length) toast('Nenhuma foto para salvar.', true); return false; }
    if (viaMenu) {
      jp.fechar();
      const files = arqs.map((a) => new File([a.blob], a.nome, { type: 'image/jpeg' }));
      const abrir = () => navigator.share({ files });
      try { await abrir(); avisoFalta(); return true; } catch (e) {
        if (e.name === 'AbortError') return false;
        if (e.name !== 'NotAllowedError') { toast('Não foi possível abrir o menu: ' + e.message, true); return false; }
      }
      // demorou para preparar e o navegador pede um novo toque para abrir o menu
      let erro = null;
      const ok = await modal(plural(arqs.length, 'foto pronta', 'fotos prontas'), h('p', {}, ehApple() && modo !== 'compartilhar' ? 'Toque em "Abrir" e escolha "Salvar ' + (arqs.length === 1 ? 'Imagem' : arqs.length + ' imagens') + '" para guardar no app Fotos.' : 'Toque em "Abrir" para escolher onde enviar.'), [
        { txt: 'Cancelar', valor: false },
        { txt: 'Abrir', cls: 'pri', valor: true, antes: () => abrir().catch((e) => { erro = e; }) }]);
      if (erro && erro.name !== 'AbortError') toast('Não foi possível abrir o menu: ' + erro.message, true);
      if (ok && !erro) avisoFalta();
      return !!ok && !erro;
    }
    try {
      if (zip) {
        const z = new JSZip();
        for (const a of arqs) z.file(a.nome, a.blob, { binary: true, compression: 'STORE' });
        const blob = await z.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => jp.set('Juntando no arquivo .zip…', 0.6 + 0.4 * m.percent / 100));
        const nomeZip = nomeArquivo([r ? r.apelido : 'fotos', v ? 'visita' + v.numero : '', v && v.data ? v.data : ''].filter(Boolean).join('_')).replace(/\s+/g, '_').slice(0, 90) + '.zip';
        jp.fechar();
        baixarBlob(blob, nomeZip);
        toast(plural(arqs.length, 'foto baixada', 'fotos baixadas') + ' em ' + nomeZip);
      } else {
        for (let i = 0; i < arqs.length; i++) {
          jp.set('Salvando ' + (i + 1) + ' de ' + arqs.length + '…', 0.95 + 0.05 * (i + 1) / arqs.length);
          baixarBlob(arqs[i].blob, arqs[i].nome);
          await new Promise((ok) => setTimeout(ok, 350)); // o navegador perde arquivos baixados todos no mesmo instante
        }
        jp.fechar();
        toast(arqs.length === 1 ? 'Foto salva em Downloads (aparece na galeria).' : arqs.length + ' fotos salvas em Downloads (aparecem na galeria).');
      }
    } catch (e) { jp.fechar(); toast('Não foi possível salvar as fotos: ' + e.message, true); return false; }
    avisoFalta();
    return true;
  }
  async function salvarNaGaleria(f, bt) {
    if (bt) bt.disabled = true;
    try {
      let blob = await DB.blobGet(f.id);
      if (!blob && f.driveId && Sync.habilitado() && navigator.onLine) { try { blob = await Sync.baixarFoto(f); } catch (e) { blob = null; } }
      if (!blob) { toast(navigator.onLine ? 'A foto ainda não está disponível (não foi enviada pelo aparelho que a tirou).' : 'Sem internet: a foto em tamanho real não está neste aparelho. Tente quando houver conexão.', true); return; }
      const r = f.registroId ? await DB.get('registros', f.registroId) : null;
      const nome = nomeFotoArq(f, r) + '.jpg';
      const arq = blob.type === 'image/jpeg' ? blob : new Blob([blob], { type: 'image/jpeg' });
      if (ehApple()) {
        const file = new File([arq], nome, { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
      }
      baixarBlob(arq, nome);
      toast(/Android/i.test(navigator.userAgent) ? 'Foto salva em Downloads (aparece na galeria).' : 'Foto baixada: ' + nome);
    } finally { if (bt) bt.disabled = false; }
  }
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
    // baixar a foto em tamanho real para a galeria do celular (ou para Downloads, no computador)
    let fotoNoVisor = null;
    const btGaleria = h('button', { class: 'visor-galeria', title: 'Salvar na galeria', 'aria-label': 'Salvar a foto na galeria', style: { display: 'none' }, onclick: () => { if (fotoNoVisor) salvarNaGaleria(fotoNoVisor, btGaleria); } },
      h('span', { html: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>' }), h('span', { class: 'visor-galeria-t' }, 'Baixar foto'));
    const tira = h('div', { class: 'visor-tira' });
    const novaMini = (k) => {
      const m = h('img', { alt: '', loading: 'lazy', draggable: 'false' }); cfg.miniatura(k).then((u) => { if (u) m.src = u; });
      const bt = h('button', { class: 'visor-mini ' + (cfg.classeMini ? cfg.classeMini(k) : ''), onclick: () => ir([...tira.children].indexOf(bt) - idx) }, m);
      return bt;
    };
    for (let k = 0; k < total; k++) tira.appendChild(novaMini(k));
    const fundo = h('div', { class: 'visor-fundo' + (cfg.classe ? ' ' + cfg.classe : '') }, h('div', { class: 'visor' },
      h('div', { class: 'visor-topo' }, contador, infoTopo, barraZoom, btGaleria, h('button', { class: 'visor-fechar', title: 'Fechar (Esc)', onclick: () => fechar() }, '✕')),
      h('div', { class: 'visor-corpo' }, palco, lado),
      total > 1 ? tira : null));
    document.body.appendChild(fundo);
    document.body.classList.add('com-visor');

    const avisoMini = h('div', { class: 'visor-aviso-mini', style: { display: 'none' } });
    const api = {
      lado, get idx() { return idx; }, get total() { return total; },
      // imagem: mostra a miniatura na hora e troca pela grande quando carregar
      imagem(mini, grandeP, legenda, foto) {
        fotoNoVisor = foto || null; btGaleria.style.display = foto ? '' : 'none';
        z.s = 1; z.x = 0; z.y = 0; aplicar();
        const k = idx; imgEl.src = mini || ''; imgEl.classList.toggle('so-mini', !!mini); // a miniatura ocupa a tela enquanto a grande não chega
        if (!avisoMini.isConnected && imgEl.parentNode) imgEl.parentNode.appendChild(avisoMini);
        avisoMini.style.display = 'none'; avisoMini.classList.remove('acao');
        if (grandeP) {
          /* 3.18.2: a foto que não está no aparelho vem do Drive — com internet lenta leva alguns segundos.
             Mostra "Carregando…" (se demorar) e, se falhar, o motivo e "Tentar de novo". */
          let pronto = false;
          const tCarr = setTimeout(() => {
            if (pronto || k !== idx || !mini) return;
            rc(avisoMini, h('span', { class: 'carregando', 'aria-hidden': 'true' }), ' Carregando a foto em tamanho real…');
            avisoMini.classList.add('carr'); avisoMini.style.display = '';
          }, 350);
          grandeP.then((u) => {
            pronto = true; clearTimeout(tCarr);
            if (k !== idx) return;
            avisoMini.classList.remove('carr');
            if (u) imgEl.src = u;
            if (!((!u || u === mini) && mini)) { imgEl.classList.remove('so-mini'); avisoMini.style.display = 'none'; return; }
            const online = navigator.onLine && Sync.habilitado();
            if (online && foto && foto.driveId) {
              avisoMini.classList.add('acao');
              rc(avisoMini, 'Não foi possível baixar a foto do Drive. ', h('button', { type: 'button', class: 'visor-tentar', onclick: (e) => { e.stopPropagation(); mostrar(true); } }, 'Tentar de novo'));
            } else rc(avisoMini, !navigator.onLine ? 'Miniatura · sem internet: a foto em tamanho real é baixada do Drive quando houver conexão'
              : foto && !foto.driveId ? 'Miniatura · a foto em tamanho real ainda não foi enviada pelo aparelho que a tirou' : 'Miniatura · a foto em tamanho real é baixada do Drive quando houver internet');
            avisoMini.style.display = '';
          });
        }
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
        api.imagem(f.miniatura, urlFoto(f, true), null, f);
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
          api.imagem(fotos[i].f.miniatura, urlFoto(fotos[i].f, true), fotos[i].rot, fotos[i].f);
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
    if (!Array.isArray(r.aditivos)) r.aditivos = [];
    const aditivosNovos = [];
    const coords = r.coordenadores.map((pid) => ({ pessoaId: pid }));
    const pessoas = await pessoasMap();
    const rot = ROTULO[tipo].toLowerCase();
    titulo((existente ? 'Editar ' : 'Novo ') + rot, true); marcarNav('registro');

    const valorInp = (chave, chaveExt) => {
      const inpExt = inputTxt(r, chaveExt, { placeholder: 'gerado automaticamente' });
      const inp = h('input', { type: 'text', inputmode: 'decimal', value: r[chave] != null && r[chave] !== '' ? X.formatarMoeda(X.parseMoeda(r[chave])) : '', placeholder: '0,00',
        oninput: (e) => { r[chave] = X.parseMoeda(e.target.value); r[chaveExt] = ''; inpExt.value = ''; inpExt.placeholder = X.moeda(r[chave]) || 'gerado automaticamente'; } });
      inpExt.placeholder = X.moeda(X.parseMoeda(r[chave])) || 'gerado automaticamente';
      return [inp, inpExt];
    };
    const [vInp, vExt] = valorInp('valor', 'valor_extenso');
    const nomeTexto = inputTxt(r, 'n_nome_texto', { placeholder: tipo === 'convenio' ? 'Ex.: Prefeitura Municipal de Cláudia' : 'Ex.: HFC CONSTRUTORA E ENGENHARIA LTDA' });
    const data = (k) => h('input', { type: 'date', value: r[k] || '', oninput: (e) => { r[k] = e.target.value; resumir(); } });

    // blocos recolhíveis (lembra quais estavam abertos)
    const abertos = (() => { try { return JSON.parse(sessionStorage.getItem('blocos_cad') || '{}'); } catch (e) { return {}; } })();
    const resumos = {};
    const bloco = (k, t, corpo, aberto) => {
      resumos[k] = h('span', {});
      return h('details', { class: nc('card bloco'), 'data-bloco': k, open: (abertos[k] != null ? abertos[k] : aberto) ? true : null,
        ontoggle: (e) => { abertos[k] = e.target.open; try { sessionStorage.setItem('blocos_cad', JSON.stringify(abertos)); } catch (er) { /* */ } } },
        h('summary', {}, h('span', { class: nc('c') }, h('b', {}, t), resumos[k]), ico('dir', 'seta')),
        h('div', { class: nc('pilha'), style: { marginTop: '0' } }, corpo));
    };

    // situação da obra
    const st = h('button', { type: 'button', class: nc('card sel-st'), onclick: async () => {
      const v = await escolherStatus(tipo, r.status_obra || '');
      if (v === undefined) return;
      r.status_obra = v; pintarSt();
    } });
    const pintarSt = () => {
      const info = infoStatus(r.status_obra, tipo);
      rc(st, h('span', { class: nc('st-bola ' + (r.status_obra ? COR_N[(info || {}).cor] || '' : '')) }),
        h('span', { class: nc('c') }, h('b', {}, r.status_obra || 'Situação não informada'), h('span', {}, (DICA_ST[r.status_obra] || (r.status_obra ? '' : 'Toque para escolher')) + (info && info.encerra ? ' · prazos param de gerar alerta' : ''))),
        h('span', { class: nc('sub') }, 'Status da obra'), ico('dir', 'seta'));
    };
    pintarSt();

    const secDados = bloco('dados', 'Dados do ' + rot, [
      campo('Nome curto (identificação no app e no nome do arquivo) *', inputTxt(r, 'apelido', { placeholder: tipo === 'convenio' ? 'Ex.: CONVÊNIO 0961-2024 - CLÁUDIA' : 'Ex.: CEI DAURY RIVA', oninput: (e) => { r.apelido = e.target.value; resumir(); } })),
      campo('Objeto', inputArea(r, 'objeto', { placeholder: 'Sem aspas — o modelo já inclui' })),
      campo('Local da obra (endereço / município)', inputTxt(r, 'local_obra', { placeholder: 'Ex.: Bairro Dauri Riva, Sinop/MT' }), 'Aparece no relatório fotográfico.'),
      h('div', { class: 'grade2' },
        campo(ROTULO[tipo] + ' nº', inputTxt(r, 'numero', { oninput: (e) => { r.numero = e.target.value; resumir(); } })),
        campo('Processo/Protocolo nº', inputTxt(r, 'processo'))),
      h('div', { class: 'grade2' }, campo('Valor do ' + rot + ' (R$)', vInp), campo('Valor por extenso', vExt, 'Deixe vazio para gerar automaticamente.')),
      tipo === 'contrato' ? h('div', {},
        h('div', { class: 'grade2' },
          campo('Aniversário (data-base do reajuste)', data('aniv_data')),
          campo('Índice de reajuste', inputTxt(r, 'aniv_indice', { placeholder: 'Ex.: INCC-DI, IPCA' }))),
        h('div', { class: 'dica', style: { marginTop: '-6px' } }, 'Use a data-base do orçamento ou da proposta, conforme o contrato. O app avisa 60 dias antes de cada aniversário.')) : null,
    ], true);

    const secOS = tipo === 'contrato' ? (() => {
      const [oInp, oExt] = valorInp('valor_os', 'valor_os_extenso');
      return bloco('os', 'Ordem de Serviço', [
        h('div', { class: 'grade2' }, campo('O.S. nº', inputTxt(r, 'os_numero', { oninput: (e) => { r.os_numero = e.target.value; resumir(); } })), campo('Valor da O.S. (R$)', oInp)),
        campo('Objeto específico da O.S.', inputArea(r, 'objeto_especifico', { placeholder: 'O que esta O.S. autoriza executar' })),
        campo('Valor da O.S. por extenso', oExt),
        h('div', { class: 'dica' }, 'Campos da O.S. vazios são removidos automaticamente do documento.')], true);
    })() : null;

    const listaAdit = h('div');
    const pintarAdit = () => {
      rc(listaAdit, r.aditivos.length ? r.aditivos.map((a, i) => h('div', { class: nc('adit') },
        h('span', { class: nc('nr') }, (i + 1) + 'º'),
        h('span', { class: nc('c') }, h('b', {}, (i + 1) + 'º termo aditivo · ' + ROT_ADIT[a.tipo || 'outro']), h('span', {}, textoAditivo(a) || '—')),
        aditivosNovos.includes(a) ? h('button', { type: 'button', class: nc('ic-bt'), style: { width: '34px', height: '34px' }, 'aria-label': 'Remover aditivo', onclick: () => {
          r.aditivos.splice(i, 1); aditivosNovos.splice(aditivosNovos.indexOf(a), 1);
          if (a._antes) { r.prazo_execucao = a._antes.execucao; r.vigencia = a._antes.vigencia; inpExec.value = r.prazo_execucao || ''; inpVig.value = r.vigencia || ''; }
          pintarAdit(); resumir();
        } }, ico('x')) : null))
        : h('div', { class: 'sub' }, 'Nenhum termo aditivo. Quando o ' + rot + ' for prorrogado ou tiver o valor alterado, registre aqui: as datas acima se atualizam e o histórico fica guardado na atividade da obra.'));
    };
    const inpExec = data('prazo_execucao'), inpVig = data('vigencia');
    const secPrazos = bloco('prazos', 'Prazos e termos aditivos', [
      h('div', { class: 'grade2' },
        tipo === 'contrato' ? campo('Prazo de execução (data final)', inpExec) : null,
        campo('Prazo de vigência (data final)', inpVig)),
      campo('Início (O.S. ou assinatura) — opcional', data('data_inicio'), 'Usado só para desenhar a barra de andamento dos prazos.'),
      listaAdit,
      h('button', { type: 'button', class: 'btn', onclick: async () => {
        const a = await dialogoAditivo(r, r.aditivos.length + 1);
        if (!a) return;
        a._antes = { execucao: r.prazo_execucao || '', vigencia: r.vigencia || '' };
        if (a.execucao) { r.prazo_execucao = a.execucao; inpExec.value = a.execucao; }
        if (a.vigencia) { r.vigencia = a.vigencia; inpVig.value = a.vigencia; }
        r.aditivos.push(a); aditivosNovos.push(a); pintarAdit(); resumir();
        toast('Aditivo registrado — salve o cadastro para gravar.');
      } }, '+ Registrar termo aditivo'),
    ], true);
    pintarAdit();

    const secNotificada = bloco('notificada', (tipo === 'convenio' ? 'Convenente' : 'Contratada') + ' (notificada)', [
      campo('Nome / Razão social (como aparece no quadro)', inputTxt(r, 'n_nome', { placeholder: tipo === 'convenio' ? 'PREFEITURA MUNICIPAL DE CLÁUDIA' : 'HFC CONSTRUTORA E ENGENHARIA LTDA', oninput: (e) => { r.n_nome = e.target.value; resumir(); } })),
      campo('Nome usado no texto', nomeTexto, 'Usado nas frases “firmado entre a Secretaria… e a ___” e “NOTIFICAR a ___”.'),
      h('div', { class: 'grade2' },
        campo('CNPJ', inputTxt(r, 'n_cnpj', { inputmode: 'numeric' })),
        campo('Telefone', inputTxt(r, 'n_telefone', { inputmode: 'tel' }))),
      campo('Representante legal', inputTxt(r, 'n_representante')),
      campo('Logradouro', inputTxt(r, 'n_logradouro')),
      h('div', { class: 'grade2' },
        campo('Bairro', inputTxt(r, 'n_bairro')),
        campo('CEP', inputTxt(r, 'n_cep', { inputmode: 'numeric' }))),
      campo('Município/UF', inputTxt(r, 'n_municipio', { placeholder: 'Ex.: Sinop/MT' }))], !existente);

    const secAss = bloco('assin', 'Assinaturas deste ' + rot, [
      h('p', { class: 'sub', style: { margin: 0 } }, 'Vêm dos padrões definidos em Ajustes. Altere aqui só se este ' + rot + ' tiver fiscais diferentes.'),
      h('h3', { class: 'sub', style: { margin: '6px 0 0' } }, 'Fiscais'), editorAssinantes(r.fiscais, pessoas, 'fiscal', true, tipo),
      h('h3', { class: 'sub', style: { margin: '6px 0 0' } }, 'Coordenadores'), editorAssinantes(coords, pessoas, 'coordenador', false, tipo)], false);

    const ultimaInp = h('input', { type: 'number', min: '0', value: r.ultima_notif_anterior == null ? '' : r.ultima_notif_anterior, oninput: (e) => { r.ultima_notif_anterior = e.target.value === '' ? null : parseInt(e.target.value, 10); } });
    const secPad = bloco('padroes', 'Padrões das notificações', [
      campo('Última notificação emitida antes de usar o app', ultimaInp, 'Ex.: se já foram emitidas 5 notificações, informe 5 (a próxima será a 6ª). Se ficar vazio, o app pergunta na primeira notificação.'),
      campo('Prazo para resposta (dias úteis)', h('input', { type: 'number', min: '1', value: r.prazo_dias || CONFIG.prazo_padrao, oninput: (e) => { r.prazo_dias = parseInt(e.target.value, 10) || CONFIG.prazo_padrao; resumir(); } }))], false);

    const sancArea = areaRica(r, 'sancoes', { placeholder: 'Em branco = usa as sanções do modelo do Word.', style: { minHeight: '180px' } });
    const secSanc = bloco('sanc', 'Sanções administrativas', [
      h('p', { class: 'sub', style: { margin: 0 } }, 'Texto da seção “Possíveis sanções administrativas” deste ' + rot + '. Deixe em branco para usar o texto padrão do modelo.'),
      sancArea,
      h('div', { class: 'dica' }, 'Cada linha vira um parágrafo · selecione um trecho e toque em B, I ou U (ex.: “16.1.” em negrito).'),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', type: 'button', onclick: async () => {
          if (r.sancoes && r.sancoes.trim() && !(await confirmar('Substituir o texto atual pelo texto padrão do modelo?', 'Substituir'))) return;
          try {
            const txt = await DocGen.extrairTextoBloco(await modeloDocx(tipo), 'sancoes_padrao');
            if (!txt) { toast('O modelo atual não tem o bloco de sanções marcado.', true); return; }
            r.sancoes = txt; sancArea.value = txt; toast('Texto padrão carregado — edite o que precisar.');
          } catch (e) { toast(e.message, true); }
        } }, '⇩ Carregar texto padrão para editar'),
        h('button', { class: 'btn peq', type: 'button', onclick: () => { r.sancoes = ''; sancArea.value = ''; toast('Usará o texto padrão do modelo.'); } }, 'Usar padrão do modelo'))], !!(r.sancoes && r.sancoes.trim()));

    const resumir = () => {
      const set = (k, t) => { if (resumos[k]) resumos[k].textContent = t; };
      set('dados', [r.numero && 'nº ' + r.numero, r.processo && 'processo ' + r.processo].filter(Boolean).join(' · ') || 'nome, número, objeto, valor');
      set('os', String(r.os_numero || '').trim() ? 'O.S. nº ' + r.os_numero : 'opcional');
      set('prazos', [tipo === 'contrato' ? 'execução ' + (r.prazo_execucao ? X.dataBR(r.prazo_execucao) : '—') : '', 'vigência ' + (r.vigencia ? X.dataBR(r.vigencia) : '—'), r.aditivos.length ? plural(r.aditivos.length, 'aditivo', 'aditivos') : ''].filter(Boolean).join(' · '));
      set('notificada', r.n_nome || '—');
      set('assin', 'fiscais e coordenadores');
      set('padroes', 'prazo de ' + (r.prazo_dias || CONFIG.prazo_padrao) + ' dias úteis');
      set('sanc', r.sancoes && r.sancoes.trim() ? 'texto próprio' : 'texto padrão do modelo');
    };
    resumir();

    const salvar = async () => {
      if (!r.apelido || !r.apelido.trim()) { toast('Informe o nome curto.', true); const d = document.querySelector('[data-bloco="dados"]'); if (d) d.open = true; return; }
      r.coordenadores = coords.map((c) => c.pessoaId).filter(Boolean);
      r.fiscais = r.fiscais.filter((f) => f.pessoaId);
      if (!r.n_nome_texto) r.n_nome_texto = '';
      for (const a of r.aditivos) delete a._antes;
      const salvo = existente ? await salvarMudancas('registros', baseReg, r) : await DB.salvar('registros', r, email());
      // atividade da obra: aditivos novos e as alterações que importam para o acompanhamento
      try {
        for (const a of aditivosNovos) await registrarAtividade(salvo.id, 'aditivo', (r.aditivos.indexOf(a) + 1) + 'º termo aditivo · ' + ROT_ADIT[a.tipo || 'outro'], textoAditivo(a));
        if (existente) {
          const mud = [];
          const dt = (v) => (v ? X.dataBR(v) : '—');
          const cmp = (k, rotulo, fmt) => { const a = baseReg[k] || '', b = r[k] || ''; if (String(a).trim() !== String(b).trim()) mud.push(rotulo + ': ' + (fmt ? fmt(a) : a || '—') + ' → ' + (fmt ? fmt(b) : b || '—')); };
          cmp('status_obra', 'Situação');
          if (!aditivosNovos.length) { cmp('prazo_execucao', 'Execução', dt); cmp('vigencia', 'Vigência', dt); }
          cmp('os_numero', 'O.S. nº');
          if (String(baseReg.objeto_especifico || '').trim() !== String(r.objeto_especifico || '').trim()) mud.push('Objeto específico da O.S. alterado');
          cmp('n_nome', tipo === 'convenio' ? 'Convenente' : 'Contratada');
          cmp('aniv_data', 'Aniversário', dt); cmp('aniv_indice', 'Índice de reajuste');
          cmp('valor', 'Valor', (v) => (v ? 'R$ ' + X.formatarMoeda(X.parseMoeda(v)) : '—'));
          if (mud.length) await registrarAtividade(salvo.id, 'edicao', 'Dados alterados', mud.join('\n'));
        }
      } catch (e) { console.warn('atividade', e); }
      toast('Cadastro salvo');
      location.replace('#/registro/' + salvo.id);
    };
    const acoes = h('div', { class: nc('fixo'), style: { position: 'sticky' } },
      h('button', { class: 'btn pri', onclick: salvar }, 'Salvar'),
      h('button', { class: 'btn', style: { flex: '0 0 auto' }, onclick: () => history.back() }, 'Cancelar'),
      existente ? h('button', { class: 'btn perigo', style: { flex: '0 0 auto' }, onclick: async () => {
        if (await confirmar('Excluir este cadastro? O histórico de notificações continuará guardado no servidor, mas ficará oculto.', 'Excluir', true)) {
          await DB.excluir('registros', existente.id, email());
          location.replace('#/obras');
        }
      } }, 'Excluir') : null);
    rcT(tk, h('div', { class: nc('pag') + ' form-obra' },
      existente ? h('div', { class: nc('sub'), style: { margin: '0 2px 10px' } }, existente.apelido || '') : h('div', { class: nc('seg'), style: { marginBottom: '12px' } },
        h('button', { class: tipo === 'contrato' ? nc('on') : null, onclick: () => { if (tipo !== 'contrato') location.replace('#/novo/contrato'); } }, 'Contrato'),
        h('button', { class: tipo === 'convenio' ? nc('on') : null, onclick: () => { if (tipo !== 'convenio') location.replace('#/novo/convenio'); } }, 'Convênio')),
      st, secDados, secOS, secPrazos, secNotificada, secAss, secPad, secSanc, acoes));
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
        if (opt.irregular && !opt.semDescricao) {
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

  // lado do aparelho onde fica o "pé" do celular deitado (botões da sequência vão para esse lado)
  function ladoBaixo() {
    let a = 0;
    try { a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0); } catch (e) { /* */ }
    a = ((a % 360) + 360) % 360;
    // ângulo 90: o topo foi para a esquerda, o pé do aparelho fica à direita; 270: o pé fica à esquerda
    // (no iPhone window.orientation = 90 quando o topo vai para a esquerda; -90 quando vai para a direita)
    document.documentElement.dataset.lado = a === 270 ? 'esq' : 'dir';
  }
  ['orientationchange', 'resize'].forEach((ev) => addEventListener(ev, ladoBaixo));
  try { if (screen.orientation) screen.orientation.addEventListener('change', ladoBaixo); } catch (e) { /* */ }
  ladoBaixo();

  async function telaVisita(id, sub) {
    const tk = rotaSeq; // a tela desiste se o usuário já foi para outra
    const v0 = await DB.get('visitas', id);
    if (!v0 || v0.excluido) { rcT(tk, h('div', { class: 'vazio' }, 'Visita não encontrada.')); return; }
    const r = await DB.get('registros', v0.registroId);
    if (!r) { rcT(tk, h('div', { class: 'vazio' }, 'Obra desta visita não encontrada.')); return; }
    if (sub === 'encerrar') return telaEncerrar(v0, r, tk);
    marcarNav('registro');
    titulo('Visita nº ' + v0.numero + ' · ' + r.apelido, true);
    const v = JSON.parse(JSON.stringify(v0));
    let vBase = clonar(v0);
    const podeEd = pode.coletar();
    const aberta = v.status !== 'concluida';
    const pessoas = await pessoasMap();
    let sujo = false, versao = 0, tAuto = null, filaSalvar = Promise.resolve();
    /* Salvamento automático (3.15.7): os dados da visita (observações gerais etc.) são gravados 1,5 s depois
       de parar de digitar, ao sair da tela e quando o app vai para segundo plano (tela apagada, outro app). */
    const statusAuto = h('span', { class: 'sub auto-status' }, podeEd ? 'As alterações são salvas automaticamente.' : '');
    const statusObs = h('div', { class: nc('auto') });
    const marcar = () => {
      sujo = true; versao++;
      if (!podeEd) return;
      clearTimeout(tAuto);
      rc(statusAuto, 'Alterações ainda não salvas…'); rc(statusObs, 'Salvando…'); statusObs.className = nc('auto');
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
      if (!sujo) { rc(statusAuto, '✓ Salvo às ' + horaAgora()); rc(statusObs, ico('ok'), 'Salvo automaticamente às ' + horaAgora()); statusObs.className = nc('auto ok'); }
    }));
    const autoSalvar = async () => {
      if (!sujo || !podeEd) return;
      try { await salvarVisita(true); } catch (e) { rc(statusAuto, '⚠️ Não foi possível salvar: ' + e.message); rc(statusObs, '⚠️ Não foi possível salvar: ' + e.message); }
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

    /* --- cabeçalho (modo campo) --- */
    const gps = h('div', { class: 'gps' }, h('span', { class: 'carregando' }), ' Obtendo localização GPS…');
    const relogio = h('span', { class: nc('relogio' + (aberta ? '' : ' fim')) }, aberta ? tempoVisita(v) : 'Concluída');
    const cab = h('div', { class: nc('campo-topo') },
      h('div', { class: nc('l1') },
        h('div', { class: nc('c') },
          h('a', { class: nc('t'), href: '#/registro/' + r.id, style: { color: 'inherit', textDecoration: 'none' } }, r.apelido),
          h('div', { class: 'sub' }, 'Visita nº ' + v.numero + ' · ' + X.dataBR(v.data) + (v.hora_inicio ? ' · início ' + v.hora_inicio : '') + (v.hora_fim ? ' · fim ' + v.hora_fim : ''))),
        relogio),
      aberta && podeEd ? gps : null);
    if (aberta) { const t = setInterval(() => { if (!document.body.contains(relogio)) { clearInterval(t); return; } relogio.textContent = tempoVisita(v); }, 20000); }

    /* --- captura --- */
    const status = h('div', { class: 'sub', style: { minHeight: '18px', margin: '6px 2px 0' } });
    const opt = { carimbarGaleria: await DB.kvGet('carimbarGaleria', false), irregular: false };
    const inpCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'oculto' });
    const inpGal = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'oculto' });
    let fila = Promise.resolve();
    const avisoSalvas = (n, nIrr) => rc(status, n ? '✅ ' + n + ' foto(s) salva(s)' + (nIrr ? ' · ⚠️ ' + nIrr + ' irregularidade(s)' : '') + '.' : '');
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
      avisoSalvas(nFotos, nIrr);
      desenharFotos();
    };
    const aoSelecionar = async (inp, origem) => {
      const f = Array.from(inp.files); inp.value = '';
      if (!f.length) return;
      const salvas = await salvarFotos(f, origem, r, v0, Object.assign({}, opt), status);
      avisoSalvas(salvas.length, salvas.filter((x) => x.irregular).length);
      desenharFotos();
    };
    inpCam.addEventListener('change', () => aoSelecionar(inpCam, 'camera'));
    inpGal.addEventListener('change', () => aoSelecionar(inpGal, 'galeria'));

    /* câmera do próprio celular em sequência: o navegador abre uma foto por toque, então depois de cada foto
       fica uma barra no polegar com "Próxima foto" e "Irregular" (sem voltar ao topo da página) */
    const seq = { ativa: false, ids: [], pulso: false };
    const barraSeq = h('div', { class: nc('fixo seq solta'), style: { display: 'none' } });
    const inNativa = (irr, rotulo) => {
      const i = h('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': rotulo });
      i.addEventListener('change', () => fotosNativas(Array.from(i.files || []), irr).finally(() => { i.value = ''; }));
      return i;
    };
    const fotosNativas = async (arqs, irregular) => {
      if (!arqs.length) return;
      seq.ativa = true;
      const salvas = await salvarFotos(arqs, 'camera', r, v0, { irregular, semDescricao: true }, status);
      if (!salvas.length) return;
      seq.ids.push(...salvas.map((x) => x.id)); seq.pulso = true;
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* */ }
      avisoSalvas(salvas.length, salvas.filter((x) => x.irregular).length);
      await desenharFotos();
    };
    async function pintarSeq(todas) {
      if (!seq.ativa) { barraSeq.style.display = 'none'; rc(barraSeq); return; }
      const lote = seq.ids.map((fid) => todas.find((x) => x.id === fid)).filter(Boolean);
      if (!lote.length) { seq.ativa = false; seq.ids = []; barraSeq.style.display = 'none'; rc(barraSeq); return; }
      const ult = lote[lote.length - 1], nIrr = lote.filter((x) => x.irregular).length;
      const tira = h('div', { class: nc('seq-tira') }, lote.slice(-4).map((x, i, a) => { const el = h('i', { class: x.irregular ? nc('irr') : null }, i === a.length - 1 ? h('b', {}, ico('ok')) : null); urlFoto(x).then((u) => { if (u) el.style.backgroundImage = 'url("' + u + '")'; }); return el; }));
      barraSeq.style.display = '';
      rc(barraSeq, h('div', { class: nc('seq-card' + (seq.pulso ? ' pulso' : '')) },
        h('div', { class: nc('seq-l1') }, tira,
          h('div', { class: nc('c') }, h('b', {}, ult.irregular ? 'Irregularidade salva' : 'Foto salva'), h('span', {}, h('span', { class: nc('num') }, String(lote.length)), ' agora' + (nIrr ? ' (' + nIrr + ' irreg.)' : '') + ' · ', h('span', { class: nc('num') }, String(todas.length)), ' na visita')),
          h('button', { class: nc('seq-x'), 'aria-label': 'Apagar a última foto', title: 'Apagar a última foto', onclick: async () => {
            if (!(await confirmar('Apagar a última foto tirada?', 'Apagar', true))) return;
            await executarExclusao(await planoExclusao([ult.id]));
            seq.ids = seq.ids.filter((x) => x !== ult.id); seq.pulso = false;
            toast('Foto apagada'); desenharFotos();
          } }, ico('lixo')),
          h('button', { class: nc('seq-x'), 'aria-label': 'Terminar a sequência', title: 'Terminar', onclick: () => { seq.ativa = false; seq.ids = []; desenharFotos(); } }, ico('x'))),
        h('div', { class: nc('seq-bts') },
          h('label', { class: 'btn pri ' + nc('seq-bt') }, ico('cam'), 'Próxima foto', inNativa(false, 'Próxima foto')),
          h('label', { class: 'btn ' + nc('seq-bt seq-bt-irr') }, ico('alerta'), 'Irregular', inNativa(true, 'Fotografar uma irregularidade'))),
        ult.irregular && !String(ult.descricao || '').trim() ? h('button', { class: nc('seq-desc'), onclick: () => descreverIrregularidade(ult).then(desenharFotos) }, ico('lapis'), 'Descrever', h('span', { class: nc('lg') }, ' agora (ou depois)')) : null));
      seq.pulso = false;
    }
    const labelNativa = (cls, icn, cor, txt, irr) => h('label', { class: nc('peq') + (cls ? ' ' + cls : '') }, h('span', { class: nc('ic ' + cor) }, ico(icn)), txt, inNativa(irr, txt));
    const chkGal = h('input', { type: 'checkbox', checked: opt.carimbarGaleria ? 'checked' : null, onchange: (e) => { opt.carimbarGaleria = e.target.checked; DB.kvSet('carimbarGaleria', e.target.checked); } });
    const captura = podeEd && aberta ? h('div', { class: nc('captura-box') },
      h('div', { class: nc('captura') },
        h('button', { class: nc('grande'), 'data-acao': 'camera', onclick: () => disparar(false) }, h('span', { class: nc('ic') }, ico('cam')), h('span', {}, h('b', {}, prefCamera() === 'aparelho' ? 'Câmera' : 'Câmera do app'), h('span', {}, prefCamera() === 'aparelho' ? 'Abre a câmera do celular' : 'Fica aberta: foto atrás de foto, sem confirmar cada uma'))),
        h('div', { class: nc('col col3') },
          labelNativa('', 'cam', 'acc', 'Câmera do celular', false),
          h('button', { class: nc('peq'), 'data-acao': 'irregularidade', onclick: () => disparar(true) }, h('span', { class: nc('ic er') }, ico('alerta')), 'Irregu­laridade'),
          h('button', { class: nc('peq'), 'data-acao': 'galeria', onclick: () => disparar(false, true) }, h('span', { class: nc('ic in') }, ico('foto')), 'Da galeria'))),
      h('div', { class: nc('captura-extra') },
        h('button', { class: 'btn peq', onclick: () => disparar(true, true) }, '🖼️ Irregularidade da galeria'),
        h('label', { class: 'linha sub', style: { gap: '6px' } }, chkGal, ' Carimbar data/hora/GPS nas fotos da galeria')),
      status, inpCam, inpGal) : (podeEd ? h('div', {}, status, inpCam, inpGal) : null);

    /* --- fotos --- */
    const boxFotos = h('div');
    const boxIrr = h('div');
    const boxPend = h('div');
    const bannerPend = h('div');
    let redesenharFotosDepois = false;
    /* 3.18.1: "Selecionar" no cartão das fotos — marca várias (toque; no computador Shift + clique marca o intervalo)
       para compartilhar ou baixar de uma vez. Enquanto seleciona, tocar não abre a foto e arrastar não muda a ordem. */
    let selFotos = null, ultSel = -1;
    const sairSel = () => { selFotos = null; ultSel = -1; desenharFotos(); };
    const escSel = (e) => {
      if (!document.body.contains(boxFotos)) { document.removeEventListener('keydown', escSel); return; }
      if (e.key === 'Escape' && selFotos && !document.querySelector('.modal-fundo')) sairSel();
    };
    document.addEventListener('keydown', escSel);
    async function desenharFotos() {
      if (arrastandoFoto) { redesenharFotosDepois = true; return; } // não desmancha a grade no meio de um arraste
      redesenharFotosDepois = false;
      const fotos = ordenarFotos((await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido));
      const irr = fotos.filter((f) => f.irregular);
      if (selFotos) { // fotos excluídas (aqui ou em outro aparelho) saem da seleção
        const ids = new Set(fotos.map((f) => f.id));
        for (const x of Array.from(selFotos)) if (!ids.has(x)) selFotos.delete(x);
        if (!fotos.length) selFotos = null;
      }
      const sel = selFotos;
      let pintarSel = () => {};
      const alternar = (f, ev) => {
        const i = fotos.indexOf(f), marcar = !sel.has(f.id);
        const faixa = ev && ev.shiftKey && ultSel >= 0 && ultSel < fotos.length ? fotos.slice(Math.min(ultSel, i), Math.max(ultSel, i) + 1) : [f];
        for (const x of faixa) { if (marcar) sel.add(x.id); else sel.delete(x.id); }
        ultSel = i;
        if (ev && ev.shiftKey) { try { window.getSelection().removeAllRanges(); } catch (e) { /* */ } }
        pintarSel();
      };
      const grade = fotos.length ? gradeFotos(fotos, { marcarRelatorio: true, marcar: sel, onclick: (f, ev) => (sel ? alternar(f, ev) : abrirFoto(f, desenharFotos, fotos)) }) : null;
      const ordenar = podeEd && fotos.length > 1 && !sel;
      if (ordenar) tornarOrdenavel(grade, async (fid, ids) => { if (fid) await moverFoto(fotos, ids, fid); desenharFotos(); });
      const tit = h('h2', {}, 'Fotos da visita (' + fotos.length + ')');
      const btSel = fotos.length ? h('button', { type: 'button', class: 'fotos-bt-sel', 'data-acao': 'selecionar', onclick: () => { if (selFotos) sairSel(); else { selFotos = new Set(); ultSel = -1; desenharFotos(); } } }, sel ? 'Cancelar' : 'Selecionar') : null;
      let faixa = null;
      if (sel) {
        const chkTodas = h('input', { type: 'checkbox', onchange: () => { if (chkTodas.checked) fotos.forEach((f) => sel.add(f.id)); else sel.clear(); ultSel = -1; pintarSel(); } });
        const icoComp = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
        const icoBaixar = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';
        const rotBaixar = h('span');
        const escolhidas = () => fotos.filter((f) => sel.has(f.id)).reverse(); // do mais antigo ao mais novo, como no relatório
        const agir = async (modo, bt) => {
          bt.disabled = true;
          try { if (await exportarFotos(escolhidas(), r, v0, modo)) sairSel(); } finally { bt.disabled = false; pintarSel(); }
        };
        const btComp = compartilhaArquivos() ? h('button', { type: 'button', class: 'btn', 'data-acao': 'compartilhar-sel', onclick: () => agir('compartilhar', btComp) }) : null;
        if (btComp) { btComp.innerHTML = icoComp; ap(btComp, h('span', {}, 'Compartilhar')); }
        const btBaixar = h('button', { type: 'button', class: 'btn pri', 'data-acao': 'baixar-sel', onclick: () => agir('baixar', btBaixar) });
        btBaixar.innerHTML = icoBaixar; ap(btBaixar, rotBaixar);
        const fora = h('span', { class: 'sub fotos-de' }, 'de ' + plural(fotos.length, 'foto', 'fotos'));
        faixa = h('div', { class: 'fotos-faixa' },
          h('label', { class: 'fotos-todas' }, chkTodas, h('span', {}, 'Selecionar todas')), fora,
          h('span', { class: 'sub fotos-shift' }, 'Shift + clique marca um intervalo'),
          h('div', { class: 'fotos-sel-acoes' }, btComp, btBaixar));
        pintarSel = () => {
          const n = sel.size;
          tit.textContent = n ? plural(n, 'selecionada', 'selecionadas') : 'Toque nas fotos para marcar';
          chkTodas.checked = n > 0 && n === fotos.length;
          chkTodas.indeterminate = n > 0 && n < fotos.length;
          rotBaixar.textContent = 'Baixar' + (n ? ' (' + n + ')' : '');
          btBaixar.disabled = !n; if (btComp) btComp.disabled = !n;
          for (const el of grade.children) el.classList.toggle('marcada', sel.has(el.dataset.id));
        };
        pintarSel();
      }
      rc(boxFotos, h('div', { class: 'fotos-cab' }, tit, btSel), faixa,
        grade || h('div', { class: 'vazio', style: { padding: '14px' } }, aberta && podeEd ? 'Nenhuma foto ainda. Toque em Câmera.' : 'Nenhuma foto ainda.'),
        ordenar ? h('div', { class: 'dica' }, 'No relatório, as fotos saem de baixo para cima: a de baixo é a primeira e a de cima, a última. Para mudar a ordem, segure a foto e arraste (no computador, clique e arraste).') : null,
        fotos.some((f) => f.fora_relatorio) && !sel ? h('div', { class: 'dica' }, 'Fotos esmaecidas não entram no relatório.') : null);

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
          return h('div', { class: 'li', style: { cursor: 'pointer' }, onclick: () => abrirFoto(f, desenharFotos, irr) }, img, h('div', { style: { flex: 1 } }, h('div', {}, f.descricao || h('span', { style: { color: 'var(--alerta)' } }, '(sem descrição — toque para descrever)')), h('div', { class: 'sub' }, dataHoraBR(f.dataHora))));
        })) : h('div', { class: 'sub' }, 'Nenhuma irregularidade registrada nesta visita.'),
        nIrr && pode.notificar() ? h('div', { class: 'acoes' }, h('button', { class: 'btn', onclick: async () => { await salvarVisita(true); notificarVisita(v0, r); } }, '📝 Gerar notificação com estas irregularidades')) : null,
        reverif.length ? h('div', { class: 'dica' }, 'Irregularidades não sanadas entram na notificação com a foto nova desta visita.') : null);
      boxIrr.className = 'card';
      boxFotos.className = 'card' + (sel ? ' fotos-selecao' : '');
      const pend = (await irregularidadesDe(r.id)).filter((f) => situacao(f) === 'pendente' && f.visitaId !== id);
      const conferidas = pend.filter((f) => (f.verificacoes || []).some((vf) => vf.visitaId === id));
      const abertasP = pend.length - conferidas.length;
      rc(bannerPend, pend.length && aberta ? h('button', { class: nc('pend'), style: abertasP ? null : { background: 'var(--ok-bg)', color: 'var(--ok)' }, onclick: () => abrirIrregularidades(pend.find((f) => !conferidas.includes(f)) || pend[0], pend, 'Pendências a verificar', id, desenharFotos) },
        h('span', { class: nc('ic'), style: { width: '36px', height: '36px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.5)', flex: 'none' } }, ico(abertasP ? 'alerta' : 'ok')),
        h('span', { class: nc('c') }, h('b', {}, abertasP ? plural(abertasP, 'pendência de visita anterior', 'pendências de visitas anteriores') : 'Pendências conferidas nesta visita'), h('span', {}, abertasP ? 'Confira na obra se foi sanada' : 'Toque para rever')),
        ico('dir')) : null);
      rc(boxPend, h('h2', {}, '📋 Pendências de visitas anteriores (' + pend.length + ')'),
        pend.length ? h('p', { class: 'sub' }, 'Verifique cada uma e registre se foi sanada, com foto e descrição do que foi feito.') : h('div', { class: 'sub' }, 'Nenhuma irregularidade pendente nesta obra.'),
        pend.map((f) => itemIrregularidade(f, () => abrirIrregularidades(f, pend, 'Pendências a verificar', id, desenharFotos))));
      boxPend.className = 'card';
      boxPend.style.display = pend.length || !aberta ? '' : 'none';
      await pintarSeq(fotos);
    }

    /* --- dados --- */
    const edFiscais = (v.fiscais || []).map((f) => ({ pessoaId: f.pessoaId, funcao: f.funcao }));
    const ro = !podeEd;
    const num = (k, attrs) => h('input', Object.assign({ type: 'number', inputmode: 'decimal', value: v[k] == null ? '' : v[k], readonly: ro,
      oninput: (e) => { v[k] = e.target.value === '' ? null : Number(e.target.value); marcar(); } }, attrs || {}));
    const txt = (k, attrs) => inputTxt(v, k, Object.assign({ readonly: ro, oninput: (e) => { v[k] = e.target.value; marcar(); } }, attrs || {}));
    const area = (k, attrs) => areaRica(v, k, Object.assign({ readonly: ro, oninput: (e) => { v[k] = e.target.value; marcar(); } }, attrs || {}));

    // observações gerais à vista (o que mais se escreve na obra)
    const obs = h('div', { class: nc('obs') }, campo('Observações gerais', area('observacoes', { placeholder: 'O que foi visto na obra…' }), 'Selecione um trecho e toque em B, I ou U · cada linha vira um parágrafo.'), podeEd ? statusObs : null);

    // condições do canteiro: clima em botões, trabalhadores com + e −, avanço em barra
    const climaBox = h('div', { class: nc('climas') });
    const pintarClima = () => rc(climaBox, CLIMAS.filter(Boolean).map((c) => h('button', { type: 'button', class: v.clima === c ? nc('on') : null, disabled: ro, onclick: () => { v.clima = v.clima === c ? '' : c; pintarClima(); marcar(); } }, c)));
    pintarClima();
    const inpTrab = num('trabalhadores', { min: '0', step: '1', inputmode: 'numeric' });
    const passoTrab = (dlt) => { if (ro) return; v.trabalhadores = Math.max(0, (+v.trabalhadores || 0) + dlt); inpTrab.value = v.trabalhadores; marcar(); };
    const rotAv = h('b', { class: nc('num') }, v.avanco_exec == null ? '—' : v.avanco_exec + '%');
    const inpAv = num('avanco_exec', { min: '0', max: '100', step: '0.1' });
    const rng = h('input', { type: 'range', min: '0', max: '100', step: '1', value: v.avanco_exec == null ? 0 : v.avanco_exec, disabled: ro, 'aria-label': 'Avanço físico executado',
      oninput: (e) => { v.avanco_exec = Number(e.target.value); inpAv.value = v.avanco_exec; rotAv.textContent = v.avanco_exec + '%'; marcar(); } });
    inpAv.addEventListener('input', () => { rng.value = v.avanco_exec == null ? 0 : v.avanco_exec; rotAv.textContent = v.avanco_exec == null ? '—' : v.avanco_exec + '%'; });
    const condicoes = h('div', {},
      h('div', { class: nc('sec') }, h('h2', {}, 'Condições do canteiro')),
      h('div', { class: nc('passos') },
        h('div', { class: nc('passo'), style: { gridColumn: '1 / -1' } }, h('span', {}, 'Condições do tempo'), climaBox),
        h('label', { class: 'campo ' + nc('passo'), style: { margin: 0 } }, h('span', {}, 'Trabalhadores no canteiro'),
          h('div', { class: nc('mm') }, h('button', { type: 'button', 'aria-label': 'Menos', onclick: (e) => { e.preventDefault(); passoTrab(-1); } }, '−'), inpTrab, h('button', { type: 'button', 'aria-label': 'Mais', onclick: (e) => { e.preventDefault(); passoTrab(1); } }, '+'))),
        h('div', { class: nc('passo') }, h('span', {}, 'Avanço físico executado · ', rotAv), rng)));

    const dados = h('details', { class: 'card', open: sessionStorage.getItem('visita_dados_aberto') === '1' ? true : null,
      ontoggle: (e) => sessionStorage.setItem('visita_dados_aberto', e.target.open ? '1' : '0') },
      h('summary', { style: { fontWeight: '600', cursor: 'pointer' } }, 'Mais dados da visita (para o relatório)'),
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
        campo('Serviços em execução', area('servicos', { style: { minHeight: '60px' } })),
        h('div', { class: 'grade2' },
          campo('Avanço físico executado (%)', inpAv),
          campo('Avanço previsto no cronograma (%)', num('avanco_prev', { min: '0', max: '100', step: '0.1' }))),
        podeEd ? h('div', { class: 'linha', style: { flexWrap: 'wrap', gap: '10px', alignItems: 'center' } },
          h('button', { class: 'btn', onclick: () => salvarVisita() }, '💾 Salvar agora'), statusAuto) : null));

    /* --- ações --- */
    const excluir = (pode.admin() || v0.criadoPor === email()) ? h('button', { class: 'btn peq perigo', onclick: async () => {
      const idsFotos = (await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido).map((f) => f.id);
      if (!(await excluirFotos(idsFotos, 'Excluir esta visita e todas as ' + idsFotos.length + ' foto(s) dela? As verificações de irregularidades feitas nesta visita também saem do histórico.', id))) return;
      await DB.excluir('visitas', id, email());
      App._sairNotif = null;
      atualizarNavCam();
      location.replace('#/registro/' + r.id);
    } }, 'Excluir visita') : null;
    const relatorio = h('button', { class: 'btn', onclick: async () => { if (podeEd && sujo) await salvarVisita(true); dialogoRelatorio(v0, r); } }, '📄 Relatório fotográfico');
    const rodape = aberta && podeEd
      ? h('div', { class: nc('fixo') + ' fixo-visita' }, h('button', { class: 'btn', style: { flex: '0 0 auto' }, onclick: async () => { if (sujo) await salvarVisita(true); toast('Visita pausada: continua aberta e aparece no Início.'); location.hash = '#/inicio'; } }, '⏸ Pausar'),
        h('button', { class: 'btn pri', onclick: async () => { if (sujo) await salvarVisita(true); location.hash = '#/visita/' + id + '/encerrar'; } }, '✓ Encerrar visita'))
      : h('div', { class: 'card' }, h('h2', {}, 'Relatório e visita'),
        h('div', { class: 'acoes' },
          h('button', { class: 'btn pri', onclick: async () => { if (podeEd && sujo) await salvarVisita(true); dialogoRelatorio(v0, r); } }, '📄 Relatório fotográfico'),
          podeEd && !aberta ? h('button', { class: 'btn peq', onclick: async () => { v.status = 'andamento'; await salvarVisita(true); atualizarNavCam(); telaVisita(id); } }, 'Reabrir visita') : null,
          excluir));

    rcT(tk, h('div', { class: nc('pag') + ' visita-campo' }, cab, bannerPend, captura, boxFotos, boxIrr,
      aberta || String(v.observacoes || '').trim() ? h('div', { class: 'card' }, obs) : null,
      condicoes, h('div', { style: { height: '12px' } }), dados, boxPend,
      aberta && podeEd ? h('div', { class: 'acoes', style: { margin: '4px 2px 0' } }, relatorio, excluir) : null,
      rodape), barraSeq);
    await desenharFotos();
    if (tk !== rotaSeq) return; // o usuário já foi para outra tela: não liga GPS nem registra limpeza
    // vindo do botão da câmera na barra de baixo: abre a câmera / grava as fotos tiradas com a câmera do celular
    const pedido = (() => { try { const x = sessionStorage.getItem('abrir_camera'); sessionStorage.removeItem('abrir_camera'); return x; } catch (e) { return null; } })();
    if (App._fotosNativas && App._fotosNativas.visitaId === id) { const fn = App._fotosNativas; App._fotosNativas = null; fotosNativas(fn.arquivos, fn.irregular); }
    else if (pedido === id && aberta && podeEd) disparar(false);
    // no computador, as fotos da visita que estão só no Drive já começam a baixar (o relatório fica pronto mais rápido)
    if (Sync.dispositivo === 'computador' && Sync.habilitado() && navigator.onLine) {
      setTimeout(async () => {
        if (tk !== rotaSeq) return;
        const esp = await espacoAparelho();
        if (esp && esp.pouco) { Sync.log('fotos', 'aparelho quase sem espaço: download automático das fotos pausado'); return; }
        const fs = (await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido && f.driveId && !f.fora_relatorio);
        const tem = await Promise.all(fs.map((f) => DB.blobGet(f.id).then((b) => !!b)));
        const faltam = fs.filter((f, k) => !tem[k]);
        if (faltam.length) { Sync.log('fotos', 'baixando ' + faltam.length + ' foto(s) da visita em segundo plano'); obterFotos(faltam, null, 4).catch(() => {}); }
      }, 1500);
    }
    App._atualizarTela = () => (document.body.contains(boxFotos) ? desenharFotos() : null); // fotos de outros aparelhos aparecem sem sair da tela
    const sairSeq = () => { barraSeq.remove(); };
    if (aberta && podeEd) {
      Foto.iniciarGPS();
      const off = Foto.onGPS((p, err) => {
        if (!document.body.contains(gps)) { off(); return; }
        if (p) { gps.className = 'gps ' + (p.precisao <= 30 ? 'bom' : ''); rc(gps, '📍 ' + Foto.textoCoord(p.lat, p.lng) + ' · precisão ±' + p.precisao + ' m'); }
        else if (err) { gps.className = 'gps ruim'; rc(gps, '⚠️ GPS indisponível: ' + (err.code === 1 ? 'permissão negada — libere a localização para este app.' : 'ative a localização do aparelho.')); }
      });
      // ao sair da visita o GPS é desligado (antes ficava ligado até fechar o app, gastando bateria)
      App._sairTela = () => { off(); Foto.pararGPS(); sairSeq(); };
    } else { Foto.pararGPS(); App._sairTela = sairSeq; }
  }

  // descrição de uma irregularidade fotografada em sequência (sem travar a próxima foto)
  async function descreverIrregularidade(foto) {
    const edit = { descricao: foto.descricao || '' };
    const u = await urlFoto(foto);
    const desc = await modal('⚠️ Descreva a irregularidade', h('div', {},
      u ? h('img', { class: 'grande', src: u }) : null,
      campo('O que está irregular?', inputArea(edit, 'descricao', { placeholder: 'Ex.: Trincas no contrapiso do refeitório' }))),
    [{ txt: 'Não é irregularidade', valor: '__normal' }, { txt: 'Depois', valor: null },
      { txt: 'Salvar', cls: 'pri', valor: () => edit.descricao, antes: () => { if (!edit.descricao.trim()) { toast('Descreva a irregularidade (ou toque em Depois).', true); return false; } } }]);
    if (desc === null || desc === undefined) return;
    await atualizarCampos('fotos', foto.id, (o) => { if (desc === '__normal') o.irregular = false; else o.descricao = desc.trim(); });
  }

  /* ---------- encerrar a visita: conferência, notificação e documentos ---------- */
  async function telaEncerrar(v0, r, tk) {
    marcarNav('registro');
    titulo('Encerrar a visita nº ' + v0.numero, true);
    const id = v0.id;
    const fotos = (await DB.byIndex('fotos', 'visitaId', id)).filter((f) => !f.excluido);
    const irr = fotos.filter((f) => f.irregular), semDesc = irr.filter((f) => !String(f.descricao || '').trim()).length;
    const pend = (await irregularidadesDe(r.id)).filter((f) => situacao(f) === 'pendente' && f.visitaId !== id);
    const semConferir = pend.filter((f) => !(f.verificacoes || []).some((vf) => vf.visitaId === id));
    const reverif = await reverificadasNaVisita(r, id);
    const ck = (ok, t, s, bt) => h('div', { class: nc('check') },
      h('span', { class: nc('ic ' + (ok === true ? 'ok' : ok === false ? 'al' : 'in')) }, ico(ok === true ? 'ok' : ok === false ? 'alerta' : 'doc')),
      h('div', { class: nc('c') }, t, h('span', {}, s)), bt || null);
    const voltarVisita = h('a', { class: 'btn peq', href: '#/visita/' + id }, 'Abrir');
    const nGer = fotos.filter((f) => !f.irregular).length;
    const lista = h('div', { class: nc('lista') },
      ck(fotos.length > 0, plural(fotos.length, 'foto', 'fotos'), plural(nGer, 'geral', 'gerais') + ' · ' + irr.length + ' de irregularidade', fotos.length ? null : voltarVisita),
      ck(!!String(v0.observacoes || '').trim(), 'Observações gerais', String(v0.observacoes || '').trim() ? 'Preenchidas e salvas' : 'Ainda em branco', String(v0.observacoes || '').trim() ? null : h('a', { class: 'btn peq', href: '#/visita/' + id }, 'Escrever')),
      pend.length ? ck(semConferir.length === 0, 'Pendências de visitas anteriores', semConferir.length ? plural(semConferir.length, 'sem conferir', 'sem conferir') : 'Todas conferidas', semConferir.length ? h('button', { class: 'btn peq', onclick: () => abrirIrregularidades(semConferir[0], pend, 'Pendências a verificar', id, () => rotear()) }, 'Conferir') : null) : null,
      irr.length ? ck(semDesc === 0, plural(irr.length, 'irregularidade', 'irregularidades'), semDesc ? plural(semDesc, 'sem descrição', 'sem descrição') : 'Todas descritas', semDesc ? h('button', { class: 'btn peq', onclick: async () => { for (const f of irr.filter((x) => !String(x.descricao || '').trim())) await descreverIrregularidade(f); rotear(); } }, 'Descrever') : null) : null);
    const nNotif = irr.length + reverif.length;
    const quem = r.tipo === 'convenio' ? 'a prefeitura' : 'a empresa';
    const notificar = nNotif && pode.notificar() ? h('div', { class: nc('card'), style: { marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' } },
      h('span', { class: nc('ic'), style: { width: '42px', height: '42px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'var(--er-bg)', color: 'var(--er)', flex: 'none' } }, ico('sino')),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('b', {}, 'Notificar ' + quem + '?'), h('div', { class: nc('sub') }, 'Já leva ' + plural(nNotif, 'irregularidade', 'irregularidades') + ', as fotos e o texto prontos.')),
      h('button', { class: 'btn pri peq', onclick: () => notificarVisita(v0, r) }, 'Notificar')) : null;
    const docs = h('div', { class: nc('lista') },
      h('button', { class: nc('li'), onclick: () => dialogoRelatorio(v0, r) }, h('span', { class: nc('ic in') }, ico('doc')),
        h('span', { class: nc('c') }, h('span', { class: nc('t') }, 'Relatório fotográfico'), h('span', { class: nc('d') }, 'Word · ' + plural(fotos.filter((f) => !f.fora_relatorio).length, 'foto', 'fotos'))), ico('baixar', 'seta')),
      irr.length ? h('button', { class: nc('li'), onclick: () => dialogoIrregularidades(r) }, h('span', { class: nc('ic er') }, ico('alerta')),
        h('span', { class: nc('c') }, h('span', { class: nc('t') }, 'Relatório de irregularidades'), h('span', { class: nc('d') }, 'Word · ' + plural(irr.length, 'item', 'itens'))), ico('baixar', 'seta')) : null);
    const concluir = async () => {
      const v = clonar(v0);
      if (!v.hora_fim) v.hora_fim = horaAgora();
      v.status = 'concluida';
      await salvarMudancas('visitas', clonar(v0), v);
      toast('Visita concluída');
      atualizarNavCam();
      location.replace('#/visita/' + id);
    };
    rcT(tk, h('div', { class: nc('pag') + ' ' + nc('encerrar') },
      h('div', { class: nc('sub'), style: { margin: '0 2px 12px' } }, r.apelido + ' · ' + X.dataBR(v0.data) + (v0.hora_inicio ? ' · início ' + v0.hora_inicio : '')),
      lista, notificar,
      h('div', { class: nc('sec') }, h('h2', {}, 'Documentos da visita')), docs,
      pode.coletar() && v0.status !== 'concluida' ? h('div', { class: nc('fixo') }, h('a', { class: 'btn', style: { flex: '0 0 auto' }, href: '#/visita/' + id }, 'Voltar'), h('button', { class: 'btn ok', onclick: concluir }, '✅ Concluir visita')) : null));
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
    const modelo = await modeloDocx(reg.tipo);
    const secoes = await secoesEditadas(n, modelo, dados);
    const blob = await DocGen.gerar(modelo, dados, { type: 'blob', larguraFotoCm: 13, secoes, aoProgresso: jp ? progGravar(jp, 0.75, 1) : undefined });
    const nome = nomeArquivo(n.ordinal + 'ª NOTIFICAÇÃO - ' + (reg.apelido || ROTULO[reg.tipo])) + '.docx';
    return { blob, nome };
  }

  /* 3.18.6: textos editados na tela da notificação (Dos fatos: antes e depois da lista; Providências).
     null = usa o texto do próprio modelo do Word (preenchido com os dados). */
  const temTextoEditado = (n) => n.fatosAntes != null || n.fatosDepois != null || n.provTexto != null;
  const linhasItens = (itens) => (itens || []).map((t) => '- ' + String(t.texto != null ? t.texto : t).replace(/\s*\n\s*/g, ' ').trim()).filter((l) => l !== '- ');
  async function secoesEditadas(n, modelo, dados) {
    if (!temTextoEditado(n)) return null;
    const auto = await DocGen.textoSecoes(modelo, dados);
    if (!auto.ok) return null; // modelo próprio sem os títulos das seções: segue o modelo
    const fatosEd = n.fatosAntes != null || n.fatosDepois != null;
    const ant = n.fatosAntes != null ? n.fatosAntes : auto.fatosAntes, dep = n.fatosDepois != null ? n.fatosDepois : auto.fatosDepois;
    return {
      fatos: fatosEd ? [ant, linhasItens(dados.itens).join('\n'), dep].filter((x) => String(x || '').trim()).join('\n') : null,
      prov: n.provTexto != null ? n.provTexto : null,
    };
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
    const nAtivas = todas.filter((x) => ['vencida', 'aguardando', 'nao_enviada'].includes(x.sit.k)).length;
    rcT(tk, h('div', { class: nc('seg-cel') }, segPrazos('notifs', nAtivas)), avisoPermissao, filtros,
      lista.length ? h('div', { class: 'lista-linhas' }, ...lista.map(({ n, sit, r }) => linhaLista({
        href: '#/notificacao/' + n.id, cls: 'item', pend: n._pendente,
        de: r.apelido || ROTULO[r.tipo],
        titulo: h('span', {}, (n.ordinal || '?') + 'ª Notificação', h('span', { class: 'so-cel' }, ' · ' + (r.apelido || ROTULO[r.tipo]))),
        resumo: ROTULO[r.tipo] + ' nº ' + (r.numero || '—') + ' · Nº ' + (n.numero || (n.status === 'emitida' ? '—' : 'a definir na emissão')) + (n.status === 'emitida' ? ' · emitida em ' + dataLocalBR(n.emitidaEm || n.data) : ' · rascunho'),
        prazos: [n.enviadaEm && !n.respondidaEm
          ? { rot: 'Prazo de resposta', data: dataCurta(prazoDe(n)) + comHora(n), cls: sit.k === 'vencida' ? 'perigo' : sit.restante <= 1 ? 'alerta' : 'info',
            txt: sit.hoje ? 'encerrado hoje às ' + horaEnvio(n) : sit.k === 'vencida' ? 'encerrado há ' + -sit.restante + (sit.restante === -1 ? ' dia' : ' dias') : sit.restante === 0 ? 'termina hoje' : sit.restante === 1 ? 'falta 1 dia útil' : 'faltam ' + sit.restante + ' dias úteis' }
          : { rot: n.status === 'emitida' ? 'Emitida em' : 'Criada em', data: dataCurtaLocal(n.emitidaEm || n.data), cls: '' }],
        chips: [repetidos.has(n.id) ? etq('nº repetido', 'perigo') : null, sit.k === 'vencida' || sit.k === 'aguardando' ? null : etq(sit.txt, sit.cls), n.enviadaEm ? etq('enviada ' + X.dataBR(n.enviadaEm), '') : null],
      })))
        : h('div', { class: 'vazio' }, g[0] === 'pendentes' ? 'Nenhuma notificação aguardando resposta. 👍' : 'Nada por aqui.'),
      h('p', { class: 'dica' }, 'O prazo conta em dias úteis a partir da data e do horário do envio e vence no último dia, no mesmo horário (sábados, domingos e os feriados cadastrados em Ajustes › Padrões não contam). Para registrar envio ou resposta, abra a notificação.'));
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
    const el = linhaLista({
      href: reg ? '#/registro/' + reg.id : null, cls: 'item fila-item' + (atendido(l) ? ' atendida' : ''),

      de: [l.convenio, l.municipio].filter(Boolean).join(' · ') || conv,
      titulo: h('span', {}, l.solicitacao || 'Solicitação não informada', h('span', { class: 'so-cel' }, ' · ' + [conv, l.municipio].filter(Boolean).join(' · '))),
      resumo: [l.escola, l.protocolo ? 'Protocolo nº ' + l.protocolo : '', 'linha ' + l.linha + ' da planilha', ...(l.extras || []).map(([k, v]) => k + ': ' + v)].filter(Boolean).join(' · '),
      chips: [l.status ? etq(l.status, atendido(l) ? 'ok' : '') : null, l.situacao ? etq(l.situacao, corSituacao(l.situacao)) : null,
        reg ? h('span', { class: 'lin-link' }, 'Abrir “' + (reg.apelido || reg.numero) + '” no app ›') : null],
    });
    // vindo da Fila, o convênio abre com os atendimentos à vista
    if (reg) el.addEventListener('click', () => { try { sessionStorage.setItem('fila_aberta_' + reg.id, '1'); } catch (e) { /* */ } });
    return el;
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
      const ativas = (await DB.listar('notificacoes')).filter((n) => { const r = regs.get(n.registroId); return r && !r.excluido && n.status === 'emitida' && n.enviadaEm && (!n.respondidaEm || rodadaAberta(n)); });
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
  const diasAditados = (n) => (n.aditivosPrazo || []).reduce((t, a) => t + (+a.dias || 0), 0);
  function aplicarEnvio(o, dataISO, hora) {
    o.enviadaEm = dataISO;
    if (hora) o.enviadaHora = hora; else delete o.enviadaHora;
    if (!o.assinaturaEm) o.assinaturaDireta = true; // 3.18.3: envio registrado direto (já estava assinada)
    o.prazoDiasEnvio = (+o.prazo_dias || 3) + diasAditados(o); // 3.18.1: os aditivos de prazo continuam valendo
    o.prazoFinal = prazoFinalUteis(dataISO, o.prazoDiasEnvio);
    o.enviadaPor = email();
  }
  async function pedirDataEnvio(n, inicial) {
    const d = { data: inicial || X.hojeISO(), hora: inicial ? horaEnv0(n) : agoraHM() };
    const dias = (+n.prazo_dias || 3) + ((n.aditivosPrazo || []).reduce((t, a) => t + (+a.dias || 0), 0));
    const inp = h('input', { type: 'date', value: d.data, max: X.hojeISO(), oninput: (e) => { d.data = e.target.value; prev(); } });
    const inpH = h('input', { type: 'time', value: d.hora, step: '60', 'aria-label': 'Horário do envio', oninput: (e) => { d.hora = e.target.value; prev(); } });
    const info = h('p', { class: 'sub' });
    const prev = () => {
      if (!d.data) { rc(info, ''); return; }
      const fim = prazoFinalUteis(d.data, dias);
      rc(info, 'Prazo de ' + plural(dias, 'dia útil', 'dias úteis') + ' para ' + quemResponde(n.tipo) + ' responder: até ', h('b', {}, DIAS_L[dataD(fim).getDay()] + ', ' + X.dataBR(fim) + (d.hora ? ' às ' + d.hora : '')), '.');
    };
    prev();
    const ok = await modal('📨 Registrar envio', h('div', {},
      h('p', {}, 'Data e horário em que a notificação foi enviada. O prazo em dias úteis conta a partir desse momento: vence no último dia do prazo, no mesmo horário do envio.'),
      h('div', { class: 'grade2' }, campo('Data do envio', inp), campo('Horário do envio', inpH)), info),
    [{ txt: 'Cancelar', valor: false }, { txt: 'Registrar envio', cls: 'pri', valor: true, antes: () => {
      if (!d.data) { toast('Informe a data.', true); return false; }
      if (d.data > X.hojeISO()) { toast('A data do envio não pode ser futura.', true); return false; }
      if (!/^\d\d:\d\d$/.test(d.hora || '')) { toast('Informe o horário do envio.', true); inpH.focus(); return false; }
      if (d.data === X.hojeISO() && d.hora > agoraHM()) { toast('O horário do envio não pode ser futuro.', true); return false; }
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
  async function pedirContra(n) {
    const d = { data: X.hojeISO(), hora: agoraHM(), dias: +(CONFIG || {}).prazo_padrao || 3, obs: '' };
    const quem = quemResponde(n.tipo);
    const inD = h('input', { type: 'date', value: d.data, max: X.hojeISO(), min: n.respondidaEm || null, oninput: (e) => { d.data = e.target.value; prev(); } });
    const inH = h('input', { type: 'time', value: d.hora, step: '60', 'aria-label': 'Horário', oninput: (e) => { d.hora = e.target.value; prev(); } });
    const inN = h('input', { type: 'number', min: '1', max: '365', value: d.dias, inputmode: 'numeric', 'aria-label': 'Dias úteis', oninput: (e) => { d.dias = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 0)); prev(); } });
    const info = h('p', { class: 'sub' });
    const prev = () => {
      if (!d.data || !d.dias) { rc(info, ''); return; }
      const fim = prazoFinalUteis(d.data, d.dias);
      rc(info, 'Prazo para ' + quem + ' responder à contrarresposta: até ', h('b', {}, DIAS_L[dataD(fim).getDay()] + ', ' + X.dataBR(fim) + (d.hora ? ' às ' + d.hora : '')), ' (fins de semana e feriados não contam).');
    };
    prev();
    const ok = await modal('↩️ Registrar contrarresposta', h('div', {},
      h('p', {}, 'Nossa resposta à manifestação ' + (quem === 'a prefeitura' ? 'da prefeitura' : 'da empresa') + ', com um novo prazo para ' + quem + ' responder. Informe quando foi enviada.'),
      h('div', { class: 'grade2' }, campo('Data do envio', inD), campo('Horário do envio', inH)),
      campo('Prazo para responder (dias úteis)', inN), info,
      campo('Resumo / documento (opcional)', inputArea(d, 'obs', { placeholder: 'Ex.: Ofício nº 45/2026 — não aceitamos a justificativa; pedimos o cronograma de troca.' }))),
    [{ txt: 'Cancelar', valor: false }, { txt: 'Registrar', cls: 'pri', valor: true, antes: () => {
      if (!d.data || !/^\d\d:\d\d$/.test(d.hora || '')) { toast('Informe a data e o horário do envio.', true); return false; }
      if (d.data > X.hojeISO() || (d.data === X.hojeISO() && d.hora > agoraHM())) { toast('A data e o horário não podem ser futuros.', true); return false; }
      if (n.respondidaEm && d.data < n.respondidaEm) { toast('A contrarresposta não pode ser anterior à resposta (' + X.dataBR(n.respondidaEm) + ').', true); return false; }
      if (!(d.dias >= 1)) { toast('Informe o prazo em dias úteis.', true); return false; }
    } }]);
    return ok ? { enviadaEm: d.data, enviadaHora: d.hora, prazoDias: d.dias, obs: d.obs.trim() } : null;
  }
  /* Acompanhamento da notificação emitida: emitida → enviada → prazo (dias úteis) → resposta */
  /* 3.18.1: aditivo de prazo para responder a notificação (pedido da prefeitura/empresa). Soma dias úteis ao prazo
     contado desde o envio (o novo prazo continua do dia seguinte ao fim do anterior); justificativa obrigatória.
     Fica no histórico da notificação e na Atividade da obra. Aparelhos com versões antigas já veem o prazo novo. */
  async function dialogoAditivoPrazo(n, r) {
    const pfAtual = prazoDe(n);
    const st = { dias: 5 };
    const quem = quemResponde(n.tipo || r.tipo);
    const inp = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: st.dias, class: nc('num'), 'aria-label': 'Dias úteis a mais' });
    const novo = h('div', { class: nc('adp-novo') });
    const sugs = h('div', { class: nc('sugs'), style: { justifyContent: 'center', margin: '12px 0 4px' } });
    const pedido = h('input', { type: 'date', max: X.hojeISO() });
    const just = h('textarea', { rows: 4, placeholder: 'Ex.: A Prefeitura solicitou, pelo Ofício nº 123/2026, mais prazo para apresentar o cronograma corrigido, alegando…' });
    const pintar = () => {
      const fim = prazoFinalUteis(n.enviadaEm, (+n.prazoDiasEnvio || +n.prazo_dias || 3) + st.dias);
      rc(novo, h('span', { class: 'sub' }, 'Novo prazo'), h('b', {}, DIAS_L[dataD(fim).getDay()] + ', ' + X.dataBR(fim) + comHora(n)),
        h('span', { class: 'sub' }, 'antes: ' + X.dataBR(pfAtual) + ' · +' + plural(st.dias, 'dia útil', 'dias úteis')));
      rc(sugs, [5, 10, 15, 30].map((x) => h('button', { type: 'button', class: st.dias === x ? nc('on') : null, onclick: () => definir(x) }, '+' + x)));
    };
    const definir = (x) => { st.dias = Math.max(1, Math.min(365, Math.round(x) || 1)); inp.value = st.dias; pintar(); };
    inp.addEventListener('input', () => { const x = parseInt(inp.value, 10); if (x >= 1) { st.dias = Math.min(365, x); pintar(); } });
    pintar();
    const sit = situacaoNotif(n);
    const conteudo = h('div', { class: nc('adp') },
      h('div', { class: nc('adp-atual') }, ico('relogio'), h('div', {}, h('b', {}, 'Prazo atual: ' + DIAS_L[dataD(pfAtual).getDay()] + ', ' + X.dataBR(pfAtual) + comHora(n)),
        h('div', { class: 'sub' }, plural(+n.prazoDiasEnvio || +n.prazo_dias || 3, 'dia útil', 'dias úteis') + ' desde o envio em ' + X.dataBR(n.enviadaEm) + ' · ' + sit.txt.toLowerCase()))),
      h('div', { class: 'campo-bloco' }, h('span', {}, 'Dias úteis a mais para ' + quem + ' responder'),
        h('div', { class: nc('card prazo-n'), style: { background: 'var(--sup2)', boxShadow: 'none' } },
          h('div', { class: nc('mm') },
            h('button', { type: 'button', 'aria-label': 'Um dia a menos', onclick: () => definir(st.dias - 1) }, '−'),
            h('label', { class: nc('pz') }, inp, h('span', {}, 'dias úteis')),
            h('button', { type: 'button', 'aria-label': 'Um dia a mais', onclick: () => definir(st.dias + 1) }, '+')),
          sugs, novo)),
      campo('Data do pedido d' + quem + ' (opcional)', pedido),
      campo('Justificativa (obrigatória)', just, 'Aparece na Atividade da obra e no histórico desta notificação.'));
    const r2 = await modal('Aditar prazo de resposta', conteudo, [
      { txt: 'Cancelar', valor: null },
      { txt: 'Aditar prazo', cls: 'pri', antes: () => { if (just.value.trim().length < 10) { toast('Escreva a justificativa do aditivo.', true); just.focus(); return false; } return true; },
        valor: () => ({ dias: st.dias, justificativa: just.value.trim(), pedidoEm: pedido.value || '' }) }]);
    return r2 || null;
  }
  async function aditarPrazoNotif(n, r) {
    const ad = await dialogoAditivoPrazo(n, r);
    if (!ad) return false;
    const de = prazoDe(n);
    let salvo = null;
    await atualizarCampos('notificacoes', n.id, (o) => {
      o.aditivosPrazo = (o.aditivosPrazo || []).slice();
      o.prazoDiasEnvio = (+o.prazoDiasEnvio || +o.prazo_dias || 3) + ad.dias;
      o.prazoFinal = prazoFinalUteis(o.enviadaEm, o.prazoDiasEnvio);
      salvo = Object.assign({ id: DB.uuid(), de, para: o.prazoFinal, em: new Date().toISOString(), por: email(), quemNome: meuNome() }, ad);
      o.aditivosPrazo.push(salvo);
    });
    if (!salvo) return false;
    const k = (n.aditivosPrazo || []).length + 1;
    await registrarAtividade(r.id, 'aditivo_prazo', k + 'º aditivo de prazo · Notificação' + (n.numero ? ' nº ' + n.numero : ''),
      'Resposta até ' + X.dataBR(salvo.para) + comHora(n) + ' (antes ' + X.dataBR(de) + ', +' + plural(ad.dias, 'dia útil', 'dias úteis') + ')' + (ad.pedidoEm ? ' · pedido em ' + X.dataBR(ad.pedidoEm) : '') + '\nJustificativa: ' + ad.justificativa,
      { notificacaoId: n.id });
    toast('Prazo aditado: resposta até ' + X.dataBR(salvo.para) + comHora(n));
    verificarPrazos();
    return true;
  }
  /* 3.18.3: etapa "Inserida para assinatura" entre Emitida e Enviada (data, horário e, opcional, onde/nº do documento).
     O prazo continua contando só a partir do envio. */
  async function pedirAssinatura(n, ini) {
    const d = { data: (ini && ini.data) || X.hojeISO(), hora: (ini && ini.hora) || agoraHM(), ref: (ini && ini.ref) || '' };
    const inD = h('input', { type: 'date', value: d.data, max: X.hojeISO(), oninput: (e) => { d.data = e.target.value; } });
    const inH = h('input', { type: 'time', value: d.hora, step: '60', 'aria-label': 'Horário', oninput: (e) => { d.hora = e.target.value; } });
    const inR = h('input', { type: 'text', value: d.ref, placeholder: 'Ex.: SIGADOC SEDUC-DOC-2026/12345', oninput: (e) => { d.ref = e.target.value; } });
    const ok = await modal('✍️ Inserida para assinatura', h('div', {},
      h('p', {}, 'Quando a notificação foi colocada para assinatura? O prazo ainda não começa: ele conta a partir do envio.'),
      h('div', { class: 'grade2' }, campo('Data', inD), campo('Horário', inH)),
      campo('Onde / nº do documento (opcional)', inR)),
    [{ txt: 'Cancelar', valor: false }, { txt: 'Registrar', cls: 'pri', valor: true, antes: () => {
      if (!d.data || !/^\d\d:\d\d$/.test(d.hora || '')) { toast('Informe a data e o horário.', true); return false; }
      if (d.data > X.hojeISO() || (d.data === X.hojeISO() && d.hora > agoraHM())) { toast('A data e o horário não podem ser futuros.', true); return false; }
    } }]);
    return ok ? { data: d.data, hora: d.hora, ref: d.ref.trim() } : null;
  }
  const aplicarAssinatura = (o, a) => { o.assinaturaEm = a.data; o.assinaturaHora = a.hora; if (a.ref) o.assinaturaRef = a.ref; else delete o.assinaturaRef; o.assinaturaPor = email(); delete o.assinaturaDireta; };
  const nomeNotif = (n) => (n.ordinal ? n.ordinal + 'ª notificação' : 'Notificação') + (n.numero ? ' nº ' + n.numero : '');
  const ativNotif = (n, titulo, texto) => registrarAtividade(n.registroId, 'notif_etapa', nomeNotif(n) + ' · ' + titulo, texto || '', { notificacaoId: n.id }).catch(() => {});
  function cartaoEnvio(n, r, redesenhar) {
    const sit = situacaoNotif(n);
    const quem = quemResponde(n.tipo || r.tipo);
    const dias = +(n.prazoDiasEnvio || n.prazo_dias) || 3;
    const pf = n.enviadaEm ? prazoOriginal(n) : null;
    const adits = n.aditivosPrazo || [];
    const diasOrig = dias - diasAditados(n);
    const btAditar = pode.notificar() && n.enviadaEm && !n.respondidaEm ? h('button', { class: 'btn peq', 'data-acao': 'aditar-prazo', onclick: async () => { if (await aditarPrazoNotif(n, r)) redesenhar(); } }, '⏩ Aditar prazo') : null;
    const listaAdits = adits.length ? h('div', { class: nc('adp-lista') }, adits.map((a, i) => h('div', { class: nc('adp-item') },
      h('b', {}, (i + 1) + 'º aditivo · +' + plural(+a.dias, 'dia útil', 'dias úteis') + ' · ' + X.dataBR(a.de) + ' → ' + X.dataBR(a.para)),
      h('div', { class: 'sub' }, (a.pedidoEm ? 'Pedido em ' + X.dataBR(a.pedidoEm) + ' · ' : '') + 'registrado em ' + dataHoraBR(a.em) + (a.quemNome ? ' por ' + a.quemNome : '')),
      h('div', { class: nc('adp-just') }, a.justificativa)))) : null;
    const passo = (est, numero, t, sub, extra) => h('div', { class: nc('rp ' + est) },
      h('span', { class: nc('b') }, est === 'feito' ? ico('ok') : String(numero)),
      h('div', { class: nc('c') }, h('b', {}, t), sub ? h('div', { class: 'sub' }, sub) : null, extra || null));
    const registrarEnvio = pode.notificar() ? h('button', { class: 'btn pri peq', onclick: async () => {
      const envio = await pedirDataEnvio(n);
      if (!envio) return;
      await atualizarCampos('notificacoes', n.id, (o) => aplicarEnvio(o, envio.data, envio.hora));
      await ativNotif(n, 'enviada', X.dataBR(envio.data) + ' às ' + envio.hora + (n.assinaturaEm ? '' : ' · registrada direto (já assinada)'));
      toast('Envio registrado — prazo até ' + X.dataBR(prazoFinalUteis(envio.data, (+n.prazo_dias || 3) + diasAditados(n))) + ' às ' + envio.hora);
      verificarPrazos(); redesenhar();
    } }, '📨 Registrar envio') : null;
    const registrarResp = pode.notificar() && n.enviadaEm && !n.respondidaEm ? h('button', { class: 'btn ok peq', onclick: async () => {
      const resp = await pedirResposta(n);
      if (!resp) return;
      await atualizarCampos('notificacoes', n.id, (o) => { o.respondidaEm = resp.data; o.respostaObs = resp.obs.trim(); o.respondidaPor = email(); });
      await ativNotif(n, 'respondida', X.dataBR(resp.data) + (resp.obs.trim() ? ' · ' + resp.obs.trim() : ''));
      toast('Resposta registrada'); verificarPrazos(); redesenhar();
    } }, '✅ Registrar resposta') : null;
    // contador de dias úteis
    let contador = null;
    const contadorDe = (sit, dias, horaEnvio) => {
      const venc = sit.k === 'vencida';
      const rest = venc ? -sit.restante : sit.restante;
      const usados = Math.max(0, Math.min(dias, dias - (venc ? 0 : sit.restante)));
      return h('div', {},
        h('div', { class: nc('contador') }, h('b', { class: nc('num'), style: { color: 'var(--' + (venc ? 'er' : 'al') + ')' } }, sit.hoje ? horaEnvio : String(rest)), h('span', { class: 'sub' }, sit.hoje ? 'prazo encerrado hoje' : venc ? (rest === 1 ? 'dia de atraso' : 'dias de atraso') : rest === 1 ? 'dia útil restante' : rest === 0 && horaEnvio ? 'dias úteis restantes · termina hoje às ' + horaEnvio : 'dias úteis restantes')),
        dias <= 20 ? h('div', { class: nc('dias-u') }, Array.from({ length: dias }, (_, i) => h('i', { class: i < (venc ? dias : usados) ? nc(venc ? 'v' : 'p') : null })))
          : h('div', { class: nc('barra ' + (venc ? 'er' : 'al')), style: { marginTop: '8px', height: '8px' } }, h('i', { style: { width: Math.round(100 * (venc ? dias : usados) / dias) + '%' } })));
    };
    if (n.enviadaEm && !n.respondidaEm) {
      const venc = sit.k === 'vencida';
      const rest = venc ? -sit.restante : sit.restante;
      const usados = Math.max(0, Math.min(dias, dias - (venc ? 0 : sit.restante)));
      contador = h('div', {},
        h('div', { class: nc('contador') }, h('b', { class: nc('num'), style: { color: 'var(--' + (venc ? 'er' : 'al') + ')' } }, sit.hoje ? horaEnvio(n) : String(rest)), h('span', { class: 'sub' }, sit.hoje ? 'prazo encerrado hoje' : venc ? (rest === 1 ? 'dia de atraso' : 'dias de atraso') : rest === 1 ? 'dia útil restante' : rest === 0 && horaEnvio(n) ? 'dias úteis restantes · termina hoje às ' + horaEnvio(n) : 'dias úteis restantes')),
        dias <= 20 ? h('div', { class: nc('dias-u') }, Array.from({ length: dias }, (_, i) => h('i', { class: i < (venc ? dias : usados) ? nc(venc ? 'v' : 'p') : null })))
          : h('div', {}, h('div', { class: nc('barra ' + (venc ? 'er' : 'al')), style: { marginTop: '8px', height: '8px' } }, h('i', { style: { width: Math.round(100 * (venc ? dias : usados) / dias) + '%' } })), h('div', { class: 'sub', style: { marginTop: '4px' } }, usados + ' de ' + dias + ' dias úteis')));
    }
    // contrarrespostas: para cada uma, "enviada" e "resposta" (com o prazo e o contador enquanto aberta)
    function passosContra() {
      const rods = n.rodadas || [];
      const daQuem = quem === 'a prefeitura' ? 'da prefeitura' : 'da empresa';
      return rods.map((ro, i) => {
        const k = rods.length > 1 ? ' ' + (i + 1) : '';
        const dias = +ro.prazoDias || 3, fim = prazoFinalUteis(ro.enviadaEm, dias), hh = horaValida(ro.enviadaHora);
        const aberta = !ro.respondidaEm && i === rods.length - 1;
        const btResp = aberta && pode.notificar() ? h('button', { class: 'btn ok peq', 'data-acao': 'resposta-contra', onclick: async () => {
          const resp = await pedirResposta({ tipo: n.tipo, enviadaEm: ro.enviadaEm });
          if (!resp) return;
          await atualizarCampos('notificacoes', n.id, (o) => { o.rodadas = (o.rodadas || []).map((x) => (x.id === ro.id ? Object.assign({}, x, { respondidaEm: resp.data, respostaObs: resp.obs.trim(), respondidaPor: email() }) : x)); });
          await ativNotif(n, 'resposta à contrarresposta' + k, X.dataBR(resp.data) + (resp.obs.trim() ? ' · ' + resp.obs.trim() : ''));
          toast('Resposta registrada'); verificarPrazos(); redesenhar();
        } }, '✅ Registrar resposta') : null;
        return [
          passo('feito', 6 + i * 2, 'Contrarresposta' + k + ' enviada', X.dataBR(ro.enviadaEm) + (hh ? ' às ' + hh : '') + ' · prazo de ' + plural(dias, 'dia útil', 'dias úteis') + (ro.por ? ' · registrado por ' + nomeDe(ro.por) : ''),
            ro.obs ? h('div', { class: nc('adp-just') }, ro.obs) : null),
          passo(ro.respondidaEm ? 'feito' : 'agora', 7 + i * 2, ro.respondidaEm ? 'Respondida' : 'Resposta ' + daQuem + ' à contrarresposta',
            ro.respondidaEm ? X.dataBR(ro.respondidaEm) + (ro.respondidaEm > fim ? ' (fora do prazo)' : '') + (ro.respondidaPor ? ' · registrado por ' + nomeDe(ro.respondidaPor) : '') + (ro.respostaObs ? ' · ' + ro.respostaObs : '')
              : (sit.k === 'vencida' ? 'Terminou em ' : 'Vence em ') + DIAS_L[dataD(fim).getDay()] + ', ' + X.dataBR(fim) + (hh ? ' às ' + hh : ''),
            aberta ? [contadorDe(sit, dias, hh), h('div', { class: 'acoes', style: { marginTop: '10px' } }, btResp)] : null),
        ];
      });
    }
    const card = h('div', { class: 'card' }, h('h2', {}, 'Envio e prazo de resposta'),
      h('div', { class: 'etqs', style: { marginTop: 0, marginBottom: '12px' } }, etq(sit.txt, sit.cls), adits.length ? etq(adits.length === 1 ? 'Prazo aditado' : 'Prazo aditado ' + adits.length + '×', 'acc') : null),
      h('div', { class: nc('rastreio') },
        passo('feito', 1, 'Emitida', (n.emitidaEm ? dataHoraBR(n.emitidaEm) : X.dataBR(n.data)) + (n.emitidaPor ? ' · por ' + nomeDe(n.emitidaPor) : '') + (n.numero ? ' · nº ' + n.numero : '')),
        passo(n.assinaturaEm || n.enviadaEm ? 'feito' : 'agora', 2, 'Inserida para assinatura',
          n.assinaturaEm ? X.dataBR(n.assinaturaEm) + (n.assinaturaHora ? ' às ' + n.assinaturaHora : '') + (n.assinaturaPor ? ' · registrado por ' + nomeDe(n.assinaturaPor) : '')
            : n.enviadaEm ? (n.assinaturaDireta ? 'Já estava assinada: o envio foi registrado direto.' : 'Não registrada (envio registrado antes desta etapa).')
            : 'Baixe o Word e coloque para assinatura (no sistema ou em papel). Registre aqui quando inserir.',
          n.assinaturaEm && n.assinaturaRef ? h('span', { class: nc('ref-doc') }, '📄 ' + n.assinaturaRef)
            : !n.assinaturaEm && !n.enviadaEm && pode.notificar() ? h('div', { class: 'acoes', style: { marginTop: '8px', alignItems: 'center' } },
              h('button', { class: 'btn pri peq', 'data-acao': 'assinatura', onclick: async () => {
                const a = await pedirAssinatura(n);
                if (!a) return;
                await atualizarCampos('notificacoes', n.id, (o) => aplicarAssinatura(o, a));
                await ativNotif(n, 'inserida para assinatura', X.dataBR(a.data) + ' às ' + a.hora + (a.ref ? ' · ' + a.ref : ''));
                toast('Registrado: inserida para assinatura'); verificarPrazos(); redesenhar();
              } }, '✍️ Inserida para assinatura'),
              h('button', { type: 'button', class: nc('lk') + ' lk-envio-direto', 'data-acao': 'envio-direto', onclick: () => registrarEnvio && registrarEnvio.click() }, 'Já foi assinada? Registrar o envio direto'))
            : null),
        passo(n.enviadaEm ? 'feito' : n.assinaturaEm ? 'agora' : '', 3, n.enviadaEm ? 'Enviada' : 'Enviar a ' + quem.replace(/^a /, ''),
          n.enviadaEm ? X.dataBR(n.enviadaEm) + (horaEnv0(n) ? ' às ' + horaEnv0(n) : '') + (n.enviadaPor ? ' · registrado por ' + nomeDe(n.enviadaPor) : '')
            : n.assinaturaEm ? 'Depois de assinada, envie e registre aqui a data e o horário do envio: o prazo conta a partir desse momento.' : 'Fica disponível depois da assinatura.',
          n.enviadaEm || !n.assinaturaEm ? null : registrarEnvio),
        passo(n.respondidaEm ? 'feito' : n.enviadaEm ? 'agora' : '', 4, 'Prazo de ' + dias + (dias === 1 ? ' dia útil' : ' dias úteis') + (adits.length ? ' (' + diasOrig + ' + ' + (dias - diasOrig) + ' aditados)' : ''),
          pf ? (sit.k === 'vencida' ? 'Terminou em ' : 'Vence em ') + DIAS_L[dataD(pf).getDay()] + ', ' + X.dataBR(pf) + (horaEnv0(n) ? ' às ' + horaEnv0(n) : '') + (horaEnv0(n) ? ' (contado a partir do envio, às ' + horaEnv0(n) + '; fins de semana e feriados não contam)' : ' (fins de semana e feriados não contam)') : 'Conta a partir da data e do horário do envio',
          [contador, listaAdits, btAditar ? h('div', { class: 'acoes', style: { marginTop: '10px' } }, btAditar) : null]),
        passo(n.respondidaEm ? 'feito' : '', 5, n.respondidaEm ? 'Respondida' : 'Resposta ' + (quem === 'a prefeitura' ? 'da prefeitura' : 'da empresa'),
          n.respondidaEm ? X.dataBR(n.respondidaEm) + (n.respondidaEm > pf ? ' (fora do prazo)' : '') + (n.respondidaPor ? ' · registrado por ' + nomeDe(n.respondidaPor) : '') + (n.respostaObs ? ' · ' + n.respostaObs : '') : 'Registre quando ' + quem + ' responder.',
          registrarResp),
        passosContra()));
    if (pode.notificar() && n.respondidaEm && !rodadaAberta(n)) {
      ap(card, h('div', { class: 'acoes' }, h('button', { class: 'btn pri peq', 'data-acao': 'contrarresposta', onclick: async () => {
        const c = await pedirContra(n);
        if (!c) return;
        const ro = Object.assign({ id: DB.uuid(), por: email(), em: new Date().toISOString() }, c);
        await atualizarCampos('notificacoes', n.id, (o) => { o.rodadas = (o.rodadas || []).concat(ro); });
        const k = (n.rodadas || []).length + 1;
        await ativNotif(n, (k > 1 ? k + 'ª ' : '') + 'contrarresposta enviada', X.dataBR(c.enviadaEm) + ' às ' + c.enviadaHora + ' · prazo de ' + plural(c.prazoDias, 'dia útil', 'dias úteis') + ' (até ' + X.dataBR(prazoFinalUteis(c.enviadaEm, c.prazoDias)) + ' às ' + c.enviadaHora + ')' + (c.obs ? '\n' + c.obs : ''));
        toast('Contrarresposta registrada — prazo até ' + X.dataBR(prazoFinalUteis(c.enviadaEm, c.prazoDias)) + ' às ' + c.enviadaHora);
        verificarPrazos(); redesenhar();
      } }, '↩️ Registrar contrarresposta')));
    }
    if (pode.notificar() && n.assinaturaEm && !n.enviadaEm) {
      ap(card, h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', 'data-acao': 'corrigir-assinatura', onclick: async () => {
          const a = await pedirAssinatura(n, { data: n.assinaturaEm, hora: n.assinaturaHora, ref: n.assinaturaRef });
          if (!a) return;
          await atualizarCampos('notificacoes', n.id, (o) => aplicarAssinatura(o, a));
          redesenhar();
        } }, 'Corrigir data da assinatura'),
        h('button', { class: 'btn peq perigo', 'data-acao': 'desfazer-assinatura', onclick: async () => {
          if (!(await confirmar('Desfazer o registro “inserida para assinatura”?', 'Desfazer', true))) return;
          await atualizarCampos('notificacoes', n.id, (o) => { for (const k of ['assinaturaEm', 'assinaturaHora', 'assinaturaRef', 'assinaturaPor', 'assinaturaDireta']) delete o[k]; });
          verificarPrazos(); redesenhar();
        } }, 'Desfazer “inserida para assinatura”')));
    }
    if (pode.notificar() && n.enviadaEm) {
      ap(card, h('div', { class: 'acoes' },
        (n.rodadas || []).length ? (() => {
          const rods = n.rodadas, ult = rods[rods.length - 1];
          return h('button', { class: 'btn peq', 'data-acao': 'desfazer-contra', onclick: async () => {
            if (!(await confirmar(ult.respondidaEm ? 'Desfazer o registro da resposta à contrarresposta?' : 'Desfazer a última contrarresposta?', 'Desfazer'))) return;
            await atualizarCampos('notificacoes', n.id, (o) => {
              const l = (o.rodadas || []).slice(); const u = l[l.length - 1];
              if (u && u.respondidaEm) { l[l.length - 1] = Object.assign({}, u); delete l[l.length - 1].respondidaEm; delete l[l.length - 1].respostaObs; delete l[l.length - 1].respondidaPor; } else l.pop();
              o.rodadas = l;
            });
            verificarPrazos(); redesenhar();
          } }, ult.respondidaEm ? 'Desfazer resposta à contrarresposta' : 'Desfazer contrarresposta');
        })() : n.respondidaEm ? h('button', { class: 'btn peq', onclick: async () => {
          if (!(await confirmar('Desfazer o registro da resposta? A notificação volta a aguardar resposta.', 'Desfazer'))) return;
          await atualizarCampos('notificacoes', n.id, (o) => { delete o.respondidaEm; delete o.respostaObs; delete o.respondidaPor; });
          verificarPrazos(); redesenhar();
        } }, 'Desfazer resposta') : null,
        h('button', { class: 'btn peq', onclick: async () => {
          const envio = await pedirDataEnvio(n, n.enviadaEm);
          if (!envio) return;
          await atualizarCampos('notificacoes', n.id, (o) => aplicarEnvio(o, envio.data, envio.hora));
          verificarPrazos(); redesenhar();
        } }, 'Corrigir data de envio'),
        !n.respondidaEm ? h('button', { class: 'btn peq perigo', onclick: async () => {
          if (!(await confirmar('Desfazer o registro de envio? O prazo deixa de ser contado.', 'Desfazer', true))) return;
          await atualizarCampos('notificacoes', n.id, (o) => { delete o.enviadaEm; delete o.enviadaHora; delete o.prazoFinal; delete o.prazoDiasEnvio; delete o.enviadaPor; delete o.assinaturaDireta; });
          verificarPrazos(); redesenhar();
        } }, 'Desfazer envio') : null,
        adits.length && !n.respondidaEm ? h('button', { class: 'btn peq', onclick: async () => {
          const ult = adits[adits.length - 1];
          if (!(await confirmar('Desfazer o ' + adits.length + 'º aditivo de prazo (+' + plural(+ult.dias, 'dia útil', 'dias úteis') + ')? O prazo volta para ' + X.dataBR(ult.de) + '.', 'Desfazer'))) return;
          await atualizarCampos('notificacoes', n.id, (o) => {
            o.aditivosPrazo = (o.aditivosPrazo || []).filter((a) => a.id !== ult.id);
            o.prazoDiasEnvio = Math.max(1, (+o.prazoDiasEnvio || 0) - (+ult.dias || 0));
            o.prazoFinal = prazoFinalUteis(o.enviadaEm, o.prazoDiasEnvio);
          });
          await registrarAtividade(r.id, 'aditivo_prazo', 'Aditivo de prazo desfeito · Notificação' + (n.numero ? ' nº ' + n.numero : ''), 'Resposta volta a ser até ' + X.dataBR(ult.de) + ' (era ' + X.dataBR(ult.para) + ')', { notificacaoId: n.id });
          verificarPrazos(); redesenhar();
        } }, 'Desfazer último aditivo') : null,
        sit.k === 'vencida' ? h('button', { class: 'btn peq', onclick: () => criarNotificacao(r.id, n) }, '↻ Reiterar (nova notificação)') : null));
    }
    return card;
  }

  /* Prazo para resposta: qualquer quantidade de dias úteis (+ e −, digitar, atalhos) e a data em que vence */
  function campoPrazoDias(n, ro, aoMudar) {
    const inp = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '365', value: n.prazo_dias, readonly: ro, class: nc('num'), 'aria-label': 'Dias úteis para resposta' });
    const vence = h('div', { class: 'sub', style: { textAlign: 'center' } });
    const sugs = h('div', { class: nc('sugs'), style: { justifyContent: 'center', margin: '12px 0 4px' } });
    const pintar = () => {
      const d = +n.prazo_dias || 0;
      if (d >= 1) { const fim = prazoFinalUteis(X.hojeISO(), d); rc(vence, 'Se enviada hoje, vence em ' + DIAS_L[dataD(fim).getDay()] + ', ' + X.dataBR(fim) + ' (fins de semana e feriados de Ajustes não contam).'); }
      else rc(vence, 'Informe ao menos 1 dia útil.');
      rc(sugs, ro ? null : [3, 5, 10, 15, 30].map((x) => h('button', { type: 'button', class: d === x ? nc('on') : null, onclick: () => definir(x) }, String(x))));
    };
    const definir = (x) => { n.prazo_dias = Math.max(1, Math.min(365, Math.round(x) || 1)); inp.value = n.prazo_dias; pintar(); aoMudar(); };
    inp.addEventListener('input', () => { const x = parseInt(inp.value, 10); if (x >= 1) { n.prazo_dias = Math.min(365, x); aoMudar(); } pintar(); });
    inp.addEventListener('change', () => { if (!(parseInt(inp.value, 10) >= 1)) definir(+n.prazo_dias || 3); else if (+inp.value > 365) definir(365); });
    pintar();
    return h('div', { class: 'campo-bloco' }, h('span', {}, 'Prazo para manifestação (dias úteis)'),
      h('div', { class: nc('card prazo-n'), style: { background: 'var(--sup2)', boxShadow: 'none' } },
        h('div', { class: nc('mm') },
          ro ? null : h('button', { type: 'button', 'aria-label': 'Um dia a menos', onclick: () => definir((+n.prazo_dias || 1) - 1) }, '−'),
          h('label', { class: nc('pz') }, inp, h('span', {}, 'dias úteis')),
          ro ? null : h('button', { type: 'button', 'aria-label': 'Um dia a mais', onclick: () => definir((+n.prazo_dias || 0) + 1) }, '+')),
        sugs, vence));
  }

  /* Rascunho em 4 passos (Dados → Texto → Anexos → Emitir): um passo por vez, com "Voltar" e "Próximo" no pé
     da tela e a barra de passos no topo (toque para ir direto). O que foi preenchido fica guardado ao trocar de
     passo. "Ver tudo numa página" mostra todas as seções de uma vez (fica lembrado neste aparelho). */
  // 3.18.2: a tela simples é o padrão; "Todos os campos" (tela completa, a antiga "tudo numa página") fica lembrada neste aparelho
  // 3.18.6: a tela simples é sempre o padrão; "Todos os campos" vale só até fechar o app (não fica lembrado)
  try { localStorage.removeItem('notif_tela'); } catch (e) { /* */ }
  const modoNotif = () => { try { return sessionStorage.getItem('notif_tela') === 'completa' ? 'tudo' : 'simples'; } catch (e) { return 'simples'; } };
  function passosNotificacao(secoes, opc) {
    const nomes = ['Dados', 'Texto', 'Anexos', 'Emitir'];
    const chave = 'passo_notif_' + (opc.id || '');
    let atual = 0;
    try { atual = Math.min(secoes.length - 1, +sessionStorage.getItem(chave) || 0); } catch (e) { /* */ }
    const tudo = modoNotif() === 'tudo';
    const barra = h('div', { class: nc('passos-n') + (tudo ? ' passos-tudo' : '') });
    const prox = h('button', { class: 'btn pri' });
    const ant = h('button', { class: 'btn', style: { flex: '0 0 auto' } }, 'Voltar');
    const resumoBox = opc.resumoBox || h('div');
    const trocarModo = h('button', { type: 'button', class: nc('lk') + ' passos-modo', style: { background: 'none', border: '0', cursor: 'pointer', padding: '4px 2px', marginLeft: 'auto' }, onclick: () => {
      try { sessionStorage.removeItem('notif_tela'); } catch (e) { /* */ }
      if (opc.redesenhar) opc.redesenhar();
    } }, 'Tela simples');
    const mostrar = () => {
      if (tudo) return;
      secoes.forEach((g, i) => g.forEach((el) => { el.style.display = i === atual ? '' : 'none'; }));
      if (atual === secoes.length - 1 && opc.resumo) rc(resumoBox, opc.resumo());
    };
    const ir = (i) => {
      atual = Math.max(0, Math.min(secoes.length - 1, i));
      try { sessionStorage.setItem(chave, String(atual)); } catch (e) { /* */ }
      pintar(); mostrar();
      if (tudo) {
        const el = secoes[atual][0];
        scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - (barra.offsetHeight + 70)), behavior: 'smooth' });
      } else scrollTo({ top: 0, behavior: 'smooth' });
    };
    const pintar = () => {
      rc(barra, h('div', { class: nc('passos-bts') }, nomes.map((t, i) => h('button', { type: 'button', class: i === atual ? nc('on') : i < atual ? nc('feito') : null, onclick: () => ir(i) }, h('i'), (i + 1) + ' ' + t))),
        // salvar e excluir valem em qualquer passo
        h('div', { class: 'passos-acoes' },
          opc.salvar ? h('button', { type: 'button', class: 'btn peq passos-salvar', onclick: () => opc.salvar() }, '💾 Salvar rascunho') : null,
          opc.excluir ? h('button', { type: 'button', class: 'btn peq perigo passos-excluir', onclick: () => opc.excluir() }, 'Excluir') : null,
          trocarModo));
      const ultimo = atual >= nomes.length - 1;
      rc(prox, ultimo ? 'Revisar e emitir' : 'Próximo · ' + nomes[atual + 1]);
      prox.style.display = ultimo && !tudo ? 'none' : '';
      ant.style.display = atual ? '' : 'none';
    };
    prox.addEventListener('click', () => {
      if (atual < secoes.length - 1) { ir(atual + 1); return; }
      const g = secoes[secoes.length - 1], el = g[g.length - 1];
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    ant.addEventListener('click', () => ir(atual - 1));
    if (tudo) {
      // página única: o passo marcado acompanha a rolagem
      let t = null;
      const aoRolar = () => {
        if (!document.body.contains(barra)) { removeEventListener('scroll', aoRolar); return; }
        clearTimeout(t);
        t = setTimeout(() => {
          const lim = barra.getBoundingClientRect().bottom + 40;
          let k = 0;
          secoes.forEach((sc, i) => { if (sc[0].getBoundingClientRect().top <= lim + 80) k = i; });
          if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) k = secoes.length - 1;
          if (k !== atual) { atual = k; pintar(); }
        }, 60);
      };
      addEventListener('scroll', aoRolar, { passive: true });
    }
    pintar();
    const pe = h('div', { class: nc('fixo') + ' pe-notif' + (tudo ? ' pe-tudo' : '') }, ant, prox);
    return { barra, pe, resumoBox, mostrar };
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
    let aoMarcar = null; // tela simples: salva sozinho e atualiza a prévia do documento
    let edVer = 0; // conta as alterações: o que for digitado enquanto grava não se perde
    const marcar = () => { sujo = true; edVer++; if (aoMarcar) aoMarcar(); };
    // 3.18.2: a legenda da foto é a descrição da foto na visita — o que for escrito aqui corrige a visita ao salvar
    const legEditadas = new Set();
    const semPonto = (t) => String(t || '').trim().replace(/[\s.;:]+$/, '');
    const fonteDesc = (s) => irrDaSel(s) || mapaFotos.get(s.fotoId) || null;

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
        areaRica(n.itens, i, { readonly: ro, mini: true, 'aria-label': 'Item ' + (i + 1), oninput: () => marcar() }),
        ro ? null : h('div', { class: 'ctl' },
          h('button', { class: 'btn peq', disabled: i === 0, onclick: () => { n.itens.splice(i - 1, 0, n.itens.splice(i, 1)[0]); marcar(); desenharItens(); } }, '▲'),
          h('button', { class: 'btn peq', disabled: i === n.itens.length - 1, onclick: () => { n.itens.splice(i + 1, 0, n.itens.splice(i, 1)[0]); marcar(); desenharItens(); } }, '▼'),
          h('button', { class: 'btn peq perigo', onclick: () => { n.itens.splice(i, 1); marcar(); desenharItens(); } }, '✕')))),
      ro ? null : h('div', { class: 'acoes' },
        h('button', { class: 'btn peq', onclick: () => { n.itens = n.itens || []; n.itens.push(''); marcar(); desenharItens(); const t = itensBox.querySelectorAll('.rt-ed'); if (t.length) t[t.length - 1].focus(); } }, '+ Item'),
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
      campo('Constatação', areaRica(n, 'constatacao', { readonly: ro, mini: true, oninput: () => marcar() }), 'Selecione um trecho e toque em B, I ou U.'),
      h('h3', {}, 'Itens (lista com marcadores)'), itensBox);

    /* --- providencias --- */
    const secProv = h('div', { class: 'card' }, h('h2', {}, '2. Providências'),
      r.tipo === 'contrato' ? h('p', { class: 'sub' }, 'O parágrafo padrão do modelo (prazo, contrato nº, protocolo) é preenchido automaticamente. Abaixo, texto complementar opcional.') : null,
      campo(r.tipo === 'contrato' ? 'Providências complementares (opcional)' : 'Texto das providências', areaRica(n, 'providencias', { readonly: ro, oninput: () => marcar() }), 'Selecione um trecho e toque em B, I ou U · cada linha vira um parágrafo.'),
      campoPrazoDias(n, ro, marcar));

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
    let redesenharSimples = null; // tela simples: mudanças do projeto redesenham os cartões dela
    const desenharFotos = () => {
      if (redesenharSimples) return redesenharSimples();
      const selIds = (n.fotos || []).map((s) => s.fotoId);
      const ordenada = h('div', { class: 'lista-ord' }, ...(n.fotos || []).map((s, i) => {
        const f = mapaFotos.get(s.fotoId) || { id: s.fotoId };
        const img = h('img');
        urlFoto(f).then((u) => { img.src = u; });
        const ta = h('textarea', { readonly: ro, placeholder: 'Legenda', oninput: (e) => { s.legenda = e.target.value; legEditadas.add(s.fotoId); marcar(); } });
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
        if (!aoMarcar) delete n.itensV2; // tela completa mexe direto na lista: a tela simples refaz a ligação itens ↔ fotos
        const limpos = (n.itens || []).map((t) => t.trim()).filter(Boolean);
        // itens vazios saem: a tela é redesenhada, senão o que se digitasse depois iria para a posição errada
        if (JSON.stringify(limpos) !== JSON.stringify(n.itens || [])) { n.itens = limpos; desenharItens(); }
      }
      const v0 = edVer, snap = clonar(n);
      const salvo = await salvarMudancas('notificacoes', nBase, snap);
      Object.assign(original, salvo);
      nBase = snap;
      sujo = edVer !== v0;
      if (sujo && aoMarcar) aoMarcar(); // alterado durante a gravação: grava de novo em seguida
      // legendas editadas → descrição da foto (ou da irregularidade) na visita
      for (const fid of Array.from(legEditadas)) {
        legEditadas.delete(fid);
        const sel = (n.fotos || []).find((x) => x.fotoId === fid); if (!sel) continue;
        const f = fonteDesc(sel); const d = semPonto(sel.legenda);
        if (!f || !d || d === semPonto(f.descricao)) continue;
        const novo = await atualizarCampos('fotos', f.id, (o) => { o.descricao = d; });
        if (novo) mapaFotos.set(f.id, novo);
      }
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
      // tela simples: { direto: true, envio: 'AAAA-MM-DD' | null } — a conferência já foi feita na janela "Emitir"
      const direto = comEnvio && typeof comEnvio === 'object' ? comEnvio : null;
      if (!validar()) return;
      const atualDB = await DB.get('notificacoes', id);
      if (atualDB && atualDB.status === 'emitida') { toast('Esta notificação já foi emitida (em outro aparelho).', true); telaNotificacao(id); return; }
      let envio = null;
      if (direto) envio = direto.envio ? { data: direto.envio, hora: direto.hora || '' } : null;
      else if (!(n.fotos || []).length && !(await confirmar('Esta notificação não tem fotos anexas. Emitir mesmo assim?', 'Emitir'))) return;
      if (direto) { /* */ } else if (comEnvio) {
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
        if (direto && direto.assinatura) aplicarAssinatura(o, direto.assinatura);
        if (envio) aplicarEnvio(o, envio.data, envio.hora);
      });
      Object.assign(original, emit);
      if (direto && direto.assinatura) await ativNotif(emit || n, 'inserida para assinatura', X.dataBR(direto.assinatura.data) + ' às ' + direto.assinatura.hora + (direto.assinatura.ref ? ' · ' + direto.assinatura.ref : ''));
      if (envio) await ativNotif(emit || n, 'enviada', X.dataBR(envio.data) + (envio.hora ? ' às ' + envio.hora : '') + ' · registrada direto (já assinada)');
      App._sairNotif = null;
      await gerarDireto();
      await telaNotificacao(id);
      if (num.avisos.length) toast('Número ajustado: ' + num.avisos.join('; ') + '.', true);
    }

    async function excluirNotif() {
      if (!(await confirmar('Excluir esta notificação?', 'Excluir', true))) return;
      sujo = false; App._sairNotif = null;
      await DB.excluir('notificacoes', id, email()); verificarPrazos(); location.replace('#/registro/' + r.id);
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
        await atualizarCampos('notificacoes', id, (o) => aplicarEnvio(o, envio.data, envio.hora));
        toast('Envio registrado — prazo até ' + X.dataBR(prazoFinalUteis(envio.data, +original.prazo_dias || 3)) + ' às ' + envio.hora);
        verificarPrazos(); telaNotificacao(id);
      } }, '📨 Enviado') : null),
      h('div', { class: 'acoes' },
        emitida && pode.notificar() ? h('button', { class: 'btn peq', onclick: () => criarNotificacao(r.id, n) }, '↻ Nova notificação a partir desta (reiteração)') : null,
        emitida && pode.admin() ? h('button', { class: 'btn peq', onclick: async () => {
          if (!(await confirmar('Reabrir para edição? A notificação voltará a ser rascunho' + (original.enviadaEm ? ' e o registro de envio/resposta será apagado (registre o envio de novo ao reemitir).' : '.'), 'Reabrir'))) return;
          await atualizarCampos('notificacoes', id, (o) => { o.status = 'rascunho'; delete o.emitidaEm; for (const k of ['rodadas', 'aditivosPrazo', 'assinaturaEm', 'assinaturaHora', 'assinaturaRef', 'assinaturaPor', 'assinaturaDireta', 'enviadaEm', 'enviadaHora', 'prazoFinal', 'prazoDiasEnvio', 'enviadaPor', 'respondidaEm', 'respostaObs', 'respondidaPor']) delete o[k]; });
          verificarPrazos(); telaNotificacao(id);
        } }, '🔓 Reabrir') : null,
        (!emitida && pode.notificar()) || pode.admin() ? h('button', { class: 'btn peq perigo', onclick: excluirNotif }, 'Excluir') : null),
      h('p', { class: 'dica' }, 'Dica: para PDF, abra o .docx no Word (celular ou computador) e use “Salvar como PDF”.'));

    /* ================= 3.18.2: rascunho numa tela só (celular e computador) =================
       Dados em 4 linhas (número, datas, prazo, quem assina), "O que foi constatado" com um cartão por foto
       (a legenda gera o item da lista e corrige a descrição na visita), providências recolhidas, salvamento
       automático, "Ver documento" (no computador ao lado, ao vivo) e "Emitir…" com a conferência. */
    function telaSimples() {
      const comoItem = (t) => { const x = semPonto(t); return x ? x + ';' : ''; };
      const itemDe = (sl) => (sl.itemProprio && String(sl.item || '').trim() ? String(sl.item).trim() : comoItem(sl.legenda));
      const itensFinal = () => [...(n.fotos || []).filter((sl) => sl.naLista).map(itemDe), ...(n.itensExtras || [])].map((t) => String(t || '').trim()).filter(Boolean);
      // mesmo que itensFinal, com o trecho da tela de cada item (foto ou item sem foto) para a prévia
      const itensComAlvo = () => [...(n.fotos || []).filter((sl) => sl.naLista).map((sl) => [itemDe(sl), 'foto:' + sl.fotoId]), ...(n.itensExtras || []).map((t) => [t, 'extras'])]
        .map(([t, a]) => [String(t || '').trim(), a]).filter(([t]) => t);
      // rascunho antigo (itens e fotos separados): liga cada item à foto de mesma descrição; o resto fica como item sem foto
      const eraV2 = !!n.itensV2;
      if (!n.itensV2) {
        const resto = (n.itens || []).slice();
        for (const sl of n.fotos || []) {
          delete sl.item; sl.itemProprio = false; // refaz a ligação do zero (texto próprio antigo não volta)
          const f = fonteDesc(sl) || {};
          const cand = [comoItem(sl.legenda), comoItem(f.descricao)].filter(Boolean);
          const k = resto.findIndex((t) => cand.includes(comoItem(t)));
          if (k >= 0) { sl.naLista = true; const t = resto.splice(k, 1)[0]; if (comoItem(t) !== comoItem(sl.legenda)) { sl.item = t; sl.itemProprio = true; } }
          else sl.naLista = false;
        }
        n.itensExtras = resto; n.itensV2 = true; sujo = true;
      }
      // a legenda acompanha a descrição atual da foto na visita (rascunhos de antes da 3.18.2, cujas legendas
      // podiam ser diferentes da descrição de propósito, ficam como estão)
      if (eraV2) for (const sl of n.fotos || []) {
        const f = fonteDesc(sl);
        if (f && semPonto(f.descricao) && semPonto(f.descricao) !== semPonto(sl.legenda)) { sl.legenda = legendaPadrao(f); sujo = true; }
      }
      n.itens = itensFinal();
      const quem = quemResponde(r.tipo);
      const nomeQuem = quem.replace(/^a /, '');
      const st = { tSalvar: null, salvando: false };
      const statusSalvo = h('span', { class: 'nf-salvo' }, '✓ Salvo');
      const pintarSalvo = (t, cls) => { statusSalvo.textContent = t; statusSalvo.className = 'nf-salvo' + (cls ? ' ' + cls : ''); };
      const autoSalvar = async () => {
        if (st.salvando) { clearTimeout(st.tSalvar); st.tSalvar = setTimeout(autoSalvar, 800); return; }
        if (!sujo || !document.body.contains(statusSalvo)) return;
        st.salvando = true; pintarSalvo('Salvando…', 'esp');
        try { await salvar(true); pintarSalvo('✓ Salvo'); } catch (e) { pintarSalvo('Não salvou: ' + e.message, 'erro'); } finally { st.salvando = false; }
      };
      let tPrev = null;
      aoMarcar = () => {
        n.itens = itensFinal();
        pintarSalvo('Alterações não salvas…', 'esp');
        clearTimeout(st.tSalvar); st.tSalvar = setTimeout(autoSalvar, 1500);
        clearTimeout(tPrev); tPrev = setTimeout(pintarDoc, 250);
        if (n.fatosAntes == null || n.fatosDepois == null || n.provTexto == null) { clearTimeout(tAuto); tAuto = setTimeout(carregarAuto, 600); }
      };
      let tAuto = null;

      /* ---- dados ---- */
      const cardDados = h('div', { class: 'card nf-dados' });
      const linhaD = (ic, rot, valor, sub, abrir, dir, alvo) => h('div', { class: 'nf-linha', role: 'button', tabindex: '0', 'data-alvo': alvo || null, onclick: abrir, onkeydown: (e) => { if (e.key === 'Enter') abrir(); } },
        h('span', { class: nc('ic') + ' nf-ic' }, ico(ic)),
        h('div', { class: 'nf-c' }, h('span', {}, rot), h('b', {}, valor), sub ? h('i', {}, sub) : null),
        dir || h('span', { class: 'nf-dir' }, '›'));
      const nomesF = () => snapshotAssinantes(edFiscais, pessoas, true).map((f) => f.nome).filter(Boolean);
      const nomesC = () => snapshotAssinantes(edCoord, pessoas, false).map((c) => c.nome).filter(Boolean);
      const pintarDados = () => {
        const d = +n.prazo_dias || 3, fim = prazoFinalUteis(X.hojeISO(), d);
        const passo = (k) => h('button', { type: 'button', class: 'nf-mm', 'aria-label': k > 0 ? 'Um dia a mais' : 'Um dia a menos', onclick: (e) => { e.stopPropagation(); n.prazo_dias = Math.max(1, Math.min(365, (+n.prazo_dias || 3) + k)); marcar(); pintarDados(); } }, k > 0 ? '+' : '−');
        const nf = nomesF(), ncs = nomesC();
        rc(cardDados,
          linhaD('doc', 'Número', n.numero || (seqAuto ? 'Automático ao emitir' : 'Não informado'), n.ordinal + 'ª notificação desta obra', editarNumero, null, 'numero'),
          linhaD('cal', 'Datas', 'Notificação ' + (X.dataBR(n.data) || '—'), 'Vistoria em ' + (X.dataBR(n.data_vistoria) || '—'), editarDatas, null, 'datas'),
          linhaD('relogio', 'Prazo para ' + quem + ' responder', plural(d, 'dia útil', 'dias úteis'), 'se enviada hoje, vence em ' + X.dataBR(fim), editarPrazo,
            h('span', { class: 'nf-step', onclick: (e) => e.stopPropagation() }, passo(-1), h('b', { class: nc('num') }, String(d)), passo(1)), 'prazo'),
          linhaD('pessoas', 'Assinam', nf.length ? nf.join(', ') : 'Escolha o fiscal', ncs.length ? 'Coordenação: ' + ncs.join(', ') : (nf.length ? 'sem coordenador' : 'obrigatório'), editarAssinantes, null, 'assinam'));
        if (!nf.length) cardDados.lastChild.classList.add('nf-falta');
      };
      async function editarNumero() {
        await modal('Número e ordem', h('div', {}, campo('Ordem (ª notificação)', ordInp),
          campo('Número da notificação', numInp, seqAuto ? 'Definido pelo servidor ao emitir — nunca se repete. Se precisar de um número específico, digite aqui.' : 'Gerado automaticamente e confirmado ao emitir — pode ser alterado.')), [{ txt: 'OK', cls: 'pri', valor: true }]);
        pintarDados(); pintarDoc();
      }
      async function editarDatas() {
        const dN = h('input', { type: 'date', value: n.data || '', oninput: (e) => { n.data = e.target.value; marcar(); } });
        const dV = h('input', { type: 'date', value: n.data_vistoria || '', oninput: (e) => { n.data_vistoria = e.target.value; marcar(); } });
        await modal('Datas', h('div', {}, campo('Data da notificação', dN), campo('Data da vistoria (in loco)', dV)), [{ txt: 'OK', cls: 'pri', valor: true }]);
        pintarDados();
      }
      async function editarPrazo() {
        await modal('Prazo para ' + quem + ' responder', campoPrazoDias(n, false, marcar), [{ txt: 'OK', cls: 'pri', valor: true }]);
        pintarDados();
      }
      async function editarAssinantes() {
        const at = () => { marcar(); equipeInp.placeholder = equipeAuto(); };
        await modal('Quem assina', h('div', { onchange: at, onclick: (e) => { if (e.target.tagName === 'BUTTON') at(); } },
          h('h3', {}, 'Fiscais'), editorAssinantes(edFiscais, pessoas, 'fiscal', true, r.tipo),
          h('h3', {}, 'Coordenadores'), editorAssinantes(edCoord, pessoas, 'coordenador', false, r.tipo),
          campo('Texto da equipe (“representada pelo …”)', equipeInp, 'Deixe vazio para gerar a partir dos fiscais.')), [{ txt: 'OK', cls: 'pri', valor: true }]);
        marcar(); pintarDados();
      }

      /* ---- 3.18.6: texto inteiro editável (Dos fatos: antes e depois da lista; Providências) ----
         O texto começa igual ao do modelo do Word (já com datas, equipe, prazo…) e acompanha os dados até ser
         editado; depois fica como foi escrito ("Restaurar o texto do modelo" volta ao automático). */
      const secAuto = { ok: false, carregando: true, fatosAntes: '', fatosDepois: '', prov: '' };
      const ROT_SEC = { fatosAntes: 'Texto antes da lista', fatosDepois: 'Texto depois da lista', provTexto: 'Texto' };
      const autoDe = (k) => (k === 'provTexto' ? secAuto.prov : secAuto[k]);
      const efTexto = (k) => (n[k] != null ? n[k] : autoDe(k));
      const autoAltura = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, 900) + 'px'; };
      const blocos = {};
      const blocoTexto = (k) => {
        if (blocos[k]) return blocos[k].el;
        const etqEl = h('span', { class: nc('etq') });
        const restaurar = h('button', { type: 'button', class: 'nf-lk', 'data-acao': 'restaurar-' + k, onclick: async () => {
          if (!(await confirmar('Voltar ao texto do modelo? O que foi escrito aqui será substituído.', 'Restaurar'))) return;
          delete n[k]; rt.definir(autoDe(k)); pintar(); marcar();
        } }, 'Restaurar o texto do modelo');
        const rt = editorRico({ valor: efTexto(k), rotulo: ROT_SEC[k], attrs: { class: 'rt-ed nf-sec-ta', 'data-sec': k }, aoMudar: (t) => { n[k] = t; pintar(); marcar(); } });
        const ta = rt.ed;
        const pintar = () => {
          const ed = n[k] != null;
          etqEl.textContent = ed ? 'editado' : 'do modelo'; etqEl.className = nc('etq ' + (ed ? 'acc' : ''));
          restaurar.style.display = ed ? '' : 'none';
        };
        const el = h('div', { class: 'nf-sec' }, h('div', { class: 'nf-sec-rot' }, h('b', {}, ROT_SEC[k]), etqEl, restaurar), rt);
        blocos[k] = { el, ta, pintar, atualizar: () => { if (n[k] == null && document.activeElement !== ta) rt.definir(autoDe(k)); pintar(); } };
        pintar();
        return el;
      };
      const dicaMarcacao = () => h('div', { class: 'dica nf-sec-dica' }, 'Selecione um trecho e toque em B (negrito), I (itálico) ou U (sublinhado) · cada linha é um parágrafo · comece com “- ” para item com marcador ou “a) ” para item recuado.');
      async function carregarAuto() {
        try {
          const dados = DocGen.montarDados(r, Object.assign({}, n, {
            fiscais: (() => { const f = snapshotAssinantes(edFiscais, pessoas, true); return f.length ? f : n.fiscais || []; })(), coordenadores: (() => { const c = snapshotAssinantes(edCoord, pessoas, false); return c.length ? c : n.coordenadores || []; })(),
            fotosDoc: (n.fotos || []).map((x) => ({ legenda: x.legenda || '' })),
          }));
          const t = await DocGen.textoSecoes(await modeloDocx(r.tipo), dados);
          const antes = secAuto.ok;
          Object.assign(secAuto, t, { carregando: false });
          if (!antes && t.ok) { pintarFatos(); pintarProv(); }
          else if (!t.ok && antes !== t.ok) { pintarFatos(); pintarProv(); }
          for (const b of Object.values(blocos)) b.atualizar();
          pintarDoc();
        } catch (e) { secAuto.carregando = false; console.error(e); pintarFatos(); pintarProv(); }
      }

      /* ---- o que foi constatado ---- */
      const cardFatos = h('div', { class: 'card nf-fatos' });
      redesenharSimples = () => pintarFatos();
      const pendentesFora = () => fotosReg.filter((f) => f.irregular && situacao(f) === 'pendente' && !temIrr(f));
      const pintarFatos = () => {
        const fs = n.fotos || [], ex = n.itensExtras || [];
        const nLista = itensFinal().length;
        const pend = pendentesFora();
        const cartao = (sl, i) => {
          const f = mapaFotos.get(sl.fotoId) || { id: sl.fotoId };
          const img = h('img', { alt: '' }); urlFoto(f).then((u) => { img.src = u; });
          const verItem = h('div', { class: 'nf-item' });
          const legTa = h('textarea', { rows: 2, 'aria-label': 'Legenda da foto (Imagem ' + (i + 1) + ')', placeholder: 'Descreva o que a foto mostra', oninput: (e) => {
            sl.legenda = e.target.value; legEditadas.add(sl.fotoId); if (!sl.itemProprio) pintarItem(); marcar();
          } });
          legTa.value = sl.legenda || '';
          const pintarItem = () => {
            if (!sl.naLista) { rc(verItem, h('span', { class: 'sub' }, 'Só no anexo (não entra na lista de irregularidades)')); return; }
            if (sl.itemProprio) {
              const ta = editorRico({ valor: sl.item || comoItem(sl.legenda), mini: true, rotulo: 'Texto na lista de irregularidades', attrs: { class: 'rt-ed nf-item-ta' }, aoMudar: (t) => { sl.item = t; marcar(); } });
              rc(verItem, h('div', { class: 'nf-item-rot' }, 'Texto na lista (próprio)', h('button', { type: 'button', class: 'nf-lk', onclick: () => { sl.itemProprio = false; delete sl.item; marcar(); pintarItem(); } }, 'gerar da legenda')), ta);
            } else rc(verItem, h('div', { class: 'nf-item-rot' }, 'Na lista: ', h('button', { type: 'button', class: 'nf-lk', onclick: () => { sl.itemProprio = true; sl.item = comoItem(sl.legenda); marcar(); pintarItem(); const t = verItem.querySelector('.rt-ed'); if (t) t.focus(); } }, 'escrever outro texto')),
              h('div', { class: 'nf-item-v' }, comoItem(sl.legenda) || '—'));
          };
          pintarItem();
          const chk = h('input', { type: 'checkbox', checked: sl.naLista ? 'checked' : null, onchange: (e) => { sl.naLista = e.target.checked; marcar(); pintarFatos(); } });
          const irr = irrDaSel(sl);
          return h('div', { class: 'nf-irr' + (sl.naLista ? '' : ' so-anexo'), 'data-foto': sl.fotoId },
            h('div', { class: 'nf-ft', role: 'button', title: 'Ver a foto', onclick: () => abrirFoto(f, null, fs.map((x) => mapaFotos.get(x.fotoId)).filter(Boolean)) }, img, h('small', {}, 'Imagem ' + (i + 1)), irr ? h('small', { class: 'nf-ft-irr', title: 'Irregularidade' }, '⚠️ irregular') : null),
            h('div', { class: 'nf-c' },
              h('label', { class: 'nf-rot' }, 'Legenda da foto'), legTa, verItem,
              h('label', { class: 'nf-chk' }, chk, ' Entra na lista de irregularidades'),
              linhaProjeto(sl, i)),
            h('div', { class: 'nf-ctl' },
              h('button', { type: 'button', 'aria-label': 'Subir', disabled: i === 0, onclick: () => { fs.splice(i - 1, 0, fs.splice(i, 1)[0]); marcar(); pintarFatos(); } }, '▲'),
              h('button', { type: 'button', 'aria-label': 'Descer', disabled: i === fs.length - 1, onclick: () => { fs.splice(i + 1, 0, fs.splice(i, 1)[0]); marcar(); pintarFatos(); } }, '▼'),
              h('button', { type: 'button', 'aria-label': 'Tirar da notificação', class: 'nf-x', onclick: () => { fs.splice(i, 1); legEditadas.delete(sl.fotoId); marcar(); pintarFatos(); } }, '✕')));
        };
        const extra = (t, i) => {
          const ta = editorRico({ valor: t, mini: true, placeholder: 'Irregularidade sem foto', rotulo: 'Irregularidade sem foto', aoMudar: (v) => { n.itensExtras[i] = v; marcar(); } });
          return h('div', { class: 'nf-irr nf-extra' }, h('div', { class: 'nf-ft vazio' }, '≡', h('small', {}, 'sem foto')),
            h('div', { class: 'nf-c' }, h('label', { class: 'nf-rot' }, 'Irregularidade (só na lista)'), ta),
            h('div', { class: 'nf-ctl' }, h('button', { type: 'button', class: 'nf-x', 'aria-label': 'Remover', onclick: () => { n.itensExtras.splice(i, 1); marcar(); pintarFatos(); } }, '✕')));
        };
        rc(cardFatos,
          h('h2', {}, 'Dos fatos e irregularidades', h('span', { class: nc('etq ' + (nLista ? 'al' : '')) }, plural(nLista, 'item na lista', 'itens na lista'))),
          secAuto.carregando ? h('div', { class: 'sub', style: { padding: '8px 0' } }, h('span', { class: 'carregando' }), ' Carregando o texto do modelo…')
            : secAuto.ok ? [blocoTexto('fatosAntes'), dicaMarcacao(), h('div', { class: 'nf-sec-rot nf-lista-rot' }, h('b', {}, 'Lista das irregularidades'), h('span', { class: 'sub' }, 'a legenda de cada foto vira um item'))]
            : campo('Texto antes da lista', areaRica(n, 'constatacao', { mini: true, 'data-alvo': 'constatacao', placeholder: 'Ex.: foram constatadas as seguintes irregularidades:', oninput: (e) => { n.constatacao = e.target.value; marcar(); } }), '“…visto que em diligência efetuada in loco no dia ' + (X.dataBR(n.data_vistoria) || '__') + ', ” + este texto'),
          fs.map(cartao), ex.map(extra),
          !fs.length && !ex.length ? h('div', { class: 'vazio', style: { padding: '12px 4px' } }, 'Inclua as irregularidades pendentes, fotos da obra ou itens sem foto.') : null,
          h('div', { class: 'nf-add' },
            pend.length ? h('button', { type: 'button', class: 'nf-add-pend', 'data-acao': 'incluir-pendentes', onclick: incluirPendentes }, '+ ' + plural(pend.length, 'pendente da obra', 'pendentes da obra')) : null,
            h('button', { type: 'button', 'data-acao': 'mais-fotos', onclick: escolherFotos }, '+ Foto'),
            h('button', { type: 'button', 'data-acao': 'item-sem-foto', onclick: () => { n.itensExtras = n.itensExtras || []; n.itensExtras.push(''); marcar(); pintarFatos(); const t = cardFatos.querySelectorAll('.nf-extra .rt-ed'); if (t.length) t[t.length - 1].focus(); } }, '+ Item sem foto')),
          secAuto.ok && !secAuto.carregando ? blocoTexto('fatosDepois') : null);
      };
      async function incluirPendentes() {
        const pend = pendentesFora().sort((a, b) => String(a.dataHora).localeCompare(b.dataHora));
        if (!pend.length) return;
        for (const f of pend) { const sl = await selIrregularidade(f, mapaFotos); sl.naLista = true; n.fotos = (n.fotos || []).concat(sl); }
        marcar(); pintarFatos();
        toast(plural(pend.length, 'irregularidade pendente incluída', 'irregularidades pendentes incluídas'));
      }
      async function escolherFotos() {
        const box = h('div');
        const pintar = () => {
          const selIds = (n.fotos || []).map((x) => x.fotoId);
          rc(box, h('p', { class: 'sub', style: { marginTop: 0 } }, 'Toque nas fotos para incluir ou tirar do anexo.'),
            fotosGrade.length ? gradeFotos(fotosGrade, { selecionadas: selIds, onclick: (f) => {
              const irr = f._irr;
              const i = irr ? (n.fotos || []).findIndex((x) => x.fotoId === f.id || x.irrId === irr.id || x.fotoId === irr.id) : selIds.indexOf(f.id);
              if (i >= 0) n.fotos.splice(i, 1);
              else { n.fotos = n.fotos || []; const base = irr || f; n.fotos.push(Object.assign(irr ? { fotoId: f.id, irrId: irr.id } : { fotoId: f.id }, { legenda: legendaPadrao(base), naLista: !!base.irregular })); }
              marcar(); pintar();
            } }) : h('div', { class: 'vazio' }, 'Nenhuma foto coletada para esta obra.'));
        };
        pintar();
        await modal('Fotos da obra', box, [{ txt: 'Pronto', cls: 'pri', valor: true }]);
        pintarFatos();
      }

      /* ---- providências ---- */
      const provTa = areaRica(n, 'providencias', { 'data-alvo': 'providencias', oninput: (e) => { n.providencias = e.target.value; marcar(); pintarProvSub(); } });
      const provSub = h('span', {});
      const pintarProvSub = () => rc(provSub, r.tipo === 'contrato'
        ? 'Parágrafo padrão do contrato' + (String(n.providencias || '').trim() ? ' + texto complementar' : '') + ' · toque para editar'
        : (String(n.providencias || '').trim() ? String(n.providencias).trim().slice(0, 70) + (String(n.providencias).trim().length > 70 ? '…' : '') : 'Sem texto') + ' · toque para editar');
      pintarProvSub();
      const cardProvAntigo = h('details', { class: 'card nf-prov' },
        h('summary', {}, h('span', { class: nc('ic') + ' nf-ic' }, ico('doc')), h('div', { class: 'nf-c' }, h('b', {}, 'Providências'), provSub), h('span', { class: 'nf-dir' }, '›')),
        r.tipo === 'contrato' ? h('p', { class: 'sub' }, 'O parágrafo padrão do modelo (prazo, contrato nº, protocolo) é preenchido sozinho. Abaixo, texto complementar opcional.') : null,
        campo(r.tipo === 'contrato' ? 'Providências complementares (opcional)' : 'Texto das providências', provTa, 'Selecione um trecho e toque em B, I ou U · cada linha vira um parágrafo.'));

      const cardProv = h('div', { class: 'nf-prov-box' });
      const pintarProv = () => {
        if (secAuto.carregando) { rc(cardProv); return; }
        if (!secAuto.ok || secAuto.okProv === false) { rc(cardProv, cardProvAntigo); return; } // modelo sem o título "Possíveis sanções": como antes
        rc(cardProv, h('div', { class: 'card nf-prov2' }, h('h2', {}, 'Providências a serem adotadas'), blocoTexto('provTexto'), dicaMarcacao()));
      };
      pintarProv();

      /* ---- documento (prévia simplificada do Word) ---- */
      const doc = h('div', { class: 'nf-papel', 'aria-label': 'Prévia do documento' });
      const cmp = (txt, alvo, auto) => h('span', { class: 'nf-cmp' + (auto ? ' auto' : ''), 'data-ir': alvo || null }, txt);
      // texto com a marcação (linhas, "- ", "a) ", **negrito**, *itálico*) → parágrafos da prévia
      const fmtRico = (pc) => { let x = pc.t; if (pc.u) x = h('u', {}, x); if (pc.i) x = h('i', {}, x); if (pc.b) x = h('b', {}, x); return x; };
      const docTexto = (texto, alvo) => {
        const out = []; let ul = null;
        for (const l of String(texto || '').split('\n')) {
          const rico = (t) => h('span', { class: 'nf-cmp', 'data-ir': alvo }, DocGen.partesRicas(t).map(fmtRico));
          if (/^\s*[-•]\s+/.test(l)) { if (!ul) { ul = h('ul'); out.push(ul); } ap(ul, h('li', {}, rico(l.replace(/^\s*[-•]\s+/, '')))); continue; }
          ul = null;
          if (!l.trim()) { out.push(h('p', { class: 'vazio-p' }, '\u00a0')); continue; }
          out.push(h('p', { class: /^\s*[a-z]\)\s/i.test(l) ? 'rec' : 'ind' }, rico(l.trim())));
        }
        return out;
      };
      function pintarDoc() {
        if (secAuto.ok && !secAuto.carregando) return pintarDocLivre();
        const nome = r.n_nome_texto || r.n_nome || '—';
        const eq = (n.equipe && n.equipe.trim()) || equipeAuto() || '—';
        const d = +n.prazo_dias || 3;
        const itens = itensFinal();
        const fs = n.fotos || [];
        const imgs = fs.map((sl, i) => { const f = mapaFotos.get(sl.fotoId) || { id: sl.fotoId }; const im = h('img', { alt: '' }); urlFoto(f).then((u) => { im.src = u; }); return h('figure', {}, im, h('figcaption', {}, 'Imagem ' + (i + 1) + ' – ', cmp(sl.legenda || '', 'foto:' + sl.fotoId))); });
        rc(doc,
          h('h3', {}, n.ordinal + 'ª NOTIFICAÇÃO EXTRAJUDICIAL' + (r.tipo === 'convenio' ? ' AO CONVÊNIO' : '')),
          h('p', { class: 'c' }, h('b', {}, 'NOTIFICAÇÃO Nº: '), cmp(n.numero || (seqAuto ? 'definido ao emitir' : '___'), 'numero', !n.numero)),
          h('p', {}, h('b', {}, 'NOTIFICADA: '), nome + ' · ' + (r.tipo === 'convenio' ? 'CONVÊNIO' : 'CONTRATO') + ' Nº ' + (r.numero || '—') + (r.objeto ? ' · OBJETO: “' + r.objeto + '”' : '')),
          h('h4', {}, 'DOS FATOS E IRREGULARIDADES IDENTIFICADAS'),
          h('p', {}, 'Ocorre que no dia ', cmp(X.dataBR(n.data) || '__', 'datas'), ', a equipe de fiscalização de obras, representada pelo ', cmp(eq, 'assinam', !(n.equipe && n.equipe.trim())),
            ', vem através deste NOTIFICAR a ' + (r.tipo === 'contrato' ? 'empresa ' : '') + nome + ', visto que em diligência efetuada in loco no dia ', cmp(X.dataBR(n.data_vistoria) || '__', 'datas'), ', ', cmp(n.constatacao || '', 'constatacao')),
          itens.length ? h('ul', {}, itens.map((t, i) => { const sl = fs.filter((x) => x.naLista)[i]; return h('li', {}, cmp(t, sl ? 'foto:' + sl.fotoId : 'extras')); })) : h('p', { class: 'falta' }, '(nenhum item na lista)'),
          h('h4', {}, 'PROVIDÊNCIAS A SEREM ADOTADAS'),
          r.tipo === 'contrato'
            ? h('p', {}, 'Diante das constatadas divergências/irregularidades…, devendo no prazo de ', cmp(d + ' (' + (X.inteiro ? X.inteiro(d) : d) + ')', 'prazo'), ' dias úteis, apresentar manifestação sobre as medidas que serão adotadas…', n.providencias ? [h('br'), cmp(n.providencias, 'providencias')] : null)
            : h('p', {}, cmp(n.providencias || '', 'providencias'), ' Deverá, ainda, no prazo de ', cmp(d + ' (' + (X.inteiro ? X.inteiro(d) : d) + ')', 'prazo'), ' dias úteis, manifestar-se acerca das medidas adotadas…'),
          h('h4', {}, 'POSSÍVEIS SANÇÕES ADMINISTRATIVAS'), h('p', { class: 'cinza' }, '(texto do modelo)'),
          fs.length ? [h('h4', {}, 'ANEXOS'), h('div', { class: 'nf-imgs' }, imgs)] : null,
          h('div', { class: 'nf-ass' }, (nomesF().length ? nomesF() : ['Fiscal']).concat(nomesC()).map((x) => h('div', {}, x))));
      }
      function pintarDocLivre() {
        const nome = r.n_nome_texto || r.n_nome || '—';
        const itens = itensFinal();
        const fs = n.fotos || [];
        const imgs = fs.map((sl, i) => { const f = mapaFotos.get(sl.fotoId) || { id: sl.fotoId }; const im = h('img', { alt: '' }); urlFoto(f).then((u) => { im.src = u; }); return h('figure', {}, im, h('figcaption', {}, 'Imagem ' + (i + 1) + ' – ', cmp(sl.legenda || '', 'foto:' + sl.fotoId))); });
        rc(doc,
          h('h3', {}, n.ordinal + 'ª NOTIFICAÇÃO EXTRAJUDICIAL' + (r.tipo === 'convenio' ? ' AO CONVÊNIO' : '')),
          h('p', { class: 'c' }, h('b', {}, 'NOTIFICAÇÃO Nº: '), cmp(n.numero || (seqAuto ? 'definido ao emitir' : '___'), 'numero', !n.numero)),
          h('p', {}, h('b', {}, 'NOTIFICADA: '), nome + ' · ' + (r.tipo === 'convenio' ? 'CONVÊNIO' : 'CONTRATO') + ' Nº ' + (r.numero || '—')),
          h('h4', {}, 'DOS FATOS E IRREGULARIDADES IDENTIFICADAS'),
          docTexto(efTexto('fatosAntes'), 'fatosAntes'),
          itens.length ? h('ul', {}, itensComAlvo().map(([t, alvo]) => h('li', {}, h('span', { class: 'nf-cmp', 'data-ir': alvo }, DocGen.partesRicas(t).map(fmtRico))))) : h('p', { class: 'falta' }, '(nenhum item na lista)'),
          docTexto(efTexto('fatosDepois'), 'fatosDepois'),
          h('h4', {}, 'PROVIDÊNCIAS A SEREM ADOTADAS'),
          secAuto.okProv === false ? h('p', {}, cmp(n.providencias || '(texto do modelo)', 'providencias')) : docTexto(efTexto('provTexto'), 'provTexto'),
          h('h4', {}, 'POSSÍVEIS SANÇÕES ADMINISTRATIVAS'), h('p', { class: 'cinza' }, '(texto do modelo)'),
          fs.length ? [h('h4', {}, 'ANEXOS'), h('div', { class: 'nf-imgs' }, imgs)] : null,
          h('div', { class: 'nf-ass' }, (nomesF().length ? nomesF() : ['Fiscal']).concat(nomesC()).map((x) => h('div', {}, x))));
      }
      // tocar num trecho do documento leva ao campo
      doc.addEventListener('click', (e) => {
        const el = e.target.closest('[data-ir]'); if (!el) return;
        const a = el.dataset.ir;
        if (fecharDoc) fecharDoc();
        setTimeout(() => {
          if (a === 'numero') return editarNumero();
          if (a === 'datas') return editarDatas();
          if (a === 'prazo') return editarPrazo();
          if (a === 'assinam') return editarAssinantes();
          let alvo = null;
          if (a === 'constatacao') alvo = cardFatos.querySelector('[data-alvo=constatacao]');
          else if (a === 'providencias') { cardProvAntigo.open = true; alvo = provTa; }
          else if (blocos[a]) alvo = blocos[a].ta;
          else if (a === 'extras') alvo = cardFatos.querySelector('.nf-extra .rt-ed');
          else if (a.startsWith('foto:')) { const c = cardFatos.querySelector('[data-foto="' + a.slice(5) + '"]'); alvo = c && c.querySelector('textarea'); }
          if (alvo) { alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => alvo.focus(), 350); }
        }, 60);
      });
      let fecharDoc = null;
      function verDocumento() {
        pintarDoc();
        const fundo = h('div', { class: 'nf-doc-tela' },
          h('div', { class: 'nf-doc-topo' }, h('b', {}, 'Documento'), h('span', { class: 'sub' }, 'Prévia simplificada · toque num trecho para editar')),
          h('div', { class: 'nf-doc-rol' }, legendaDoc(), doc),
          h('div', { class: 'nf-pe' }, h('button', { type: 'button', class: 'n-btn n-cont', onclick: () => fecharDoc() }, 'Voltar a editar'), h('button', { type: 'button', class: 'n-btn n-pri', onclick: () => { fecharDoc(); abrirEmitir(); } }, ico('envio'), 'Emitir…')));
        document.body.appendChild(fundo); document.body.classList.add('nf-doc-aberto');
        fecharDoc = () => { fundo.remove(); document.body.classList.remove('nf-doc-aberto'); colDoc.appendChild(doc); fecharDoc = null; };
      }
      const legendaDoc = () => h('div', { class: 'nf-leg' }, h('span', {}, h('i', { class: 'u' }), 'o que você preencheu (toque para editar)'), h('span', {}, h('i', { class: 'a' }), 'automático'));

      /* ---- emitir ---- */
      async function abrirEmitir() {
        if (sujo) await salvar(true);
        n.itens = itensFinal();
        const itens = n.itens, nf = nomesF(), pend = pendentesFora();
        const erros = [];
        if (!n.data || !n.data_vistoria) erros.push('datas');
        if (!n.numero && !seqAuto) erros.push('número');
        if (!nf.length) erros.push('fiscal');
        const li = (k, t) => h('div', { class: 'nf-chkl' }, h('span', { class: 'b ' + k }, k === 'ok' ? '✓' : k === 'er' ? '✕' : '!'), h('div', {}, t));
        const d = +n.prazo_dias || 3;
        const st2 = { modo: 'ass', data: X.hojeISO(), hora: agoraHM(), ref: '' };
        const dEnvio = h('input', { type: 'date', value: st2.data, max: X.hojeISO(), 'aria-label': 'Data', oninput: (e) => { st2.data = e.target.value; pintarOpc(); } });
        const hEnvio = h('input', { type: 'time', value: st2.hora, step: '60', 'aria-label': 'Horário', oninput: (e) => { st2.hora = e.target.value; pintarOpc(); } });
        const rAss = h('input', { type: 'text', placeholder: 'Onde / nº do documento (opcional)', 'aria-label': 'Onde / nº do documento', oninput: (e) => { st2.ref = e.target.value; } });
        const quando = (rot) => h('span', {}, h('span', {}, rot), h('span', { class: 'nf-quando' }, dEnvio, h('span', {}, ' às '), hEnvio));
        const opcs = h('div');
        const opc = (k, titulo, corpo) => h('div', { class: 'nf-opc' + (st2.modo === k ? ' on' : ''), role: 'radio', 'aria-checked': String(st2.modo === k), 'data-opc': k,
          onclick: (e) => { if (e.target.tagName === 'INPUT') return; if (st2.modo !== k) { st2.modo = k; pintarOpc(); } } }, h('span', { class: 'r' }), h('div', {}, h('b', {}, titulo), corpo));
        const pintarOpc = () => {
          const fim = st2.data ? prazoFinalUteis(st2.data, d) : null;
          rc(opcs,
            opc('ass', 'Emitir e registrar que foi para assinatura', st2.modo === 'ass'
              ? [quando('Inserida em '), rAss, h('span', { class: 'sub', style: { display: 'block' } }, 'O envio é registrado depois; o prazo só começa no envio.')]
              : h('span', {}, 'Data e horário de agora (dá para mudar). O envio é registrado depois.')),
            opc('envio', 'Emitir e registrar o envio', st2.modo === 'envio'
              ? [quando('Enviada em '), h('span', { class: 'sub', style: { display: 'block' } }, fim ? 'Já assinada e enviada: o prazo de ' + plural(d, 'dia útil', 'dias úteis') + ' conta a partir do envio e vence em ' + DIAS_L[dataD(fim).getDay()] + ', ' + X.dataBR(fim) + (st2.hora ? ' às ' + st2.hora : '') + '.' : 'Informe a data do envio.')]
              : h('span', {}, 'Já assinada e enviada: informe a data e o horário do envio; o prazo começa a contar.')),
            opc('so', 'Só emitir', h('span', {}, 'Registro a assinatura e o envio depois.')));
        };
        pintarOpc();
        const ok = await modal('Emitir a ' + n.ordinal + 'ª notificação', h('div', { class: 'nf-emitir' },
          h('div', { class: 'sub', style: { marginBottom: '6px' } }, erros.length ? 'Falta preencher antes de emitir:' : 'Confira e escolha como emitir.'),
          li(n.data && n.data_vistoria ? 'ok' : 'er', 'Vistoria ' + (X.dataBR(n.data_vistoria) || '—') + ' · notificação ' + (X.dataBR(n.data) || '—')),
          li(itens.length ? 'ok' : 'al', plural(itens.length, 'item na lista de irregularidades', 'itens na lista de irregularidades') + ' · ' + plural((n.fotos || []).length, 'foto anexa', 'fotos anexas')),
          li(nf.length ? 'ok' : 'er', nf.length ? 'Assina' + (nf.length > 1 ? 'm' : '') + ' ' + nf.join(', ') : 'Escolha quem assina'),
          !n.numero && !seqAuto ? li('er', 'Informe o número') : null,
          pend.length ? li('al', plural(pend.length, 'irregularidade pendente da obra ficou de fora', 'irregularidades pendentes da obra ficaram de fora')) : null,
          n.provTexto != null && !new RegExp('(^|\\D)0?' + d + '(\\D|$)').test(n.provTexto) ? li('al', 'O texto das providências (editado) não cita o prazo de ' + plural(d, 'dia útil', 'dias úteis') + ' — confira.') : null,
          erros.length ? null : opcs,
          erros.length ? null : h('div', { class: 'nota' }, 'O número é reservado agora e o conteúdo fica bloqueado.')),
          erros.length ? [{ txt: 'Voltar', valor: false }] : [{ txt: 'Cancelar', valor: false }, { txt: 'Emitir e baixar o Word', cls: 'pri', valor: true, antes: () => {
          if (st2.modo === 'so') return true;
          if (!st2.data) { toast('Informe a data.', true); return false; }
          if (!/^\d\d:\d\d$/.test(st2.hora || '')) { toast('Informe o horário.', true); return false; }
          if (st2.data > X.hojeISO()) { toast('A data não pode ser futura.', true); return false; }
          if (st2.data === X.hojeISO() && st2.hora > agoraHM()) { toast('O horário não pode ser futuro.', true); return false; }
          return true;
        } }]);
        if (!ok) { if (erros.includes('fiscal')) editarAssinantes(); else if (erros.length) editarDatas(); return; }
        clearTimeout(st.tSalvar);
        await emitir({ direto: true, envio: st2.modo === 'envio' ? st2.data : null, hora: st2.hora, assinatura: st2.modo === 'ass' ? { data: st2.data, hora: st2.hora, ref: st2.ref.trim() } : null });
      }
      async function menuMais() {
        const v = await modal('Mais opções', h('div', { class: 'nf-menu' },
          h('button', { type: 'button', class: 'btn', 'data-v': 'word' }, '⬇️ Baixar Word (rascunho)'),
          h('button', { type: 'button', class: 'btn', 'data-v': 'comp' }, '📤 Compartilhar (rascunho)'),
          h('button', { type: 'button', class: 'btn', 'data-v': 'completo' }, '🗂️ Todos os campos (tela completa)'),
          h('button', { type: 'button', class: 'btn perigo', 'data-v': 'excluir' }, 'Excluir rascunho')), [{ txt: 'Fechar', valor: null }]);
        return v;
      }
      const abrirMenu = () => {
        menuMais();
        setTimeout(() => {
          const m = document.querySelector('.nf-menu'); if (!m) return;
          m.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-v]'); if (!b) return;
            const fundo = m.closest('.modal-fundo'); if (fundo) fundo.click();
            const k = b.dataset.v;
            if (k === 'word') gerar(false); else if (k === 'comp') gerar(true);
            else if (k === 'excluir') excluirNotif();
            else if (k === 'completo') { if (sujo) await salvar(true); try { sessionStorage.setItem('notif_tela', 'completa'); } catch (e2) { /* */ } telaNotificacao(id); }
          });
        }, 0);
      };

      /* ---- montagem ---- */
      pintarDados(); pintarFatos(); pintarDoc(); carregarAuto();
      const btMais = h('button', { type: 'button', class: 'nf-mais', 'aria-label': 'Mais opções', 'data-acao': 'mais', onclick: abrirMenu }, '⋯');
      const cab = h('div', { class: 'nf-cab' }, statusSalvo,
        h('button', { type: 'button', class: 'n-btn n-cont n-peq so-pc-nf', onclick: () => gerar(false) }, '⬇ Baixar Word'),
        h('button', { type: 'button', class: 'n-btn n-pri n-peq so-pc-nf', 'data-acao': 'emitir', onclick: abrirEmitir }, ico('envio'), 'Emitir…'), btMais);
      const colDoc = h('div', { class: 'nf-coldoc' }, legendaDoc(), doc);
      const pe = h('div', { class: 'nf-pe so-cel-nf' },
        h('button', { type: 'button', class: 'n-btn n-cont', 'data-acao': 'ver-documento', onclick: verDocumento }, ico('olho'), 'Ver documento'),
        h('button', { type: 'button', class: 'n-btn n-pri', 'data-acao': 'emitir-cel', onclick: abrirEmitir }, ico('envio'), 'Emitir…'));
      document.body.dataset.foco = '1';
      rcT(tk, h('div', { class: 'nf-tela' }, cab, h('div', { class: 'nf-cols' }, h('div', { class: 'nf-ed' }, cardDados, cardFatos, cardProv), colDoc)), pe);
      if (sujo) aoMarcar();
      const tirarEsc = salvarAoEsconder(() => { clearTimeout(st.tSalvar); return autoSalvar(); }, () => document.body.contains(statusSalvo));
      App._sairNotif = async () => { tirarEsc(); clearTimeout(st.tSalvar); if (sujo) await salvar(true); };
    }
    if (!ro && modoNotif() !== 'tudo') { telaSimples(); return; }

    if (!ro) {
      // rascunho: 4 passos (dados → texto → anexos → emitir)
      const resumo = () => {
        const d = +n.prazo_dias || 3, fim = prazoFinalUteis(X.hojeISO(), d);
        const itens = (n.itens || []).map((t) => t.trim()).filter(Boolean);
        const li = (ok, t) => h('div', { class: nc('check') }, h('span', { class: nc('ic ' + (ok ? 'ok' : 'al')) }, ico(ok ? 'ok' : 'alerta')), h('div', { class: nc('c') }, t));
        return h('div', { class: 'card' }, h('h2', {}, 'Revisão antes de emitir'),
          h('div', { class: nc('lista'), style: { boxShadow: 'none' } },
            li(!!(n.data && n.data_vistoria), 'Notificação de ' + (X.dataBR(n.data) || '—') + ' · vistoria em ' + (X.dataBR(n.data_vistoria) || '—')),
            li(itens.length > 0, plural(itens.length, 'item', 'itens') + ' na lista de irregularidades'),
            li((n.fotos || []).length > 0, plural((n.fotos || []).length, 'foto anexa', 'fotos anexas')),
            li(true, 'Prazo de ' + d + (d === 1 ? ' dia útil' : ' dias úteis') + ' · se enviada hoje, vence em ' + X.dataBR(fim)),
            li(!!(edFiscais.length || (n.fiscais || []).length), 'Assinam: ' + (snapshotAssinantes(edFiscais, pessoas, true).map((f) => f.nome).join(', ') || '—'))),
          h('div', { class: 'dica' }, 'Baixe o Word para conferir o documento. Ao emitir, o número é reservado e o conteúdo fica bloqueado.'));
      };
      // textos editados na tela simples: são eles que vão no documento — avisa (os campos antigos não os mudam)
      if (temTextoEditado(n)) {
        const avisoEd = () => h('div', { class: 'aviso nf-aviso-ed', style: { margin: '6px 0 10px' } }, '⚠️ Este texto foi editado na tela simples e é ele que vai no documento; os campos abaixo não o alteram. ',
          h('button', { type: 'button', class: 'btn peq', onclick: async () => { if (sujo) await salvar(true); try { sessionStorage.removeItem('notif_tela'); } catch (e) { /* */ } telaNotificacao(id); } }, 'Editar na tela simples'));
        if (n.fatosAntes != null || n.fatosDepois != null) secFatos.insertBefore(avisoEd(), secFatos.children[1] || null);
        if (n.provTexto != null) secProv.insertBefore(avisoEd(), secProv.children[1] || null);
      }
      const resumoCard = h('div');
      const ps = passosNotificacao([[secCab], [secFatos, secProv], [secFotos], [resumoCard, secAss, acoes]], { id, resumo, resumoBox: resumoCard, salvar: () => salvar(), excluir: excluirNotif, redesenhar: async () => { if (sujo) await salvar(true); telaNotificacao(id); } });
      document.body.dataset.foco = '1';
      rcT(tk, ps.barra, secCab, secFatos, secProv, secFotos, resumoCard, secAss, acoes, ps.pe);
      ps.mostrar();
    } else {
      // textos editados na tela simples (3.18.6): é o que vai no documento
      const ed = temTextoEditado(n) ? h('div', { class: 'card' }, h('h2', {}, 'Texto da notificação (editado)'),
        [['fatosAntes', 'Dos fatos — antes da lista'], ['fatosDepois', 'Dos fatos — depois da lista'], ['provTexto', 'Providências']].filter(([k]) => n[k] != null)
          .map(([k, t]) => [h('h3', {}, t), h('div', { class: 'sub', style: { color: 'var(--txt)' } }, rtParaNos(n[k]))])) : null;
      rcT(tk, emitida ? cartaoEnvio(original, r, () => telaNotificacao(id)) : null, secCab, ed, secFatos, secProv, secAss, secFotos, acoes);
    }
    // salvamento automatico do rascunho ao sair da tela (e com o app minimizado)
    const tirarEscN = ro ? () => {} : salvarAoEsconder(() => (sujo ? salvar(true) : null), () => document.body.contains(secCab));
    App._sairNotif = async () => { tirarEscN(); if (sujo && !ro) await salvar(true); };
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
            h('div', { class: 'campo-bloco' }, h('span', {}, 'Comentário'), areaRica(it, 'comentario', { readonly: ro, mini: true, placeholder: 'Ex.: não medido — serviço iniciado, aguardando conclusão do pano', oninput: () => marcar() })),
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
      areaRica(m, 'observacoes', { readonly: ro, placeholder: 'Observações que valem para a medição como um todo.', oninput: () => marcar() }));
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
    // salva o rascunho ao sair da tela (e com o app minimizado)
    const tirarEsc = ro ? () => {} : salvarAoEsconder(() => (sujo ? salvar(true) : null), () => document.body.contains(cab));
    App._sairNotif = async () => { tirarEsc(); if (sujo && !ro) await salvar(true); };
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
        Sync.versaoServidor && Sync.versaoServidor >= 5 && Sync.versaoServidor < 16 && perfil() === 'admin' ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, 'ℹ️ Há uma versão nova do servidor (Code.gs versão 16, com correções no envio das fotos ao Drive). Atualize no Apps Script quando puder.') : null,
        Sync.versaoServidor && Sync.versaoServidor < 5 ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, '⚠️ O servidor (Code.gs) está numa versão antiga, sujeita a perda de sincronismo. O administrador deve colar o Code.gs novo no Apps Script e publicar como nova versão (Guia de publicação, Parte G).') : null,
        Sync.estado === 'erro' ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, Sync.erro) : null,
        Sync.estado === 'sem_acesso' ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, 'Seu e-mail não está autorizado. Peça ao administrador para incluí-lo.') : null,
        !Sync.token() ? h('div', { class: 'sub', style: { marginTop: '8px' } }, 'Sessão expirada — entre novamente para sincronizar:') : null,
        !Sync.token() ? alvo : null,
        h('div', { class: 'acoes' },
          h('button', { class: 'btn pri', onclick: async () => { await Sync.sincronizar({ forcar: true }); telaConfig(); } }, '🔄 Sincronizar agora'),
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
      for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes', 'atividades']) pendPor[e] = (await DB.all(e)).filter((o) => o._pendente).length;
      const fotosSemDrive = (await DB.all('fotos')).filter((f) => !f.driveId && !f.excluido);
      let semArquivo = 0;
      for (const f of fotosSemDrive) if (!(await DB.blobGet(f.id))) semArquivo++;
      const log = Sync.lerLog().slice().reverse();
      const resumo = {
        app: VERSAO_APP, servidor: Sync.versaoServidor || '?', usuario: (u || {}).email, perfil: perfil(), estado: Sync.estado, erro: Sync.erro || '',
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
    // fotos guardadas no aparelho (uso sem internet) e espaço
    const boxFotosAp = h('div', { class: nc('fotos-ap') }, h('span', { class: 'carregando' }), ' Calculando…');
    const pintarFotosAp = async () => {
      const [x, esp] = await Promise.all([resumoFotosAparelho(), espacoAparelho()]);
      rc(boxFotosAp,
        h('div', {}, h('b', {}, 'Fotos no aparelho: ' + mb(x.total)), ' · ' + plural(x.guardadas, 'pendência guardada', 'pendências guardadas') + ' para uso sem internet' + (x.pendencias > x.guardadas ? ' (de ' + x.pendencias + ')' : '')),
        x.naoEnviadas ? h('div', { class: 'sub' }, plural(x.naoEnviadas, 'foto ainda não enviada', 'fotos ainda não enviadas') + ' ao Drive (nunca saem do aparelho antes do envio).') : null,
        esp ? h('div', { class: 'sub' }, 'Espaço livre para o app neste aparelho: ' + mb(esp.livre)) : null,
        esp && esp.pouco ? h('div', { class: 'aviso', style: { marginTop: '8px' } }, '⚠️ O aparelho está quase sem espaço. Os downloads automáticos de fotos estão pausados; libere espaço aqui ou no celular.') : null,
        h('div', { class: 'dica' }, 'Ficam em tamanho real: as fotos das irregularidades pendentes (constatação e última verificação), da visita em andamento, das visitas dos últimos ' + DIAS_GUARDA + ' dias e dos rascunhos. As demais saem do aparelho sozinhas quando já estão no Drive (a miniatura continua; com internet, a foto é baixada de novo ao abrir). Na página da obra, “Preparar para usar sem internet” baixa as que faltam.'),
        h('div', { class: 'acoes' }, h('button', { class: 'btn', onclick: async (e) => {
          const bt = e.currentTarget; bt.disabled = true; rc(bt, h('span', { class: 'carregando' }), ' Liberando…');
          try {
            const r = await limparFotosAparelho({ forcar: true });
            toast(r.removidas ? plural(r.removidas, 'foto saiu', 'fotos saíram') + ' do aparelho · ' + mb(r.liberado) + ' liberados (continuam no Drive).' : 'Nada para liberar: só ficaram as fotos das pendências, das visitas recentes, dos rascunhos e as ainda não enviadas.');
          } catch (er) { toast('Não foi possível liberar: ' + er.message, true); }
          pintarFotosAp();
        } }, '🧹 Liberar espaço agora')));
    };
    pintarFotosAp().catch((e) => rc(boxFotosAp, 'Não foi possível calcular: ' + e.message));
    cards.push(h('div', { class: 'card' }, h('h2', {}, 'Fotos no aparelho'), boxFotosAp));
    cards.push(h('div', { class: 'card' }, h('h2', {}, 'Aparência e câmera'),
      campoBloco('Tema', seg([['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']], temaAtual, aplicarTema)),
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
        campo('Constatação padrão — Contrato', areaRica(c.constatacao_padrao, 'contrato', { mini: true })),
        campo('Constatação padrão — Convênio', areaRica(c.constatacao_padrao, 'convenio', { mini: true })),
        campo('Providências padrão — Convênio', areaRica(c.providencias_padrao, 'convenio'), '{nome_texto} é trocado pelo nome da notificada. Selecione um trecho e toque em B, I ou U.'),
        campo('Providências complementares padrão — Contrato', areaRica(c.providencias_padrao, 'contrato')),
        campo('Prazo padrão (dias úteis)', inputTxt(c, 'prazo_padrao', { type: 'number', min: '1' })),
        editorFeriados(c),
        h('h3', {}, 'Fotos no Google Drive'),
        campo('Pastas das fotos', inputTxt(c, 'pasta_fotos', { placeholder: CONFIG_PADRAO.pasta_fotos }),
          'Dentro da pasta Fotos. Use / para criar subpastas. {tipo} = Conv ou Contr · {numero} = nº do contrato/convênio · {apelido} = nome curto · {os} = O.S. do contrato (“OS 01-2026”; convênio ou sem O.S.: o nível é pulado) · {data} = data da visita (29.09.2026) · {ano} · {visita} = “Visita 3”. Ex.: {tipo}-{numero}/{os}/{data} → Contr-013-2022/OS 01-2026/29.09.2026. Vale para as próximas fotos enviadas; as já enviadas mudam de pasta com “Reorganizar as fotos do Drive”.'),
        pode.admin() ? h('div', { class: 'acoes', style: { marginTop: '-4px' } }, h('button', { type: 'button', class: 'btn peq', 'data-acao': 'reorganizar-drive', onclick: () => reorganizarFotosDrive() }, '🗂️ Reorganizar as fotos do Drive')) : null,
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
    cards.push(h('p', { class: 'dica', style: { textAlign: 'center' } }, 'Fiscalização de Obras · v3.18.6 · dados salvos no aparelho' + (Sync.habilitado() ? ' e no Google Drive do administrador' : '') + ' · ', h('a', { href: 'privacidade.html' }, 'Política de privacidade')));
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

  /* Ajustes › Padrões › Feriados: nacionais (Brasil) e de Mato Grosso automáticos, cada um pode ser desligado;
     pontos facultativos do Governo de MT opcionais; outros feriados digitados (municipais, emendas). */
  function editorFeriados(c) {
    if (c.feriados_auto === undefined) c.feriados_auto = true;
    c.feriados_desligados = (c.feriados_desligados || []).slice();
    let ano = new Date().getFullYear();
    const lista = h('div', { class: 'lista-feriados' });
    const tituloAno = h('b', {});
    const pintar = () => {
      rc(tituloAno, String(ano));
      const f = feriadosDoAno(ano);
      const itens = Object.entries(f).filter(([, v]) => v.tipo === 'nacional' || c.feriados_facultativos).sort((a, b) => a[0].localeCompare(b[0]));
      rc(lista, !c.feriados_auto ? h('div', { class: 'sub' }, 'Automáticos desligados: só contam os feriados digitados abaixo.') : itens.map(([iso, v]) => {
        const ligado = !c.feriados_desligados.includes(iso);
        const d = dataD(iso);
        return h('label', { class: 'linha fer-item' + (ligado ? '' : ' fer-off') },
          h('input', { type: 'checkbox', checked: ligado ? 'checked' : null, onchange: (e) => {
            c.feriados_desligados = c.feriados_desligados.filter((x) => x !== iso);
            if (!e.target.checked) c.feriados_desligados.push(iso);
            pintar();
          } }),
          h('span', { class: 'fer-data' }, X.dataBR(iso).slice(0, 5) + ' · ' + DIAS_C[d.getDay()]),
          h('span', { class: 'fer-nome' }, v.nome, v.tipo === 'facultativo' ? h('small', {}, ' · ponto facultativo MT') : null));
      }));
    };
    pintar();
    const navAno = (dlt) => h('button', { type: 'button', class: 'btn peq', 'aria-label': dlt < 0 ? 'Ano anterior' : 'Próximo ano', onclick: () => { ano += dlt; pintar(); } }, dlt < 0 ? '‹' : '›');
    return h('div', { class: 'campo-bloco editor-feriados' }, h('span', {}, 'Feriados (não contam no prazo das notificações)'),
      h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: c.feriados_auto ? 'checked' : null, onchange: (e) => { c.feriados_auto = e.target.checked; pintar(); } }),
        h('b', {}, 'Feriados nacionais e de Mato Grosso automáticos')),
      h('label', { class: 'linha sub' }, h('input', { type: 'checkbox', checked: c.feriados_facultativos ? 'checked' : null, onchange: (e) => { c.feriados_facultativos = e.target.checked; pintar(); } }),
        'Contar também os pontos facultativos do Governo de MT (Carnaval, Quarta-feira de Cinzas, Corpus Christi, 28/10, 24/12 e 31/12)'),
      h('div', { class: 'linha', style: { margin: '8px 0 4px' } }, navAno(-1), tituloAno, navAno(1), h('span', { class: 'sub' }, '· desmarque para não contar como feriado')),
      lista,
      campo('Outros feriados (municipais, emendas, mudanças)', inputArea(c, 'feriados', { placeholder: 'dd/mm Feriado municipal\n05/06/2026 Emenda de Corpus Christi' }),
        'Um por linha: dd/mm/aaaa (ou só dd/mm, para os que se repetem todo ano) e o nome. Sábados e domingos já não contam.'),
      h('div', { class: 'dica' }, 'Os automáticos seguem a lei federal (Lei 662/1949, Lei 6.802/1980 e Lei 14.759/2023) e são calculados para cada ano, inclusive a Sexta-feira Santa. Mato Grosso não tem feriado estadual próprio além dos nacionais (Decreto estadual nº 1.787/2025, feriados de 2026); o 20 de novembro, antes estadual, é nacional desde 2024. Salve em “Salvar padrões”.'));
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
      for (const e of ['registros', 'pessoas', 'visitas', 'notificacoes', 'fotos', 'config', 'medicoes', 'atividades']) dados[e] = await DB.all(e);
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
  /* 3.18.6: com internet fraca o navegador pode juntar arquivos de duas versões do app (um novo, outro guardado).
     Se isso acontecer, pede a versão nova inteira ao service worker e recarrega (uma vez por sessão). */
  const VERSAO_APP = '3.18.6';
  function conferirVersaoArquivos() {
    const vj = self.VERSOES_JS || {};
    const dif = ['db', 'sync', 'docgen'].filter((k) => vj[k] !== VERSAO_APP);
    if (!dif.length) { try { sessionStorage.removeItem('recarregouVersao'); } catch (e) { /* */ } return; }
    console.warn('Arquivos de versões diferentes:', dif, vj);
    let n = 0; try { n = +sessionStorage.getItem('recarregouVersao') || 0; } catch (e) { /* */ }
    if (n >= 2) { toast('O app não terminou de atualizar. Quando tiver uma internet melhor, feche e abra o app de novo.', true); return; }
    try { sessionStorage.setItem('recarregouVersao', String(n + 1)); } catch (e) { /* */ }
    toast('Terminando de atualizar o app…');
    const recarregar = () => location.reload();
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.addEventListener('controllerchange', recarregar, { once: true });
      navigator.serviceWorker.getRegistration().then((r) => (r ? r.update() : null)).catch(() => {});
    }
    setTimeout(recarregar, 8000);
  }
  async function iniciar() {
    conferirVersaoArquivos();
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
      Sync.sincronizar({ forcar: true });
      setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') Sync.sincronizar({ forcar: true }); }, 5 * 60 * 1000);
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
      navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.hash) location.hash = e.data.hash; });
    }
  }
  iniciar();
})();
