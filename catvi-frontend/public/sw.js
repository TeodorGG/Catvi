// Retirement worker: old installations clear CATVI caches and unregister.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.toLowerCase().startsWith('catvi')) await caches.delete(key);
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
