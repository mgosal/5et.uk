const SHELL = "5et-shell-v1";
const APP_FILES = ["./", "index.html", "app.css", "app.js", "icon.svg", "manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith(".md")) {
    const stableKey = new Request(`${url.origin}${url.pathname}`);
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(SHELL).then(cache => cache.put(stableKey, copy)); return response;
    }).catch(() => caches.match(stableKey)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

// 🤖 Last AI edit: 2026-08-26 18:05 · gpt-5 · ~30k in / ~10k out · ~$0.45
// Log: ../../../Compliance/_data/ai-observability-log.md#session-20260826-pwa-frame-renderer
