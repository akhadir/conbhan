// Conbhan service worker — app shell caching with offline navigation fallback.

const CACHE_NAME = 'conbhan-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL);
      const response = await fetch(new URL('assets/manifest.json', self.registration.scope));
      const manifest = await response.json();
      await cache.addAll(Object.values(manifest).map((entry) => entry.file));
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
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cached = await caches.match('./index.html');
          if (!cached) throw new Error('Offline: no cached Conbhan shell is available');
          return cached;
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      if (response) return response;
      return fetch(request).then(async (response) => {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, copy);
        return response;
      });
    }),
  );
});
