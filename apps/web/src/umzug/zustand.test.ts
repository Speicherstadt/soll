import { describe, expect, it } from "vitest";
import type { Vorschau } from "./typen.ts";
import { base64Von, letzterAbschliessbarer, spaltenwahl, zuordnungAus } from "./zustand.ts";

describe("the move page", () => {
  it("writes a file's bytes as base64, also a large one", () => {
    const text = "Typ;Kennung\nzeit;z-1;Sandra Kühn\n";
    const bytes = new TextEncoder().encode(text);
    expect(base64Von(bytes)).toBe(Buffer.from(text).toString("base64"));
    const gross = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(base64Von(gross)).toBe(Buffer.from(gross).toString("base64"));
  });

  it("proposes the mapping of a preview: members, kinds, everything else anew", () => {
    const vorschau = {
      personen: [
        { person: "Sandra", datensaetze: 3, vorschlag: "s" },
        { person: "Leon", datensaetze: 1, vorschlag: null },
      ],
      arten: [{ art: "Urlaub", datensaetze: 1, vorschlag: "urlaub" }],
      kunden: [{ externalId: "k-1", name: "Elbhof", nummer: "" }],
      projekte: [{ externalId: "p-1", name: "Bad", nummer: "", kunde: "k-1" }],
      taetigkeiten: [{ externalId: "401", name: "Montage" }],
    } as Vorschau;
    expect(zuordnungAus(vorschau)).toEqual({
      personen: { Sandra: "s", Leon: null },
      arten: { Urlaub: "urlaub" },
      kunden: { "k-1": "neu" },
      projekte: { "p-1": "neu" },
      taetigkeiten: { "401": "neu" },
    });
  });

  it("sends the column of each field that has one", () => {
    expect(spaltenwahl({ person: "Wer", datum: "Datum", typ: null })).toEqual({
      person: "Wer",
      datum: "Datum",
    });
  });

  it("lets the old tool have closed months up to the one before the running one", () => {
    expect(letzterAbschliessbarer("2026-11-25")).toBe("2026-10");
    expect(letzterAbschliessbarer("2027-01-01")).toBe("2026-12");
  });
});
