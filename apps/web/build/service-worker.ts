import { createHash } from "node:crypto";
import type { Plugin } from "vite";

/**
 * The service worker caches the whole static build, so the app opens and clocks in without a network
 * (CLAUDE.md: "the static build is cached whole by the service worker"). The API is never cached;
 * the offline queue for clocking in comes with S-305.
 */
export const serviceWorkerSource = (files: readonly string[]): string => {
  const urls = ["/", ...files.map((file) => `/${file}`)].sort();
  const version = createHash("sha256").update(urls.join("\n")).digest("hex").slice(0, 16);
  return `// Generated at build time by apps/web/build/service-worker.ts
const CACHE = "soll-${version}";
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
});
`;
};

/** Writes sw.js next to the build with every emitted file in its precache list */
export const serviceWorker = (): Plugin => ({
  name: "soll-service-worker",
  apply: "build",
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle).filter(
      (file) => !file.endsWith(".map") && file !== "index.html",
    );
    this.emitFile({ type: "asset", fileName: "sw.js", source: serviceWorkerSource(files) });
  },
});
