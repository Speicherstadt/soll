import { describe, expect, it } from "vitest";
import { rufdienst, schicht } from "../dienstplan/testhilfen.ts";
import type { PlanRufdienst, PlanSchicht } from "../dienstplan/typen.ts";
import { zeitpunktInBerlin } from "../kalender/zeit.ts";
import type { Spanne } from "../pruefung-bereitschaft/typen.ts";
import { type PlanPruefung, planBefunde } from "./planpruefung.ts";
import { planTage } from "./plantage.ts";

/*
 * R-11 and R-12 in the check of the plan (S-505), with the cases of docs/regeln.md: a planned
 * Rufbereitschaft is working time only under 30 minutes of reaction time or without one (Matzak);
 * the call-outs recorded before today end no rest but begin a new one. Today is Monday 23.11.2026.
 */
const HEUTE = "2026-11-23";
const SO = "2026-11-22";
const DI = "2026-11-24";
const MI = "2026-11-25";

const pruefe = (
  schichten: PlanSchicht[],
  rufdienste: PlanRufdienst[],
  weiteres: Partial<PlanPruefung> = {},
) =>
  planBefunde({
    schichten,
    rufdienste,
    ist: [],
    heute: HEUTE,
    standort: { land: "HH" },
    betrieb: {},
    person: {},
    mitteilungAm: () => HEUTE,
    ...weiteres,
  });

const kurz = (ergebnis: ReturnType<typeof pruefe>) =>
  ergebnis.befunde.map((befund) => [befund.regel, befund.art, befund.schichtIds]);

/** An instant on the Berlin clock, e.g. `um("2026-11-22", "23:00")` */
const um = (tag: string, uhrzeit: string): number => {
  const [stunden = 0, minuten = 0] = uhrzeit.split(":").map(Number);
  const zeitpunkt = zeitpunktInBerlin(tag, stunden * 60 + minuten);
  if (zeitpunkt === null) throw new Error(`no instant ${tag} ${uhrzeit}`);
  return zeitpunkt;
};
const einsatz = (tag: string, von: string, bisTag: string, bis: string): Spanne => ({
  beginn: um(tag, von),
  ende: um(bisTag, bis),
});

