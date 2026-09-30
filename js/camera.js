/* Camera continua dentro do app (getUserMedia), com troca de lente, zoom (inclusive 0,5x quando o
 * aparelho permite), toque para focar, lanterna e atalho para a camera nativa do celular. */
(function (root) {
  const Camera = {};
  Camera.suportada = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  }
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } },
  };

  function rotuloLente(d, i, total) {
    const l = (d.label || '').toLowerCase();
    if (/ultra|wide|grande|0[.,]5/.test(l)) return 'Grande angular';
    if (/tele|zoom/.test(l)) return 'Teleobjetiva';
    return total > 1 ? 'Lente ' + (i + 1) : 'Traseira';
  }

  /**
   * opts: { titulo, modo: 'continuo'|'unica', aoFoto(blob)->Promise, aoIrregularidade(blob)->Promise }
   * Resolve: modo continuo -> {total, irregularidades} ; modo unica -> Blob|null
   *          se o usuario escolher a camera do celular -> {aparelho: FileList}
   */
  Camera.abrir = function (opts) {
    opts = opts || {};
    return new Promise(async (resolve, reject) => {
      let stream = null, track = null, cap = {}, wake = null, fechado = false, total = 0, irr = 0, ocupado = false, torch = false;
      let lentes = [], lenteAtual = ls.get('cam_lente') || '', zoom = 1, imgCap = null;

      const video = el('video', { autoplay: '', playsinline: '', muted: '', class: 'cam-video' });
      video.muted = true;
      const flash = el('div', { class: 'cam-flash' });
      const foco = el('div', { class: 'cam-foco' });
      const cont = el('div', { class: 'cam-cont' }, opts.modo === 'unica' ? '' : '0 fotos');
      const thumb = el('div', { class: 'cam-thumb' });
      const msg = el('div', { class: 'cam-msg' });
      const boxZoom = el('div', { class: 'cam-zoom' });
      const boxLentes = el('div', { class: 'cam-lentes' });
      const inpNativo = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
      inpNativo.addEventListener('change', () => {
        const files = inpNativo.files;
        if (files && files.length) { fechar(true); resolve({ aparelho: files, total, irregularidades: irr }); }
      });
      const btnFechar = el('button', { class: 'cam-bt', onclick: () => fechar() }, opts.modo === 'unica' ? 'Cancelar' : 'Concluir');
      const btnTorch = el('button', { class: 'cam-bt', style: { display: 'none' }, title: 'Lanterna', onclick: () => alternarLanterna() }, '🔦');
      const btnNativo = el('button', { class: 'cam-bt', title: 'Usar a câmera do celular (grande angular, HDR, etc.)',
        onclick: () => { inpNativo.click(); } }, '📱');
      const btnDisparo = el('button', { class: 'cam-disparo', 'aria-label': 'Tirar foto', onclick: () => disparar(false) });
      const btnIrr = opts.aoIrregularidade ? el('button', { class: 'cam-bt cam-irr', onclick: () => disparar(true) }, '⚠️', el('span', {}, 'Irregularidade')) : el('div', { style: { width: '84px' } });
      const ov = el('div', { class: 'cam-overlay' },
        video, flash, foco,
        el('div', { class: 'cam-topo' }, btnFechar, el('div', { class: 'cam-titulo' }, opts.titulo || ''), btnTorch, btnNativo),
        msg, boxLentes, boxZoom,
        el('div', { class: 'cam-base' }, el('div', { class: 'cam-esq' }, thumb, cont), btnDisparo, btnIrr), inpNativo);
      document.body.appendChild(ov);
      document.body.style.overflow = 'hidden';

      function aviso(t, ms) {
        msg.textContent = t; msg.style.opacity = '1';
        clearTimeout(aviso._t); aviso._t = setTimeout(() => { msg.style.opacity = '0'; }, ms || 1800);
      }

      async function abrirStream(deviceId) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        const video0 = { width: { ideal: 4096 }, height: { ideal: 3072 } };
        const c = deviceId ? Object.assign({ deviceId: { exact: deviceId } }, video0) : Object.assign({ facingMode: { ideal: 'environment' } }, video0);
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: c });
        track = stream.getVideoTracks()[0];
        video.srcObject = stream;
        await video.play().catch(() => {});
        cap = track.getCapabilities ? track.getCapabilities() : {};
        imgCap = ('ImageCapture' in root) ? new root.ImageCapture(track) : null;
        btnTorch.style.display = cap.torch ? '' : 'none';
        torch = false; btnTorch.classList.remove('ativo');
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
        montarLentes();
      }

      function montarLentes() {
        boxLentes.replaceChildren();
        if (lentes.length < 2) return;
        lentes.forEach((d, i) => {
          boxLentes.append(el('button', { class: d.deviceId === lenteAtual ? 'ativo' : '', onclick: async () => {
            try { await abrirStream(d.deviceId); ls.set('cam_lente', d.deviceId); montarLentes(); aviso(rotuloLente(d, i, lentes.length)); }
            catch (e) { aviso('Lente indisponível'); }
          } }, rotuloLente(d, i, lentes.length)));
        });
      }

      function montarZoom() {
        boxZoom.replaceChildren();
        if (!cap.zoom || !(cap.zoom.max > cap.zoom.min)) return;
        const pres = [];
        if (cap.zoom.min < 1) pres.push(Math.max(cap.zoom.min, 0.5));
        pres.push(1);
        for (const z of [2, 5]) if (cap.zoom.max >= z) pres.push(z);
        pres.forEach((z) => boxZoom.append(el('button', { class: Math.abs(zoom - z) < 0.05 ? 'ativo' : '', onclick: () => aplicarZoom(z) },
          (z < 1 ? String(z).replace('0.', ',') : z) + 'x')));
      }

      async function aplicarZoom(z) {
        if (!cap.zoom) return;
        z = Math.min(cap.zoom.max, Math.max(cap.zoom.min, z));
        try { await track.applyConstraints({ advanced: [{ zoom: z }] }); zoom = z; } catch (e) { /* */ }
        [...boxZoom.children].forEach((b) => b.classList.toggle('ativo', b.textContent === (z < 1 ? String(z).replace('0.', ',') : String(Math.round(z * 10) / 10)) + 'x'));
      }

      // pinca para zoom e toque para focar
      let pinca = null;
      video.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          pinca = { d, z: zoom };
        }
      }, { passive: true });
      video.addEventListener('touchmove', (e) => {
        if (pinca && e.touches.length === 2 && cap.zoom) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          aplicarZoom(pinca.z * (d / pinca.d));
        }
      }, { passive: true });
      video.addEventListener('touchend', () => { pinca = null; }, { passive: true });
      video.addEventListener('click', async (e) => {
        foco.style.left = e.clientX + 'px'; foco.style.top = e.clientY + 'px'; foco.style.opacity = '1';
        setTimeout(() => { foco.style.opacity = '0'; }, 700);
        if (!track) return;
        const r = video.getBoundingClientRect();
        const pt = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
        try {
          const adv = {};
          if (cap.pointsOfInterest !== undefined || 'pointsOfInterest' in (track.getConstraints ? track.getConstraints() : {})) adv.pointsOfInterest = [pt];
          if (cap.focusMode && cap.focusMode.includes('single-shot')) adv.focusMode = 'single-shot';
          if (Object.keys(adv).length) await track.applyConstraints({ advanced: [adv] });
          if (cap.focusMode && cap.focusMode.includes('continuous')) setTimeout(() => track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}), 2500);
        } catch (err) { /* aparelho sem controle de foco */ }
      });

      async function alternarLanterna() {
        try {
          torch = !torch;
          await track.applyConstraints({ advanced: [{ torch }] });
          btnTorch.classList.toggle('ativo', torch);
        } catch (e) { aviso('Lanterna indisponível'); }
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
        // foto em resolucao total do sensor quando o navegador permite; senao, quadro do video
        if (imgCap && ls.get('cam_rapida') !== '1') {
          try {
            const b = await Promise.race([imgCap.takePhoto(torch ? { fillLightMode: 'flash' } : {}), new Promise((_, rj) => setTimeout(() => rj(new Error('tempo')), 3500))]);
            if (b && b.size) return b;
          } catch (e) { /* usa o quadro */ }
        }
        return capturarQuadro();
      }

      async function disparar(irregular) {
        if (ocupado || fechado) return;
        ocupado = true;
        btnDisparo.style.opacity = '.5';
        try {
          flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
          if (navigator.vibrate) navigator.vibrate(30);
          const blob = await capturar();
          if (!blob) { aviso('Câmera ainda iniciando…'); return; }
          thumb.style.backgroundImage = 'url(' + URL.createObjectURL(blob) + ')';
          if (opts.modo === 'unica') { fechar(true); resolve(blob); return; }
          if (irregular) {
            video.pause();
            await opts.aoIrregularidade(blob);
            irr++;
            if (!fechado) { await video.play().catch(() => {}); aviso('Pode continuar fotografando'); }
          } else {
            opts.aoFoto(blob).catch((e) => aviso('Erro ao salvar: ' + e.message, 3000));
          }
          total++;
          cont.textContent = total + (total === 1 ? ' foto' : ' fotos') + (irr ? ' · ⚠️ ' + irr : '');
        } finally {
          ocupado = false;
          btnDisparo.style.opacity = '';
        }
      }

      let fecharInterno = function (silencioso) {
        if (fechado) return;
        fechado = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (wake) { try { wake.release(); } catch (e) { /* */ } }
        ov.remove();
        document.body.style.overflow = '';
        window.removeEventListener('popstate', aoVoltar);
        if (!silencioso) resolve(opts.modo === 'unica' ? null : { total, irregularidades: irr });
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
