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
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    esq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    dir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
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
      let facing = 'environment', temFrontal = false, zoom = 1, imgCap = null, gravidade = null;
      /* Lentes traseiras: no iPhone a grande angular vem como zoom 0,5 da câmera principal.
         No Android ela costuma ser OUTRA câmera (outro deviceId) — então o 0,5 troca de câmera. */
      const lentes = { principal: null, extras: [], atual: null, naUltra: false, logico: false };
      const sessao = []; // fotos desta sessao: {url, blob, foto: Promise}

      const video = el('video', { autoplay: '', playsinline: '', muted: '', class: 'cv-video' });
      video.muted = true;
      const flash = el('div', { class: 'cv-flash' });
      const foco = el('div', { class: 'cv-foco' });
      const msg = el('div', { class: 'cv-msg' });
      const zoomBar = el('div', { class: 'cv-zoom' });
      const cont = el('div', { class: 'cv-cont' }, opts.modo === 'unica' ? (opts.titulo || '') : (opts.titulo || ''));
      const thumb = el('button', { class: 'cv-thumb', 'aria-label': 'Fotos desta sessão', onclick: () => abrirGaleria() });
      const badge = el('span', { class: 'cv-badge' });
      thumb.append(badge);
      const inpNativo = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
      inpNativo.addEventListener('change', () => {
        const files = inpNativo.files;
        if (files && files.length) { fechar(true); resolve({ aparelho: files, total }); }
      });
      const btnFlash = el('button', { class: 'cv-ic', 'aria-label': 'Flash', html: SVG.flashOff, style: { visibility: 'hidden' }, onclick: () => alternarFlash() });
      const btnLente = el('button', { class: 'cv-ic cv-ic-grande', 'aria-label': 'Câmera frontal / traseira', html: SVG.lente, style: { visibility: 'hidden' }, onclick: () => alternarFrontal() });
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
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
        const tam = { width: { ideal: 4096 }, height: { ideal: 3072 } };
        if (deviceId) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: Object.assign({ deviceId: { exact: deviceId } }, tam) });
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: Object.assign({ facingMode: { exact: facing } }, tam) });
          } catch (e) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: Object.assign({ facingMode: { ideal: facing } }, tam) });
          }
        }
        video.classList.toggle('espelho', facing === 'user');
        track = stream.getVideoTracks()[0];
        video.srcObject = stream;
        await video.play().catch(() => {});
        cap = track.getCapabilities ? track.getCapabilities() : {};
        imgCap = ('ImageCapture' in root) ? new root.ImageCapture(track) : null;
        btnFlash.style.visibility = cap.torch ? 'visible' : 'hidden';
        torch = false; btnFlash.innerHTML = SVG.flashOff; btnFlash.classList.remove('ativo');
        try { if (cap.focusMode && cap.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* */ }
        const s = track.getSettings ? track.getSettings() : {};
        zoom = s.zoom || 1;
        montarZoom();
      }

      const FRONTAL = /front|frontal|user|selfie|facing front|dianteira/i;
      async function detectarFrontal() {
        let devs = [];
        try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch (e) { /* */ }
        temFrontal = devs.length > 1;
        btnLente.style.visibility = temFrontal ? 'visible' : 'hidden';
        // outras câmeras traseiras (grande angular, teleobjetiva...) — usadas quando o zoom 0,5 não existe
        const s = track && track.getSettings ? track.getSettings() : {};
        lentes.principal = s.deviceId || lentes.principal;
        const num = (d) => { const m = /(\d+)/.exec(d.label || ''); return m ? +m[1] : 99; };
        const ultraNome = (d) => (/ultra|wide|grande.?angular|0[.,]5/i.test(d.label || '') ? 0 : 1);
        lentes.extras = devs.filter((d) => d.deviceId && d.deviceId !== lentes.principal && d.label && !FRONTAL.test(d.label))
          .sort((a, b) => ultraNome(a) - ultraNome(b) || num(a) - num(b));
        montarZoom();
      }

      async function alternarFrontal() {
        const antes = facing;
        facing = facing === 'environment' ? 'user' : 'environment';
        lentes.naUltra = false;
        try { await abrirStream(facing === 'environment' ? lentes.principal : null); aviso(facing === 'user' ? 'Câmera frontal' : 'Câmera traseira'); }
        catch (e) { facing = antes; try { await abrirStream(facing === 'environment' ? lentes.principal : null); } catch (e2) { /* */ } aviso('Não foi possível trocar a câmera'); }
      }

      /* Android: 0,5 = abrir a câmera grande angular (outro dispositivo). Tocar de novo em 0,5 troca para a
         próxima câmera traseira, caso a escolhida não seja a grande angular; a escolha fica gravada. */
      async function irParaUltra() {
        if (!lentes.extras.length) return;
        let alvo;
        if (lentes.naUltra) {
          const i = lentes.extras.findIndex((d) => d.deviceId === lentes.atual);
          alvo = lentes.extras[(i + 1) % lentes.extras.length];
        } else {
          const salvo = ls.get('lente_05');
          alvo = lentes.extras.find((d) => d.label === salvo) || lentes.extras[0];
        }
        try {
          await abrirStream(alvo.deviceId);
          lentes.atual = alvo.deviceId; lentes.naUltra = true;
          ls.set('lente_05', alvo.label);
          zoom = 0.5; montarZoom();
          if (lentes.extras.length > 1) aviso('Lente ' + (lentes.extras.indexOf(alvo) + 1) + ' de ' + lentes.extras.length + ' — se não for a grande angular, toque em 0,5 de novo', 3200);
        } catch (e) {
          aviso('Não foi possível abrir a grande angular neste celular');
          await voltarPrincipal();
        }
      }
      async function voltarPrincipal(z) {
        if (lentes.naUltra) {
          lentes.naUltra = false;
          try { await abrirStream(lentes.principal); } catch (e) { await abrirStream(); }
        }
        if (z && z !== 1) await aplicarZoom(z); else { zoom = (track.getSettings && track.getSettings().zoom) || 1; montarZoom(); }
      }

      /* posicao do celular no momento da foto (para salvar na horizontal quando estiver na horizontal) */
      function aoMovimento(e) {
        const a = e.accelerationIncludingGravity;
        if (a && a.x !== null) gravidade = { x: a.x, y: a.y };
      }
      window.addEventListener('devicemotion', aoMovimento);
      function anguloAtual() {
        let ang = 0;
        if (screen.orientation && typeof screen.orientation.angle === 'number') ang = screen.orientation.angle;
        else if (typeof window.orientation === 'number') ang = (window.orientation + 360) % 360;
        if (ang === 0 && gravidade && Math.abs(gravidade.x) > 6 && Math.abs(gravidade.x) > Math.abs(gravidade.y) * 1.3) {
          // tela travada em retrato, mas o celular esta deitado
          const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
          const topoEsquerda = ios ? gravidade.x > 0 : gravidade.x < 0;
          ang = topoEsquerda ? 90 : 270;
        }
        return ang;
      }

      /* galeria das fotos tiradas nesta sessao */
      function abrirGaleria() {
        if (!sessao.some((f) => !f.excluida)) { aviso('Nenhuma foto nesta sessão ainda'); return; }
        video.pause();
        const gal = el('div', { class: 'cv-gal' });
        const vivas = () => sessao.filter((f) => !f.excluida);
        const fecharGal = () => { gal.remove(); video.play().catch(() => {}); };
        const desenharGrade = () => {
          const v = vivas();
          gal.replaceChildren(
            el('div', { class: 'cv-gal-topo' },
              el('button', { class: 'cv-ic', 'aria-label': 'Voltar à câmera', html: SVG.esq, onclick: fecharGal }),
              el('div', { class: 'cv-cont' }, v.length + (v.length === 1 ? ' foto nesta sessão' : ' fotos nesta sessão')),
              el('div', { style: { width: '42px' } })),
            el('div', { class: 'cv-gal-grade' }, v.map((f) => el('button', { class: 'cv-gal-item', style: { backgroundImage: 'url(' + f.url + ')' }, onclick: () => verFoto(f) }))),
            el('div', { class: 'cv-gal-base' }, el('button', { class: 'cv-gal-bt', onclick: fecharGal }, 'Voltar à câmera')));
        };
        const verFoto = (f) => {
          const v = vivas();
          const pos = v.indexOf(f);
          gal.replaceChildren(
            el('div', { class: 'cv-gal-topo' },
              el('button', { class: 'cv-ic', 'aria-label': 'Voltar', html: SVG.esq, onclick: desenharGrade }),
              el('div', { class: 'cv-cont' }, 'Foto ' + (pos + 1) + ' de ' + v.length),
              el('button', { class: 'cv-ic', 'aria-label': 'Excluir foto', html: SVG.lixo, onclick: async () => {
                if (!confirm('Excluir esta foto?')) return;
                f.excluida = true;
                try { const foto = await f.foto; if (opts.aoExcluir) await opts.aoExcluir(foto); } catch (e) { /* */ }
                total--; atualizarContador();
                if (vivas().length) desenharGrade(); else fecharGal();
              } })),
            el('div', { class: 'cv-ver' }, el('img', { class: 'cv-ver-img', src: f.url }),
              pos > 0 ? el('button', { class: 'cv-ver-nav esq', html: SVG.esq, onclick: () => verFoto(v[pos - 1]) }) : null,
              pos < v.length - 1 ? el('button', { class: 'cv-ver-nav dir', html: SVG.dir, onclick: () => verFoto(v[pos + 1]) }) : null),
            el('div', { class: 'cv-gal-base' }, el('button', { class: 'cv-gal-bt', onclick: fecharGal }, 'Voltar à câmera')));
        };
        desenharGrade();
        ov.append(gal);
      }

      function atualizarContador() {
        const v = sessao.filter((f) => !f.excluida);
        badge.textContent = v.length;
        badge.style.display = v.length ? 'grid' : 'none';
        const ult = v[v.length - 1];
        thumb.style.backgroundImage = ult ? 'url(' + ult.url + ')' : '';
      }

      function montarZoom() {
        zoomBar.replaceChildren();
        if (facing !== 'environment') return;
        const temZoom = cap.zoom && cap.zoom.max > cap.zoom.min;
        // zoom abaixo de 1 na própria câmera (iPhone e alguns Android): usa o zoom
        lentes.logico = !lentes.naUltra && temZoom && cap.zoom.min < 1;
        const outraLente = !lentes.logico && lentes.extras.length > 0;
        if (!temZoom && !outraLente && !lentes.naUltra) return;
        const pres = [];
        if (lentes.logico) pres.push(Math.max(cap.zoom.min, 0.5));
        else if (outraLente || lentes.naUltra) pres.push(0.5);
        pres.push(1);
        const zMax = lentes.naUltra ? (lentes.zMaxPrincipal || 1) : (temZoom ? cap.zoom.max : 1);
        if (!lentes.naUltra && temZoom) lentes.zMaxPrincipal = cap.zoom.max;
        for (const z of [2, 5]) if (zMax >= z) pres.push(z);
        pres.forEach((z) => zoomBar.append(el('button', { 'data-z': z, onclick: () => escolherZoom(z) }, fmtZoom(z))));
        marcarZoom();
      }
      function escolherZoom(z) {
        if (z < 1 && !lentes.logico) return irParaUltra();
        if (lentes.naUltra) return voltarPrincipal(z);
        return aplicarZoom(z);
      }
      function marcarZoom() {
        const botoes = [...zoomBar.children];
        let alvo = null;
        if (lentes.naUltra) alvo = botoes[0] || null;
        else botoes.forEach((b) => { if (+b.dataset.z <= zoom + 0.01) alvo = b; });
        botoes.forEach((b) => {
          const ativo = b === alvo;
          b.classList.toggle('ativo', ativo);
          b.textContent = ativo ? fmtZoom(zoom) + 'x' : fmtZoom(+b.dataset.z);
        });
      }
      async function aplicarZoom(z) {
        if (!cap.zoom) { marcarZoom(); return; }
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
        if (pinca && e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          if (lentes.naUltra) { if (d / pinca.d > 1.6 && !pinca.trocou) { pinca.trocou = true; voltarPrincipal(); } return; }
          if (!lentes.logico && lentes.extras.length && d / pinca.d < 0.6 && zoom <= 1.01 && !pinca.trocou) { pinca.trocou = true; irParaUltra(); return; }
          if (cap.zoom) aplicarZoom(pinca.z * (d / pinca.d));
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
          const angulo = anguloAtual();
          const blob = await capturar();
          if (!blob) { aviso('Câmera iniciando…'); return; }
          blob.angulo = angulo;
          if (opts.modo === 'unica') { fechar(true); resolve(blob); return; }
          const item = { blob, url: URL.createObjectURL(blob), angulo, foto: Promise.resolve(opts.aoFoto(blob)) };
          item.foto.then(async (foto) => {
            // troca a miniatura pela foto ja processada (girada e com carimbo)
            if (foto && opts.urlFoto) { try { const u = await opts.urlFoto(foto); if (u) { item.url = u; atualizarContador(); } } catch (e) { /* */ } }
          }).catch((e) => aviso('Erro ao salvar: ' + e.message, 3000));
          sessao.push(item);
          total++;
          atualizarContador();
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
        window.removeEventListener('devicemotion', aoMovimento);
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
        await abrirStream();
        await detectarFrontal();
        try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
      } catch (e) {
        fechar(true);
        reject(e);
      }
    });
  };

  root.Camera = Camera;
})(self);
