import { describe, expect, it } from "vitest";
import { tage } from "../arbeitstag/testhilfen.ts";
import {
  type AufzeichnungOptionen,
  aufzeichnungsfrist,
  aufzeichnungspflichtig,
  type ErfassteStempelung,
} from "./aufzeichnung.ts";
import { erfasst, um } from "./testhilfen.ts";

/*
 * docs/regeln.md, R-13 (cases taken literally): Arbeitstag Mo 2.11.2026, Minijob. The shift is
 * 8:00 to 12:00; the time runs out at the end of Mo 9.11. (0:00 on Di 10.11.).
 */
const MINIJOB: AufzeichnungOptionen = { minijob: true };
const SPAETER = um("2030-01-01T00:00+01:00");
const FRIST = um("2026-11-10T00:00+01:00");

const kommen = erfasst("kommen", "2026-11-02T08:00+01:00", "2026-11-02T08:00+01:00");
const vollstaendigAm = (wann: string): ErfassteStempelung[] => [
  erfasst("kommen", "2026-11-02T08:00+01:00", wann),
  erfasst("gehen", "2026-11-02T12:00+01:00", wann),
];

const pruefe = (
  stempelungen: ErfassteStempelung[],
  jetzt: number,
  optionen: AufzeichnungOptionen = MINIJOB,
) => {
  const ergebnis = aufzeichnungsfrist(stempelungen, jetzt, optionen);
  if (!ergebnis.ok) throw new Error(ergebnis.grund);
  expect(ergebnis.wert.nichtHinterlegt).toEqual([]);
  return ergebnis.wert;
};

const verspaetet = (vollstaendigSeit: number | null = null) => ({
  regel: "R-13",
  norm: "§ 17 Abs. 1 Satz 1 MiLoG",
  schwere: "verstoss",
  art: "aufzeichnung_verspaetet",
  tage: ["2026-11-02"],
  frist: FRIST,
  vollstaendigSeit,
});

describe("R-13: Aufzeichnung binnen sieben Tagen", () => {
  it("erlaubt: vollständig erfasst am Mi 4.11. – no finding", () => {
    const stempelungen = vollstaendigAm("2026-11-04T10:00+01:00");
    expect(pruefe(stempelungen, um("2026-11-04T10:00+01:00")).befunde).toEqual([]);
    expect(pruefe(stempelungen, SPAETER)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
      nachgetragen: [],
    });
  });

  it("Grenze: nachgetragen am Mo 9.11. um 23:59 – no finding", () => {
    const stempelungen = vollstaendigAm("2026-11-09T23:59+01:00");
    expect(pruefe(stempelungen, SPAETER).befunde).toEqual([]);
    expect(pruefe(stempelungen, um("2026-11-09T23:59+01:00")).befunde).toEqual([]);
  });

  it("Verstoß: noch offen am Di 10.11. um 0:00 – Verstoß „Aufzeichnung verspätet“", () => {
    expect(pruefe([kommen], FRIST).befunde).toEqual([verspaetet()]);
  });

  it("ausgenommen: Minijob im Privathaushalt, offen am 10.11. – nur R-01", () => {
    const optionen = { minijob: true, privathaushalt: true };
    expect(pruefe([kommen], FRIST, optionen).befunde).toEqual([]);
    expect(aufzeichnungspflichtig(optionen)).toBe(false);
    const r01 = tage([{ art: "kommen", zeitpunkt: kommen.zeitpunkt }], FRIST)[0]?.befunde;
    expect(r01?.map((befund) => [befund.regel, befund.art])).toEqual([["R-01", "gehen_fehlt"]]);
  });

  it("vor dem Hinweis: noch offen am Fr 6.11. um 23:59 – nur R-01", () => {
    expect(pruefe([kommen], um("2026-11-06T23:59+01:00")).befunde).toEqual([]);
  });

  it("Hinweis: noch offen am Sa 7.11. um 0:00 – Hinweis „Aufzeichnung fällig“, Frist bis 9.11.", () => {
    const hinweis = {
      ...verspaetet(),
      schwere: "hinweis",
      art: "aufzeichnung_faellig",
    };
    expect(pruefe([kommen], um("2026-11-07T00:00+01:00")).befunde).toEqual([hinweis]);
    expect(pruefe([kommen], FRIST - 1).befunde).toEqual([hinweis]);
  });

  it("verspätet nachgetragen: Gehen erfasst am Di 10.11. um 0:00 – Verstoß, auch danach", () => {
    const gehen = erfasst("gehen", "2026-11-02T12:00+01:00", "2026-11-10T00:00+01:00");
    const ergebnis = pruefe([kommen, gehen], SPAETER);
    expect(ergebnis.befunde).toEqual([verspaetet(FRIST)]);
    expect(ergebnis.nachgetragen).toEqual(["2026-11-02"]);
  });

  it("geändert nach der Frist: vollständig am 4.11., Gehen am 12.11. geändert – nachgetragen", () => {
    const stempelungen = [
      erfasst("kommen", "2026-11-02T08:00+01:00", "2026-11-04T10:00+01:00"),
      erfasst(
        "gehen",
        "2026-11-02T12:00+01:00",
        "2026-11-04T10:00+01:00",
        "2026-11-12T09:00+01:00",
      ),
      erfasst("gehen", "2026-11-02T13:00+01:00", "2026-11-12T09:00+01:00"),
    ];
    expect(pruefe(stempelungen, SPAETER)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
      nachgetragen: ["2026-11-02"],
    });
  });

  it("Branche: Vollzeit in einer Gaststätte, offen am 10.11. – Verstoß", () => {
    const optionen = { minijob: false, branche: "gaststaetten_beherbergung" as const };
    expect(pruefe([kommen], FRIST, optionen).befunde).toEqual([verspaetet()]);
  });

  it("andere Branche: Vollzeit außerhalb § 2a SchwarzArbG, offen am 10.11. – nur R-01", () => {
    expect(pruefe([kommen], FRIST, { minijob: false, branche: "andere" }).befunde).toEqual([]);
  });

  it("Branche nicht eingestellt: Vollzeit, offen am 10.11. – Verstoß (nie weniger streng)", () => {
    expect(pruefe([kommen], FRIST, { minijob: false }).befunde).toEqual([verspaetet()]);
  });

  it("Zeitumstellung: Arbeitstag Mo 19.10.2026, offen am Di 27.10. um 0:00 MEZ – Verstoß", () => {
    const offen = [erfasst("kommen", "2026-10-19T08:00+02:00", "2026-10-19T08:00+02:00")];
    const frist = um("2026-10-27T00:00+01:00");
    expect(pruefe(offen, frist - 1).befunde).toEqual([
      expect.objectContaining({ art: "aufzeichnung_faellig", frist }),
    ]);
    expect(pruefe(offen, frist).befunde).toEqual([
      expect.objectContaining({ art: "aufzeichnung_verspaetet", tage: ["2026-10-19"], frist }),
    ]);
  });
});

