/* Service worker: guarda o app no aparelho para funcionar sem internet */
const VERSAO = 'notif-v3.5.0';
const ARQUIVOS = [
  './', 'index.html', 'privacidade.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'lib/jszip.min.js', 'js/extenso.js', 'js/docgen.js', 'js/db.js', 'js/foto.js', 'js/camera.js', 'js/sync.js', 'js/app.js',
  'modelos/modelo_contrato.docx', 'modelos/modelo_convenio.docx', 'modelos/modelo_relatorio.docx', 'modelos/modelo_sanadas.docx', 'modelos/modelo_irregularidades.docx',
  'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/poppins-Regular.woff', 'fonts/poppins-Medium.woff', 'fonts/poppins-Bold.woff',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' — não aproveita cópias antigas do cache do navegador ao instalar a versão nova
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // login Google e servidor: sempre pela rede
  // rede primeiro (para receber atualizações); com sinal fraco, depois de 4 s usa a cópia do aparelho
  // (a resposta da rede, se chegar, atualiza a cópia para a próxima vez)
  e.respondWith((async () => {
    const rede = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((resp) => {
      if (resp && resp.ok) { const copia = resp.clone(); e.waitUntil(caches.open(VERSAO).then((c) => c.put(e.request, copia))); }
      return resp;
    });
    rede.catch(() => {}); // se a rede falhar depois de já termos usado a cópia
    const doCache = () => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'));
    let timer;
    const lento = new Promise((res) => { timer = setTimeout(() => res('lento'), 4000); });
    try {
      const r = await Promise.race([rede, lento]);
      if (r !== 'lento') return r;
      const c = await doCache();
      return c || (await rede);
    } catch (err) {
      const c = await doCache();
      if (c) return c;
      throw err;
    } finally { clearTimeout(timer); }
  })());
});

// toque no aviso de prazo: traz o app para frente e abre a notificação
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || '#/notificacoes';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = cs.find((c) => { const p = new URL(c.url).pathname; return p.endsWith('/') || p.endsWith('/index.html'); });
    if (app) { try { await app.focus(); } catch (err) { /* */ } app.postMessage({ hash: alvo }); return; }
    await self.clients.openWindow('./index.html' + alvo);
  })());
});
