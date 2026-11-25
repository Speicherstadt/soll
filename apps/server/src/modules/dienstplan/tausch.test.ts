import { describe, expect, it } from "vitest";
import {
  abgelaufen,
  gemeint,
  istOffen,
  nochAngeboten,
  sichtbarFuer,
  type Tausch,
  tauschMeldungen,
  ueberschneiden,
} from "./tausch.ts";

/* The shift swap as pure functions (S-504) */

const tausch = (felder: Partial<Tausch> = {}): Tausch => ({
  betriebId: "elbblick",
  tauschId: "t1",
  schichtId: "s1",
  anbieterId: "tom",
  anNutzerId: null,
  uebernehmerId: null,
  status: "offen",
  grund: null,
  angebotenAm: 0,
  uebernommenAm: null,
  entschiedenVon: null,
  entschiedenAm: null,
  ...felder,
});

const schicht = { schichtId: "s1", tag: "2026-11-23", beginn: 1_000, ende: 2_000 };

describe("a swap", () => {
  it("is open while offered or taken, not once decided", () => {
    expect(istOffen(tausch())).toBe(true);
    expect(istOffen(tausch({ status: "uebernommen" }))).toBe(true);
    for (const status of ["freigegeben", "abgelehnt", "zurueckgezogen", "hinfaellig"] as const)
      expect(istOffen(tausch({ status }))).toBe(false);
  });

  it("expires the moment its shift begins", () => {
    expect(abgelaufen(schicht, 999)).toBe(false);
    expect(abgelaufen(schicht, 1_000)).toBe(true);
  });

  it("holds only while the shift is published and still the offerer's", () => {
    const veroeffentlicht = { ...schicht, nutzerId: "tom", veroeffentlichtAm: 5 };
    expect(nochAngeboten(tausch(), veroeffentlicht)).toBe(true);
    expect(nochAngeboten(tausch(), { ...veroeffentlicht, nutzerId: "lea" })).toBe(false);
    expect(nochAngeboten(tausch(), { ...veroeffentlicht, veroeffentlichtAm: null })).toBe(false);
    expect(nochAngeboten(tausch(), undefined)).toBe(false);
  });
});

describe("who an offer is meant for and who sees it", () => {
  it("means everyone who can take it, never the offerer", () => {
    expect(gemeint(tausch(), "yusuf", true)).toBe(true);
    expect(gemeint(tausch(), "yusuf", false)).toBe(false);
    expect(gemeint(tausch(), "tom", true)).toBe(false);
  });

  it("keeps an offer to a named colleague between the two", () => {
    const an = tausch({ anNutzerId: "yusuf" });
    expect(sichtbarFuer(an, "yusuf", true)).toBe(true);
    expect(sichtbarFuer(an, "tom", true)).toBe(true);
    expect(sichtbarFuer(an, "olena", true)).toBe(false);
  });

  it("shows a decided swap only to its parties", () => {
    const entschieden = tausch({ status: "abgelehnt", uebernehmerId: "yusuf", grund: "Inventur" });
    expect(sichtbarFuer(entschieden, "yusuf", true)).toBe(true);
    expect(sichtbarFuer(entschieden, "tom", true)).toBe(true);
    expect(sichtbarFuer(entschieden, "olena", true)).toBe(false);
  });
});

describe("overlapping shifts", () => {
  it("overlap when one begins before the other ends; touching ends do not", () => {
    expect(ueberschneiden({ beginn: 0, ende: 10 }, { beginn: 9, ende: 20 })).toBe(true);
    expect(ueberschneiden({ beginn: 0, ende: 10 }, { beginn: 10, ende: 20 })).toBe(false);
    expect(ueberschneiden({ beginn: 5, ende: 6 }, { beginn: 0, ende: 20 })).toBe(true);
  });
});

describe("the messages of a swap", () => {
  it("tell whoever an offer is meant for", () => {
    expect(tauschMeldungen("angeboten", tausch(), schicht, { gemeint: ["yusuf", "lea"] })).toEqual([
      { art: "angeboten", nutzerId: "yusuf", schicht },
      { art: "angeboten", nutzerId: "lea", schicht },
    ]);
  });

  it("tell the offerer of a takeover and whoever approves, the offerer once", () => {
    const genommen = tausch({ status: "uebernommen", uebernehmerId: "yusuf" });
    expect(
      tauschMeldungen("uebernommen", genommen, schicht, { freigebende: ["mia", "lea", "tom"] }),
    ).toEqual([
      { art: "uebernommen", nutzerId: "tom", schicht },
      { art: "freigabe", nutzerId: "mia", schicht },
      { art: "freigabe", nutzerId: "lea", schicht },
    ]);
  });

  it("tell both parties of an approval or refusal, the taker of a withdrawal", () => {
    const genommen = tausch({ uebernehmerId: "yusuf" });
    for (const schritt of ["freigegeben", "abgelehnt"] as const)
      expect(tauschMeldungen(schritt, genommen, schicht).map((m) => m.nutzerId)).toEqual([
        "tom",
        "yusuf",
      ]);
    expect(tauschMeldungen("zurueckgezogen", genommen, schicht)).toEqual([
      { art: "zurueckgezogen", nutzerId: "yusuf", schicht },
    ]);
    expect(tauschMeldungen("zurueckgezogen", tausch(), schicht)).toEqual([]);
    expect(tauschMeldungen("abgelehnt", tausch(), schicht).map((m) => m.nutzerId)).toEqual(["tom"]);
  });
});
