import { describe, expect, it } from "vitest";
import { feiertage } from "../feiertage/feiertage.ts";
import { plusTage, type Tag, wochentag } from "../kalender/tag.ts";
import { type AusgleichOptionen, ausgleichszeitraum } from "./ausgleichszeitraum.ts";
import { tagMit, um } from "./testhilfen.ts";
import type { PruefTag } from "./typen.ts";
import { tageVonBis } from "./zeitraeume.ts";

/*
 * docs/regeln.md, R-03 (cases taken literally). The cases count 24 weeks of six Werktage each, so
 * they run without holidays, over 24 weeks from Mo 5.1.2026 to So 21.6.2026; the cases with
 * holidays and the six calendar months follow.
 */
const BEGINN = "2026-01-05";
const NACH_DEM_ZEITRAUM = um("2026-06-22T12:00+02:00");
const OHNE = new Set<Tag>();

/** Mon to Sat of week `woche` (0 to 23) of the 24 weeks */
const werktageDerWoche = (woche: number): Tag[] =>
  Array.from({ length: 6 }, (_, tag) => plusTage(BEGINN, woche * 7 + tag));

const wochen = (von: number, bis: number, minutenJeTag: number): PruefTag[] =>
  Array.from({ length: bis - von }, (_, index) => von + index).flatMap((woche) =>
    werktageDerWoche(woche).map((tag) => tagMit(tag, minutenJeTag)),
  );

const pruefe = (tage: PruefTag[], optionen: Partial<AusgleichOptionen> = {}) =>
  ausgleichszeitraum(tage, {
    jetzt: NACH_DEM_ZEITRAUM,
    feiertage: OHNE,
    neutral: OHNE,
    zeitraum: "24_wochen",
    beginn: BEGINN,
    ...optionen,
  });

/** 1152 h in 24 weeks (Ø 48:00 h), one day 1 minute more when `extra` */
const genau48 = (extra: number) =>
  wochen(0, 24, 480).map((tag, index) => (index === 0 ? tagMit(tag.tag, 480 + extra) : tag));

describe("R-03: Ausgleichszeitraum", () => {
  it("erlaubt: 12 Wochen mit 50 h, 12 Wochen mit 40 h (Ø 45 h) – no finding", () => {
    const tage = [...wochen(0, 12, 500), ...wochen(12, 24, 400)];
    expect(pruefe(tage)).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Grenze: 24 Wochen mit Ø 48:00 h (1152 h) – no finding („nicht überschritten“)", () => {
    expect(pruefe(genau48(0)).befunde).toEqual([]);
  });

  it("Verstoß: 24 Wochen mit 1152 h und 1 Minute – Verstoß „Ausgleich nicht erreicht“", () => {
    expect(pruefe(genau48(1)).befunde).toEqual([
      {
        regel: "R-03",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "verstoss",
        art: "ausgleich_nicht_erreicht",
        tage: [BEGINN],
        zeitraum: { art: "24_wochen", von: BEGINN, bis: "2026-06-21" },
        minuten: 1152 * 60 + 1,
        hoechstens: 1152 * 60,
        werktage: 144,
        ueber: 1,
      },
    ]);
  });

  it("Urlaub: 22 Wochen mit 1056 h und 1 Minute, 2 Wochen Urlaub – Verstoß (Ø über 48 h ohne den Urlaub)", () => {
    const tage = wochen(0, 22, 480).map((tag, index) => (index === 0 ? tagMit(tag.tag, 481) : tag));
    const urlaub = new Set(tageVonBis(plusTage(BEGINN, 22 * 7), "2026-06-21"));
    expect(pruefe(tage, { neutral: urlaub }).befunde).toEqual([
      expect.objectContaining({
        art: "ausgleich_nicht_erreicht",
        minuten: 1056 * 60 + 1,
        hoechstens: 1056 * 60,
        werktage: 132,
        ueber: 1,
      }),
    ]);
  });

  it("Hinweis: after 12 Wochen mit 50 h, while the period runs – Hinweis „Ausgleich offen“", () => {
    const jetzt = um("2026-03-29T12:00+02:00"); // So, the last day of week 12
    expect(pruefe(wochen(0, 12, 500), { jetzt }).befunde).toEqual([
      expect.objectContaining({
        schwere: "hinweis",
        art: "ausgleich_offen",
        zeitraum: { art: "24_wochen", von: BEGINN, bis: "2026-06-21" },
        minuten: 72 * 500,
        hoechstens: 72 * 480,
        werktage: 72,
        ueber: 72 * 20,
      }),
    ]);
  });

  it("Hinweis: the time planned ahead counts up to its last day (S-502)", () => {
    const jetzt = um("2026-01-05T08:00+01:00");
    expect(pruefe(wochen(0, 2, 500), { jetzt }).befunde).toEqual([
      expect.objectContaining({ art: "ausgleich_offen", werktage: 12, ueber: 12 * 20 }),
    ]);
  });

  it("takes work on a neutral day out of the period with the day", () => {
    const urlaub = new Set([BEGINN]);
    const mitUrlaub = genau48(0).map((tag, index) => (index === 1 ? tagMit(tag.tag, 960) : tag));
    expect(pruefe(genau48(0), { neutral: urlaub }).befunde).toEqual([]);
    expect(pruefe(mitUrlaub, { neutral: urlaub }).befunde).toEqual([
      expect.objectContaining({ werktage: 143, ueber: 480 }),
    ]);
  });
});