describe("R-13: the stamps as they stood", () => {
  it("a stamp recorded in time but deleted before the deadline does not count", () => {
    const stempelungen = [
      kommen,
      erfasst(
        "gehen",
        "2026-11-02T12:00+01:00",
        "2026-11-03T10:00+01:00",
        "2026-11-05T10:00+01:00",
      ),
    ];
    expect(pruefe(stempelungen, SPAETER).befunde).toEqual([verspaetet()]);
  });

  it("a night shift over midnight belongs to the day it began", () => {
    const stempelungen = [
      erfasst("kommen", "2026-11-02T22:00+01:00", "2026-11-02T22:00+01:00"),
      erfasst("gehen", "2026-11-03T06:00+01:00", "2026-11-10T12:00+01:00"),
    ];
    const ergebnis = pruefe(stempelungen, SPAETER);
    expect(ergebnis.befunde).toEqual([verspaetet(um("2026-11-10T12:00+01:00"))]);
    expect(ergebnis.nachgetragen).toEqual(["2026-11-02"]);
  });

  it("a day before the first rule version is not judged but named", () => {
    const alt = [erfasst("kommen", "2025-11-03T08:00+01:00", "2025-11-03T08:00+01:00")];
    const ergebnis = aufzeichnungsfrist(alt, SPAETER, MINIJOB);
    expect(ergebnis).toEqual({
      ok: true,
      wert: { befunde: [], nichtHinterlegt: ["2025-11-03"], nachgetragen: [] },
    });
  });

  it("refuses an instant that is no whole millisecond or a version replaced before it was recorded", () => {
    expect(aufzeichnungsfrist([{ ...kommen, erfasst: 0.5 }], SPAETER, MINIJOB).ok).toBe(false);
    expect(
      aufzeichnungsfrist([{ ...kommen, ersetzt: kommen.erfasst - 1 }], SPAETER, MINIJOB).ok,
    ).toBe(false);
    expect(aufzeichnungsfrist([kommen], Number.NaN, MINIJOB).ok).toBe(false);
  });
});

