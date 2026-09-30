/* Camera continua dentro do app, com visual de camera nativa de celular:
 * barra superior (fechar, contador, flash, camera do celular), visor 3:4, zoom 0,5x/1x/2x,
 * rotulo FOTO, e barra inferior (miniatura, disparador, troca de lente). */
(function (root) {
  const Camera = {};
  Camera.suportada = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const SVG = {
    fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    flashOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L6 13h5l-1 8 7-10h-5l1-8z"/><path d="M3 3l18 18"/></svg>',
    flashOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M13 3L6 13h5l-1 8 7-10h-5l1-8z"/></svg>',
    celular: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>',
    lente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3"/></svg>',
  };

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  }
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } },
  };
  const fmtZoom = (z) => (z < 1 ? String(Math.round(z * 10) / 10).replace('0.', ',') : String(Math.round(z * 10) / 10).replace('.', ','));

  /**
   * opts: { titulo, modo: 'continuo'|'unica', aoFoto(blob)->Promise }
   * Resolve: continuo -> {total} ; unica -> Blob|null ; camera do celular -> {aparelho: FileList}
   */
  Camera.abrir = function (opts) {
    opts = opts || {};
    return new Promise(async (resolve, reject) => {
      let stream = null, track = null, cap = {}, wake = null, fechado = false, total = 0, ocupado = false, torch = false;
      let lentes = [], lenteAtual = ls.get('cam_lente') || '', zoom = 1, imgCap = null;

      const video = el('video', { autoplay: '', playsinline: '', muted: '', class: 'cv-video' });
      video.muted = true;
      const flash = el('div', { class: 'cv-flash' });
      const foco = el('div', { class: 'cv-foco' });
      const msg = el('div', { class: 'cv-msg' });
      const zoomBar = el('div', { class: 'cv-zoom' });
      const cont = el('div', { class: 'cv-cont' }, opts.modo === 'unica' ? (opts.titulo || '') : (opts.titulo || ''));
      const thumb = el('button', { class: 'cv-thumb', 'aria-label': 'Concluir', onclick: () => fechar() });
      const badge = el('span', { class: 'cv-badge' });
      thumb.append(badge);
      const inpNativo = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
      inpNativo.addEventListener('change', () => {
        const files = inpNativo.files;
        if (files && files.length) { fechar(true); resolve({ aparelho: files, total }); }
      });
      const btnFlash = el('button', { class: 'cv-ic', 'aria-label': 'Flash', html: SVG.flashOff, style: { visibility: 'hidden' }, onclick: () => alternarFlash() });
      const btnLente = el('button', { class: 'cv-ic cv-ic-grande', 'aria-label': 'Trocar lente', html: SVG.lente, style: { visibility: 'hidden' }, onclick: () => proximaLente() });
      const btnDisparo = el('button', { class: 'cv-disparo', 'aria-label': 'Tirar foto', onclick: () => disparar() }, el('span'));

      const visor = el('div', { class: 'cv-visor' }, video, foco, flash, zoomBar);
      const ov = el('div', { class: 'cv' },
        el('div', { class: 'cv-topo' },
          el('button', { class: 'cv-ic', 'aria-label': 'Fechar', html: SVG.fechar, onclick: () => fechar() }),
          cont,
          el('div', { class: 'cv-topo-dir' }, btnFlash,
            el('button', { class: 'cv-ic', 'aria-label': 'Câmera do celular', title: 'Abrir a câmera do celular', html: SVG.celular, onclick: () => inpNativo.click() }))),
        visor, msg,
        el('div', { class: 'cv-modos' }, el('span', { class: 'ativo' }, 'FOTO')),
        el('div', { class: 'cv-base' }, thumb, btnDisparo, btnLente),
        inpNativo);
      document.body.appendChild(ov);
      document.body.style.overflow = 'hidden';

      function aviso(t, ms) {
        msg.textContent = t; msg.style.opacity = '1';
        clearTimeout(aviso._t); aviso._t = setTimeout(() => { msg.style.opacity = '0'; }, ms || 1600);
      }

      async function abrirStream(deviceId) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        const tam = { width: { ideal: 4096 }, height: { ideal: 3072 } };
        const c = deviceId ? Object.assign({ deviceId: { exact: deviceId } }, tam) : Object.assign({ facingMode: { ideal: 'environment' } }, tam);
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: c });
        track = stream.getVideoTracks()[0];
        video.srcObject = stream;
        await video.play().catch(() => {});
        cap = track.getCapabilities ? track.getCapabilities() : {};
        imgCap = ('ImageCapture' in root) ? new root.ImageCapture(track) : null;
        btnFlash.style.visibility = cap.torch ? 'visible' : 'hidden';
        torch = false; btnFlash.innerHTML = SVG.flashOff; btnFlash.classList.remove('ativo');
        try { if (cap.focusMode && cap.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* */ }
        const s = track.getSettings ? track.getSettings() : {};
        lenteAtual = s.deviceId || deviceId || '';
        zoom = s.zoom || 1;
        montarZoom();
      }

      async function listarLentes() {
        try {
          const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
          const traseiras = devs.filter((d) => !/front|frontal|user|selfie/i.test(d.label || ''));
          lentes = traseiras.length ? traseiras : devs;
        } catch (e) { lentes = []; }
        btnLente.style.visibility = lentes.length > 1 ? 'visible' : 'hidden';
      }

      function nomeLente(d, i) {
        const l = (d.label || '').toLowerCase();
        if (/ultra|wide|grande/.test(l)) return 'Grande angular';
        if (/tele/.test(l)) return 'Teleobjetiva';
        return 'Lente ' + (i + 1) + ' de ' + lentes.length;
      }

      async function proximaLente() {
        if (lentes.length < 2) return;
        let i = lentes.findIndex((d) => d.deviceId === lenteAtual);
        for (let t = 0; t < lentes.length; t++) {
          i = (i + 1) % lentes.length;
          try { await abrirStream(lentes[i].deviceId); ls.set('cam_lente', lentes[i].deviceId); aviso(nomeLente(lentes[i], i)); return; }
          catch (e) { /* tenta a proxima */ }
        }
        aviso('Não foi possível trocar de lente');
      }

      function montarZoom() {
        zoomBar.replaceChildren();
        if (!cap.zoom || !(cap.zoom.max > cap.zoom.min)) return;
        const pres = [];
        if (cap.zoom.min < 1) pres.push(Math.max(cap.zoom.min, 0.5));
        pres.push(1);
        for (const z of [2, 5]) if (cap.zoom.max >= z) pres.push(z);
        pres.forEach((z) => zoomBar.append(el('button', { 'data-z': z, onclick: () => aplicarZoom(z) }, fmtZoom(z))));
        marcarZoom();
      }
      function marcarZoom() {
        const botoes = [...zoomBar.children];
        let alvo = null;
        botoes.forEach((b) => { if (+b.dataset.z <= zoom + 0.01) alvo = b; });
        botoes.forEach((b) => {
          const ativo = b === alvo;
          b.classList.toggle('ativo', ativo);
          b.textContent = ativo ? fmtZoom(zoom) + 'x' : fmtZoom(+b.dataset.z);
        });
      }
      async function aplicarZoom(z) {
        if (!cap.zoom) return;
        z = Math.min(cap.zoom.max, Math.max(cap.zoom.min, z));
        try { await track.applyConstraints({ advanced: [{ zoom: z }] }); zoom = z; } catch (e) { /* */ }
        marcarZoom();
      }

      // pinca (zoom) e toque para focar
      let pinca = null;
      visor.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) pinca = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom };
      }, { passive: true });
      visor.addEventListener('touchmove', (e) => {
        if (pinca && e.touches.length === 2 && cap.zoom) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          aplicarZoom(pinca.z * (d / pinca.d));
        }
      }, { passive: true });
      visor.addEventListener('touchend', () => { pinca = null; }, { passive: true });
      video.addEventListener('click', async (e) => {
        const r = visor.getBoundingClientRect();
        foco.style.left = (e.clientX - r.left) + 'px'; foco.style.top = (e.clientY - r.top) + 'px';
        foco.classList.remove('on'); void foco.offsetWidth; foco.classList.add('on');
        if (!track) return;
        const pt = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
        try {
          const adv = {};
          if (cap.focusMode && cap.focusMode.includes('single-shot')) adv.focusMode = 'single-shot';
          adv.pointsOfInterest = [pt];
          await track.applyConstraints({ advanced: [adv] });
          if (cap.focusMode && cap.focusMode.includes('continuous')) setTimeout(() => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}), 2500);
        } catch (err) { /* sem controle de foco */ }
      });

      async function alternarFlash() {
        try {
          torch = !torch;
          await track.applyConstraints({ advanced: [{ torch }] });
          btnFlash.innerHTML = torch ? SVG.flashOn : SVG.flashOff;
          btnFlash.classList.toggle('ativo', torch);
        } catch (e) { torch = false; aviso('Flash indisponível'); }
      }

      function capturarQuadro() {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return Promise.resolve(null);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(video, 0, 0, w, h);
        return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
      }
      async function capturar() {
        if (imgCap && ls.get('cam_rapida') !== '1') {
          try {
            const b = await Promise.race([imgCap.takePhoto(), new Promise((_, rj) => setTimeout(() => rj(new Error('tempo')), 3500))]);
            if (b && b.size) return b;
          } catch (e) { /* usa o quadro do video */ }
        }
        return capturarQuadro();
      }

      async function disparar() {
        if (ocupado || fechado) return;
        ocupado = true;
        btnDisparo.classList.add('ocupado');
        try {
          flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
          if (navigator.vibrate) navigator.vibrate(25);
          const blob = await capturar();
          if (!blob) { aviso('Câmera iniciando…'); return; }
          thumb.style.backgroundImage = 'url(' + URL.createObjectURL(blob) + ')';
          if (opts.modo === 'unica') { fechar(true); resolve(blob); return; }
          opts.aoFoto(blob).catch((e) => aviso('Erro ao salvar: ' + e.message, 3000));
          total++;
          badge.textContent = total;
          badge.style.display = 'grid';
        } finally {
          ocupado = false;
          btnDisparo.classList.remove('ocupado');
        }
      }

      const fecharInterno = function (silencioso) {
        if (fechado) return;
        fechado = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (wake) { try { wake.release(); } catch (e) { /* */ } }
        ov.remove();
        document.body.style.overflow = '';
        window.removeEventListener('popstate', aoVoltar);
        if (!silencioso) resolve(opts.modo === 'unica' ? null : { total });
      };
      function fechar(silencioso) {
        const aberto = !fechado;
        fecharInterno(silencioso);
        if (aberto && history.state && history.state.camera) history.back();
      }
      const aoVoltar = () => fecharInterno();
      history.pushState({ camera: true }, '');
      window.addEventListener('popstate', aoVoltar);

      try {
        try { await abrirStream(lenteAtual || null); }
        catch (e) { if (lenteAtual) { ls.set('cam_lente', ''); await abrirStream(null); } else throw e; }
        await listarLentes();
        try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
      } catch (e) {
        fechar(true);
        reject(e);
      }
    });
  };

  root.Camera = Camera;
})(self);
