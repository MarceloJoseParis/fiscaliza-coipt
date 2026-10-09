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
    lentes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M20.2 8l-4.5 2.2M17.6 19.5l-3.1-3.9M6.4 19.5l3.1-3.9M3.8 8l4.5 2.2"/></svg>',
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
    /* iPhone (iOS 13+): o sensor de movimento só funciona depois de o usuário permitir, e o pedido precisa sair
       do toque no botão. Sem ele, com a rotação da tela travada, a foto tirada com o celular deitado saía em pé. */
    try {
      if (!Camera._movPedido && root.DeviceMotionEvent && typeof root.DeviceMotionEvent.requestPermission === 'function') {
        Camera._movPedido = true;
        root.DeviceMotionEvent.requestPermission().catch(() => {});
      }
    } catch (e) { /* */ }
    return new Promise(async (resolve, reject) => {
      let stream = null, track = null, cap = {}, wake = null, fechado = false, total = 0, ocupado = false, torch = false;
      let facing = 'environment', temFrontal = false, zoom = 1, imgCap = null, gravidade = null;
      /* Lentes traseiras: no iPhone a grande angular vem como zoom 0,5 da câmera principal.
         No Android ela costuma ser OUTRA câmera (outro deviceId) — então o 0,5 troca de câmera. */
      const lentes = { principal: null, extras: [], atual: null, naUltra: false, logico: false };
      const sessao = []; // fotos desta sessao: {url (miniatura), cheia(), foto: Promise}
      /* Vigia da câmera (3.15.7). No iPhone, com o aparelho sem memória ou depois de uma interrupção, o
         Safari às vezes para de mandar imagem: o visor congela (parece "fora de foco") e a foto sai PRETA.
         O app percebe (quadros parados, trilha "muda"/encerrada, foto preta) e reabre a câmera sozinho. */
      let ultimoQuadro = performance.now(), galeriaAberta = false, reabrindo = null, perfilando = false, ultimoRefoco = 0;

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
      const btnLentes = el('button', { class: 'cv-ic', 'aria-label': 'Escolher lente', title: 'Escolher lente', html: SVG.lentes, style: { display: 'none' }, onclick: () => menuLentes() });
      const btnFlash = el('button', { class: 'cv-ic', 'aria-label': 'Flash', html: SVG.flashOff, style: { visibility: 'hidden' }, onclick: () => alternarFlash() });
      const btnLente = el('button', { class: 'cv-ic cv-ic-grande', 'aria-label': 'Câmera frontal / traseira', html: SVG.lente, style: { visibility: 'hidden' }, onclick: () => alternarFrontal() });
      const btnDisparo = el('button', { class: 'cv-disparo', 'aria-label': 'Tirar foto', onclick: () => disparar() }, el('span'));

      const visor = el('div', { class: 'cv-visor' }, video, foco, flash, zoomBar);
      const ov = el('div', { class: 'cv' },
        el('div', { class: 'cv-topo' },
          el('button', { class: 'cv-ic', 'aria-label': 'Fechar', html: SVG.fechar, onclick: () => fechar() }),
          cont,
          el('div', { class: 'cv-topo-dir' }, btnLentes, btnFlash,
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
        const esta = track;
        track.addEventListener('ended', () => { if (esta === track && !fechado && !perfilando) reabrir('A câmera foi interrompida — reabrindo…'); });
        track.addEventListener('mute', () => {
          if (esta !== track || fechado) return;
          setTimeout(() => { if (esta === track && track.muted && !fechado && !document.hidden && !perfilando) reabrir('A câmera parou — reabrindo…'); }, 1200);
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
        ultimoQuadro = performance.now();
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

      /* reabre a câmera na mesma lente e no mesmo zoom (é o que acontecia ao sair e voltar ao app) */
      function reabrir(texto) {
        if (reabrindo || fechado) return reabrindo || Promise.resolve();
        reabrindo = (async () => {
          if (texto) aviso(texto, 2200);
          const z = zoom, ultra = lentes.naUltra;
          try { await abrirStream(ultra ? lentes.atual : (facing === 'environment' ? lentes.principal : null)); }
          catch (e) { try { lentes.naUltra = false; await abrirStream(); } catch (e2) { aviso('Não foi possível reabrir a câmera. Feche e abra de novo.', 4000); } }
          if (lentes.naUltra) { zoom = 0.5; montarZoom(); }
          else if (z && cap.zoom && Math.abs(z - zoom) > 0.01) await aplicarZoom(z);
          ultimoQuadro = performance.now();
        })().finally(() => { reabrindo = null; });
        return reabrindo;
      }
      // quadros chegando: requestVideoFrameCallback (iPhone 15.4+ e Chrome) ou o relógio do vídeo
      const temRVFC = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
      const aoQuadro = () => { ultimoQuadro = performance.now(); if (!fechado && temRVFC) video.requestVideoFrameCallback(aoQuadro); };
      if (temRVFC) video.requestVideoFrameCallback(aoQuadro); else video.addEventListener('timeupdate', () => { ultimoQuadro = performance.now(); });
      function esperarQuadro(ms) {
        return new Promise((res) => {
          const t0 = ultimoQuadro, fim = Date.now() + ms;
          const ver = () => { if ((ultimoQuadro > t0 && video.readyState >= 2) || Date.now() > fim) res(); else setTimeout(ver, 60); };
          ver();
        });
      }
      const vigia = setInterval(() => {
        if (fechado || galeriaAberta || reabrindo || perfilando || document.hidden || !track) return;
        if (video.paused) video.play().catch(() => {});
        if (performance.now() - ultimoQuadro > 3000) reabrir('A imagem da câmera parou — reabrindo…');
      }, 1000);
      const aoVoltarAoApp = () => {
        if (fechado || document.hidden) return;
        ultimoQuadro = performance.now();
        if (!track || track.readyState !== 'live' || track.muted) reabrir('Reabrindo a câmera…');
        else video.play().catch(() => {});
      };
      document.addEventListener('visibilitychange', aoVoltarAoApp);

      /* Perfil das lentes do celular (feito uma vez e guardado): abre cada câmera traseira por um instante
         e lê o zoom de cada uma. Em muitos Android existe uma câmera "combinada" com zoom abaixo de 1x
         (ex.: 0,6x) que NÃO é a que o navegador abre por padrão — é ela que dá a grande angular. */
      async function perfilLentes(devs) {
        const assinatura = devs.map((d) => d.label || d.deviceId).join('|');
        let perf = null;
        try { perf = JSON.parse(ls.get('cam_perfil') || 'null'); } catch (e) { /* */ }
        if (perf && perf.assinatura === assinatura) return perf;
        aviso('Reconhecendo as lentes deste celular…', 5000);
        perfilando = true; setTimeout(() => { perfilando = false; ultimoQuadro = performance.now(); }, 15000);
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
        perf = { assinatura, cams: [] };
        for (const d of devs) {
          if (!d.deviceId) continue;
          try {
            const st = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: d.deviceId } } });
            const t = st.getVideoTracks()[0];
            const c = t.getCapabilities ? t.getCapabilities() : {};
            perf.cams.push({ label: d.label || d.deviceId, zmin: c.zoom ? c.zoom.min : null, zmax: c.zoom ? c.zoom.max : null, facing: (c.facingMode || [])[0] || (t.getSettings() || {}).facingMode || '' });
            st.getTracks().forEach((x) => x.stop());
          } catch (e) { perf.cams.push({ label: d.label || d.deviceId, erro: e.name || 'erro' }); }
        }
        ls.set('cam_perfil', JSON.stringify(perf));
        perfilando = false; ultimoQuadro = performance.now();
        return perf;
      }

      async function detectarFrontal() {
        let devs = [];
        try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch (e) { /* */ }
        temFrontal = devs.length > 1;
        btnLente.style.visibility = temFrontal ? 'visible' : 'hidden';
        const s = track && track.getSettings ? track.getSettings() : {};
        lentes.principal = s.deviceId || lentes.principal;
        let perf = null;
        // a câmera aberta não tem zoom abaixo de 1x e há outras câmeras: descobre as lentes (uma vez por celular)
        lentes.todas = devs;
        if (facing === 'environment' && !(cap.zoom && cap.zoom.min < 1) && devs.length > 1) {
          try { perf = await perfilLentes(devs); } catch (e) { perf = null; }
          const infoDe = (d) => (perf ? perf.cams.find((c) => c.label === (d.label || d.deviceId)) : null) || {};
          lentes.perfil = perf;
          const combinada = devs.filter((d) => { const i = infoDe(d); return i.zmin != null && i.zmin < 1 && i.facing !== 'user' && !FRONTAL.test(d.label); })
            .sort((a, b) => infoDe(a).zmin - infoDe(b).zmin)[0];
          const abrir = combinada ? combinada.deviceId : lentes.principal;
          if (!stream || (track && track.getSettings && track.getSettings().deviceId !== abrir)) {
            try { await abrirStream(abrir); } catch (e) { await abrirStream(); }
            const s2 = track.getSettings ? track.getSettings() : {};
            lentes.principal = s2.deviceId || abrir;
          }
          // na próxima vez já abre direto na câmera com grande angular
          if (combinada) ls.set('cam_principal', combinada.label || combinada.deviceId);
        }
        // outras câmeras traseiras (grande angular, teleobjetiva...) — usadas quando o zoom abaixo de 1x não existe
        const frontalPerfil = (d) => { const i = perf ? perf.cams.find((c) => c.label === d.label) : null; return i && i.facing === 'user'; };
        const num = (d) => { const m = /(\d+)/.exec(d.label || ''); return m ? +m[1] : 99; };
        const ultraNome = (d) => (/ultra|wide|grande.?angular|0[.,]5/i.test(d.label || '') ? 0 : 1);
        const escolhida = ls.get('lente_05');
        lentes.extras = devs.filter((d) => d.deviceId && d.deviceId !== lentes.principal && (d.label === escolhida || (d.label && !FRONTAL.test(d.label) && !frontalPerfil(d))))
          .sort((a, b) => (b.label === escolhida) - (a.label === escolhida) || ultraNome(a) - ultraNome(b) || num(a) - num(b));
        const traseiras = devs.filter((d) => d.deviceId && !(d.label && FRONTAL.test(d.label)) && !frontalPerfil(d));
        btnLentes.style.display = traseiras.length > 1 ? '' : 'none';
        montarZoom();
      }

      /* Escolha manual da lente (como nas versões anteriores): lista todas as câmeras traseiras.
         A escolhida vira a câmera principal e passa a abrir direto nas próximas vezes. */
      function menuLentes() {
        const velho = ov.querySelector('.cv-lentes-menu');
        if (velho) { velho.remove(); return; }
        const devs = (lentes.todas || []).filter((d) => d.deviceId && !(d.label && FRONTAL.test(d.label)));
        const atual = track && track.getSettings ? track.getSettings().deviceId : null;
        const info = (d) => { const p = lentes.perfil || (() => { try { return JSON.parse(ls.get('cam_perfil') || 'null'); } catch (e) { return null; } })(); const c = p && p.cams.find((x) => x.label === (d.label || d.deviceId)); return c || {}; };
        const menu = el('div', { class: 'cv-lentes-menu' },
          el('div', { class: 'cv-lentes-tit' }, 'Lentes deste celular'),
          devs.map((d, i) => {
            const c = info(d);
            const extra = c.facing === 'user' ? ' · frontal' : c.zmin != null ? ' · zoom ' + String(Math.round(c.zmin * 10) / 10).replace('.', ',') + '–' + String(Math.round(c.zmax * 10) / 10).replace('.', ',') + 'x' : '';
            return el('button', { class: d.deviceId === atual ? 'ativo' : '', onclick: async () => {
              menu.remove();
              try {
                facing = 'environment'; lentes.naUltra = false;
                await abrirStream(d.deviceId);
                lentes.principal = d.deviceId;
                ls.set('cam_principal', d.label || d.deviceId);
                lentes.extras = (lentes.todas || []).filter((x) => x.deviceId && x.deviceId !== d.deviceId && x.label && !FRONTAL.test(x.label));
                montarZoom();
                aviso((d.label || 'Lente ' + (i + 1)) + (cap.zoom && cap.zoom.min < 1 ? ' — zoom a partir de ' + String(Math.round(cap.zoom.min * 10) / 10).replace('.', ',') + 'x' : ''), 2600);
              } catch (e) { aviso('Não foi possível abrir esta lente'); }
            } }, (d.label || 'Lente ' + (i + 1)) + extra);
          }));
        ov.append(menu);
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
      /* Sentido do sensor: no padrão (Android e iPhone atuais) o eixo y dá +9,8 com o celular em pé; alguns
         aparelhos/navegadores dão o sinal invertido. Aprende pelo próprio celular quando ele está em pé
         (a câmera quase sempre abre assim) — antes a regra fixa do Android estava invertida e a foto deitada
         saía de cabeça para baixo. */
      let sinalY = 0;
      function aoMovimento(e) {
        const a = e.accelerationIncludingGravity;
        if (!a || a.x === null || a.x === undefined) return;
        gravidade = { x: a.x, y: a.y };
        if (Math.abs(a.y) > 7 && Math.abs(a.x) < 3) sinalY = Math.max(-20, Math.min(20, sinalY + (a.y > 0 ? 1 : -1)));
      }
      window.addEventListener('devicemotion', aoMovimento);
      function anguloAtual() {
        let ang = 0;
        if (screen.orientation && typeof screen.orientation.angle === 'number') ang = screen.orientation.angle;
        else if (typeof window.orientation === 'number') ang = (window.orientation + 360) % 360;
        if (ang === 0 && gravidade && Math.abs(gravidade.x) > 6 && Math.abs(gravidade.x) > Math.abs(gravidade.y) * 1.3) {
          // tela travada em retrato, mas o celular esta deitado: no padrão, x positivo = topo do celular à esquerda
          const conv = sinalY < 0 ? -1 : 1;
          const topoEsquerda = gravidade.x * conv > 0;
          ang = topoEsquerda ? 90 : 270;
        }
        return ang;
      }

      /* galeria das fotos tiradas nesta sessao */
      function abrirGaleria() {
        if (!sessao.some((f) => !f.excluida)) { aviso('Nenhuma foto nesta sessão ainda'); return; }
        video.pause();
        galeriaAberta = true;
        const gal = el('div', { class: 'cv-gal' });
        const vivas = () => sessao.filter((f) => !f.excluida);
        let urlCheia = null;
        const soltarCheia = () => { if (urlCheia) { const u = urlCheia; urlCheia = null; setTimeout(() => URL.revokeObjectURL(u), 500); } };
        const fecharGal = () => {
          soltarCheia(); gal.remove(); galeriaAberta = false; ultimoQuadro = performance.now();
          if (!track || track.readyState !== 'live') reabrir(); else video.play().catch(() => {});
        };
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
          soltarCheia();
          const v = vivas();
          const pos = v.indexOf(f);
          const img = el('img', { class: 'cv-ver-img', src: f.url });
          if (f.cheia) f.cheia().then((u) => { if (!u) return; if (gal.isConnected && img.isConnected) { urlCheia = u; img.src = u; } else URL.revokeObjectURL(u); }).catch(() => {});
          gal.replaceChildren(
            el('div', { class: 'cv-gal-topo' },
              el('button', { class: 'cv-ic', 'aria-label': 'Voltar', html: SVG.esq, onclick: () => { soltarCheia(); desenharGrade(); } }),
              el('div', { class: 'cv-cont' }, 'Foto ' + (pos + 1) + ' de ' + v.length),
              el('button', { class: 'cv-ic', 'aria-label': 'Excluir foto', html: SVG.lixo, onclick: async () => {
                if (!confirm('Excluir esta foto?')) return;
                f.excluida = true;
                try { const foto = await f.foto; if (opts.aoExcluir) await opts.aoExcluir(foto); } catch (e) { /* */ }
                total--; atualizarContador();
                if (vivas().length) desenharGrade(); else fecharGal();
              } })),
            el('div', { class: 'cv-ver' }, img,
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
        // sem controle de foco pelo navegador (iPhone): reabre a câmera, o que refaz o foco automático
        if (!(cap.focusMode && cap.focusMode.length) && !cap.pointsOfInterest) {
          if (Date.now() - ultimoRefoco > 4000 && !ocupado) { ultimoRefoco = Date.now(); reabrir('Focando…'); }
          return;
        }
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

      // o quadro está todo preto? (amostra reduzida: um ambiente escuro de verdade ainda tem pontos de luz)
      function quadroPreto(cv) {
        try {
          const s = document.createElement('canvas'); s.width = 24; s.height = 32;
          const g = s.getContext('2d'); g.drawImage(cv, 0, 0, 24, 32);
          const d = g.getImageData(0, 0, 24, 32).data;
          let max = 0;
          for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]); if (m > max) max = m; }
          s.width = s.height = 0;
          return max < 14;
        } catch (e) { return false; }
      }
      async function capturarQuadro() {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h || video.readyState < 2) return null;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        if (!g) { cv.width = cv.height = 0; return 'preto'; } // sem memória para o quadro
        g.drawImage(video, 0, 0, w, h);
        if (quadroPreto(cv)) { cv.width = cv.height = 0; return 'preto'; }
        const b = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
        cv.width = cv.height = 0; // libera a memória do quadro já (o iPhone tem pouca memória para imagens)
        return b && b.size ? b : 'preto';
      }
      async function capturar() {
        if (imgCap && ls.get('cam_rapida') !== '1') {
          try {
            const b = await Promise.race([imgCap.takePhoto(), new Promise((_, rj) => setTimeout(() => rj(new Error('tempo')), 3500))]);
            if (b && b.size) return b;
          } catch (e) { /* usa o quadro do video */ }
        }
        let b = await capturarQuadro();
        if (b !== 'preto') return b;
        // foto preta: espera o próximo quadro; se continuar preta, reabre a câmera e tenta de novo
        await esperarQuadro(400);
        b = await capturarQuadro();
        if (b !== 'preto') return b;
        await reabrir('A câmera parou de mandar imagem — reabrindo…');
        await esperarQuadro(2500);
        b = await capturarQuadro();
        if (b && b !== 'preto') return b;
        aviso('A câmera não entregou a imagem (tela preta). A foto NÃO foi salva — tente de novo.', 4500);
        return 'falhou';
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
          if (blob === 'falhou') return;
          blob.angulo = angulo;
          if (opts.modo === 'unica') { fechar(true); resolve(blob); return; }
          const item = { url: URL.createObjectURL(blob), angulo, foto: Promise.resolve(opts.aoFoto(blob)) };
          item.foto.then(async (foto) => {
            // troca pela miniatura da foto já processada (girada e com carimbo). A foto inteira só é carregada
            // ao abri-la na galeria — antes cada foto da sessão ficava inteira na memória e, numa visita longa,
            // o iPhone ficava sem memória (fotos pretas e câmera travada)
            if (!foto) return;
            const velha = item.url;
            if (foto.miniatura) { item.url = foto.miniatura; item.cheia = opts.urlFoto ? () => opts.urlFoto(foto) : null; }
            else if (opts.urlFoto) { try { const u = await opts.urlFoto(foto); if (u) { item.url = u; if (fechado) URL.revokeObjectURL(u); } } catch (e) { /* */ } }
            if (item.url !== velha) { atualizarContador(); setTimeout(() => URL.revokeObjectURL(velha), 1500); }
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
        clearInterval(vigia);
        document.removeEventListener('visibilitychange', aoVoltarAoApp);
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (wake) { try { wake.release(); } catch (e) { /* */ } }
        ov.remove();
        // libera a memória das pré-visualizações (antes, uma visita com muitas fotos esgotava a memória do iPhone)
        sessao.forEach((f) => { try { if (/^blob:/.test(f.url)) URL.revokeObjectURL(f.url); } catch (e) { /* */ } });
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
        // câmera combinada (com grande angular) já reconhecida neste celular: abre direto nela
        let inicial = null;
        const rot = ls.get('cam_principal');
        if (rot) { try { const d = (await navigator.mediaDevices.enumerateDevices()).find((x) => x.kind === 'videoinput' && x.label === rot); if (d) inicial = d.deviceId; } catch (e) { /* */ } }
        try { await abrirStream(inicial); } catch (e) { if (!inicial) throw e; await abrirStream(); }
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
