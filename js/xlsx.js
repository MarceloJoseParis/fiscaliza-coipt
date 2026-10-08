/* Relatório Fotográfico da medição em Excel (.xlsx), no layout do modelo
   "Registro Fotográfico dos Serviços Executados": folha A4 retrato, cabeçalho, 6 fotos por folha (2 × 3),
   cada foto com Coordenada / Localização / Serviço. Gerado do zero (sem planilha-modelo), só com JSZip. */
(function (root) {
  'use strict';
  const RelFotoXlsx = {};

  // larguras das colunas A..P (as mesmas do modelo, em "caracteres" do Excel)
  const LARG = [2.43, 2.14, 16.14, 18, 15.29, 16.86, 13.14, 13.57, 2.71, 14.71, 16.57, 15.29, 14.71, 14.71, 19, 2.71];
  const PX = LARG.map((w) => Math.round(w * 7)); // pixels de cada coluna (fonte Calibri 11)
  const EMU_PX = 9525, EMU_PT = 12700;
  const COL = (c) => String.fromCharCode(65 + c);
  const esc = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const PESO = { thin: 1, medium: 2 };
  const maisForte = (a, b) => ((PESO[b] || 0) > (PESO[a] || 0) ? b : a);

  /* Uma coordenada em graus, minutos e segundos (ex.: 11°49'59.7"S). */
  RelFotoXlsx.dms = function (v, pos, neg) {
    if (v == null || v === '' || !isFinite(v)) return '';
    const s = v < 0 ? neg : pos; v = Math.abs(+v);
    let g = Math.floor(v), mi = Math.floor((v - g) * 60), se = Math.round(((v - g) * 60 - mi) * 600) / 10;
    if (se >= 60) { se = 0; mi++; }
    if (mi >= 60) { mi = 0; g++; }
    return g + '°' + String(mi).padStart(2, '0') + "'" + se.toFixed(1).padStart(4, '0') + '"' + s;
  };
  /* Lê "lat, lng" em decimal (-11.8332, -55.5354) ou em graus (11°49'59.7"S 55°32'07.6"W). */
  RelFotoXlsx.lerCoord = function (txt) {
    const t = String(txt || '').trim().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
    if (!t) return null;
    const g = /(\d{1,3})\s*°\s*(\d{1,2})?\s*'?\s*([\d.,]+)?\s*"?\s*([NSns])[\s,;]+(\d{1,3})\s*°\s*(\d{1,2})?\s*'?\s*([\d.,]+)?\s*"?\s*([EWOLewol])/.exec(t);
    if (g) {
      const num = (x) => parseFloat(String(x || '0').replace(',', '.')) || 0;
      let lat = num(g[1]) + num(g[2]) / 60 + num(g[3]) / 3600, lng = num(g[5]) + num(g[6]) / 60 + num(g[7]) / 3600;
      if (/[Ss]/.test(g[4])) lat = -lat;
      if (/[WwOo]/.test(g[8])) lng = -lng;
      return lat <= 90 && lng <= 180 ? { lat, lng } : null;
    }
    const d = /(-?\d{1,3}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/.exec(t.replace(/(\d),(\d)/g, (m, a, b) => a + '.' + b).replace(/\s*,\s*/, ' , '));
    if (d) {
      const lat = parseFloat(d[1].replace(',', '.')), lng = parseFloat(d[2].replace(',', '.'));
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
    return null;
  };

  /* ---------------- estilos (fontes, preenchimentos, bordas) ---------------- */
  function Estilos() {
    const fontes = ['<font><sz val="10"/><name val="Calibri"/><family val="2"/></font>'], mFonte = new Map();
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'], mFill = new Map();
    const bordas = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], mBorda = new Map();
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], mXf = new Map();
    const fonte = (f) => {
      const k = (f.b ? 'b' : '') + '|' + (f.sz || 9) + '|' + (f.cor || '') + '|' + (f.i ? 'i' : '');
      if (!mFonte.has(k)) { mFonte.set(k, fontes.length); fontes.push('<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') + '<sz val="' + (f.sz || 9) + '"/>' + (f.cor ? '<color rgb="FF' + f.cor + '"/>' : '<color theme="1"/>') + '<name val="Calibri"/><family val="2"/></font>'); }
      return mFonte.get(k);
    };
    const fill = (cor) => {
      if (!cor) return 0;
      if (!mFill.has(cor)) { mFill.set(cor, fills.length); fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + cor + '"/><bgColor indexed="64"/></patternFill></fill>'); }
      return mFill.get(cor);
    };
    const borda = (b) => {
      b = b || {};
      const k = [b.l, b.r, b.t, b.b].map((x) => x || '').join('|');
      if (k === '|||') return 0;
      if (!mBorda.has(k)) {
        const lado = (n, s) => (s ? '<' + n + ' style="' + s + '"><color indexed="64"/></' + n + '>' : '<' + n + '/>');
        mBorda.set(k, bordas.length);
        bordas.push('<border>' + lado('left', b.l) + lado('right', b.r) + lado('top', b.t) + lado('bottom', b.b) + '<diagonal/></border>');
      }
      return mBorda.get(k);
    };
    this.id = (st) => {
      if (!st) return 0;
      const fi = fonte(st.f || {}), fl = fill(st.fill), bo = borda(st.bd);
      const al = st.h || st.v || st.wrap ? '<alignment' + (st.h ? ' horizontal="' + st.h + '"' : '') + ' vertical="' + (st.v || 'center') + '"' + (st.wrap ? ' wrapText="1"' : '') + '/>' : '';
      const k = fi + '|' + fl + '|' + bo + '|' + al;
      if (!mXf.has(k)) {
        mXf.set(k, xfs.length);
        xfs.push('<xf numFmtId="0" fontId="' + fi + '" fillId="' + fl + '" borderId="' + bo + '" xfId="0" applyFont="1"' + (fl ? ' applyFill="1"' : '') + (bo ? ' applyBorder="1"' : '') + (al ? ' applyAlignment="1">' + al + '</xf>' : '/>'));
      }
      return mXf.get(k);
    };
    this.xml = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + fontes.length + '">' + fontes.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
      '<borders count="' + bordas.length + '">' + bordas.join('') + '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  /* ---------------- grade de células de uma planilha ---------------- */
  function Grade() {
    const cel = new Map(); // "r,c" -> { v, st }
    const merges = [];
    const pega = (r, c) => { const k = r + ',' + c; if (!cel.has(k)) cel.set(k, { st: {} }); return cel.get(k); };
    this.cel = cel; this.merges = merges;
    this.valor = (r, c, v) => { pega(r, c).v = v; };
    this.estilo = (r1, c1, r2, c2, st) => {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const x = pega(r, c).st;
        if (st.f) x.f = st.f; if (st.fill) x.fill = st.fill; if (st.h) x.h = st.h; if (st.v) x.v = st.v; if (st.wrap) x.wrap = true;
      }
    };
    // contorno do retângulo (só as bordas de fora), somando com o que já houver
    this.contorno = (r1, c1, r2, c2, peso) => {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const x = pega(r, c).st; x.bd = x.bd || {};
        if (c === c1) x.bd.l = maisForte(x.bd.l, peso);
        if (c === c2) x.bd.r = maisForte(x.bd.r, peso);
        if (r === r1) x.bd.t = maisForte(x.bd.t, peso);
        if (r === r2) x.bd.b = maisForte(x.bd.b, peso);
      }
    };
    // caixa: junta as células, escreve o texto, aplica o estilo e o contorno
    this.caixa = (r1, c1, r2, c2, v, st, peso) => {
      if (r2 > r1 || c2 > c1) merges.push(COL(c1) + r1 + ':' + COL(c2) + r2);
      if (v != null) this.valor(r1, c1, v);
      this.estilo(r1, c1, r2, c2, st || {});
      if (peso) this.contorno(r1, c1, r2, c2, peso);
    };
  }

  /* encaixa a imagem (iw × ih) dentro de um retângulo da planilha, centralizada, com uma margem */
  function ancora(x0px, y0pt, wpx, hpt, iw, ih, margemPx, linhaIni, alturas) {
    const W = (wpx - 2 * margemPx) * EMU_PX, H = hpt * EMU_PT - 2 * margemPx * EMU_PX;
    const s = Math.min(W / iw, H / ih);
    const cx = Math.round(iw * s), cy = Math.round(ih * s);
    const ax = x0px * EMU_PX + margemPx * EMU_PX + Math.round((W - cx) / 2);
    const ay = y0pt * EMU_PT + margemPx * EMU_PX + Math.round((H - cy) / 2);
    const colDe = (x) => { let acc = 0; for (let c = 0; c < PX.length; c++) { const w = PX[c] * EMU_PX; if (x < acc + w || c === PX.length - 1) return { c, off: Math.max(0, Math.round(x - acc)) }; acc += w; } return { c: PX.length - 1, off: 0 }; };
    const linDe = (y) => { let acc = 0; for (let r = linhaIni; r < alturas.length; r++) { const hh = alturas[r] * EMU_PT; if (y < acc + hh || r === alturas.length - 1) return { r, off: Math.max(0, Math.round(y - acc)) }; acc += hh; } return { r: alturas.length - 1, off: 0 }; };
    // y relativo ao início da linha linhaIni
    const yBase = alturas.slice(0, linhaIni).reduce((a, b) => a + b, 0) * EMU_PT;
    const de = colDe(ax), ate = colDe(ax + cx), dl = linDe(ay - yBase), al = linDe(ay - yBase + cy);
    return { de, ate, dl, al, cx, cy, ax, ay };
  }

  const tamanhoImg = (u8) => {
    if (root.DocGen && root.DocGen.imageSize) { try { const t = root.DocGen.imageSize(u8); if (t && t.w) return { w: t.w, h: t.h }; } catch (e) { /* */ } }
    // PNG
    if (u8[0] === 0x89 && u8[1] === 0x50) { const dv = new DataView(u8.buffer, u8.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20) }; }
    // JPEG: procura o SOF
    let i = 2;
    while (i < u8.length - 9) {
      if (u8[i] !== 0xff) { i++; continue; }
      const m = u8[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (u8[i + 5] << 8) | u8[i + 6], w: (u8[i + 7] << 8) | u8[i + 8] };
      i += 2 + ((u8[i + 2] << 8) | u8[i + 3]);
    }
    return { w: 4, h: 3 };
  };
  const ehPng = (u8) => u8[0] === 0x89 && u8[1] === 0x50;
  const linhasTexto = (txt, porLinha) => String(txt || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / porLinha)), 0);

  /**
   * dados: { cab: { orgao, medicao, obra, local, contratada, cnpj, contrato, os },
   *          itens: [{ img: Uint8Array (jpeg/png), lat, lng (texto já em graus), local, servico }],
   *          logo: Uint8Array (png/jpeg, opcional) }
   * opts: { JSZip, aoProgresso(frac), type: 'blob'|'uint8array'|'nodebuffer' }
   */
  RelFotoXlsx.gerar = async function (dados, opts) {
    opts = opts || {};
    const JSZip = opts.JSZip || root.JSZip;
    const cab = dados.cab || {};
    const itens = dados.itens || [];
    const est = new Estilos(), g = new Grade();
    const alturas = [0]; // alturas[r] = altura da linha r (1-based), em pontos
    const quebras = [];
    const imagens = []; // { u8, png, pos }
    const nFolhas = Math.max(1, Math.ceil(itens.length / 6));
    const F = { sz: 8 }, FB = { sz: 8, b: true };
    const L = 1, C = 2, D = 3, E = 4, FF = 5, H = 7, I = 8, J = 9, K = 10, Lc = 11, M = 12, N = 13, O = 14, P = 15; // índices de coluna (A=0)
    let r0 = 0; // última linha usada

    for (let fo = 0; fo < nFolhas; fo++) {
      const ini = r0 + 1;
      const lin = (k, ht) => { alturas[ini + k - 1] = ht; return ini + k - 1; };
      // linhas do cabeçalho (k = posição dentro da folha)
      lin(1, 8);
      lin(2, 15); lin(3, 12.75); lin(4, 13.5); lin(5, 15); lin(6, 12.75);
      const hObra = Math.max(63.75, linhasTexto(cab.obra, 92) * 10.5 + 8);
      lin(7, 12); lin(8, Math.max(12, hObra - 12));
      const hLoc = Math.max(33, linhasTexto(cab.local, 92) * 10.5 + 8);
      lin(9, hLoc / 2); lin(10, hLoc / 2);
      lin(11, 6); lin(12, 16.5); lin(13, 6);
      const R = (k) => ini + k - 1;
      // logotipo | títulos | folha
      g.caixa(R(2), L, R(6), D, null, { h: 'center' }, 'medium');
      g.caixa(R(2), E, R(3), M, 'GOVERNO DO ESTADO DE MATO GROSSO', { f: { sz: 9, b: true }, h: 'center', v: 'center' });
      g.caixa(R(4), E, R(4), M, cab.orgao || '', { f: FB, h: 'center' });
      g.caixa(R(5), E, R(6), M, cab.medicao || '', { f: FB, h: 'center' });
      g.contorno(R(2), E, R(6), M, 'medium');
      g.caixa(R(2), N, R(2), P, 'Folha N.º', { f: { sz: 7.5 }, h: 'center' }, 'thin');
      g.caixa(R(3), N, R(6), P, (fo + 1) + '/' + nFolhas, { f: { sz: 14, b: true }, h: 'center' });
      g.contorno(R(2), N, R(6), P, 'medium');
      // dados da obra
      g.caixa(R(7), L, R(8), C, 'Obra:', { f: { sz: 9, b: true }, h: 'center' }, 'thin');
      g.caixa(R(7), D, R(8), H, cab.obra || '', { f: F, h: 'left', wrap: true }, 'thin');
      g.caixa(R(7), I, R(10), I, null, {}, 'thin');
      g.caixa(R(7), J, R(8), J, 'Contratada:', { f: { sz: 9, b: true }, h: 'center' }, 'thin');
      g.caixa(R(7), K, R(8), P, cab.contratada || '', { f: F, h: 'center', wrap: true }, 'thin');
      g.caixa(R(9), L, R(10), C, 'Localização:', { f: { sz: 9, b: true }, h: 'center' }, 'thin');
      g.caixa(R(9), D, R(10), H, cab.local || '', { f: F, h: 'left', wrap: true }, 'thin');
      g.caixa(R(9), J, R(9), J, 'CNPJ:', { f: FB, h: 'center' }, 'thin');
      g.caixa(R(9), K, R(9), P, cab.cnpj || '', { f: F, h: 'center' }, 'thin');
      g.caixa(R(10), J, R(10), J, 'Contrato N.º', { f: FB, h: 'center' }, 'thin');
      g.caixa(R(10), K, R(10), Lc, cab.contrato || '', { f: FB, h: 'center' }, 'thin');
      g.caixa(R(10), M, R(10), M, 'O.S. N.º', { f: FB, h: 'center' }, 'thin');
      g.caixa(R(10), N, R(10), P, cab.os || '', { f: FB, h: 'center' }, 'thin');
      g.contorno(R(7), L, R(10), P, 'medium');
      g.caixa(R(12), L, R(12), P, 'Registro Fotográfico dos Serviços Executados', { f: { sz: 9.5, cor: '1F3864' }, fill: 'D9D9D9', h: 'center' }, 'medium');
      if (dados.logo) imagens.push({ u8: dados.logo, png: ehPng(dados.logo), caixa: { c1: L, c2: D, r1: R(2), r2: R(6) }, margem: 4, nome: 'Logotipo' });
      let k = 13;
      // 3 fileiras de 2 fotos
      for (let fi = 0; fi < 3; fi++) {
        const par = [itens[fo * 6 + fi * 2], itens[fo * 6 + fi * 2 + 1]];
        if (!par[0] && !par[1]) break; // última folha: só as fotos que sobram
        const lado = (it) => (it ? Math.max(linhasTexto(it.servico, 48), linhasTexto(it.local, 26)) : 0);
        const nl = Math.max(lado(par[0]), lado(par[1]));
        const hv = Math.max(42, nl * 10.5 + 8);
        const rf = lin(++k, 283), rh = lin(++k, 12.75), rv1 = lin(++k, 18), rv2 = lin(++k, hv - 18), rs = lin(++k, 6);
        void rs;
        [[par[0], C, H], [par[1], J, O]].forEach(([it, c1, c2]) => {
          if (!it) return;
          g.caixa(rf, c1, rf, c2, null, {}, 'thin');
          g.caixa(rh, c1, rh, c1, 'Coordenada:', { f: { sz: 7.5, b: true }, h: 'center' }, 'thin');
          g.caixa(rh, c1 + 1, rh, c1 + 2, 'Localização:', { f: { sz: 7.5, b: true }, h: 'center' }, 'thin');
          g.caixa(rh, c1 + 3, rh, c2, 'Serviço:', { f: { sz: 7.5, b: true }, h: 'center' }, 'thin');
          g.caixa(rv1, c1, rv1, c1, it.lat || '', { f: F, h: 'center', v: 'bottom' });
          g.caixa(rv2, c1, rv2, c1, it.lng || '', { f: F, h: 'center', v: 'top' });
          g.contorno(rv1, c1, rv2, c1, 'thin');
          g.caixa(rv1, c1 + 1, rv2, c1 + 2, it.local || '', { f: F, h: 'center', wrap: true }, 'thin');
          g.caixa(rv1, c1 + 3, rv2, c2, String(it.servico || '').toUpperCase(), { f: F, h: 'center', wrap: true }, 'thin');
          g.contorno(rf, c1, rv2, c2, 'thin');
          imagens.push({ u8: it.img, png: ehPng(it.img), caixa: { c1, c2, r1: rf, r2: rf }, margem: 6, nome: 'Foto' });
        });
      }
      const fim = ini + k - 1;
      // moldura da folha (das linhas de baixo do cabeçalho até o fim)
      g.contorno(R(11), L, fim, P, 'medium');
      r0 = fim;
      if (fo < nFolhas - 1) quebras.push(fim);
      if (opts.aoProgresso) opts.aoProgresso(0.1 * (fo + 1) / nFolhas);
    }
    const ultima = r0;

    /* ---------- planilha ---------- */
    const linhasXml = [];
    for (let r = 1; r <= ultima; r++) {
      const cs = [];
      for (let c = 0; c <= P; c++) {
        const x = g.cel.get(r + ',' + c);
        if (!x) continue;
        const s = est.id(Object.keys(x.st).length ? x.st : null);
        const ref = COL(c) + r;
        if (x.v != null && x.v !== '') cs.push('<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + ' t="inlineStr"><is><t xml:space="preserve">' + esc(x.v) + '</t></is></c>');
        else if (s) cs.push('<c r="' + ref + '" s="' + s + '"/>');
      }
      linhasXml.push('<row r="' + r + '" ht="' + (+alturas[r]).toFixed(2) + '" customHeight="1">' + cs.join('') + '</row>');
    }
    const cols = LARG.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('');
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:P' + ultima + '"/>' +
      '<sheetViews><sheetView showGridLines="0" view="pageBreakPreview" zoomScale="70" zoomScaleNormal="70" zoomScaleSheetLayoutView="70" workbookViewId="0"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="12"/><cols>' + cols + '</cols><sheetData>' + linhasXml.join('') + '</sheetData>' +
      (g.merges.length ? '<mergeCells count="' + g.merges.length + '">' + g.merges.map((m) => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
      '<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' +
      (quebras.length ? '<rowBreaks count="' + quebras.length + '" manualBreakCount="' + quebras.length + '">' + quebras.map((q) => '<brk id="' + q + '" max="16383" man="1"/>').join('') + '</rowBreaks>' : '') +
      (imagens.length ? '<drawing r:id="rId1"/>' : '') + '</worksheet>';

    /* ---------- desenho (fotos e logotipo) ---------- */
    const zip = new JSZip();
    const ancoras = [], relsImg = [];
    const xCol = (c) => PX.slice(0, c).reduce((a, b) => a + b, 0);
    for (let n = 0; n < imagens.length; n++) {
      const im = imagens[n];
      const t = tamanhoImg(im.u8);
      const cx = im.caixa;
      const wpx = PX.slice(cx.c1, cx.c2 + 1).reduce((a, b) => a + b, 0);
      const hpt = alturas.slice(cx.r1, cx.r2 + 1).reduce((a, b) => a + b, 0);
      const yPt = alturas.slice(1, cx.r1).reduce((a, b) => a + b, 0);
      const a = ancora(xCol(cx.c1), yPt, wpx, hpt, t.w, t.h, im.margem, 1, alturas);
      const arq = 'image' + (n + 1) + (im.png ? '.png' : '.jpeg');
      zip.file('xl/media/' + arq, im.u8);
      relsImg.push('<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + arq + '"/>');
      const pos = (p, l) => '<xdr:col>' + p.c + '</xdr:col><xdr:colOff>' + p.off + '</xdr:colOff><xdr:row>' + (l.r - 1) + '</xdr:row><xdr:rowOff>' + l.off + '</xdr:rowOff>';
      ancoras.push('<xdr:twoCellAnchor editAs="oneCell"><xdr:from>' + pos(a.de, a.dl) + '</xdr:from><xdr:to>' + pos(a.ate, a.al) + '</xdr:to>' +
        '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (n + 2) + '" name="' + esc(im.nome + ' ' + (n + 1)) + '"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
        '<xdr:blipFill><a:blip r:embed="rId' + (n + 1) + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
        '<xdr:spPr><a:xfrm><a:off x="' + a.ax + '" y="' + a.ay + '"/><a:ext cx="' + a.cx + '" cy="' + a.cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>');
      if (opts.aoProgresso && n % 4 === 3) opts.aoProgresso(0.1 + 0.2 * n / imagens.length);
    }
    const drawing = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + ancoras.join('') + '</xdr:wsDr>';

    const rel = (id, tipo, alvo) => '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + tipo + '" Target="' + alvo + '"/>';
    const rels = (x) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + x + '</Relationships>';
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      (imagens.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
    zip.file('_rels/.rels', rels(rel('rId1', 'officeDocument', 'xl/workbook.xml') +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      rel('rId3', 'extended-properties', 'docProps/app.xml')));
    const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + esc(dados.titulo || 'Relatório Fotográfico') + '</dc:title><dc:creator>Fiscalização de Obras</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + agora + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + agora + '</dcterms:modified></cp:coreProperties>');
    zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application></Properties>');
    zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000"/></bookViews><sheets><sheet name="Fotos" sheetId="1" r:id="rId1"/></sheets>' +
      '<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">Fotos!$A$1:$P$' + ultima + '</definedName></definedNames><calcPr calcId="191029"/></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', rels(rel('rId1', 'worksheet', 'worksheets/sheet1.xml') + rel('rId2', 'styles', 'styles.xml')));
    zip.file('xl/worksheets/sheet1.xml', sheet);
    if (imagens.length) {
      zip.file('xl/worksheets/_rels/sheet1.xml.rels', rels(rel('rId1', 'drawing', '../drawings/drawing1.xml')));
      zip.file('xl/drawings/drawing1.xml', drawing);
      zip.file('xl/drawings/_rels/drawing1.xml.rels', rels(relsImg.join('')));
    }
    zip.file('xl/styles.xml', est.xml());
    const tipo = opts.type || 'blob';
    return zip.generateAsync({ type: tipo, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE', compressionOptions: { level: 1 } },
      (m) => { if (opts.aoProgresso) opts.aoProgresso(0.3 + 0.7 * m.percent / 100); });
  };

  root.RelFotoXlsx = RelFotoXlsx;
  if (typeof module !== 'undefined' && module.exports) module.exports = RelFotoXlsx;
})(typeof window !== 'undefined' ? window : globalThis);