describe("R-13: review of PR #15", () => {
  it("Privathaushalt ohne Minijob: Vollzeit im Privathaushalt, Branche nicht eingestellt, offen am 10.11. – Verstoß (§ 17 Abs. 1 Satz 3 MiLoG nimmt nur § 8a SGB IV aus)", () => {
    const optionen = { minijob: false, privathaushalt: true };
    expect(aufzeichnungspflichtig(optionen)).toBe(true);
    expect(pruefe([kommen], FRIST, optionen).befunde).toEqual([verspaetet()]);
  });

  it("deleting the part of a night shift after midnight after the deadline is nachgetragen", () => {
    const stempelungen = [
      erfasst("kommen", "2026-11-02T22:00+01:00", "2026-11-02T22:00+01:00"),
      erfasst("gehen", "2026-11-03T02:00+01:00", "2026-11-03T02:00+01:00"),
      erfasst(
        "kommen",
        "2026-11-03T02:20+01:00",
        "2026-11-03T02:20+01:00",
        "2026-11-12T09:00+01:00",
      ),
      erfasst(
        "gehen",
        "2026-11-03T06:00+01:00",
        "2026-11-03T06:00+01:00",
        "2026-11-12T09:00+01:00",
      ),
    ];
    expect(pruefe(stempelungen, SPAETER)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
      nachgetragen: ["2026-11-02"],
    });
  });
});

describe("R-13: second review of PR #15", () => {
  const geloescht = (art: "kommen" | "gehen", zeit: string, wann: string, weg: string) =>
    erfasst(art, `2026-11-02T${zeit}+01:00`, `2026-11-${wann}+01:00`, `2026-11-${weg}+01:00`);

  it("gelöscht nach der Frist: vollständig am 4.11., Kommen und Gehen am 12.11. gelöscht – nachgetragen", () => {
    const stempelungen = [
      geloescht("kommen", "08:00", "04T10:00", "12T09:00"),
      geloescht("gehen", "12:00", "04T10:00", "12T09:00"),
    ];
    expect(pruefe(stempelungen, SPAETER)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
      nachgetragen: ["2026-11-02"],
    });
  });

  it("offen gelöscht nach der Frist: Kommen am 2.11., am 12.11. gelöscht – Verstoß, nachgetragen", () => {
    const stempelungen = [geloescht("kommen", "08:00", "02T08:00", "12T09:00")];
    expect(pruefe(stempelungen, SPAETER)).toEqual({
      befunde: [verspaetet()],
      nichtHinterlegt: [],
      nachgetragen: ["2026-11-02"],
    });
  });

  it("gelöscht vor der Frist: Kommen am 2.11., am 4.11. gelöscht – kein Befund", () => {
    const stempelungen = [geloescht("kommen", "08:00", "02T08:00", "04T09:00")];
    expect(pruefe(stempelungen, SPAETER)).toEqual({
      befunde: [],
      nichtHinterlegt: [],
      nachgetragen: [],
    });
  });

  const offenUnd16 = [
    erfasst("kommen", "2026-11-02T08:00+01:00", "2026-11-02T08:00+01:00"),
    erfasst("kommen", "2026-11-16T08:00+01:00", "2026-11-16T08:00+01:00"),
  ];

  it("nach einer offenen Schicht: 2.11. offen, 16.11. vollständig am 16.11., geprüft am 21.11. – kein Befund für den 16.11.", () => {
    const stempelungen = [
      ...offenUnd16,
      erfasst("gehen", "2026-11-16T12:00+01:00", "2026-11-16T12:00+01:00"),
    ];
    const befunde = pruefe(stempelungen, um("2026-11-21T10:00+01:00")).befunde;
    expect(befunde.map((befund) => befund.tage)).toEqual([["2026-11-02"]]);
  });

  it("geändert nach einer offenen Schicht: 2.11. offen, Gehen des 16.11. am 30.11. geändert – 16.11. nachgetragen", () => {
    const stempelungen = [
      ...offenUnd16,
      erfasst(
        "gehen",
        "2026-11-16T12:00+01:00",
        "2026-11-16T12:00+01:00",
        "2026-11-30T09:00+01:00",
      ),
      erfasst("gehen", "2026-11-16T13:00+01:00", "2026-11-30T09:00+01:00"),
    ];
    expect(pruefe(stempelungen, SPAETER).nachgetragen).toEqual(["2026-11-16"]);
  });
});
