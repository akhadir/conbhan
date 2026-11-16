// Conbhan service worker — app shell caching with offline navigation fallback.

const CACHE_NAME = 'conbhan-v2';
const SHELL = ['./index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL);
      try {
        const response = await fetch(new URL('assets/manifest.json', self.registration.scope));
        const manifest = await response.json();
        const files = Object.values(manifest).flatMap((entry) =>
          [entry && entry.file, ...(Array.isArray(entry && entry.css) ? entry.css : [])].filter(Boolean),
        );
        if (files.length) await cache.addAll(files);
      } catch (error) {
        console.warn('Conbhan: could not precache build manifest', error);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('./index.html');
          if (cached) return cached;
          throw new Error('Offline: no cached Conbhan shell is available');
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      if (response) return response;
      return fetch(request).then(async (response) => {
        if (response && response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, copy);
        }
        return response;
      });
    }),
  );
});
