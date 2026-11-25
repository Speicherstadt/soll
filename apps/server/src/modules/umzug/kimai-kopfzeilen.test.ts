import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { kimaiAbrufen } from "./kimai-abruf.ts";
import { sicherHolen } from "./kimai-holen.ts";

// Review S-705: BAULISTE.md S-705 "Zugang … Fehler als Werte mit eigenem Grund"; CLAUDE.md "errors
// as values". The route takes any token up to 500 chars and any user name (Zod) and hands them to
// node:https as header values; a value node:http refuses must become an error value, not a throw.
let server: ReturnType<typeof Bun.serve>;
beforeAll(() => {
  server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.json([]) });
});
afterAll(() => server.stop(true));

const deps = () => ({
  holen: sicherHolen(async () => [{ address: "127.0.0.1", family: 4 }]),
  erlaubt: new Set([`http://kimai.weber.test:${server.port}`]),
});
const zeitraum = { von: "2026-09-01", bis: "2026-09-30" };

describe("review S-705: header values", () => {
  it("a user name outside Latin-1 (Polish Ł) for X-AUTH-USER", async () => {
    const zugang = {
      instanz: `http://kimai.weber.test:${server.port}`,
      token: "t",
      benutzer: "Łukasz",
    };
    let ergebnis: unknown;
    try {
      ergebnis = await kimaiAbrufen(deps(), zugang, zeitraum);
    } catch (e) {
      ergebnis = { geworfen: String(e) };
    }
    expect(ergebnis).toMatchObject({ ok: false });
  });
  it("a token with a line break pasted in", async () => {
    const zugang = {
      instanz: `http://kimai.weber.test:${server.port}`,
      token: "geheim_4711\n",
      benutzer: null,
    };
    let ergebnis: unknown;
    try {
      ergebnis = await kimaiAbrufen(deps(), zugang, zeitraum);
    } catch (e) {
      ergebnis = { geworfen: String(e) };
    }
    expect(ergebnis).toMatchObject({ ok: false });
  });
});
