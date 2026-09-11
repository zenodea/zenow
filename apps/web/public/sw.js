const VERSION = "zenow-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;

const PRECACHE = ["/offline", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Anything that can change state, or that identifies you, is never cached. */
function cacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.searchParams.has("_rsc")) return false;
  return !["/api/", "/auth/", "/account/", "/share"].some((prefix) => url.pathname.startsWith(prefix));
}

async function pageThenCache(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // A redirect to the sign-in page is not this page, and must not be stored
    // under its url.
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    if (offline) return offline;
    throw error;
  }
}

async function cacheThenNetwork(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!cacheable(url)) return;

  // Build output is content-hashed, so it can be served from cache for ever.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheThenNetwork(request));
    return;
  }

  if (request.mode === "navigate") event.respondWith(pageThenCache(request));
});
