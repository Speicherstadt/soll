import { describe, expect, it } from "vitest";
import { nachtMinuten, nachttage } from "./nachtzeit.ts";
import { schicht, tagAb, tage, tageVonBis } from "./testhilfen.ts";
import type { PruefTag } from "./typen.ts";

const NACHT = { von: 23 * 60, bis: 6 * 60 };
const einzig = (liste: PruefTag[]) => liste[0]?.schichten[0];
const minutenVon = (beginn: string, ende: string, spanne = NACHT) =>
  nachtMinuten(einzig(tage(schicht(beginn, ende))) as never, spanne);

/** Nachtarbeit (23:00 – 2:01, 181 minutes in the Nachtzeit) on each of the days */
const naechte = (liste: string[]): PruefTag[] => liste.map((tag) => tagAb(tag, "23:00", 181));

describe("R-06: Nachtzeit and Nachtarbeit (§ 2 Abs. 3 to 5 ArbZG)", () => {
  it("erlaubt: 21:00 – 1:00 has 2:00 in the Nachtzeit and is no Nachtarbeit", () => {
    const [tag] = nachttage(tage(schicht("2026-11-16T21:00+01:00", "2026-11-17T01:00+01:00"))).tage;
    expect(tag).toMatchObject({ tag: "2026-11-16", nachtMinuten: 120, nachtarbeit: false });
    expect(tag?.nummer).toBeNull();
  });

  it("Grenze: 21:00 – 1:01 has 2:01 in the Nachtzeit, Nachtarbeit, a Nachtarbeitstag", () => {
    const [tag] = nachttage(tage(schicht("2026-11-16T21:00+01:00", "2026-11-17T01:01+01:00"))).tage;
    expect(tag).toMatchObject({ nachtMinuten: 121, nachtarbeit: true, nummer: 1 });
  });

  it("Bäckerei: 4:00 – 7:00 in a bakery has 1:00 in the Nachtzeit 22 – 5 and is no Nachtarbeit", () => {
    const tag = tage(schicht("2026-11-16T04:00+01:00", "2026-11-16T07:00+01:00"));
    const [baeckerei] = nachttage(tag, { baeckerei: true }).tage;
    expect(baeckerei).toMatchObject({ nachtMinuten: 60, nachtarbeit: false });
    // the same shift elsewhere has 2:00 in the Nachtzeit 23 – 6
    expect(nachttage(tag).tage[0]?.nachtMinuten).toBe(120);
  });

  it("Grenze: from the 48th Nachtarbeitstag in the calendar year on, a Nachtarbeitnehmer", () => {
    const tage48 = naechte(tageVonBis("2026-01-05", "2026-02-21"));
    const ergebnis = nachttage(tage48).tage;
    expect(ergebnis).toHaveLength(48);
    expect(ergebnis[46]).toMatchObject({ nummer: 47, nachtarbeitnehmer: null });
    expect(ergebnis[47]).toMatchObject({ nummer: 48, nachtarbeitnehmer: "tage" });
  });

  it("counts real minutes over the DST changes: 22:00 – 6:00 has 8:00 or 6:00 in the Nachtzeit", () => {
    // SoZV: the night of 24/25.10.2026 has 25 hours, the night of 27/28.03.2027 23
    expect(minutenVon("2026-10-24T22:00+02:00", "2026-10-25T06:00+01:00")).toBe(8 * 60);
    expect(minutenVon("2027-03-27T22:00+01:00", "2027-03-28T06:00+02:00")).toBe(6 * 60);
  });

  it("counts the morning before 6:00 and the night after 23:00 of the same shift", () => {
    // 5:00 – 23:30: one hour of the night before, 30 minutes of the night after
    expect(minutenVon("2026-11-16T05:00+01:00", "2026-11-16T23:30+01:00")).toBe(90);
  });

  it("leaves a Ruhepause out of the Nachtzeit, but not a short interruption", () => {
    const [tag] = tage([
      { art: "kommen", zeitpunkt: Date.parse("2026-11-16T22:00+01:00") },
      { art: "pause_beginn", zeitpunkt: Date.parse("2026-11-17T00:00+01:00") },
      { art: "pause_ende", zeitpunkt: Date.parse("2026-11-17T00:30+01:00") },
      { art: "gehen", zeitpunkt: Date.parse("2026-11-17T02:00+01:00") },
    ]);
    expect(nachttage([tag as PruefTag]).tage[0]).toMatchObject({
      nachtMinuten: 150,
      nachtarbeit: true,
    });
  });

  it("counts the working day as the day the shift starts, also over the turn of the year", () => {
    const [tag] = nachttage(tage(schicht("2026-12-31T22:00+01:00", "2027-01-01T06:00+01:00"))).tage;
    expect(tag).toMatchObject({ tag: "2026-12-31", nachtMinuten: 7 * 60, nummer: 1 });
  });

  it("Vorjahr: whoever had 48 Nachtarbeitstage last year is a Nachtarbeitnehmer from 1 January", () => {
    const liste = [
      ...naechte(tageVonBis("2026-11-01", "2026-12-18")),
      tagAb("2027-01-04", "23:00", 181),
    ];
    const ergebnis = nachttage(liste).tage;
    expect(ergebnis.at(-1)).toMatchObject({
      tag: "2027-01-04",
      nummer: 1,
      nachtarbeitnehmer: "vorjahr",
    });
  });

  it("Wechselschicht: a Nachtarbeitnehmer from the first day, with or without Nachtarbeit", () => {
    const ergebnis = nachttage([tagAb("2026-11-16", "8:00", 480)], { wechselschicht: true }).tage;
    expect(ergebnis[0]?.nachtarbeitnehmer).toBe("wechselschicht");
  });

  it("does not judge a day before the first rule version", () => {
    const ergebnis = nachttage([tagAb("2025-12-30", "23:00", 181)]);
    expect(ergebnis).toEqual({ tage: [], nichtHinterlegt: ["2025-12-30"] });
  });
});
