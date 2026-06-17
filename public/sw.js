// Tiny service worker for the Screensaver PWA.
//
// Strategy:
//   - install: precache the app shell (everything under /assets/*, plus
//     icons, fonts, SVG, sounds).
//   - fetch (navigations): network-first, fall back to cached /.
//   - fetch (static): cache-first, fall back to network, then cache.
//
// Cache name is versioned via a build-time injection. The constant
// __BUILD_HASH__ is replaced by Vite at build time (see vite.config.ts).
// On schema-breaking changes bump the version prefix.

const CACHE = 'screensaver-v1-' + (typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev');
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/favicon.svg',
  '/casio-f91w.svg',
  '/icons.svg',
  '/fonts/Seven%20Segment.ttf',
  '/fonts/EuroStyle.ttf',
  '/sound/casio-bip.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
  );
  // Activate new SW immediately on first install.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && k.startsWith('screensaver-'))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests: try network, fall back to cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
