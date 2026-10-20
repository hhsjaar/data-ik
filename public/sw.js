/* Service worker Data IK.
 * Data berisi informasi intelijen, jadi SENGAJA minimal:
 *  - Hanya aset statis ber-hash (/_next/static) dan ikon yang disimpan (cache-first).
 *  - Halaman beraut/berisi data TIDAK pernah disimpan; navigasi selalu lewat jaringan.
 *  - /api/* tidak pernah disentuh.
 *  - Bila offline, tampilkan /offline (halaman statis tanpa data).
 */
const VERSION = "v1";
const STATIC = "dataik-static-" + VERSION;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.add(new Request(new URL(OFFLINE, self.location.origin).href, { cache: "reload" })))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("dataik-") && k !== STATIC).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // data & autentikasi: selalu jaringan

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(STATIC);
          return (await cache.match(OFFLINE)) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
      })(),
    );
  }
});
