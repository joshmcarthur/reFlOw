const CACHE_NAME = "flow-ruffle-v2";

const PRECACHE_URLS = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

function isGameAssetRequest(url) {
  return url.pathname.includes("/game/");
}

function isAppShellRequest(url) {
  if (url.pathname.includes("/assets/")) {
    return true;
  }

  if (url.pathname.endsWith("/sw.js")) {
    return true;
  }

  if (url.pathname.includes("/ruffle/")) {
    return true;
  }

  if (url.pathname.endsWith("/manifest.webmanifest")) {
    return true;
  }

  return url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isGameAssetRequest(url)) {
    // Game assets: network-first so audio/SWF updates are not stuck behind cache.
    event.respondWith(networkFirst(request));
    return;
  }

  if (isAppShellRequest(url)) {
    // App shell: network-first so deploys are not stuck behind stale HTML/JS.
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
