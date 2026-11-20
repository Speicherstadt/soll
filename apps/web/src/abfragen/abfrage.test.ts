import { describe, expect, it } from "vitest";
import { behalten, daten } from "./abfrage.ts";

const geladen = { ok: true as const, status: 200, daten: { monat: "2026-10" } };
const ohneNetz = { ok: false as const, status: 0, fehler: "netz" };

describe("behalten", () => {
  it("takes a new answer that loaded", () => {
    expect(behalten(geladen, { ...ohneNetz, letzte: { monat: "2026-09" } })).toEqual(geladen);
  });

  it("keeps the data last loaded through a failed load again, and names the failure", () => {
    const neu = behalten(ohneNetz, geladen);
    expect(neu.ok).toBe(false);
    expect(daten(neu)).toEqual({ monat: "2026-10" });
    // and through a second failure in a row
    expect(daten(behalten({ ok: false, status: 500, fehler: "x" }, neu))).toEqual({
      monat: "2026-10",
    });
  });

  it("has nothing to keep on a first load that failed", () => {
    expect(behalten(ohneNetz, undefined)).toEqual(ohneNetz);
    expect(daten(behalten(ohneNetz, undefined))).toBeUndefined();
  });
});