describe("R-03: Werktage, holidays and the two periods", () => {
  const hamburg2026 = (() => {
    const ergebnis = feiertage(2026, { land: "HH" });
    if (!ergebnis.ok) throw new Error(ergebnis.grund);
    return new Set(ergebnis.feiertage.map((feiertag) => feiertag.tag));
  })();
  const halbjahr = tageVonBis("2026-01-01", "2026-06-30");
  const jedenWerktag = (minuten: number) =>
    halbjahr
      .filter((tag) => wochentag(tag) !== 0 && !hamburg2026.has(tag))
      .map((tag) => tagMit(tag, minuten));
  const ENDE_JUNI = um("2026-07-01T12:00+02:00");

  it("Feiertag: 8 h on every Werktag of the first half of 2026 in Hamburg – no finding", () => {
    const ergebnis = ausgleichszeitraum(jedenWerktag(480), {
      jetzt: ENDE_JUNI,
      feiertage: hamburg2026,
      neutral: OHNE,
      zeitraum: "sechs_monate",
    });
    expect(ergebnis.befunde).toEqual([]);
  });

  it("Feiertag: work on Karfreitag counts, the day is no Werktag – Verstoß naming the day", () => {
    const ergebnis = ausgleichszeitraum([...jedenWerktag(480), tagMit("2026-04-03", 240)], {
      jetzt: ENDE_JUNI,
      feiertage: hamburg2026,
      neutral: OHNE,
      zeitraum: "sechs_monate",
    });
    expect(ergebnis.befunde).toEqual([
      expect.objectContaining({
        art: "ausgleich_nicht_erreicht",
        tage: ["2026-04-03"],
        zeitraum: { art: "sechs_monate", von: "2026-01-01", bis: "2026-06-30" },
        ueber: 240,
      }),
    ]);
  });

  // 8 h on every day but Sunday from 1.1. to 17.6.2026 and on Su 1.2.: the 24 weeks from 1.1. are
  // over by 8 h, the six months to 30.6. are not, because 18.6. to 30.6. are free
  const vierundzwanzigWochen = [
    ...tageVonBis("2026-01-01", "2026-06-17")
      .filter((tag) => wochentag(tag) !== 0)
      .map((tag) => tagMit(tag, 480)),
    tagMit("2026-02-01", 480),
  ].sort((a, b) => a.tag.localeCompare(b.tag));
  const optionen = { jetzt: ENDE_JUNI, feiertage: OHNE, neutral: OHNE };

  it("ohne Wahl: the 24 weeks are over, the six calendar months are not – no finding", () => {
    expect(ausgleichszeitraum(vierundzwanzigWochen, optionen).befunde).toEqual([]);
  });

  it("24 Wochen gewählt: the same days are a Verstoß", () => {
    const { befunde } = ausgleichszeitraum(vierundzwanzigWochen, {
      ...optionen,
      zeitraum: "24_wochen",
    });
    expect(befunde).toEqual([
      expect.objectContaining({
        zeitraum: { art: "24_wochen", von: "2026-01-01", bis: "2026-06-17" },
        tage: ["2026-02-01"],
        ueber: 480,
      }),
    ]);
  });

  it("ohne Wahl: both periods over and ended – a Verstoß for each", () => {
    const rest = tageVonBis("2026-06-18", "2026-06-30")
      .filter((tag) => wochentag(tag) !== 0)
      .map((tag) => tagMit(tag, 480));
    const { befunde } = ausgleichszeitraum([...vierundzwanzigWochen, ...rest], optionen);
    expect(befunde.map((befund) => [befund.zeitraum.art, befund.schwere])).toEqual([
      ["sechs_monate", "verstoss"],
      ["24_wochen", "verstoss"],
    ]);
  });

  it("ohne Wahl: one period ended over, the other still running over – Hinweis only", () => {
    const rest = tageVonBis("2026-06-18", "2026-06-20").map((tag) => tagMit(tag, 480));
    const jetzt = um("2026-06-20T20:00+02:00");
    const { befunde } = ausgleichszeitraum([...vierundzwanzigWochen, ...rest], {
      ...optionen,
      jetzt,
    });
    expect(befunde).toEqual([
      expect.objectContaining({
        schwere: "hinweis",
        zeitraum: { art: "sechs_monate", von: "2026-01-01", bis: "2026-06-30" },
      }),
    ]);
  });

  // Review of PR #12: 8 h on every day but Sunday from 1.1.2026 to 30.6.2027, 9 h on Mo 22.6.2026
  // and Tu 15.12.2026, 7 h on Tu 15.9.2026. The half-year to 30.6.2026 is over (only it), so is
  // the 24 weeks from 3.12.2026 (only it); the two do not overlap. Whichever period the business
  // had chosen, it would have a Verstoß, so without a choice it has one (§ 3 Satz 2 ArbZG, "oder").
  it("ohne Wahl: each kind has an ended period over, the two do not overlap – a Verstoß for each", () => {
    const abweichung: Record<Tag, number> = {
      "2026-06-22": 540,
      "2026-09-15": 420,
      "2026-12-15": 540,
    };
    const tage = tageVonBis("2026-01-01", "2027-06-30")
      .filter((tag) => wochentag(tag) !== 0)
      .map((tag) => tagMit(tag, abweichung[tag] ?? 480));
    const jetzt = um("2027-07-01T12:00+02:00");
    const gewaehlt = (zeitraum: "sechs_monate" | "24_wochen") =>
      ausgleichszeitraum(tage, { ...optionen, jetzt, zeitraum }).befunde.map((befund) => [
        befund.zeitraum,
        befund.schwere,
      ]);
    const halbjahr = { art: "sechs_monate", von: "2026-01-01", bis: "2026-06-30" };
    const wochen24 = { art: "24_wochen", von: "2026-12-03", bis: "2027-05-19" };
    expect(gewaehlt("sechs_monate")).toEqual([[halbjahr, "verstoss"]]);
    expect(gewaehlt("24_wochen")).toEqual([[wochen24, "verstoss"]]);
    const { befunde } = ausgleichszeitraum(tage, { ...optionen, jetzt });
    expect(befunde.map((befund) => [befund.zeitraum, befund.schwere])).toEqual([
      [halbjahr, "verstoss"],
      [wochen24, "verstoss"],
    ]);
  });

  it("names the days before the first rule version instead of judging them", () => {
    const ergebnis = ausgleichszeitraum([tagMit("2025-12-30", 600)], optionen);
    expect(ergebnis).toEqual({ befunde: [], nichtHinterlegt: ["2025-12-30"] });
  });
});
