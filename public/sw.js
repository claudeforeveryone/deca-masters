// DECA Masters offline shell. Registered by src/lib/pwa.ts in production builds only.
//   * Pages: network first. Offline, the plain app shell (/app) opens instead, and each page says what it cannot load.
//   * Built files under /assets/ have hashed names, so they are cached on first use and served from the cache.
//   * Public content under /content/ is network first, with the last copy kept for offline reading.
//   * Nothing else is touched: Supabase (accounts, progress, anything personal) is another origin and always goes to
//     the network, and same-origin API-looking paths are skipped too. No member data is ever cached here.
const VERSION = "v1";
const SHELL = `deca-shell-${VERSION}`;
const ASSETS = `deca-assets-${VERSION}`;
const CONTENT = `deca-content-${VERSION}`;
const KEEP = [SHELL, ASSETS, CONTENT];
const SKIP = /^\/(auth|rest|functions|storage|realtime|graphql)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      const res = await fetch("/app", { cache: "no-cache" });
      if (!res.ok) throw new Error(`sw: /app returned ${res.status}`);
      const html = await res.clone().text();
      await shell.put("/app", res);
      // The shell's own scripts and styles, so it can start with no connection at all.
      const files = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
        (m) => m[1],
      );
      const assets = await caches.open(ASSETS);
      await assets.addAll([...new Set(files)]);
      await shell.addAll([
        "/manifest.webmanifest",
        "/favicon.svg",
        "/icons/icon-192.png",
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || SKIP.test(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        async () =>
          (await caches.match("/app", { cacheName: SHELL })) ??
          Response.error(),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req, { cacheName: ASSETS });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(ASSETS)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/content/")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(CONTENT)).put(req, res.clone());
          return res;
        } catch (err) {
          const hit = await caches.match(req, { cacheName: CONTENT });
          if (hit) return hit;
          throw err;
        }
      })(),
    );
  }
});
