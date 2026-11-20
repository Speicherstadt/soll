import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { spawnSync } from "bun";
import { describe, expect, it } from "vitest";
import { serviceWorkerSource } from "./service-worker.ts";

const precacheOf = (source: string): string[] =>
  JSON.parse(source.match(/const PRECACHE = (\[.*\]);/)?.[1] ?? "[]");

describe("serviceWorkerSource", () => {
  it("precaches the start page and every file of the build", () => {
    const source = serviceWorkerSource(["assets/index-abc.js", "assets/index-def.css"]);
    expect(precacheOf(source)).toEqual(["/", "/assets/index-abc.js", "/assets/index-def.css"]);
  });

  it("names the cache after the files, so a new build replaces the old cache", () => {
    const a = serviceWorkerSource(["assets/a.js"]);
    const b = serviceWorkerSource(["assets/b.js"]);
    expect(a.match(/soll-[0-9a-f]+/)?.[0]).not.toBe(b.match(/soll-[0-9a-f]+/)?.[0]);
    expect(serviceWorkerSource(["assets/a.js"])).toBe(a);
  });

  it("changes the cache name when content changes under the same file names", () => {
    const cacheOf = (source: string) => source.match(/soll-[0-9a-f]+/)?.[0];
    const files = ["manifest.webmanifest"];
    expect(cacheOf(serviceWorkerSource(files, "a"))).not.toBe(
      cacheOf(serviceWorkerSource(files, "b")),
    );
  });

  it("never answers the API or /health from the cache", () => {
    const source = serviceWorkerSource([]);
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname === "/health"');
  });
});

type Handler = (event: Record<string, unknown>) => void;

/** Runs the worker's source against a stand-in for `self`, and collects what it does */
const worker = (fenster: { url: string }[] = []) => {
  const handler = new Map<string, Handler>();
  const gezeigt: { titel: string; optionen: Record<string, unknown> }[] = [];
  const geoeffnet: string[] = [];
  const navigiert: string[] = [];
  const self = {
    location: { origin: "https://soll.example.test" },
    addEventListener: (name: string, h: Handler) => handler.set(name, h),
    registration: {
      showNotification: async (titel: string, optionen: Record<string, unknown>) => {
        gezeigt.push({ titel, optionen });
      },
    },
    clients: {
      matchAll: async () =>
        fenster.map((f) => ({
          ...f,
          focus: async () => ({ navigate: async (url: string) => navigiert.push(url) }),
        })),
      openWindow: async (url: string) => geoeffnet.push(url),
    },
  };
  new Function("self", "caches", serviceWorkerSource([]))(self, {});
  let warten: Promise<unknown> = Promise.resolve();
  const senden = (name: string, event: Record<string, unknown>) => {
    handler.get(name)?.({
      ...event,
      waitUntil: (p: Promise<unknown>) => {
        warten = p;
      },
    });
    return warten;
  };
  return { senden, gezeigt, geoeffnet, navigiert };
};

const nachricht = (daten: unknown) => ({ data: { json: () => daten } });

describe("notifications of the service worker (S-307)", () => {
  it("shows a reminder from a push message with its text, tag and page", async () => {
    const w = worker();
    await w.senden(
      "push",
      nachricht({ titel: "Pause fällig", text: "Um 14:00 Uhr …", ziel: "/", tag: "pause" }),
    );
    expect(w.gezeigt).toEqual([
      {
        titel: "Pause fällig",
        optionen: {
          body: "Um 14:00 Uhr …",
          tag: "pause",
          icon: "/icon.svg",
          dir: "auto",
          data: { ziel: "/" },
        },
      },
    ]);
  });

  it("shows nothing for a message it cannot read", async () => {
    const w = worker();
    await w.senden("push", { data: { json: () => JSON.parse("kein json") } });
    await w.senden("push", nachricht({ text: "ohne Titel" }));
    await w.senden("push", { data: null });
    expect(w.gezeigt).toEqual([]);
  });

  it("opens the page of the reminder, in an open window of the app or a new one", async () => {
    const klick = (ziel: unknown) => ({ notification: { close: () => undefined, data: { ziel } } });
    const neu = worker();
    await neu.senden("notificationclick", klick("/monat"));
    expect(neu.geoeffnet).toEqual(["https://soll.example.test/monat"]);
    const offen = worker([{ url: "https://soll.example.test/zeiten" }]);
    await offen.senden("notificationclick", klick("/"));
    expect(offen.navigiert).toEqual(["https://soll.example.test/"]);
    expect(offen.geoeffnet).toEqual([]);
    const fremd = worker();
    await fremd.senden("notificationclick", klick("https://fremd.example.test/"));
    expect(fremd.geoeffnet).toEqual([]);
  });
});

describe("service worker of a real build", () => {
  it("precaches every file the build writes, the public files included", () => {
    const outDir = mkdtempSync(join(tmpdir(), "soll-sw-"));
    try {
      const run = spawnSync(["bun", "run", "build", "--outDir", outDir, "--emptyOutDir"], {
        cwd: join(import.meta.dirname, ".."),
        stdout: "ignore",
        stderr: "pipe",
      });
      expect(run.exitCode, run.stderr.toString()).toBe(0);
      const written = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join("/"))
        .filter((file) => file !== "sw.js" && file !== "index.html" && !file.endsWith(".map"));
      const precache = precacheOf(readFileSync(join(outDir, "sw.js"), "utf8"));
      expect(written).toContain("manifest.webmanifest");
      // the pattern page of packages/ui (apps/web/muster.html) is for the tests only
      expect(written.filter((file) => file.includes("muster"))).toEqual([]);
      expect(precache).toEqual(["/", ...written.map((file) => `/${file}`)].sort());
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
