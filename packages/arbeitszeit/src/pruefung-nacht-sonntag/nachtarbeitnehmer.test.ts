import { describe, expect, it } from "vitest";
import { nachtarbeitnehmer } from "./nachtarbeitnehmer.ts";
import { am, HAMBURG, istSonntag, tagAb, tageVonBis } from "./testhilfen.ts";

const werktage = (von: string, bis: string) => tageVonBis(von, bis, (tag) => !istSonntag(tag));
/** Night shifts from 22:00 of `minuten` on each Werktag */
const naechte = (von: string, bis: string, minuten: number) =>
  werktage(von, bis).map((tag) => tagAb(tag, "22:00", minuten));
const arten = (befunde: { art: string }[]) => befunde.map((befund) => befund.art);

describe("R-06: Arbeitszeit der Nachtarbeitnehmer (§ 6 Abs. 2 ArbZG)", () => {
  it("Verstoß: Nachtarbeitnehmer, 4 Wochen mit Ø 8:30 je Werktag", () => {
    // four weeks from 1.1.2026: 29.1. to 25.2.2026, 24 Werktage in Hamburg
    const { befunde } = nachtarbeitnehmer(naechte("2026-01-29", "2026-02-25", 510), {
      jetzt: am("2026-02-26"),
      standort: HAMBURG,
      wechselschicht: true,
      ausgleich: "vier_wochen",
    });
    const verstoss = befunde.find((befund) => befund.art === "nacht_ausgleich_nicht_erreicht");
    expect(verstoss).toMatchObject({
      regel: "R-06",
      norm: "§ 6 Abs. 2 Satz 2 ArbZG",
      schwere: "verstoss",
      zeitraum: { art: "vier_wochen", von: "2026-01-29", bis: "2026-02-25" },
      werktage: 24,
      minuten: 24 * 510,
      hoechstens: 24 * 480,
      ueber: 24 * 30,
    });
    expect(verstoss?.tage).toHaveLength(24);
  });

  it("Grenze: four weeks with Ø 8:00 je Werktag keep the average", () => {
    const { befunde } = nachtarbeitnehmer(naechte("2026-01-29", "2026-02-25", 480), {
      jetzt: am("2026-02-26"),
      standort: HAMBURG,
      wechselschicht: true,
      ausgleich: "vier_wochen",
    });
    expect(befunde).toEqual([]);
  });

  it("erlaubt: a day over 8 hours is a Hinweis to balance it within the month or four weeks", () => {
    const { befunde } = nachtarbeitnehmer([tagAb("2026-11-16", "22:00", 481)], {
      jetzt: am("2026-11-17"),
      standort: HAMBURG,
      wechselschicht: true,
    });
    expect(befunde).toEqual([
      {
        regel: "R-06",
        norm: "§ 6 Abs. 2 ArbZG",
        schwere: "hinweis",
        art: "nacht_ueber_8h",
        tage: ["2026-11-16"],
        minuten: 481,
        ueber: 1,
      },
    ]);
  });

  it("over 10 hours on a day is a Verstoß", () => {
    const { befunde } = nachtarbeitnehmer([tagAb("2026-11-16", "22:00", 601)], {
      jetzt: am("2026-11-17"),
      standort: HAMBURG,
      wechselschicht: true,
    });
    expect(befunde.map(({ art, schwere, ueber }) => ({ art, schwere, ueber }))).toEqual([
      { art: "nacht_ueber_10h", schwere: "verstoss", ueber: 1 },
    ]);
  });

  it("while the period runs, a period over the average is a Hinweis with the minutes to balance", () => {
    const { befunde } = nachtarbeitnehmer(naechte("2026-02-01", "2026-02-14", 540), {
      jetzt: am("2026-02-15"),
      standort: HAMBURG,
      wechselschicht: true,
      ausgleich: "kalendermonat",
    });
    expect(befunde.find((befund) => befund.art === "nacht_ausgleich_offen")).toMatchObject({
      schwere: "hinweis",
      zeitraum: { art: "kalendermonat", von: "2026-02-01", bis: "2026-02-28" },
      werktage: 12,
      ueber: 12 * 60,
    });
  });

  it("ohne Wahl: four weeks over the average but the calendar months not are no finding", () => {
    // 29.1. to 25.2.2026 at 8:30; January and February stay under 8 h per Werktag
    const { befunde } = nachtarbeitnehmer(naechte("2026-01-29", "2026-02-25", 510), {
      jetzt: am("2026-03-01"),
      standort: HAMBURG,
      wechselschicht: true,
    });
    expect(arten(befunde).filter((art) => art.startsWith("nacht_ausgleich"))).toEqual([]);
  });

  it("ohne Wahl: a month that is also four weeks over the average is a Verstoß for both", () => {
    // February 2026 begins on a Sunday and has 28 days: with four weeks from 1.2. both are the same
    const { befunde } = nachtarbeitnehmer(naechte("2026-02-01", "2026-02-28", 510), {
      jetzt: am("2026-03-01"),
      standort: HAMBURG,
      wechselschicht: true,
      beginn: "2026-02-01",
    });
    const verstoesse = befunde.filter((befund) => befund.art === "nacht_ausgleich_nicht_erreicht");
    expect(verstoesse.map((befund) => "zeitraum" in befund && befund.zeitraum.art)).toEqual([
      "kalendermonat",
      "vier_wochen",
    ]);
  });

  it("is not a Nachtarbeitnehmer: no finding of § 6 Abs. 2 for long days (R-02 judges them)", () => {
    const { befunde } = nachtarbeitnehmer(naechte("2026-11-02", "2026-11-14", 540), {
      jetzt: am("2026-12-01"),
      standort: HAMBURG,
    });
    expect(befunde).toEqual([]);
  });

  it("Hinweis on the 40th Nachtarbeitstag (bald Nachtarbeitnehmer) and on the 48th", () => {
    const liste = naechte("2026-01-05", "2026-02-28", 420).slice(0, 48);
    const { befunde } = nachtarbeitnehmer(liste, { jetzt: am("2026-03-01"), standort: HAMBURG });
    expect(befunde).toEqual([
      {
        regel: "R-06",
        norm: "§ 2 Abs. 5 Nr. 2 ArbZG",
        schwere: "hinweis",
        art: "bald_nachtarbeitnehmer",
        tage: [liste[39]?.tag],
        nummer: 40,
      },
      {
        regel: "R-06",
        norm: "§ 2 Abs. 5 Nr. 2 ArbZG",
        schwere: "hinweis",
        art: "nachtarbeitnehmer",
        tage: [liste[47]?.tag],
        nummer: 48,
      },
    ]);
  });

  it("§ 6 Abs. 2 Satz 3: a month without Nachtarbeit of a Nachtarbeitnehmer by days is left to R-03", () => {
    // 48 nights in January and February make a Nachtarbeitnehmer; March has day shifts of 9 h only,
    // April a night shift of 9 h
    const liste = [
      ...naechte("2026-01-05", "2026-02-28", 420).slice(0, 48),
      ...werktage("2026-03-02", "2026-03-07").map((tag) => tagAb(tag, "7:00", 540)),
      tagAb("2026-04-14", "22:00", 540),
    ];
    const { befunde } = nachtarbeitnehmer(liste, {
      jetzt: am("2026-05-01"),
      standort: HAMBURG,
      ausgleich: "kalendermonat",
    });
    const tageMitBefund = befunde
      .filter((befund) => befund.art === "nacht_ueber_8h")
      .flatMap((befund) => befund.tage);
    expect(tageMitBefund).toEqual(["2026-04-14"]);
  });
});
