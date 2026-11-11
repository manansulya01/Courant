const CACHE_VERSION = "courant-offline-v1";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_ROUTE = "/offline-practice";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGE_CACHE);
    await cache.addAll([OFFLINE_ROUTE, "/manifest.webmanifest"]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("courant-offline-") && ![PAGE_CACHE, ASSET_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login") || url.pathname.startsWith("/signup")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === "navigate" && url.pathname === OFFLINE_ROUTE) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(OFFLINE_ROUTE, response.clone());
        return response;
      } catch {
        return (await cache.match(OFFLINE_ROUTE)) || Response.error();
      }
    })());
  }
});
