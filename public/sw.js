// Cache-first za rendere. Ime keša nosi hash iz renders-manifest.json (?v=<hash> u URL-u skripte).
const V = new URL(self.location.href).searchParams.get('v') || '0';
const RENDERS = `piramida-renders-${V}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('piramida-') && k !== RENDERS) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !/\/renders(-\d+)?\/.+\.webp$/.test(url.pathname)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(RENDERS);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })(),
  );
});
