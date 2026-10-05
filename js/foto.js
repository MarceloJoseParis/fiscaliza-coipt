/* Captura de fotos: GPS, data/hora, carimbo na imagem, compressao e leitura de EXIF */
(function (root) {
  const Foto = {};
  let ultimaPos = null;
  let watchId = null;
  const ouvintes = new Set();

  /* ---------------- GPS ---------------- */
  Foto.iniciarGPS = function () {
    if (!('geolocation' in navigator) || watchId !== null) return;
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        ultimaPos = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy), em: Date.now() };
        ouvintes.forEach((f) => f(ultimaPos));
      },
      (e) => ouvintes.forEach((f) => f(null, e)),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 60000 }
    );
  };
  Foto.pararGPS = function () {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  };
  Foto.onGPS = (f) => { ouvintes.add(f); if (ultimaPos) f(ultimaPos); return () => ouvintes.delete(f); };
  Foto.posicaoAtual = function (maxIdadeMs) {
    if (ultimaPos && Date.now() - ultimaPos.em < (maxIdadeMs || 60000)) return Promise.resolve(ultimaPos);
    return new Promise((res) => {
      if (!('geolocation' in navigator)) return res(null);
      navigator.geolocation.getCurrentPosition(
        (p) => { ultimaPos = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy), em: Date.now() }; res(ultimaPos); },
        () => res(ultimaPos),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
      );
    });
  };

  /* ---------------- EXIF (DateTimeOriginal e GPS) ---------------- */
  Foto.lerExif = async function (blob) {
    try {
      const buf = new DataView(await blob.slice(0, 256 * 1024).arrayBuffer());
      if (buf.getUint16(0) !== 0xffd8) return {};
      let off = 2;
      while (off < buf.byteLength - 4) {
        const marker = buf.getUint16(off);
        const len = buf.getUint16(off + 2);
        if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return parseTiff(buf, off + 10);
        if ((marker & 0xff00) !== 0xff00) break;
        off += 2 + len;
      }
    } catch (e) { /* sem EXIF */ }
    return {};
  };

  function parseTiff(v, t0) {
    const le = v.getUint16(t0) === 0x4949;
    const u16 = (o) => v.getUint16(t0 + o, le);
    const u32 = (o) => v.getUint32(t0 + o, le);
    const out = {};
    function ifd(o) {
      const n = u16(o), tags = {};
      for (let i = 0; i < n; i++) {
        const e = o + 2 + i * 12;
        tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), valOff: e + 8 };
      }
      return tags;
    }
    const str = (t) => {
      const o = t.count > 4 ? u32(t.valOff) : t.valOff;
      let s = '';
      for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(v.getUint8(t0 + o + i));
      return s;
    };
    const rats = (t) => {
      const o = u32(t.valOff), r = [];
      for (let i = 0; i < t.count; i++) r.push(u32(o + i * 8) / (u32(o + i * 8 + 4) || 1));
      return r;
    };
    const ascii1 = (t) => String.fromCharCode(v.getUint8(t0 + t.valOff));
    const ifd0 = ifd(u32(4));
    if (ifd0[0x8769]) {
      const ex = ifd(u32(ifd0[0x8769].valOff));
      const dt = ex[0x9003] || ex[0x9004];
      if (dt) {
        const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str(dt));
        if (m) out.dataHora = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
      }
    }
    if (ifd0[0x8825]) {
      const g = ifd(u32(ifd0[0x8825].valOff));
      if (g[2] && g[4]) {
        const la = rats(g[2]), lo = rats(g[4]);
        let lat = la[0] + la[1] / 60 + la[2] / 3600, lng = lo[0] + lo[1] / 60 + lo[2] / 3600;
        if (g[1] && ascii1(g[1]) === 'S') lat = -lat;
        if (g[3] && ascii1(g[3]) === 'W') lng = -lng;
        if (isFinite(lat) && isFinite(lng) && (lat || lng)) { out.lat = lat; out.lng = lng; }
      }
    }
    return out;
  }

  /* ---------------- Carimbo + compressao ---------------- */
  const MES_ABREV = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  Foto.textoDataHora = function (iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return d.getDate() + ' de ' + MES_ABREV[d.getMonth()] + ' de ' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  Foto.textoCoord = (lat, lng) => (lat === null || lat === undefined ? '' : lat.toFixed(6) + ', ' + lng.toFixed(6));

  async function carregarImagem(blob) {
    if (root.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* fallback */ }
    }
    return new Promise((res, rej) => {
      const img = new Image();
      const u = URL.createObjectURL(blob);
      img.onload = () => { URL.revokeObjectURL(u); res(img); };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Não foi possível ler a imagem.')); };
      img.src = u;
    });
  }

  /**
   * Processa a foto: redimensiona (máx. 2000 px; 3000 px em "alta qualidade"), aplica carimbo (opcional) e gera JPEG.
   * @returns {Promise<{blob, largura, altura, miniatura}>}
   */
  // qualidade das fotos (preferência de cada aparelho, em Ajustes › Aparência e câmera)
  Foto.QUALIDADES = { normal: { maxLado: 2000, qualidade: 0.82 }, alta: { maxLado: 3000, qualidade: 0.9 } };
  Foto.qualidadeAtual = function () { try { return localStorage.getItem('foto_qualidade') === 'alta' ? 'alta' : 'normal'; } catch (e) { return 'normal'; } };
  Foto.processar = async function (arquivo, opcoes) {
    opcoes = Object.assign({}, Foto.QUALIDADES[Foto.qualidadeAtual()], opcoes || {});
    const img = await carregarImagem(arquivo);
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    // giro para acompanhar a posicao do celular no momento da foto (angulo da tela: 0, 90, 180, 270)
    let giro = 0;
    const ang = opcoes.angulo;
    if ((ang === 90 || ang === 270) && ih > iw) giro = ang === 90 ? -90 : 90;
    const max = opcoes.maxLado || 2000;
    const esc = Math.min(1, max / Math.max(iw, ih));
    const dw = Math.round(iw * esc), dh = Math.round(ih * esc);
    const w = giro ? dh : dw, h = giro ? dw : dh;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    // redução com o melhor filtro do navegador (menos serrilhado e mais nitidez nos detalhes finos)
    g.imageSmoothingEnabled = true;
    try { g.imageSmoothingQuality = 'high'; } catch (e) { /* navegador antigo */ }
    if (giro) {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(giro * Math.PI / 180);
      g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      g.restore();
    } else g.drawImage(img, 0, 0, w, h);
    if (opcoes.carimbo) {
      const linhas = opcoes.carimbo.filter(Boolean);
      const fs = Math.max(14, Math.round(Math.min(w, h) * 0.034));
      g.font = '600 ' + fs + 'px Roboto, Arial, sans-serif';
      g.textAlign = 'right';
      g.textBaseline = 'bottom';
      const pad = Math.round(fs * 0.7);
      let y = h - pad;
      for (let i = linhas.length - 1; i >= 0; i--) {
        const t = linhas[i];
        g.lineWidth = Math.max(2, fs / 7);
        g.strokeStyle = 'rgba(0,0,0,0.75)';
        g.strokeText(t, w - pad, y);
        g.fillStyle = '#ffffff';
        g.fillText(t, w - pad, y);
        y -= Math.round(fs * 1.25);
      }
    }
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', opcoes.qualidade || 0.82));
    // o iPhone pode devolver imagem vazia quando falta memória: melhor avisar agora do que ficar sem foto no Drive
    if (!blob || !blob.size) throw new Error('Não foi possível gerar a imagem da foto (memória do aparelho). Feche outros apps e tente de novo.');
    // miniatura
    const tw = 240, th = Math.round(h * (tw / w));
    const cm = document.createElement('canvas');
    cm.width = tw; cm.height = th;
    cm.getContext('2d').drawImage(cv, 0, 0, tw, th);
    const miniatura = cm.toDataURL('image/jpeg', 0.55);
    if (img.close) img.close();
    return { blob, largura: w, altura: h, miniatura };
  };

  Foto.blobParaBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  Foto.base64ParaBlob = (b64, mime) => {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime || 'image/jpeg' });
  };

  root.Foto = Foto;
})(self);
