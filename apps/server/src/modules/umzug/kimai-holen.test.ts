import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Aufloesen, MAX_ANTWORT, sicherHolen } from "./kimai-holen.ts";

/*
 * The guarded GET to an instance the owner typed (BAULISTE.md S-705): the addresses a name resolves
 * to are checked when the connection is made, redirects are not followed, a large answer is cut.
 * The DNS is a stand-in that maps every name to the test server on 127.0.0.1.
 */

let server: ReturnType<typeof Bun.serve>;
const anfragen: string[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (anfrage) => {
      const pfad = new URL(anfrage.url).pathname;
      anfragen.push(pfad);
      if (pfad === "/weiter")
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/" },
        });
      if (pfad === "/gross") return new Response("x".repeat(MAX_ANTWORT + 1));
      return Response.json(
        { host: anfrage.headers.get("host"), token: anfrage.headers.get("authorization") },
        { headers: { "X-Total-Pages": "3" } },
      );
    },
  });
});
afterAll(() => server.stop(true));

const nach =
  (adressen: string[]): Aufloesen =>
  async () =>
    adressen.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));

const url = (pfad: string) => new URL(`http://kimai.weber.test:${server.port}${pfad}`);

describe("sicherHolen", () => {
  it("connects to the address the lookup gave and reads the answer", async () => {
    const holen = sicherHolen(nach(["127.0.0.1"]));
    const ergebnis = await holen(url("/api/x"), { Authorization: "Bearer t" }, false);
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.wert.status).toBe(200);
    expect(ergebnis.wert.kopf("X-Total-Pages")).toBe("3");
    expect(JSON.parse(ergebnis.wert.text)).toEqual({
      host: `kimai.weber.test:${server.port}`,
      token: "Bearer t",
    });
  });

  it("refuses a name that resolves to a private address, before anything is sent", async () => {
    anfragen.length = 0;
    const holen = sicherHolen(nach(["127.0.0.1"]));
    expect(await holen(url("/api/geheim"), {}, true)).toEqual({
      ok: false,
      grund: "adresse_intern",
    });
    expect(anfragen).toEqual([]);
  });

  it("refuses a name when any one of its addresses is not public", async () => {
    const holen = sicherHolen(nach(["93.184.215.14", "10.0.0.5"]));
    expect(await holen(url("/api/x"), {}, true)).toEqual({ ok: false, grund: "adresse_intern" });
  });

  it("refuses an address typed as such that is not public", async () => {
    const holen = sicherHolen(nach([]));
    const direkt = new URL(`http://127.0.0.1:${server.port}/api/x`);
    expect(await holen(direkt, {}, true)).toEqual({ ok: false, grund: "adresse_intern" });
    expect(await holen(new URL("https://[::ffff:169.254.169.254]/"), {}, true)).toEqual({
      ok: false,
      grund: "adresse_intern",
    });
  });

  it("follows no redirect", async () => {
    const holen = sicherHolen(nach(["127.0.0.1"]));
    expect(await holen(url("/weiter"), {}, false)).toEqual({ ok: false, grund: "weiterleitung" });
  });

  it("cuts an answer larger than 10 MiB", async () => {
    const holen = sicherHolen(nach(["127.0.0.1"]));
    expect(await holen(url("/gross"), {}, false)).toEqual({ ok: false, grund: "zu_gross" });
  });

  it("calls a name the DNS does not know unreachable", async () => {
    const holen = sicherHolen(async () => {
      throw new Error("ENOTFOUND");
    });
    expect(await holen(url("/api/x"), {}, true)).toEqual({ ok: false, grund: "nicht_erreichbar" });
  });
});
