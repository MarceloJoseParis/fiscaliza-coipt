/* Camera continua dentro do app (getUserMedia): tira varias fotos sem fechar. */
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

  /**
   * Abre a camera.
   * opts: {
   *   titulo, modo: 'continuo' | 'unica',
   *   aoFoto(blob) -> Promise   (foto normal; no modo 'unica' retorna a foto e fecha)
   *   aoIrregularidade(blob) -> Promise  (opcional: botao de irregularidade; a camera continua aberta depois)
   * }
   * Retorna Promise que resolve quando a camera e fechada ({total}) ou com o blob no modo 'unica'.
   */
  Camera.abrir = function (opts) {
    opts = opts || {};
    return new Promise(async (resolve, reject) => {
      let stream = null, wake = null, fechado = false, total = 0, irr = 0, ocupado = false, torch = false;
      const video = el('video', { autoplay: '', playsinline: '', muted: '', class: 'cam-video' });
      video.muted = true;
      const flash = el('div', { class: 'cam-flash' });
      const cont = el('div', { class: 'cam-cont' }, '0 fotos');
      const thumb = el('div', { class: 'cam-thumb' });
      const msg = el('div', { class: 'cam-msg' });
      const btnFechar = el('button', { class: 'cam-bt cam-fechar', onclick: () => fechar() }, opts.modo === 'unica' ? '✕ Cancelar' : '✓ Concluir');
      const btnTorch = el('button', { class: 'cam-bt cam-torch', style: { display: 'none' }, onclick: () => alternarLanterna() }, '🔦');
      const btnDisparo = el('button', { class: 'cam-disparo', 'aria-label': 'Tirar foto', onclick: () => disparar(false) });
      const btnIrr = opts.aoIrregularidade ? el('button', { class: 'cam-bt cam-irr', onclick: () => disparar(true) }, '⚠️', el('span', {}, 'Irregularidade')) : el('div', { style: { width: '84px' } });
      const ov = el('div', { class: 'cam-overlay' },
        video, flash,
        el('div', { class: 'cam-topo' }, btnFechar, el('div', { class: 'cam-titulo' }, opts.titulo || ''), btnTorch),
        msg,
        el('div', { class: 'cam-base' }, el('div', { class: 'cam-esq' }, thumb, cont), btnDisparo, btnIrr));
      document.body.appendChild(ov);
      document.body.style.overflow = 'hidden';

      function aviso(t, ms) {
        msg.textContent = t; msg.style.opacity = '1';
        clearTimeout(aviso._t); aviso._t = setTimeout(() => { msg.style.opacity = '0'; }, ms || 1800);
      }

      async function iniciar() {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } },
          });
          video.srcObject = stream;
          await video.play().catch(() => {});
          const track = stream.getVideoTracks()[0];
          const cap = track.getCapabilities ? track.getCapabilities() : {};
          if (cap.torch) btnTorch.style.display = '';
          try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
        } catch (e) {
          fechar(true);
          reject(e);
        }
      }

      async function alternarLanterna() {
        try {
          torch = !torch;
          await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch }] });
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

      async function disparar(irregular) {
        if (ocupado || fechado) return;
        ocupado = true;
        try {
          const blob = await capturarQuadro();
          if (!blob) { aviso('Câmera ainda iniciando…'); return; }
          flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
          if (navigator.vibrate) navigator.vibrate(40);
          const u = URL.createObjectURL(blob);
          thumb.style.backgroundImage = 'url(' + u + ')';
          if (opts.modo === 'unica') {
            fechar(true);
            resolve(blob);
            return;
          }
          if (irregular) {
            video.pause();
            await opts.aoIrregularidade(blob);
            irr++;
            if (!fechado) { await video.play().catch(() => {}); aviso('Pode continuar fotografando'); }
          } else {
            // processamento em segundo plano: a camera continua disponivel
            opts.aoFoto(blob).catch((e) => aviso('Erro ao salvar: ' + e.message, 3000));
          }
          total++;
          cont.textContent = total + (total === 1 ? ' foto' : ' fotos') + (irr ? ' · ⚠️ ' + irr : '');
        } finally {
          ocupado = false;
        }
      }

      function fechar(silencioso) {
        if (fechado) return;
        fechado = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (wake) { try { wake.release(); } catch (e) { /* */ } }
        ov.remove();
        document.body.style.overflow = '';
        window.removeEventListener('popstate', aoVoltar);
        if (!silencioso) resolve(opts.modo === 'unica' ? null : { total, irregularidades: irr });
      }
      // botao "voltar" do Android fecha a camera
      const aoVoltar = () => fechar();
      window.addEventListener('popstate', aoVoltar, { once: true });
      history.pushState({ camera: true }, '');
      const fecharOrig = fechar;
      fechar = function (silencioso) {
        const estavaAberto = !fechado;
        fecharOrig(silencioso);
        if (estavaAberto && history.state && history.state.camera) history.back();
      };
      await iniciar();
    });
  };

  root.Camera = Camera;
})(self);
