import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { temporaerOrdner } from "./test-ordner.ts";
import { testServer } from "./test-server.ts";
import { webAuslieferung } from "./web.ts";

/** A small stand-in for the static build of apps/web, next to a secret that lies outside it */
const testBuild = () => {
  const ordner = temporaerOrdner("soll-web-");
  const web = join(ordner, "web");
  mkdirSync(join(web, "assets"), { recursive: true });
  writeFileSync(join(web, "index.html"), "<!doctype html><title>Soll</title>");
  writeFileSync(join(web, "sw.js"), "self.addEventListener('fetch', () => {});");
  writeFileSync(join(web, "manifest.webmanifest"), '{"name":"Soll"}');
  writeFileSync(join(web, "assets", "index-AbC123.js"), "console.log('soll');");
  writeFileSync(join(ordner, "soll.db"), "geheime Daten");
  return web;
};

const appMit = (web: string) => new Hono().get("*", webAuslieferung(web));

describe("webAuslieferung", () => {
  it("serves the index at / and never caches it", async () => {
    const res = await appMit(testBuild()).request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("<title>Soll</title>");
  });

  it("serves a file of the build with its type; hashed assets are cached for good", async () => {
    const res = await appMit(testBuild()).request("/assets/index-AbC123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await res.text()).toBe("console.log('soll');");
  });

  it("never caches the service worker, so a new build reaches every device", async () => {
    const res = await appMit(testBuild()).request("/sw.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("answers a route of the app without a file extension with the index (SPA)", async () => {
    const app = appMit(testBuild());
    for (const pfad of ["/heute", "/pruefen/weber/2026-10", "/einladung/abc"]) {
      const res = await app.request(pfad);
      expect(res.status, pfad).toBe(200);
      expect(await res.text(), pfad).toContain("<title>Soll</title>");
    }
  });

  it("answers a missing file with an extension with 404, not the index", async () => {
    const res = await appMit(testBuild()).request("/assets/fehlt-123.js");
    expect(res.status).toBe(404);
  });

  it("serves nothing outside its directory, also with encoded dots", async () => {
    const app = appMit(testBuild());
    for (const pfad of ["/../soll.db", "/%2e%2e/soll.db", "/assets/%2e%2e/%2e%2e/soll.db"]) {
      const res = await app.request(`http://localhost${pfad}`);
      expect(await res.text(), pfad).not.toContain("geheime Daten");
    }
  });

  it("never answers a path under /api or /health with the app", async () => {
    const app = appMit(testBuild());
    expect((await app.request("/api/v2/unbekannt")).status).toBe(404);
    expect((await app.request("/api")).status).toBe(404);
    expect((await app.request("/healthz")).status).toBe(200);
  });
});

describe("the app with SOLL_WEB_DIR", () => {
  it("serves the build next to the API; /health and unknown API paths stay the API's", async () => {
    const { app } = testServer({ webVerzeichnis: testBuild() });
    expect(await (await app.request("/health")).json()).toMatchObject({ status: "ok" });
    expect(await (await app.request("/heute")).text()).toContain("<title>Soll</title>");
    const api = await app.request("/api/v9/gibt-es-nicht");
    expect(api.status).toBe(404);
    expect(await api.text()).not.toContain("<title>Soll</title>");
  });

  it("serves no app without SOLL_WEB_DIR (development: Vite serves it)", async () => {
    const { app } = testServer();
    expect((await app.request("/heute")).status).toBe(404);
  });
});
