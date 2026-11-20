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
      expect(precache).toEqual(["/", ...written.map((file) => `/${file}`)].sort());
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
