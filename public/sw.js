/* Service worker — makes the app installable and keeps it running if the network drops mid-test.
 *
 *  - App shell (HTML/CSS/JS/icons): precached, network-first so updates show immediately, cache when offline.
 *  - CDN assets (fonts, KaTeX, Desmos): cached on first use, stale-while-revalidate.
 *  - /api/*: always network — start codes and results must really reach the server.
 *
 * Bump VERSION whenever you change files in /public so clients pick up the update.
 */
const VERSION = 'v39';
const SHELL_CACHE = `bb-shell-${VERSION}`;
const RUNTIME_CACHE = `bb-runtime-${VERSION}`;

const SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/config.js',
  '/js/icons.js',
  '/js/app.js',
  '/js/pwa.js',
  '/img/favicon.svg',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/apple-touch-icon.png',
];

const RUNTIME_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'www.desmos.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('bb-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Fresh files whenever the server is reachable; cached copy when offline. */
function networkFirst(req, cacheName) {
  return fetch(req)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(req, copy));
      }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true }));
}

function staleWhileRevalidate(event, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return;               // never cache API
    if (url.pathname.startsWith('/operator')) return;          // operator panel: always live
    if (url.pathname.startsWith('/manifest.webmanifest')) return;
    if (req.mode === 'navigate') {
      // Test pages ("/", "/2222") all share the same app shell.
      const isTestPage = url.pathname === '/' || url.pathname === '/index.html' || /^\/\d{3,8}\/?$/.test(url.pathname);
      if (!isTestPage) return;
      event.respondWith(
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy));
            }
            return res;
          })
          .catch(() => caches.match('/index.html'))
      );
      return;
    }
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, RUNTIME_CACHE));
  }
});
