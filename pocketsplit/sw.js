/*
 * PocketSplit service worker.
 * Caches the application shell so the app opens with no internet connection.
 * It never handles, reads, or uploads financial data: all records live in IndexedDB.
 *
 * When you change any file, bump CACHE_VERSION (e.g. v1.0.1) so installed apps update.
 */
const CACHE_VERSION = 'pocketsplit-v1.0.0';
const CACHE_NAME = CACHE_VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/utils.js',
  './assets/js/db.js',
  './assets/js/components.js',
  './assets/js/backup.js',
  './assets/js/views/dashboard.js',
  './assets/js/views/expenses.js',
  './assets/js/views/workers.js',
  './assets/js/views/reports.js',
  './assets/js/views/backup.js',
  './assets/js/views/more.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon-180.png',
  './assets/icons/apple-touch-icon-152.png',
  './assets/icons/apple-touch-icon-167.png',
  './assets/icons/splash-828x1792.png',
  './assets/icons/splash-1170x2532.png',
  './assets/icons/splash-1284x2778.png',
  './assets/icons/splash-750x1334.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('pocketsplit-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

function isSameOrigin(url) {
  return new URL(url, self.location.href).origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!isSameOrigin(request.url)) return;

  // App navigations: try the network, fall back to the cached shell (offline).
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request, { ignoreSearch: true }))
          || (await cache.match('./index.html'))
          || (await cache.match('./'))
          || new Response(
            '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PocketSplit</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F1E7;color:#17251C;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;text-align:center}div{max-width:340px}h1{font-size:22px}p{color:#5F6C61;line-height:1.6}</style><div><h1>PocketSplit is offline</h1><p>The app could not load its cached files. Connect to the internet once, open PocketSplit, then it will work offline again. Your saved records are still on this device.</p></div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
      }
    })());
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const fallback = await cache.match(request, { ignoreSearch: true });
      if (fallback) return fallback;
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
