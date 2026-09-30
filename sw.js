/* Service worker: guarda o app no aparelho para funcionar sem internet */
const VERSAO = 'notif-v2.8.0';
const ARQUIVOS = [
  './', 'index.html', 'privacidade.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'lib/jszip.min.js', 'js/extenso.js', 'js/docgen.js', 'js/db.js', 'js/foto.js', 'js/camera.js', 'js/sync.js', 'js/app.js',
  'modelos/modelo_contrato.docx', 'modelos/modelo_convenio.docx', 'modelos/modelo_relatorio.docx', 'modelos/modelo_sanadas.docx',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // login Google e servidor: sempre pela rede
  // rede primeiro (para receber atualizacoes), cache se estiver offline
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((resp) => {
      if (resp && resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); }
      return resp;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
