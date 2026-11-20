import { describe, expect, it } from "vitest";
import { entkoppelt, meldungAus } from "./meldung.ts";

const abgelehnt = (status: number, fehler: string, koerper?: unknown) =>
  ({ ok: false, status, fehler, koerper }) as const;

describe("messages of the kiosk", () => {
  it("names the tries left and the end of a lock", () => {
    expect(meldungAus(abgelehnt(401, "unbekannt", { fehler: "unbekannt", rest: 3 }))).toEqual({
      art: "unbekannt",
      rest: 3,
    });
    expect(meldungAus(abgelehnt(423, "gesperrt", { gesperrtBis: 99 }))).toEqual({
      art: "gesperrt",
      bis: 99,
    });
  });

  it("tells no network, a module off, a closed month and anything else apart", () => {
    expect(meldungAus(abgelehnt(0, "netz"))).toEqual({ art: "netz" });
    expect(meldungAus(abgelehnt(403, "modul_aus"))).toEqual({ art: "modul_aus" });
    expect(meldungAus(abgelehnt(409, "abgeschlossen"))).toEqual({ art: "abgeschlossen" });
    expect(meldungAus(abgelehnt(500, "x"))).toEqual({ art: "fehler" });
    expect(meldungAus({ ok: true, status: 200, daten: null })).toBeNull();
  });

  it("knows a revoked device", () => {
    expect(entkoppelt(abgelehnt(401, "terminal_unbekannt"))).toBe(true);
    expect(entkoppelt(abgelehnt(401, "unbekannt"))).toBe(false);
  });
});
