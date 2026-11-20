import { describe, expect, it } from "vitest";
import { modell } from "../soll/testhilfen.ts";
import { volleElternzeitmonate } from "./elternzeit.ts";
import { anspruch, MO_DO_8, tage } from "./testhilfen.ts";

const GANZES_JAHR = [{ von: "2020-01-01", bis: null }];

/* docs/regeln.md, R-25 (cases taken literally), in 2026 */
describe("R-25: Zusatzurlaub", () => {
  it("erlaubt: 5-day week, whole year – 5 days", () => {
    const wert = anspruch({ schwerbehinderung: GANZES_JAHR });
    expect(wert.zusatzHalbtage).toBe(tage(5));
    expect(wert.gesamtHalbtage).toBe(tage(25));
  });

  it("Grenze: 4-day week, whole year – 4 days", () => {
    const wert = anspruch({
      modelle: [modell("2020-01-01", MO_DO_8)],
      schwerbehinderung: GANZES_JAHR,
    });
    expect(wert.zusatzHalbtage).toBe(tage(4));
  });

  it("anteilig: disability from 1.7., 5-day week (6 full months) – 2,5 → 3 days", () => {
    const wert = anspruch({ schwerbehinderung: [{ von: "2026-07-01", bis: null }] });
    expect(wert.zusatzHalbtage).toBe(tage(3));
  });

  it("Verstoß: 5-day week, whole year, 4 days entered – Hinweis „Zusatzurlaub unter dem Gesetz“", () => {
    const wert = anspruch({ schwerbehinderung: GANZES_JAHR, zusatzurlaubHalbtage: tage(4) });
    expect(wert.befunde).toEqual([
      {
        regel: "R-25",
        norm: "§ 208 Abs. 1 Satz 1 SGB IX",
        schwere: "hinweis",
        art: "zusatzurlaub_unter_gesetz",
        tage: ["2026-01-01"],
        eingetragenHalbtage: tage(4),
        gesetzlichHalbtage: tage(5),
      },
    ]);
    expect(wert.zusatzHalbtage).toBe(tage(5));
  });

  it("6-Tage-Woche: whole year – 6 days", () => {
    const wert = anspruch({
      modelle: [modell("2020-01-01", [400, 400, 400, 400, 400, 400, 0])],
      schwerbehinderung: GANZES_JAHR,
    });
    expect(wert.zusatzHalbtage).toBe(tage(6));
    expect(wert.grundHalbtage).toBe(tage(24));
  });

  it("Bruchteil: disability from 15.7., 5-day week (5 full months) – 2,08 → 2,5 days", () => {
    const wert = anspruch({ schwerbehinderung: [{ von: "2026-07-15", bis: null }] });
    expect(wert.zusatzHalbtage).toBe(tage(2.5));
  });

  it("Modellwechsel: Mo–Di until 30.9., Mo–Fr from 1.10., disability from 1.10. – 1,25 → 1,5 days, counting only the days with the disability", () => {
    // Mo–Di until 30.9.2026, Mo–Fr from 1.10.2026, disability from 1.10.2026 (3 full months):
    // § 208 Abs. 2 SGB IX gives 3/12 of the additional leave of Abs. 1 for those months, at five
    // days a week 5 × 3 ÷ 12 = 1,25 → 1,5 days (EuGH C-415/12, Brandes); weighting the months
    // before the disability in would give 0,69 → 1 day
    const wert = anspruch({
      modelle: [modell("2020-01-01", [480, 480, 0, 0, 0, 0, 0]), modell("2026-10-01")],
      schwerbehinderung: [{ von: "2026-10-01", bis: null }],
    });
    expect(wert.zusatzHalbtage).toBe(tage(1.5));
  });

  it("Bescheid verlängert: 1.2.–15.4. and 16.4.–30.6. count as one span of 5 full months – 2,08 → 2,5 days", () => {
    // a limited Bescheid followed seamlessly by the next one: the disability lasts 1.2.–30.6.2026
    // without a break, 5 full months (§§ 187, 188 BGB), 5 × 5 ÷ 12 = 2,08 → 2,5 days (§ 208 Abs. 2
    // SGB IX); counted per entry it would be 2 + 2 months, 1,67 → 2 days
    const wert = anspruch({
      schwerbehinderung: [
        { von: "2026-02-01", bis: "2026-04-15" },
        { von: "2026-04-16", bis: "2026-06-30" },
      ],
    });
    expect(wert.zusatzHalbtage).toBe(tage(2.5));
  });

  it("follows the Teilurlaub of § 5 BUrlG while the disability lasts the whole employment", () => {
    // Eintritt 1.8.2026 with disability: 5 × 5 ÷ 12 = 2,08 → 2,5 days besides 8,5 days of leave
    const wert = anspruch({
      modelle: [modell("2026-08-01")],
      beschaeftigung: { eintritt: "2026-08-01" },
      schwerbehinderung: GANZES_JAHR,
    });
    expect(wert.zusatzHalbtage).toBe(tage(2.5));
    expect(wert.gesamtHalbtage).toBe(tage(11));
  });

  it("keeps more additional leave the business entered", () => {
    expect(
      anspruch({ schwerbehinderung: GANZES_JAHR, zusatzurlaubHalbtage: tage(6) }).zusatzHalbtage,
    ).toBe(tage(6));
  });
});

