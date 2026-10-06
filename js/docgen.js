/*
 * DocGen - preenche modelos .docx preservando a formatacao original.
 *
 * Sintaxe dos marcadores no modelo (Word):
 *   {campo}                  -> substitui pelo valor (aceita **negrito** e quebras de linha)
 *   paragrafo "{#lista}" ... paragrafo "{/lista}"
 *                            -> repete os paragrafos entre os marcadores para cada item
 *                               (ou mostra/oculta, se o valor for verdadeiro/falso)
 *   "{#tr:lista}" ... "{/tr:lista}" dentro de uma linha de tabela
 *                            -> repete (ou remove) a linha inteira da tabela
 *   Dentro do laco {#fotos}, a imagem modelo (media/foto_modelo.png) e trocada pela foto.
 */
(function (root) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  const XMLNS = 'http://www.w3.org/XML/1998/namespace';
  const PLACEHOLDER_TARGET = 'media/foto_modelo.png';

  const isEl = (n, name) => n && n.nodeType === 1 && n.namespaceURI === W && n.localName === name;
  const kids = (n) => Array.from(n.childNodes).filter((c) => c.nodeType === 1);
  const byTag = (n, ns, name) => Array.from(n.getElementsByTagNameNS(ns, name));

  function textNodesOfParagraph(p) {
    // w:t que pertencem a este paragrafo (sem entrar em paragrafos aninhados de caixas de texto)
    const out = [];
    (function walk(n) {
      for (const c of kids(n)) {
        if (isEl(c, 'p')) continue;
        if (isEl(c, 't')) out.push(c);
        else if (isEl(c, 'drawing') || isEl(c, 'pict') || (c.localName === 'AlternateContent')) continue;
        else walk(c);
      }
    })(p);
    return out;
  }
  const paraText = (p) => textNodesOfParagraph(p).map((t) => t.textContent).join('');

  function setText(t, s) {
    t.textContent = s;
    t.setAttributeNS(XMLNS, 'xml:space', 'preserve');
  }

  /* Junta marcadores {tag} que o Word quebrou em varios runs */
  function normalize(p) {
    const ts = textNodesOfParagraph(p);
    if (ts.length < 2) return;
    const texts = ts.map((t) => t.textContent);
    const full = texts.join('');
    if (full.indexOf('{') < 0) return;
    const pos = []; // indice global -> [tIndex, offset]
    texts.forEach((s, i) => { for (let k = 0; k < s.length; k++) pos.push([i, k]); });
    const spans = [];
    const re = /\{[^{}]*\}/g;
    let m;
    while ((m = re.exec(full))) spans.push([m.index, m.index + m[0].length]);
    for (let s = spans.length - 1; s >= 0; s--) {
      const [a, b] = spans[s];
      const [ti, oi] = pos[a];
      const [tj, oj] = pos[b - 1];
      if (ti === tj) continue;
      const span = full.slice(a, b);
      texts[ti] = texts[ti].slice(0, oi) + span;
      for (let k = ti + 1; k < tj; k++) texts[k] = '';
      texts[tj] = texts[tj].slice(oj + 1);
    }
    ts.forEach((t, i) => { if (t.textContent !== texts[i]) setText(t, texts[i]); });
  }

  function lookup(name, scopes) {
    if (name === '.') return scopes[scopes.length - 1]['.'];
    for (let i = scopes.length - 1; i >= 0; i--) {
      const s = scopes[i];
      if (s && typeof s === 'object' && Object.prototype.hasOwnProperty.call(s, name)) return s[name];
    }
    return undefined;
  }

  function toItems(v) {
    if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? x : { '.': x }));
    if (v === undefined || v === null || v === false || v === '' || v === 0) return [];
    if (typeof v === 'object') return [v];
    return [{}];
  }

  function valueToString(v) {
    if (v === undefined || v === null || v === false) return '';
    return String(v);
  }

  /* ---------- runs com negrito / quebra de linha ---------- */
  const RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline',
    'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern',
    'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em',
    'lang', 'eastAsianLayout', 'specVanish', 'oMath'];

  function setBold(doc, rPr) {
    for (const name of ['b', 'bCs']) {
      let el = kids(rPr).find((c) => isEl(c, name));
      if (el) { el.removeAttributeNS(W, 'val'); continue; }
      el = doc.createElementNS(W, 'w:' + name);
      const myIdx = RPR_ORDER.indexOf(name);
      const after = kids(rPr).find((c) => RPR_ORDER.indexOf(c.localName) > myIdx);
      if (after) rPr.insertBefore(el, after); else rPr.appendChild(el);
    }
  }

  function parseRich(s) {
    // retorna [{text, bold, br}]
    const out = [];
    const lines = s.replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((line, li) => {
      if (li > 0) out.push({ br: true });
      const parts = line.split('**');
      parts.forEach((part, k) => { if (part) out.push({ text: part, bold: k % 2 === 1 }); });
    });
    return out;
  }

  function replaceInParagraph(doc, p, scopes) {
    normalize(p);
    for (const t of textNodesOfParagraph(p)) {
      const s = t.textContent;
      if (s.indexOf('{') < 0) continue;
      const segs = [];
      let last = 0, rich = false, m;
      const re = /\{([^{}]*)\}/g;
      while ((m = re.exec(s))) {
        if (m.index > last) segs.push({ lit: s.slice(last, m.index) });
        const name = m[1].trim();
        if (name[0] === '#' || name[0] === '/') { /* marcador residual */ }
        else {
          const v = valueToString(lookup(name, scopes));
          if (v.indexOf('**') >= 0 || /[\r\n]/.test(v)) rich = true;
          segs.push({ val: v });
        }
        last = re.lastIndex;
      }
      if (last < s.length) segs.push({ lit: s.slice(last) });
      const run = t.parentNode;
      const simpleRun = run && isEl(run, 'r') && kids(run).filter((c) => !isEl(c, 'rPr')).length === 1;
      if (!rich || !simpleRun) {
        setText(t, segs.map((x) => (x.lit !== undefined ? x.lit : x.val.replace(/\*\*/g, '').replace(/\s*[\r\n]+\s*/g, ' '))).join(''));
        continue;
      }
      // divide o run
      const pieces = [];
      for (const sg of segs) {
        if (sg.lit !== undefined) pieces.push({ text: sg.lit, bold: false });
        else pieces.push(...parseRich(sg.val));
      }
      const rPr0 = kids(run).find((c) => isEl(c, 'rPr'));
      const parent = run.parentNode;
      for (const pc of pieces) {
        const r = doc.createElementNS(W, 'w:r');
        let rPr = rPr0 ? rPr0.cloneNode(true) : null;
        if (pc.bold) {
          if (!rPr) rPr = doc.createElementNS(W, 'w:rPr');
          setBold(doc, rPr);
        }
        if (rPr) r.appendChild(rPr);
        if (pc.br) { r.appendChild(doc.createElementNS(W, 'w:br')); r.setAttribute('data-nl', '1'); }
        else {
          const nt = doc.createElementNS(W, 'w:t');
          setText(nt, pc.text);
          r.appendChild(nt);
        }
        parent.insertBefore(r, run);
      }
      parent.removeChild(run);
    }
    splitAtNewlines(doc, p);
  }

  /* Quebras de linha vindas dos valores viram paragrafos separados (evita linhas "esticadas" no justificado). */
  function splitAtNewlines(doc, p) {
    const marks = kids(p).filter((c) => isEl(c, 'r') && c.getAttribute('data-nl') === '1');
    if (!marks.length) return;
    const pPr = kids(p).find((c) => isEl(c, 'pPr'));
    let cur = p;
    const content = kids(p).filter((c) => !isEl(c, 'pPr'));
    const newPs = [];
    for (const c of content) {
      if (c.getAttribute && c.getAttribute('data-nl') === '1') {
        const np = doc.createElementNS(W, 'w:p');
        if (pPr) np.appendChild(pPr.cloneNode(true));
        newPs.push(np);
        cur = np;
        p.removeChild(c);
        continue;
      }
      if (cur !== p) cur.appendChild(c);
    }
    let ref = p;
    for (const np of newPs) {
      ref.parentNode.insertBefore(np, ref.nextSibling);
      ref = np;
    }
  }

  const BLOCK_RE = /^\{\s*([#/])\s*([\w.]+)\s*\}$/;

  function renderChildren(ctx, parent, scopes) {
    let child = parent.firstChild;
    while (child) {
      let next = child.nextSibling;
      if (child.nodeType === 1) {
        if (isEl(child, 'p')) {
          normalize(child);
          const m = BLOCK_RE.exec(paraText(child).trim());
          if (m && m[1] === '#') {
            const name = m[2];
            // procura o fechamento correspondente
            let depth = 0, end = null, n = child.nextSibling;
            const body = [];
            while (n) {
              if (isEl(n, 'p')) {
                const mm = BLOCK_RE.exec(paraText(n).trim());
                if (mm && mm[2] === name) {
                  if (mm[1] === '#') depth++;
                  else if (depth === 0) { end = n; break; } else depth--;
                }
              }
              body.push(n);
              n = n.nextSibling;
            }
            if (!end) throw new Error('Marcador {/' + name + '} não encontrado no modelo.');
            next = end.nextSibling;
            const items = toItems(lookup(name, scopes));
            items.forEach((item, idx) => {
              const wrap = ctx.doc.createElementNS(W, 'w:tmp');
              body.forEach((b) => wrap.appendChild(b.cloneNode(true)));
              renderChildren(ctx, wrap, scopes.concat([item]));
              if (name === 'fotos' || item.__foto) ctx.applyPhoto(wrap, item);
              while (wrap.firstChild) parent.insertBefore(wrap.firstChild, child);
            });
            body.forEach((b) => parent.removeChild(b));
            parent.removeChild(child);
            parent.removeChild(end);
            child = next;
            continue;
          }
          ctx.applyTagged(child, scopes);
          replaceInParagraph(ctx.doc, child, scopes);
        } else if (isEl(child, 'tbl')) {
          renderTable(ctx, child, scopes);
          if (!kids(child).some((c) => isEl(c, 'tr'))) parent.removeChild(child);
        } else if (isEl(child, 'sdt') || isEl(child, 'sdtContent') || isEl(child, 'customXml')) {
          renderChildren(ctx, child, scopes);
        }
      }
      child = next;
    }
    if (isEl(parent, 'tc') && !kids(parent).some((c) => isEl(c, 'p'))) {
      parent.appendChild(ctx.doc.createElementNS(W, 'w:p'));
    }
  }

  function stripRowMarkers(tr, name) {
    const re = new RegExp('\\{\\s*[#/]\\s*tr:' + name + '\\s*\\}', 'g');
    for (const p of byTag(tr, W, 'p')) normalize(p);
    for (const t of byTag(tr, W, 't')) {
      if (t.textContent.indexOf('tr:' + name) >= 0) setText(t, t.textContent.replace(re, ''));
    }
  }

  function renderTable(ctx, tbl, scopes) {
    for (const tr of kids(tbl).filter((c) => isEl(c, 'tr'))) {
      for (const p of byTag(tr, W, 'p')) normalize(p);
      const txt = byTag(tr, W, 't').map((t) => t.textContent).join('');
      const m = /\{\s*#\s*tr:([\w.]+)\s*\}/.exec(txt);
      if (m) {
        const name = m[1];
        const items = toItems(lookup(name, scopes));
        for (const item of items) {
          const clone = tr.cloneNode(true);
          stripRowMarkers(clone, name);
          for (const tc of kids(clone).filter((c) => isEl(c, 'tc'))) renderChildren(ctx, tc, scopes.concat([item]));
          tbl.insertBefore(clone, tr);
        }
        tbl.removeChild(tr);
      } else {
        for (const tc of kids(tr).filter((c) => isEl(c, 'tc'))) renderChildren(ctx, tc, scopes);
      }
    }
  }

  function imageSize(bytes) {
    const b = bytes;
    if (b[0] === 0x89 && b[1] === 0x50) { // PNG
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      return { w: dv.getUint32(16), h: dv.getUint32(20), ext: 'png' };
    }
    if (b[0] === 0xff && b[1] === 0xd8) { // JPEG
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const mk = b[i + 1];
        const len = (b[i + 2] << 8) | b[i + 3];
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
          return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], ext: 'jpeg' };
        }
        i += 2 + len;
      }
    }
    throw new Error('Formato de imagem não suportado (use JPEG ou PNG).');
  }

  async function toBytes(x) {
    if (!x) return null;
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (typeof Blob !== 'undefined' && x instanceof Blob) return new Uint8Array(await x.arrayBuffer());
    if (typeof x === 'string') { // dataURL ou base64
      const b64 = x.indexOf(',') >= 0 ? x.split(',')[1] : x;
      const bin = atob(b64);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }
    throw new Error('Imagem inválida');
  }

  /* Converte (recursivamente) Blobs dos dados em bytes, para uso sincrono na renderizacao. */
  async function prepararImagens(o, prof) {
    prof = prof || 0;
    if (!o || typeof o !== 'object' || prof > 6) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof Blob !== 'undefined' && v instanceof Blob) o[k] = await toBytes(v);
      else if (v instanceof ArrayBuffer) o[k] = new Uint8Array(v);
      else if (v && typeof v === 'object' && !(v instanceof Uint8Array)) await prepararImagens(v, prof + 1);
    }
  }

  /**
   * Gera o .docx.
   * @param {ArrayBuffer|Uint8Array|Blob} template  modelo .docx
   * @param {object} data   dados (ver montarDados). data.fotos = [{n, legenda, imagem: Blob|Uint8Array|dataURL}]
   * @param {object} [opts] {JSZip, DOMParser, XMLSerializer, type:'blob'|'uint8array'}
   */
  async function gerar(template, data, opts) {
    opts = opts || {};
    const JSZip = opts.JSZip || root.JSZip;
    const DP = opts.DOMParser || root.DOMParser;
    const XS = opts.XMLSerializer || root.XMLSerializer;
    const zip = await JSZip.loadAsync(template);
    const docXml = await zip.file('word/document.xml').async('string');
    const relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
    const ctXml = await zip.file('[Content_Types].xml').async('string');
    const parser = new DP();
    const doc = parser.parseFromString(docXml, 'application/xml');
    const rels = parser.parseFromString(relsXml, 'application/xml');
    const ct = parser.parseFromString(ctXml, 'application/xml');

    // bytes das fotos antes de renderizar
    const fotos = Array.isArray(data.fotos) ? data.fotos : [];
    for (const f of fotos) {
      f.__foto = true;
      f.__bytes = await toBytes(f.imagem);
    }

    await prepararImagens(data);

    const relEls = byTag(rels, PR, 'Relationship');
    const ph = relEls.find((r) => (r.getAttribute('Target') || '').replace(/^\/?word\//, '') === PLACEHOLDER_TARGET);
    const phId = ph ? ph.getAttribute('Id') : null;
    let maxDocPr = 0;
    for (const d of byTag(doc, WP, 'docPr')) maxDocPr = Math.max(maxDocPr, +d.getAttribute('id') || 0);
    let imgCount = 0;
    const exts = new Set();

    const ctx = {
      doc,
      applyPhoto(wrap, item) {
        if (!phId || !item.__bytes) return;
        for (const blip of byTag(wrap, A, 'blip')) {
          if (blip.getAttributeNS(R, 'embed') !== phId) continue;
          ctx.inserir(blip, item.__bytes, item.legenda);
        }
      },
      /* imagens marcadas pelo texto alternativo {img:campo} */
      applyTagged(p, scopes) {
        for (const docPr of byTag(p, WP, 'docPr')) {
          const m = /^\{img:([\w.]+)\}$/.exec((docPr.getAttribute('descr') || '').trim());
          if (!m) continue;
          const bytes = lookup(m[1], scopes);
          const inline = docPr.parentNode;
          const blip = byTag(inline, A, 'blip')[0];
          if (bytes && bytes.length && blip) ctx.inserir(blip, bytes, '');
          else {
            let r = inline;
            while (r && !isEl(r, 'r')) r = r.parentNode;
            if (r && r.parentNode) r.parentNode.removeChild(r);
          }
        }
      },
      inserir(blip, bytes, legenda) {
        {
          const info = imageSize(bytes);
          imgCount++;
          const rid = 'rIdFotoN' + imgCount;
          const file = 'media/foto_' + imgCount + '.' + info.ext;
          // fotos (JPEG/PNG) já são comprimidas: guardadas sem recompactar (era o que mais demorava e pesava na memória)
          zip.file('word/' + file, bytes, { compression: 'STORE' });
          exts.add(info.ext);
          const rel = rels.createElementNS(PR, 'Relationship');
          rel.setAttribute('Id', rid);
          rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
          rel.setAttribute('Target', file);
          rels.documentElement.appendChild(rel);
          blip.setAttributeNS(R, 'r:embed', rid);
          // dimensionamento: caber na caixa da imagem modelo
          let drawing = blip;
          while (drawing && !(drawing.namespaceURI === WP && (drawing.localName === 'inline' || drawing.localName === 'anchor'))) drawing = drawing.parentNode;
          if (!drawing) return;
          const extent = kids(drawing).find((c) => c.localName === 'extent');
          const boxW = +extent.getAttribute('cx'), boxH = +extent.getAttribute('cy');
          const esc = Math.min(boxW / info.w, boxH / info.h);
          const cx = Math.round(info.w * esc), cy = Math.round(info.h * esc);
          extent.setAttribute('cx', cx); extent.setAttribute('cy', cy);
          for (const e of byTag(drawing, A, 'ext')) {
            if (e.getAttribute('cx') !== null && e.getAttribute('cx') !== '') { e.setAttribute('cx', cx); e.setAttribute('cy', cy); }
          }
          const docPr = kids(drawing).find((c) => c.localName === 'docPr');
          if (docPr) { docPr.setAttribute('id', ++maxDocPr); docPr.setAttribute('name', 'Foto ' + imgCount); docPr.setAttribute('descr', legenda || ''); }
        }
      },
    };

    const body = byTag(doc, W, 'body')[0];
    renderChildren(ctx, body, [data]);

    // remove ids de paragrafo duplicados (clonados)
    const seen = new Set();
    for (const p of byTag(doc, W, 'p')) {
      const id = p.getAttributeNS('http://schemas.microsoft.com/office/word/2010/wordml', 'paraId');
      if (!id) continue;
      if (seen.has(id)) {
        p.removeAttributeNS('http://schemas.microsoft.com/office/word/2010/wordml', 'paraId');
        p.removeAttributeNS('http://schemas.microsoft.com/office/word/2010/wordml', 'textId');
      } else seen.add(id);
    }

    // content types
    const have = new Set(byTag(ct, CT, 'Default').map((d) => (d.getAttribute('Extension') || '').toLowerCase()));
    for (const e of exts) {
      if (have.has(e)) continue;
      const d = ct.createElementNS(CT, 'Default');
      d.setAttribute('Extension', e);
      d.setAttribute('ContentType', e === 'png' ? 'image/png' : 'image/jpeg');
      ct.documentElement.insertBefore(d, ct.documentElement.firstChild);
    }

    const ser = new XS();
    const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const s = (d) => { const x = ser.serializeToString(d); return x.startsWith('<?xml') ? x : decl + x; };
    zip.file('word/document.xml', s(doc));
    zip.file('word/_rels/document.xml.rels', s(rels));
    zip.file('[Content_Types].xml', s(ct));
    for (const f of fotos) { delete f.__bytes; delete f.__foto; }
    return zip.generateAsync({
      type: opts.type || 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }, opts.aoProgresso ? (m) => { try { opts.aoProgresso(m.percent); } catch (e) { /* */ } } : undefined);
  }

  /** Lista os marcadores encontrados em um modelo (para validar modelos enviados pelo usuario). */
  async function listarMarcadores(template, opts) {
    opts = opts || {};
    const JSZip = opts.JSZip || root.JSZip;
    const DP = opts.DOMParser || root.DOMParser;
    const zip = await JSZip.loadAsync(template);
    const doc = new DP().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
    const tags = new Set();
    for (const p of byTag(doc, W, 'p')) {
      normalize(p);
      const re = /\{([^{}]+)\}/g; let m;
      const t = paraText(p);
      while ((m = re.exec(t))) tags.add(m[1].trim());
    }
    return Array.from(tags);
  }

  /** Extrai, como texto editavel (**negrito**), os paragrafos de um bloco {#nome}...{/nome} do modelo. */
  async function extrairTextoBloco(template, nome, opts) {
    opts = opts || {};
    const JSZip = opts.JSZip || root.JSZip;
    const DP = opts.DOMParser || root.DOMParser;
    const zip = await JSZip.loadAsync(template);
    const doc = new DP().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
    const ps = byTag(doc, W, 'p');
    let dentro = false;
    const linhas = [];
    for (const p of ps) {
      normalize(p);
      const t = paraText(p).trim();
      if (t === '{#' + nome + '}') { dentro = true; continue; }
      if (t === '{/' + nome + '}') break;
      if (!dentro) continue;
      const segs = [];
      for (const r of byTag(p, W, 'r')) {
        const txt = byTag(r, W, 't').map((x) => x.textContent).join('');
        if (!txt) continue;
        const rPr = kids(r).find((c) => isEl(c, 'rPr'));
        const b = rPr ? kids(rPr).find((c) => isEl(c, 'b')) : null;
        const bold = !!b && !/^(0|false)$/.test(b.getAttributeNS(W, 'val') || '');
        const ult = segs[segs.length - 1];
        if (ult && ult.bold === bold) ult.txt += txt; else segs.push({ txt, bold });
      }
      const linha = segs.map((sg) => {
        if (!sg.bold || !sg.txt.trim()) return sg.txt;
        const m = /^(\s*)(.*?)(\s*)$/.exec(sg.txt);
        return m[1] + '**' + m[2] + '**' + m[3];
      }).join('').replace(/[ \t]{2,}/g, ' ').trim();
      linhas.push(linha);
    }
    return linhas.join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* Montagem dos dados a partir do cadastro + notificacao + configuracao */
  const E = () => root.Extenso || (typeof require === 'function' ? require('./extenso.js') : null);

  function juntarNomes(lista) {
    if (lista.length <= 1) return lista.join('');
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  }

  function textoEquipe(fiscais) {
    return juntarNomes(fiscais.filter((f) => f && f.nome).map((f) => ((f.tratamento ? f.tratamento + ' ' : '') + f.nome).trim()));
  }

  function montarDados(reg, notif) {
    const X = E();
    const fiscais = (notif.fiscais || []).filter((f) => f && f.nome);
    const pares = [];
    for (let i = 0; i + 1 < fiscais.length; i += 2) {
      const a = fiscais[i], b = fiscais[i + 1];
      pares.push({ a_nome: a.nome, a_cargo: a.cargo || '', a_funcao: a.funcao || '', a_lotacao: a.lotacao || '',
        b_nome: b.nome, b_cargo: b.cargo || '', b_funcao: b.funcao || '', b_lotacao: b.lotacao || '' });
    }
    const central = fiscais.length % 2 === 1 ? fiscais[fiscais.length - 1] : null;
    const coords = (notif.coordenadores || []).filter((c) => c && c.nome);
    const prazo = Number(notif.prazo_dias || 3);
    const valor = X.parseMoeda(reg.valor);
    const valorOs = X.parseMoeda(reg.valor_os);
    const rep = (reg.n_representante || '') + (reg.n_representante_cpf ? ' – CPF: ' + reg.n_representante_cpf : '');
    const fotos = (notif.fotosDoc || []).map((f, i) => ({ n: i + 1, legenda: f.legenda || '', imagem: f.imagem }));
    return {
      ordinal: notif.ordinal,
      numero_notificacao: notif.numero || '',
      n_cnpj: reg.n_cnpj || '',
      n_nome: reg.n_nome || '',
      n_representante: rep,
      n_logradouro: reg.n_logradouro || '',
      n_cep: reg.n_cep || '',
      n_bairro: reg.n_bairro || '',
      n_municipio: reg.n_municipio || '',
      n_telefone: reg.n_telefone || '',
      nome_texto: reg.n_nome_texto || reg.n_nome || '',
      objeto: reg.objeto || '',
      numero_instrumento: reg.numero || '',
      processo: reg.processo || '',
      valor: X.formatarMoeda(valor),
      valor_extenso: reg.valor_extenso || X.moeda(valor),
      vigencia: X.dataBR(reg.vigencia) || reg.vigencia || '',
      os_numero: reg.os_numero || '',
      tem_os: !!reg.os_numero,
      objeto_especifico: reg.objeto_especifico || '',
      tem_objeto_especifico: !!reg.objeto_especifico,
      texto_objeto_especifico: reg.objeto_especifico ? ', tendo como objeto específico da Ordem de Serviço a ' + reg.objeto_especifico : '',
      valor_os: X.formatarMoeda(valorOs),
      valor_os_extenso: reg.valor_os_extenso || X.moeda(valorOs),
      tem_valor_os: valorOs !== null && valorOs !== undefined && valorOs !== '',
      data_notificacao: X.dataBR(notif.data),
      data_extenso: X.dataExtenso(notif.data),
      data_vistoria: X.dataBR(notif.data_vistoria),
      equipe: notif.equipe || textoEquipe(fiscais),
      constatacao: notif.constatacao || '',
      itens: (notif.itens || []).filter((t) => t && t.trim()).map((t) => ({ texto: t.trim() })),
      providencias: notif.providencias || '',
      prazo_num: String(prazo).padStart(2, '0'),
      prazo_extenso: X.inteiro(prazo),
      fiscais_pares: pares,
      fiscal_central: central ? [{ c_nome: central.nome, c_cargo: central.cargo || '', c_funcao: central.funcao || '', c_lotacao: central.lotacao || '' }] : [],
      coordenadores: coords.map((c, i) => ({ nome: c.nome, cargo: c.cargo || '', lotacao: c.lotacao || '', extra: c.extra || '', nao_ultimo: i < coords.length - 1 })),
      rotulo_coordenadores: coords.length > 1 ? 'Coordenadores' : 'Coordenador',
      fotos,
      tem_fotos: fotos.length > 0,
      sancoes_padrao: !(reg.sancoes && reg.sancoes.trim()),
      sancoes_personalizadas: reg.sancoes && reg.sancoes.trim() ? [{ texto: reg.sancoes.trim() }] : [],
    };
  }

  /**
   * Dados do Relatorio Fotografico.
   * fotos: [{img: Blob|Uint8Array, legenda, meta, irregular, descricao}]
   */
  function montarDadosRelatorio(reg, vis, fotos, opcoes) {
    const X = E();
    opcoes = opcoes || {};
    const layout = [2, 4, 6].includes(+opcoes.layout) ? +opcoes.layout : 4;
    const fiscais = (vis.fiscais || []).filter((f) => f && f.nome);
    const pares = [];
    for (let i = 0; i + 1 < fiscais.length; i += 2) {
      const a = fiscais[i], b = fiscais[i + 1];
      pares.push({ a_nome: a.nome, a_cargo: a.cargo || '', a_funcao: a.funcao || '', a_lotacao: a.lotacao || '',
        b_nome: b.nome, b_cargo: b.cargo || '', b_funcao: b.funcao || '', b_lotacao: b.lotacao || '' });
    }
    const central = fiscais.length % 2 === 1 ? fiscais[fiscais.length - 1] : null;
    const itens = fotos.map((f, i) => ({ n: i + 1, img: f.img, legenda: f.legenda || '', sep: f.legenda ? ' – ' : '', meta: f.meta || '', irregular: !!f.irregular, descricao: f.descricao || '' }));
    const linhas = [];
    for (let i = 0; i < itens.length; i += 2) {
      const a = itens[i], b = itens[i + 1] || null;
      const l = {};
      for (const [p, it] of [['a_', a], ['b_', b]]) {
        l[p + 'img'] = it ? it.img : null;
        l[p + 'n'] = it ? it.n : '';
        l[p + 'rotulo'] = it ? 'Foto ' + it.n : '';
        l[p + 'legenda'] = it ? it.legenda : '';
        l[p + 'sep'] = it ? it.sep : '';
        l[p + 'meta'] = it ? it.meta : '';
      }
      if (!b) l.b_n = '';
      linhas.push(l);
    }
    // irregularidades (agrupa descricoes iguais, referenciando as fotos)
    const irr = [];
    itens.forEach((it) => {
      if (!it.irregular) return;
      const txt = (it.descricao || it.legenda || '').trim().replace(/[.;]?$/, '');
      if (!txt) return;
      const ex = irr.find((x) => x.chave === txt.toLowerCase());
      if (ex) ex.fotos.push(it.n); else irr.push({ chave: txt.toLowerCase(), texto: txt, fotos: [it.n] });
    });
    (opcoes.irregularidadesSemFoto || []).forEach((t) => { if (t && t.trim()) irr.push({ texto: t.trim().replace(/[.;]?$/, ''), fotos: [] }); });
    const irregularidades = irr.map((x, i) => ({ texto: x.texto + (i === irr.length - 1 ? '.' : ';'),
      ref_fotos: x.fotos.length ? ' (Foto' + (x.fotos.length > 1 ? 's ' : ' ') + x.fotos.join(', ') + ')' : '' }));
    const horario = [vis.hora_inicio, vis.hora_fim].filter(Boolean).join(' às ');
    const pct = (v) => (v === null || v === undefined || v === '' ? '—' : String(v).replace('.', ',') + '%');
    return {
      visita_numero: vis.numero || '',
      data_visita: X.dataBR(vis.data),
      data_extenso: X.dataExtenso(vis.data),
      horario: horario || '—',
      obra: reg.apelido || '',
      objeto: reg.objeto || '',
      tem_objeto: !!reg.objeto,
      sem_fotos: itens.length === 0,
      rotulo_instrumento: reg.tipo === 'convenio' ? 'CONVÊNIO' : 'CONTRATO',
      rotulo_notificada: reg.tipo === 'convenio' ? 'CONVENENTE' : 'CONTRATADA',
      numero_instrumento: reg.numero || '',
      processo: reg.processo || '—',
      n_nome: reg.n_nome || '',
      local_obra: reg.local_obra || '',
      tem_local: !!reg.local_obra,
      equipe: vis.equipe || textoEquipe(fiscais) || '—',
      acompanhantes: vis.acompanhantes || '',
      tem_acompanhantes: !!(vis.acompanhantes && vis.acompanhantes.trim()),
      objetivo: vis.objetivo || '',
      tem_objetivo: !!(vis.objetivo && vis.objetivo.trim()),
      clima: vis.clima || '—',
      trabalhadores: vis.trabalhadores === 0 || vis.trabalhadores ? String(vis.trabalhadores) : '—',
      tem_condicoes: !!(vis.clima || vis.trabalhadores === 0 || vis.trabalhadores),
      servicos: vis.servicos || '',
      tem_servicos: !!(vis.servicos && vis.servicos.trim()),
      avanco_exec: pct(vis.avanco_exec),
      avanco_prev: pct(vis.avanco_prev),
      tem_avanco: !!(vis.avanco_exec || vis.avanco_exec === 0 || vis.avanco_prev || vis.avanco_prev === 0),
      total_fotos: String(itens.length),
      total_irregularidades: String(irregularidades.length),
      observacoes: vis.observacoes && vis.observacoes.trim() ? vis.observacoes.trim() : 'Sem observações.',
      irregularidades,
      tem_irregularidades: irregularidades.length > 0,
      sem_irregularidades: irregularidades.length === 0,
      layout_2: layout === 2,
      layout_4: layout === 4,
      layout_6: layout === 6,
      fotos: layout === 2 ? itens : [],
      linhas: layout === 2 ? [] : linhas,
      fiscais_pares: pares,
      fiscal_central: central ? [{ c_nome: central.nome, c_cargo: central.cargo || '', c_funcao: central.funcao || '', c_lotacao: central.lotacao || '' }] : [],
    };
  }

  function paresFiscais(fiscais) {
    fiscais = (fiscais || []).filter((f) => f && f.nome);
    const pares = [];
    for (let i = 0; i + 1 < fiscais.length; i += 2) {
      const a = fiscais[i], b = fiscais[i + 1];
      pares.push({ a_nome: a.nome, a_cargo: a.cargo || '', a_funcao: a.funcao || '', a_lotacao: a.lotacao || '',
        b_nome: b.nome, b_cargo: b.cargo || '', b_funcao: b.funcao || '', b_lotacao: b.lotacao || '' });
    }
    const c = fiscais.length % 2 === 1 ? fiscais[fiscais.length - 1] : null;
    return { fiscais_pares: pares, fiscal_central: c ? [{ c_nome: c.nome, c_cargo: c.cargo || '', c_funcao: c.funcao || '', c_lotacao: c.lotacao || '' }] : [] };
  }

  /**
   * Dados do Relatorio de Irregularidades Sanadas.
   * itens: [{antes_img, antes_desc, antes_data, antes_visita, depois_img, depois_desc, depois_data, depois_visita, verificado_por}]
   */
  function montarDadosSanadas(reg, itens, fiscais, dataISO) {
    const X = E();
    const n = itens.length;
    return Object.assign({
      obra: reg.apelido || '',
      objeto: reg.objeto || '',
      tem_objeto: !!reg.objeto,
      rotulo_instrumento: reg.tipo === 'convenio' ? 'CONVÊNIO' : 'CONTRATO',
      rotulo_notificada: reg.tipo === 'convenio' ? 'CONVENENTE' : 'CONTRATADA',
      numero_instrumento: reg.numero || '',
      processo: reg.processo || '—',
      n_nome: reg.n_nome || '',
      local_obra: reg.local_obra || '',
      tem_local: !!reg.local_obra,
      data_emissao: X.dataBR(dataISO),
      data_extenso: X.dataExtenso(dataISO),
      total_texto: n === 1 ? '1 (uma) irregularidade' : n + ' irregularidades',
      itens: itens.map((it, i) => Object.assign({ n: i + 1 }, it, {
        antes_desc: (it.antes_desc || '').trim().replace(/[.;]?$/, '.'),
        depois_desc: (it.depois_desc || '').trim() || '—',
        antes_visita: it.antes_visita || '',
        depois_visita: it.depois_visita || '',
        verificado_por: it.verificado_por || '—',
      })),
    }, paresFiscais(fiscais));
  }

  /**
   * Dados do Relatorio de Irregularidades (todas as selecionadas, com o historico completo).
   * itens: [{descricao, sanada, sanada_em, constatada_data, constatada_visita, constatada_por, img,
   *          historico: [{data, status, descricao, visita, por, img}]}]
   */
  function montarDadosIrregularidades(reg, itens, fiscais, dataISO) {
    const X = E();
    const n = itens.length;
    const nS = itens.filter((i) => i.sanada).length, nP = n - nS;
    const plural = (k, s, p) => k + ' ' + (k === 1 ? s : p);
    return Object.assign({
      obra: reg.apelido || '',
      objeto: reg.objeto || '',
      tem_objeto: !!reg.objeto,
      rotulo_instrumento: reg.tipo === 'convenio' ? 'CONVÊNIO' : 'CONTRATO',
      rotulo_notificada: reg.tipo === 'convenio' ? 'CONVENENTE' : 'CONTRATADA',
      numero_instrumento: reg.numero || '',
      processo: reg.processo || '—',
      n_nome: reg.n_nome || '',
      local_obra: reg.local_obra || '',
      tem_local: !!reg.local_obra,
      data_emissao: X.dataBR(dataISO),
      data_extenso: X.dataExtenso(dataISO),
      total_texto: n === 1 ? '1 (uma) irregularidade' : n + ' irregularidades',
      resumo_situacao: [nP ? plural(nP, 'pendente', 'pendentes') : '', nS ? plural(nS, 'sanada', 'sanadas') : ''].filter(Boolean).join(' e '),
      itens: itens.map((it, i) => {
        const hist = (it.historico || []).map((h) => ({
          h_data: h.data || '', h_status: h.status || '', h_descricao: (h.descricao || '').trim() || '—',
          h_visita: h.visita ? h.visita + ' · ' : '', h_por: h.por || '—', h_img: h.img || null, h_semfoto: h.img ? '' : 'Sem foto nesta verificação.',
        }));
        return {
          n: i + 1,
          descricao: (it.descricao || '(sem descrição)').trim().replace(/[.;]?$/, '.'),
          situacao: it.sanada ? 'SANADA' : 'PENDENTE',
          sanada_em: it.sanada && it.sanada_em ? ' (em ' + it.sanada_em + ')' : '',
          constatada_data: it.constatada_data || '',
          constatada_visita: it.constatada_visita ? ' · ' + it.constatada_visita : '',
          constatada_por: it.constatada_por || '—',
          img: it.img || null,
          n_verificacoes: String(hist.length),
          historico: hist,
          tem_historico: hist.length ? [{}] : [],
          sem_historico: hist.length ? [] : [{}],
        };
      }),
    }, paresFiscais(fiscais));
  }

  /**
   * Dados do Relatório de Elaboração de Medição (contratos).
   * med: { numero, periodo_inicio, periodo_fim, data_vistoria, data, observacoes, itens: [{descricao, situacao, comentario, memorial}] }
   */
  const SITUACAO_MED = { medido: 'MEDIDO', parcial: 'MEDIDO PARCIALMENTE', nao: 'NÃO MEDIDO' };
  function montarDadosMedicao(reg, med, fiscais) {
    const X = E();
    const itens = (med.itens || []).filter((it) => (it.descricao || '').trim() || (it.comentario || '').trim() || (it.memorial || '').trim());
    const cont = { medido: 0, parcial: 0, nao: 0 };
    itens.forEach((it) => { if (cont[it.situacao] !== undefined) cont[it.situacao]++; });
    const pl = (k, s, p) => k + ' ' + (k === 1 ? s : p);
    const resumo = [cont.medido ? pl(cont.medido, 'medido', 'medidos') : '', cont.parcial ? pl(cont.parcial, 'medido parcialmente', 'medidos parcialmente') : '', cont.nao ? pl(cont.nao, 'não medido', 'não medidos') : ''].filter(Boolean).join(', ');
    const hoje = med.data || new Date().toISOString().slice(0, 10);
    return Object.assign({
      medicao_numero: String(med.numero || ''),
      periodo_inicio: X.dataBR(med.periodo_inicio) || '—',
      periodo_fim: X.dataBR(med.periodo_fim) || '—',
      data_vistoria: X.dataBR(med.data_vistoria) || '—',
      data_relatorio: X.dataBR(hoje),
      data_extenso: X.dataExtenso(hoje),
      obra: reg.apelido || '',
      objeto: reg.objeto || '',
      tem_objeto: !!reg.objeto,
      rotulo_instrumento: 'CONTRATO',
      rotulo_notificada: 'CONTRATADA',
      numero_instrumento: reg.numero || '',
      processo: reg.processo || '—',
      n_nome: reg.n_nome || '',
      local_obra: reg.local_obra || '',
      tem_local: !!reg.local_obra,
      equipe: textoEquipe(fiscais || []) || '—',
      total_itens: itens.length === 1 ? '1 item' : itens.length + ' itens',
      resumo_situacao: resumo ? ' (' + resumo + ')' : '',
      itens: itens.map((it, i) => ({
        n: String(i + 1),
        descricao: (it.descricao || '').trim() || '—',
        situacao: SITUACAO_MED[it.situacao] || '',
        comentario: (it.comentario || '').trim() || (SITUACAO_MED[it.situacao] ? '' : '—'),
        memorial: (it.memorial || '').trim() || '—',
      })),
      observacoes: (med.observacoes || '').trim(),
      tem_observacoes: !!(med.observacoes || '').trim(),
    }, paresFiscais(fiscais));
  }

  const api = { gerar, montarDadosMedicao, montarDadosRelatorio, montarDadosSanadas, montarDadosIrregularidades, montarDados, listarMarcadores, extrairTextoBloco, textoEquipe, imageSize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DocGen = api;
})(typeof self !== 'undefined' ? self : this);
