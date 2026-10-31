// Offline service worker (template; seo.mjs writes dist/sw.js with the version and precache list). Same-origin GET only.
// Shell + index precached; chapter files (index/pass, index/faq), covers and pages are cached as visited.
// shortcut: no entry cap on visited files (whole corpus ~6 MB), add an LRU trim if the corpus grows a lot.
const V = "ijodel-offline-__VER__", PRE = [/*PRE*/];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(PRE))));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ijodel-offline-") && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });
const put = (q, r) => { if (r.ok && r.type === "basic" && !r.redirected) { const c = r.clone(); caches.open(V).then((x) => x.put(q, c)); } return r; };
self.addEventListener("fetch", (e) => {
  const q = e.request, u = new URL(q.url);
  if (q.method !== "GET" || u.origin !== location.origin || /\.(bin|wasm)$/.test(u.pathname) || u.pathname.endsWith("/sw.js")) return; // vectors/model stay under the model consent
  if (q.mode === "navigate") return e.respondWith(fetch(q).then((r) => put(q, r)).catch(() => caches.match(q, { ignoreSearch: true }).then((r) => r || caches.match("./"))));
  if (u.pathname.includes("/assets/")) return e.respondWith(caches.match(q).then((r) => r || fetch(q).then((r) => put(q, r)))); // hashed names: immutable
  e.respondWith(fetch(q).then((r) => put(q, r)).catch(() => caches.match(q).then((r) => r || Response.error())));
});