describe("R-12 on planned Rufbereitschaft (S-505)", () => {
  it("erlaubt: Rufbereitschaft Mo 18:00 – Di 6:00 with 30 min, Di Schicht 8:00 – no finding", () => {
    const dienst = rufdienst(HEUTE, "18:00", "06:00", { reaktionMinuten: 30 });
    expect(pruefe([schicht(DI, "08:00", "14:00")], [dienst])).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Matzak: reaction time 8 min, 18:00 – 6:00 – R-02 Verstoß at the duty", () => {
    const dienst = rufdienst(HEUTE, "18:00", "06:00", { reaktionMinuten: 8 });
    expect(pruefe([], [dienst]).befunde).toContainEqual(
      expect.objectContaining({
        regel: "R-02",
        art: "ueber_10h",
        minuten: 720,
        schichtIds: [dienst.rufdienstId],
      }),
    );
  });

  it("Matzak, Grenze: reaction time 30 min, 18:00 – 6:00 without a call-out – no finding", () => {
    expect(pruefe([], [rufdienst(HEUTE, "18:00", "06:00", { reaktionMinuten: 30 })])).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("ohne Reaktionszeit: 18:00 – 6:00 counts as Matzak", () => {
    const dienst = rufdienst(HEUTE, "18:00", "06:00");
    expect(kurz(pruefe([], [dienst]))).toContainEqual(["R-02", "ueber_10h", [dienst.rufdienstId]]);
  });

  it("over midnight: a duty that counts joins the shift before it into one working day", () => {
    const frueh = schicht(HEUTE, "12:00", "18:00");
    const dienst = rufdienst(HEUTE, "20:00", "02:00");
    expect(kurz(pruefe([frueh], [dienst]))).toContainEqual([
      "R-02",
      "ueber_10h",
      [frueh.schichtId, dienst.rufdienstId],
    ]);
  });

  it("a duty that counts makes the next shift part of its working day (Grundbegriff „Schicht“)", () => {
    // Mo 8:00 – 16:00, the duty to 2:00 and Di from 6:00: under 9 hours apart, under 24 after 8:00
    const mo = schicht(HEUTE, "08:00", "16:00", { pauseMinuten: 30 });
    const dienst = rufdienst(HEUTE, "16:00", "02:00", { reaktionMinuten: 5 });
    const di = schicht(DI, "06:00", "07:30");
    const befund = pruefe([mo, di], [dienst]).befunde.find((b) => b.regel === "R-02");
    expect(befund?.tage).toEqual([HEUTE]);
    expect(befund?.schichtIds.sort()).toEqual(
      [mo.schichtId, di.schichtId, dienst.rufdienstId].sort(),
    );
  });

  it("a duty that does not count names no finding and joins nothing", () => {
    const mo = schicht(HEUTE, "06:00", "17:30", { pauseMinuten: 45 });
    const dienst = rufdienst(HEUTE, "17:30", "06:00", { reaktionMinuten: 45 });
    expect(kurz(pruefe([mo], [dienst]))).toEqual([["R-02", "ueber_10h", [mo.schichtId]]]);
  });

  it("a duty before today is not read", () => {
    expect(pruefe([], [rufdienst(SO, "18:00", "06:00")])).toEqual({
      befunde: [],
      nichtHinterlegt: [],
    });
  });

  it("Herbst: Sa 24.10.2026 22:00 – So 7:00 without reaction time has 10:00, Hinweis of R-02", () => {
    const dienst = rufdienst("2026-10-24", "22:00", "07:00");
    const ergebnis = pruefe([], [dienst], { heute: "2026-10-24" });
    expect(ergebnis.befunde).toContainEqual(
      expect.objectContaining({ regel: "R-02", art: "ueber_8h", minuten: 600 }),
    );
  });

  it("Frühjahr: Sa 27.03.2027 22:00 – So 7:00 has 8:00, no finding of R-02", () => {
    const dienst = rufdienst("2027-03-27", "22:00", "07:00");
    const ergebnis = pruefe([], [dienst], { heute: "2027-03-27" });
    expect(ergebnis.befunde.filter((befund) => befund.regel === "R-02")).toEqual([]);
  });
});

describe("R-12 with the call-outs recorded before today (S-505)", () => {
  it("Verstoß: Einsatz So 23:00 – Mo 0:30, Mo Schicht 8:00 (7:30 Ruhe) at the planned shift", () => {
    const mo = schicht(HEUTE, "08:00", "14:00");
    const einsaetze = [einsatz(SO, "23:00", HEUTE, "00:30")];
    // as stamped, the shift goes on the call-out's working day, Sunday (R-29), and with it the
    // finding about the hour of Sunday the call-out worked (R-07)
    expect(kurz(pruefe([mo], [], { einsaetze }))).toEqual([
      ["R-12", "ruhezeit_durch_einsatz_unterbrochen", [mo.schichtId]],
      ["R-07", "sonntagsarbeit", [mo.schichtId]],
    ]);
  });

  it("Grenze: Einsatz So 20:00 – 21:00, Mo Schicht 8:00 (11:00 Ruhe) – no finding", () => {
    const mo = schicht(HEUTE, "08:00", "14:00");
    const einsaetze = [einsatz(SO, "20:00", SO, "21:00")];
    expect(pruefe([mo], [], { einsaetze }).befunde).toEqual([]);
  });

  it("a call-out from today on is not read: the plan cannot know it yet", () => {
    const di = schicht(DI, "08:00", "14:00");
    const einsaetze = [einsatz(HEUTE, "23:00", DI, "00:30")];
    expect(pruefe([di], [], { einsaetze }).befunde).toEqual([]);
  });

  it("Krankenhaus: So 18:00 – 20:00, Einsatz So 23:00 – Mo 1:00, Mo Schicht 8:00 – no Verstoß", () => {
    const ist = planTage([schicht(SO, "18:00", "20:00")], [], SO).tage;
    const mo = schicht(HEUTE, "08:00", "14:00");
    const einsaetze = [einsatz(SO, "23:00", HEUTE, "01:00")];
    const mit = (branche?: "krankenhaus_pflege") =>
      kurz(pruefe([mo], [], { ist, einsaetze, betrieb: branche ? { branche } : {} }));
    // as stamped, So 18:00 to Mo 14:00 is one shift of Sunday (R-29): the planned shift carries
    // the findings of that working day, the Hinweis „Einsatz ausgleichen“ and no Verstoß of R-12
    const sonntag = [
      ["R-02", "ueber_8h", [mo.schichtId]],
      ["R-07", "sonntagsarbeit", [mo.schichtId]],
    ];
    expect(mit("krankenhaus_pflege")).toEqual([
      sonntag[0],
      ["R-12", "einsatz_ausgleich", [mo.schichtId]],
      sonntag[1],
    ]);
    expect(mit()).toEqual([
      sonntag[0],
      ["R-12", "ruhezeit_durch_einsatz_unterbrochen", [mo.schichtId]],
      sonntag[1],
    ]);
  });

  it("two days later the rest is no matter of the call-out", () => {
    const mi = schicht(MI, "08:00", "14:00");
    const einsaetze = [einsatz(SO, "23:00", HEUTE, "00:30")];
    expect(pruefe([mi], [], { einsaetze }).befunde).toEqual([]);
  });
});
