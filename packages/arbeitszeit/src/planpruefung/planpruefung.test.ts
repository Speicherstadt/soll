import { describe, expect, it } from "vitest";
import { schicht } from "../dienstplan/testhilfen.ts";
import type { PlanSchicht } from "../dienstplan/typen.ts";
import { plusTage } from "../kalender/tag.ts";
import { type PlanPruefung, planBefunde } from "./planpruefung.ts";
import { planTage } from "./plantage.ts";

/** Monday 23 November 2026 in Hamburg: what lies before was stamped, from today on the plan holds */
const HEUTE = "2026-11-23";

const pruefe = (schichten: PlanSchicht[], weiteres: Partial<PlanPruefung> = {}) =>
  planBefunde({
    schichten,
    ist: [],
    heute: HEUTE,
    standort: { land: "HH" },
    betrieb: {},
    person: {},
    mitteilungAm: () => HEUTE,
    ...weiteres,
  });

const regeln = (ergebnis: ReturnType<typeof pruefe>) =>
  ergebnis.befunde.map((befund) => [befund.regel, befund.art]);

const CAFE = { ausnahmen: [{ art: "abs1" as const, nummer: 4 }] };

describe("the rules of Phase 2 on planned shifts (S-502)", () => {
  it("finds nothing in an ordinary week", () => {
    const woche = [0, 1, 2, 3, 4].map((tag) =>
      schicht(plusTage(HEUTE, tag), "08:00", "16:30", { pauseMinuten: 30 }),
    );
    expect(pruefe(woche)).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("R-02: names the shift of a day over 10 hours", () => {
    const lang = schicht("2026-11-24", "06:00", "17:30", { pauseMinuten: 45 });
    const [befund] = pruefe([lang]).befunde;
    expect(befund).toMatchObject({
      regel: "R-02",
      norm: "§ 3 Satz 2 ArbZG",
      schwere: "verstoss",
      art: "ueber_10h",
      schichtIds: [lang.schichtId],
    });
  });

  it("R-03: the running period over its average up to the last planned day", () => {
    const tage = [0, 1].map((tag) =>
      schicht(plusTage(HEUTE, tag), "07:00", "17:45", { pauseMinuten: 45 }),
    );
    const betrieb = { zeitraum: "24_wochen" as const, beginn: HEUTE };
    expect(regeln(pruefe(tage, { betrieb }))).toContainEqual(["R-03", "ausgleich_offen"]);
    expect(regeln(pruefe(tage))).not.toContainEqual(["R-03", "ausgleich_offen"]);
  });

  it("R-04: a planned shift of 7 hours without a break", () => {
    expect(regeln(pruefe([schicht("2026-11-24", "08:00", "15:00")]))).toEqual([
      ["R-04", "pause_fehlt"],
      ["R-04", "ohne_pause"],
    ]);
  });

  it("R-04: the break in the middle leaves no block over 6 hours", () => {
    const zwoelf = schicht("2026-11-24", "06:00", "18:00", { pauseMinuten: 45 });
    expect(regeln(pruefe([zwoelf]))).toEqual([["R-02", "ueber_10h"]]);
  });

  it("R-05: the rest after a day already worked ends at the planned shift", () => {
    const ist = planTage([schicht("2026-11-22", "15:00", "23:00")], [], "2026-11-22").tage;
    const frueh = schicht(HEUTE, "06:00", "12:00");
    const ergebnis = pruefe([frueh], { ist, betrieb: CAFE });
    expect(ergebnis.befunde).toEqual([
      expect.objectContaining({
        regel: "R-05",
        art: "ruhezeit_zu_kurz",
        schichtIds: [frueh.schichtId],
      }),
    ]);
  });

  it("leaves out what concerns only the days already worked", () => {
    const ist = planTage([schicht("2026-11-20", "06:00", "18:00")], [], "2026-11-20").tage;
    expect(pruefe([schicht(HEUTE, "08:00", "12:00")], { ist }).befunde).toEqual([]);
  });

  it("R-06: a Nachtarbeitnehmer in Wechselschicht over 8 hours", () => {
    const nacht = schicht("2026-11-24", "22:00", "08:00", { pauseMinuten: 45 });
    expect(regeln(pruefe([nacht], { person: { wechselschicht: true } }))).toContainEqual([
      "R-06",
      "nacht_ueber_8h",
    ]);
    expect(regeln(pruefe([nacht]))).not.toContainEqual(["R-06", "nacht_ueber_8h"]);
  });

  it("R-07: a Sunday without an exception, and with § 10 Abs. 1 Nr. 4 ArbZG none", () => {
    const sonntag = schicht("2026-11-29", "10:00", "16:00");
    expect(regeln(pruefe([sonntag]))).toContainEqual(["R-07", "sonntagsarbeit"]);
    expect(regeln(pruefe([sonntag], { betrieb: CAFE }))).not.toContainEqual([
      "R-07",
      "sonntagsarbeit",
    ]);
  });

  it("R-08: the 37th Sunday planned in 2027 leaves no further one", () => {
    const sonntage = Array.from({ length: 37 }, (_, index) =>
      schicht(plusTage("2027-01-03", index * 7), "10:00", "14:00"),
    );
    const ergebnis = pruefe(sonntage, { betrieb: CAFE });
    expect(ergebnis.befunde.filter((befund) => befund.regel === "R-08")).toEqual([
      expect.objectContaining({
        art: "kein_sonntag_mehr",
        schichtIds: [sonntage[36]?.schichtId],
      }),
    ]);
  });

  it("R-09: a Sunday with every Werktag of the two weeks before planned", () => {
    const werktage = Array.from({ length: 13 }, (_, index) => plusTage(HEUTE, index))
      .filter((tag) => tag !== "2026-11-29")
      .map((tag) => schicht(tag, "08:00", "12:00"));
    const sonntag = schicht("2026-12-06", "08:00", "12:00");
    const ergebnis = pruefe([...werktage, sonntag], { betrieb: CAFE });
    expect(ergebnis.befunde.filter((befund) => befund.regel === "R-09")).toContainEqual(
      expect.objectContaining({ art: "ersatzruhetag_offen", schichtIds: [sonntag.schichtId] }),
    );
  });

  it("R-14: a monthly wage below the minimum wage for the planned hours", () => {
    const lohnAm = () => ({ lohn: { art: "monat" as const, cent: 100 }, minijob: false });
    expect(regeln(pruefe([schicht("2026-11-24", "08:00", "12:00")], { lohnAm }))).toEqual([
      ["R-14", "unter_mindestlohn"],
    ]);
  });

  it("R-32: a mini-job month over the limit with the plan", () => {
    const lohnAm = () => ({ lohn: { art: "stunde" as const, cent: 100_000 }, minijob: true });
    const [befund] = pruefe([schicht("2026-11-24", "08:00", "12:00")], { lohnAm }).befunde;
    expect(befund).toMatchObject({ regel: "R-32", norm: expect.stringContaining("SGB IV") });
  });

  it("R-15 to R-20: the rules for Jugendliche only with a birth date under 18", () => {
    const lang = schicht("2026-11-24", "07:00", "16:30", { pauseMinuten: 60 });
    const person = { geburtsdatum: "2009-06-01" };
    expect(pruefe([lang], { person }).befunde.map((b) => b.regel)).toContain("R-15");
    const erwachsen = pruefe([lang], { person: { geburtsdatum: "2000-06-01" } });
    expect(erwachsen.befunde.map((b) => b.regel)).not.toContain("R-15");
  });

  it("R-21: the Mutterschutz only in its span", () => {
    const lang = schicht("2026-11-24", "08:00", "17:30", { pauseMinuten: 30 });
    const im = { mutterschutz: [{ von: "2026-11-01", bis: null }] };
    const davor = { mutterschutz: [{ von: "2026-11-01", bis: "2026-11-20" }] };
    expect(pruefe([lang], { person: im }).befunde.map((b) => b.regel)).toContain("R-21");
    expect(pruefe([lang], { person: davor }).befunde.map((b) => b.regel)).not.toContain("R-21");
  });

  it("R-22: a shift told less than four days ahead, only for work on call", () => {
    const morgen = schicht("2026-11-24", "10:00", "16:00");
    const ergebnis = pruefe([morgen], { person: { abruf: true }, tagesdauerAm: () => 360 });
    expect(ergebnis.befunde).toEqual([
      expect.objectContaining({ regel: "R-22", art: "vorlauf", schichtIds: [morgen.schichtId] }),
    ]);
    expect(pruefe([morgen]).befunde).toEqual([]);
  });

  it("R-22: a published shift counts from the day it was published", () => {
    const spaeter = schicht("2026-11-30", "10:00", "16:00");
    const mitteilungAm = () => "2026-11-20";
    expect(pruefe([spaeter], { person: { abruf: true }, mitteilungAm }).befunde).toEqual([]);
  });
});
