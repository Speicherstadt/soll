import { describe, expect, it } from "vitest";
import { ersatzruhetag } from "./ersatzruhetag.ts";
import { ruhetagAm } from "./ruhetage.ts";
import { am, HAMBURG, tagAb, tageVonBis } from "./testhilfen.ts";

/** A working day 8:00 – 16:00 on each day */
const arbeit = (liste: string[]) => liste.map((tag) => tagAb(tag, "8:00", 480));
const werktag = (tag: string) => {
  const ruhetag = ruhetagAm(tag, HAMBURG);
  return ruhetag.ok && ruhetag.ruhetag === null;
};
/** Every Werktag in Hamburg (Mon to Sat, no holiday) from `von` to `bis` except the days in `frei` */
const werktageAusser = (von: string, bis: string, frei: string[] = []) =>
  tageVonBis(von, bis, (tag) => werktag(tag) && !frei.includes(tag));

describe("R-09: Ersatzruhetag (§ 11 Abs. 3 ArbZG)", () => {
  it("erlaubt: Arbeit So, frei Di", () => {
    const liste = arbeit(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-18"]);
    const ergebnis = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-11-20") });
    expect(ergebnis).toEqual({ befunde: [], nichtHinterlegt: [] });
  });

  it("Grenze: Arbeit So, einziger freier Werktag am 13. Tag danach (Sa der übernächsten Woche)", () => {
    // So 15.11.2026: the period reaches from Mo 2.11. to Sa 28.11.
    const liste = arbeit([
      ...werktageAusser("2026-11-02", "2026-11-28", ["2026-11-28"]),
      "2026-11-15",
    ]);
    const ergebnis = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-12-01") });
    expect(ergebnis.befunde).toEqual([]);
  });

  it("Verstoß: Arbeit So, 13 Tage davor und danach kein freier Werktag, der nächste am 15. Tag danach (Mo)", () => {
    const liste = arbeit([...werktageAusser("2026-11-02", "2026-11-28"), "2026-11-15"]);
    const { befunde } = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-12-01") });
    expect(befunde).toEqual([
      {
        regel: "R-09",
        norm: "§ 11 Abs. 3 Satz 1 ArbZG",
        schwere: "verstoss",
        art: "ersatzruhetag_fehlt",
        tage: ["2026-11-15"],
        von: "2026-11-02",
        bis: "2026-11-28",
        feiertag: null,
      },
    ]);
  });

  it("Feiertag: Arbeit Mo 25.5.2026 (Pfingstmontag), freier Werktag nach 7 Wochen", () => {
    // the period of eight weeks reaches 55 days before and after: 31.3. to 19.7.2026
    const liste = arbeit([
      ...werktageAusser("2026-03-31", "2026-07-19", ["2026-07-13"]),
      "2026-05-25",
    ]);
    const ergebnis = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-08-01") });
    expect(ergebnis.befunde).toEqual([]);
    // without the free Monday 13.7.: a Verstoß under Satz 2
    const ohne = ersatzruhetag([...liste, ...arbeit(["2026-07-13"])], {
      standort: HAMBURG,
      jetzt: am("2026-08-01"),
    });
    expect(ohne.befunde).toMatchObject([
      { art: "ersatzruhetag_fehlt", norm: "§ 11 Abs. 3 Satz 2 ArbZG", feiertag: "Pfingstmontag" },
    ]);
  });

  it("while the period runs without a free Werktag, a Hinweis with the last day", () => {
    // every Werktag from 26.10. on worked, and the Sundays 8.11. and 15.11.
    const liste = arbeit([
      ...werktageAusser("2026-10-26", "2026-11-17"),
      "2026-11-08",
      "2026-11-15",
    ]);
    const { befunde } = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-11-18") });
    expect(befunde.map(({ art, schwere, tage, bis }) => ({ art, schwere, tage, bis }))).toEqual([
      { art: "ersatzruhetag_offen", schwere: "hinweis", tage: ["2026-11-08"], bis: "2026-11-21" },
      { art: "ersatzruhetag_offen", schwere: "hinweis", tage: ["2026-11-15"], bis: "2026-11-28" },
    ]);
  });

  it("gives each Sunday its own free Werktag", () => {
    // Sundays 8.11. and 15.11. worked, only Wednesday 11.11. free
    const liste = arbeit(
      werktageAusser("2026-10-26", "2026-11-28", ["2026-11-11"]).concat("2026-11-08", "2026-11-15"),
    );
    const { befunde } = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-12-01") });
    expect(befunde.map(({ art, tage }) => ({ art, tage }))).toEqual([
      { art: "ersatzruhetag_fehlt", tage: ["2026-11-15"] },
    ]);
  });

  it("lets the Sunday choose before the holiday with the longer period", () => {
    // Pfingstmontag 25.5. and Sunday 31.5.2026 worked; free are Tue 2.6. and Mon 13.7. In calendar
    // order the holiday would take 2.6., the only free day of the Sunday's two weeks
    const liste = arbeit([
      ...werktageAusser("2026-03-31", "2026-07-19", ["2026-06-02", "2026-07-13"]),
      "2026-05-25",
      "2026-05-31",
    ]);
    const ergebnis = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-08-01") });
    expect(ergebnis.befunde).toEqual([]);
  });

  it("does not count a Werktag touched by a night shift as free", () => {
    // Sunday 15.11. worked; Monday 16.11. off, but the shift of Sunday reaches into it until 1:00
    const liste = [
      ...arbeit(werktageAusser("2026-11-02", "2026-11-28", ["2026-11-16"])),
      tagAb("2026-11-15", "17:00", 480),
    ];
    const { befunde } = ersatzruhetag(liste, { standort: HAMBURG, jetzt: am("2026-12-01") });
    expect(befunde.map((befund) => befund.art)).toEqual(["ersatzruhetag_fehlt"]);
  });
});