const ELTERNZEIT_APRIL = [{ von: "2026-03-15", bis: "2026-05-14" }];

/* docs/regeln.md, R-26 (cases taken literally), in 2026 */
describe("R-26: Kürzung bei Elternzeit", () => {
  it("erlaubt: 15.3. – 14.5. (one full calendar month: April) – reduction by 1/12 proposed", () => {
    const wert = anspruch({ elternzeit: ELTERNZEIT_APRIL });
    expect(wert.befunde).toEqual([
      {
        regel: "R-26",
        norm: "§ 17 Abs. 1 Satz 1 BEEG",
        schwere: "hinweis",
        art: "kuerzung_vorgeschlagen",
        tage: ["2026-04-01"],
        erlaubtZwoelftel: 1,
        erklaertZwoelftel: null,
      },
    ]);
    // proposed, not taken: nothing off until the business declares it
    expect(wert.gesamtHalbtage).toBe(tage(20));
  });

  it("erlaubt, declared: 1/12 of 20 days taken off, 18,33 → 18,5 days remain", () => {
    const wert = anspruch({ elternzeit: ELTERNZEIT_APRIL, elternzeitKuerzungZwoelftel: 1 });
    expect(wert.befunde).toEqual([]);
    expect(wert.elternzeit).toEqual({
      volleMonate: ["2026-04"],
      kuerzungZwoelftel: 1,
      kuerzungHalbtage: 3,
    });
    expect(wert.grundHalbtage).toBe(tage(18.5));
  });

  it("Grenze: 2.3. – 31.3. (no full calendar month) – no reduction", () => {
    const wert = anspruch({
      elternzeit: [{ von: "2026-03-02", bis: "2026-03-31" }],
      elternzeitKuerzungZwoelftel: 1,
    });
    expect(wert.elternzeit.kuerzungZwoelftel).toBe(0);
    expect(wert.gesamtHalbtage).toBe(tage(20));
  });

  it("ausgenommen: 1.4. – 30.6. in part-time with the business – no reduction", () => {
    const wert = anspruch({
      elternzeit: [{ von: "2026-04-01", bis: "2026-06-30", teilzeit: true }],
    });
    expect(wert.elternzeit.volleMonate).toEqual([]);
    expect(wert.befunde).toEqual([]);
  });

  it("Verstoß: one full calendar month, 2/12 entered – Hinweis „Kürzung über 1/12 je vollem Monat“", () => {
    const wert = anspruch({ elternzeit: ELTERNZEIT_APRIL, elternzeitKuerzungZwoelftel: 2 });
    expect(wert.befunde).toMatchObject([
      { regel: "R-26", art: "kuerzung_zu_hoch", erlaubtZwoelftel: 1, erklaertZwoelftel: 2 },
    ]);
    expect(wert.elternzeit.kuerzungZwoelftel).toBe(1);
  });

  it("Jahreswechsel: 15.10.2026 – 14.3.2027 – 2026: November, December; 2027: January, February", () => {
    const elternzeit = [{ von: "2026-10-15", bis: "2027-03-14" }];
    expect(volleElternzeitmonate(2026, elternzeit)).toEqual(["2026-11", "2026-12"]);
    expect(volleElternzeitmonate(2027, elternzeit)).toEqual(["2027-01", "2027-02"]);
    const wert2027 = anspruch({ jahr: 2027, elternzeit, elternzeitKuerzungZwoelftel: 2 });
    // 20 × 10 ÷ 12 = 16,67 → 17 days
    expect(wert2027.grundHalbtage).toBe(tage(17));
  });

  it("nicht erklärt: one full calendar month, no declaration – no reduction, a Hinweis with the proposal", () => {
    const wert = anspruch({ elternzeit: ELTERNZEIT_APRIL, elternzeitKuerzungZwoelftel: null });
    expect(wert.elternzeit.kuerzungZwoelftel).toBe(0);
    expect(wert.befunde.map((befund) => befund.art)).toEqual(["kuerzung_vorgeschlagen"]);
  });

  it("Schaltjahr: 1.2.2028 – 28.2.2028 – no reduction (29.2. is missing)", () => {
    expect(volleElternzeitmonate(2028, [{ von: "2028-02-01", bis: "2028-02-28" }])).toEqual([]);
    expect(volleElternzeitmonate(2027, [{ von: "2027-02-01", bis: "2027-02-28" }])).toEqual([
      "2027-02",
    ]);
  });

  it("joins spans and declines to propose once the business decided on no reduction", () => {
    const zweiTeile = [
      { von: "2026-04-01", bis: "2026-04-15" },
      { von: "2026-04-16", bis: "2026-04-30" },
    ];
    expect(volleElternzeitmonate(2026, zweiTeile)).toEqual(["2026-04"]);
    expect(anspruch({ elternzeit: zweiTeile, elternzeitKuerzungZwoelftel: 0 }).befunde).toEqual([]);
  });

  it("does not reduce the additional leave of § 208 SGB IX", () => {
    const wert = anspruch({
      elternzeit: ELTERNZEIT_APRIL,
      elternzeitKuerzungZwoelftel: 1,
      schwerbehinderung: [{ von: "2020-01-01", bis: null }],
    });
    expect(wert.zusatzHalbtage).toBe(tage(5));
  });
});
