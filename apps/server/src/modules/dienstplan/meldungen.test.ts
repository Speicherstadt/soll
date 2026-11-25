import { describe, expect, it } from "vitest";
import {
  aenderungsMeldungen,
  type Planstand,
  unterscheidet,
  veroeffentlichungsMeldungen,
} from "./meldungen.ts";

const SPAET: Planstand = {
  standortId: "elbe",
  tag: "2026-11-23",
  beginn: Date.parse("2026-11-23T13:00:00Z"),
  ende: Date.parse("2026-11-23T21:00:00Z"),
  pauseMinuten: 30,
  rolle: "Service",
  nutzerId: "tom",
  veroeffentlichtAm: Date.parse("2026-11-20T09:00:00Z"),
};

describe("aenderungsMeldungen", () => {
  it("tells nobody about a draft, changed or removed", () => {
    const entwurf = { ...SPAET, veroeffentlichtAm: null };
    expect(aenderungsMeldungen(entwurf, { ...entwurf, pauseMinuten: 45 })).toEqual([]);
    expect(aenderungsMeldungen(entwurf, null)).toEqual([]);
  });

  it("tells the person when their published shift changes", () => {
    const spaeter = { ...SPAET, ende: SPAET.ende + 3_600_000 };
    expect(aenderungsMeldungen(SPAET, spaeter)).toEqual([
      {
        art: "geaendert",
        nutzerId: "tom",
        schicht: { tag: "2026-11-23", beginn: SPAET.beginn, ende: spaeter.ende },
      },
    ]);
  });

  it("tells nobody when nothing changed", () => {
    expect(aenderungsMeldungen(SPAET, { ...SPAET, veroeffentlichtAm: 1 })).toEqual([]);
  });

  it("tells the person before and the person after when it moves to someone else", () => {
    expect(aenderungsMeldungen(SPAET, { ...SPAET, nutzerId: "lea" })).toEqual([
      {
        art: "entfaellt",
        nutzerId: "tom",
        schicht: expect.objectContaining({ tag: "2026-11-23" }),
      },
      { art: "neu", nutzerId: "lea", schicht: expect.objectContaining({ tag: "2026-11-23" }) },
    ]);
  });

  it("tells only the one person there is when a shift is opened or filled", () => {
    expect(aenderungsMeldungen(SPAET, { ...SPAET, nutzerId: null }).map((m) => m.art)).toEqual([
      "entfaellt",
    ]);
    expect(
      aenderungsMeldungen({ ...SPAET, nutzerId: null }, SPAET).map((m) => [m.art, m.nutzerId]),
    ).toEqual([["neu", "tom"]]);
    expect(
      aenderungsMeldungen(
        { ...SPAET, nutzerId: null },
        { ...SPAET, nutzerId: null, pauseMinuten: 0 },
      ),
    ).toEqual([]);
  });

  it("tells the person when their published shift is removed, with its old times", () => {
    expect(aenderungsMeldungen(SPAET, null)).toEqual([
      {
        art: "entfaellt",
        nutzerId: "tom",
        schicht: { tag: SPAET.tag, beginn: SPAET.beginn, ende: SPAET.ende },
      },
    ]);
  });
});

describe("unterscheidet", () => {
  it("sees a change in every field a person sees", () => {
    for (const aenderung of [
      { standortId: "anderswo" },
      { tag: "2026-11-24" },
      { beginn: 0 },
      { ende: 0 },
      { pauseMinuten: 0 },
      { rolle: "Küche" },
      { nutzerId: null },
    ])
      expect(unterscheidet(SPAET, { ...SPAET, ...aenderung })).toBe(true);
    expect(unterscheidet(SPAET, { ...SPAET })).toBe(false);
  });
});

describe("veroeffentlichungsMeldungen", () => {
  it("tells each person once, open shifts nobody", () => {
    const meldungen = veroeffentlichungsMeldungen(
      [{ nutzerId: "tom" }, { nutzerId: null }, { nutzerId: "tom" }, { nutzerId: "lea" }],
      { tag: "2026-11-23", kw: 48 },
    );
    expect(meldungen).toEqual([
      { art: "veroeffentlicht", nutzerId: "tom", tag: "2026-11-23", kw: 48 },
      { art: "veroeffentlicht", nutzerId: "lea", tag: "2026-11-23", kw: 48 },
    ]);
  });
});
