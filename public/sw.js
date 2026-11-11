const CACHE_VERSION = "courant-offline-v1";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const OFFLINE_ROUTE = "/offline-practice";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGE_CACHE);
    const response = await fetch(OFFLINE_ROUTE, { headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error("Could not pre-cache the offline practice page.");
    await pages.put(OFFLINE_ROUTE, response.clone());
    await pages.addAll(["/manifest.webmanifest", "/icon.svg"]);

    // Pre-cache the page's own Next.js runtime, scripts and styles so its
    // controls can hydrate after the first install, even before a second visit.
    const html = await response.text();
    const assetPaths = [...new Set([...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)]
      .map(match => match[1].replace(/&amp;/g, "&").split("?")[0])
      .filter(path => path.startsWith("/_next/static/")))];
    const assets = await caches.open(ASSET_CACHE);
    await Promise.allSettled(assetPaths.map(path => assets.add(path)));
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
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  if (request.mode === "navigate" && url.pathname === OFFLINE_ROUTE) {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(OFFLINE_ROUTE, response.clone());
        return response;
      } catch {
        // Ignore Vary headers because the pre-cached install request and a real
        // browser navigation carry different Next.js request headers.
        return (await cache.match(OFFLINE_ROUTE, { ignoreVary: true })) || Response.error();
      }
    })());
  }
});
