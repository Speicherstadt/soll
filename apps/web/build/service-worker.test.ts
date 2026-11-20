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

  it("never answers the API or /health from the cache", () => {
    const source = serviceWorkerSource([]);
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname === "/health"');
  });
});
