import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";

/**
 * The service worker caches the whole static build, so the app opens and clocks in without a network
 * (CLAUDE.md: "the static build is cached whole by the service worker"). The API is never cached;
 * the offline queue for clocking in comes with S-305. A push message of the server (S-307) becomes a
 * notification, and a tap on it opens the page it names, only of the app's own origin.
 */
export const serviceWorkerSource = (files: readonly string[], revision = ""): string => {
  const urls = ["/", ...files.map((file) => `/${file}`)].sort();
  const version = createHash("sha256")
    .update(urls.join("\n"))
    .update(revision)
    .digest("hex")
    .slice(0, 16);
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
  // ignoreVary: a module script asks with an Origin header that the precache request lacked, so a
  // server that answers with "Vary: Origin" (vite preview, CORS middleware) would never hit the cache
  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((hit) => hit ?? fetch(event.request)),
  );
});

// A reminder of the server (S-307): title, text, the page to open and a tag, so a second one of the
// same kind replaces the first instead of piling up
self.addEventListener("push", (event) => {
  let daten = null;
  try {
    daten = event.data ? event.data.json() : null;
  } catch {
    daten = null;
  }
  if (!daten || typeof daten.titel !== "string") return;
  event.waitUntil(
    self.registration.showNotification(daten.titel, {
      body: typeof daten.text === "string" ? daten.text : "",
      tag: typeof daten.tag === "string" ? daten.tag : undefined,
      icon: "/icon.svg",
      dir: "auto",
      data: { ziel: typeof daten.ziel === "string" ? daten.ziel : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = new URL((event.notification.data && event.notification.data.ziel) || "/", self.location.origin);
  if (ziel.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      const offen = fenster.find((f) => new URL(f.url).origin === self.location.origin);
      if (!offen) return self.clients.openWindow(ziel.href);
      return offen.focus().then((f) => f.navigate(ziel.href));
    }),
  );
});
`;
};

/** The files under public/ that Vite copies into the build as they are, with their content */
const publicFiles = (dir: string | false): { file: string; content: Buffer }[] =>
  dir && existsSync(dir)
    ? readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(entry.parentPath, entry.name))
        .map((path) => ({
          file: relative(dir, path).split(sep).join("/"),
          content: readFileSync(path),
        }))
    : [];

/**
 * Writes sw.js next to the build with every emitted file and every copied public file in its
 * precache list. The public files and index.html keep their names across builds, so their content
 * goes into the cache name: a changed manifest or start page replaces the old cache.
 */
export const serviceWorker = (): Plugin => {
  let publicDir: string | false = false;
  return {
    name: "soll-service-worker",
    apply: "build",
    configResolved(config) {
      publicDir = config.build.copyPublicDir ? config.publicDir : false;
    },
    generateBundle(_options, bundle) {
      const copied = publicFiles(publicDir);
      const emitted = Object.keys(bundle).filter(
        (file) => !file.endsWith(".map") && file !== "index.html",
      );
      const index = bundle["index.html"];
      const revision = createHash("sha256");
      if (index?.type === "asset") revision.update(index.source);
      for (const { file, content } of copied) revision.update(file).update(content);
      const files = [...emitted, ...copied.map(({ file }) => file)];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: serviceWorkerSource(files, revision.digest("hex")),
      });
    },
  };
};
