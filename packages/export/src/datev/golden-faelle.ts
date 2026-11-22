import type { DatevExportEingabe, DatevZiel } from "./export.ts";
import type { Lohnarten } from "./posten.ts";
import { HAMBURG, minijobModell, monatsModell, monatsTage, stundenModell } from "./testdaten.ts";

/*
 * The cases of the golden files (S-308, "Fertig, wenn"): the file each case must give, byte for
 * byte, lies in golden/<fall>.<ziel>.txt. The numbers are worked out by hand in the comments.
 */

/** A mapping as a payroll office might choose it; the numbers mean nothing beyond these tests */
const LOHNARTEN: Lohnarten = {
  stunden: "1000",
  minijob: "1100",
  feiertag: "1010",
  nacht_steuerfrei: "1300",
  nacht_steuerpflichtig: "1301",
  sonntag_steuerfrei: "1310",
  sonntag_steuerpflichtig: "1311",
  feiertag_steuerfrei: "1320",
  feiertag_steuerpflichtig: "1321",
};

const einstellungen = (personalnummern: Record<string, string>) => ({
  beraterNr: "1234567",
  mandantenNr: "10001",
  lohnarten: LOHNARTEN,
  personalnummern,
});

const MO_FR = [480, 480, 480, 480, 480, 0, 0];
const NACH_PLAN = [0, 0, 0, 0, 0, 0, 0];
const SOMMER = "+02:00";
const WINTER = "+01:00";

const tagSchicht = (tag: string) => ({
  tag,
  von: "07:00",
  bis: "15:30",
  pause: ["11:30", "12:00"] as [string, string],
});

/**
 * Stundenlohn, Weber Haustechnik, May 2026 (holidays in Hamburg: Fri 1.5., Thu 14.5., Mon 25.5.).
 * Sandra (101), 21,50 € an hour, Mo–Fr 8 h, works 4.–8. and 11.–13.5. at 8 h: 3.840 min, and a
 * counter-entry of +45 min to 30.4. booked in May: 3.885 min = 64,75 h; the three holidays take
 * 3 × 480 min = 24,00 h. Max (102), 19,80 €, works 4.5. 7:00–15:37 with 30 min break: 487 min =
 * 8,1166… h, rounded up to 8,12; holidays 24,00 h. Leon (103), apprentice on a monthly wage without
 * surcharges, has no item and so no record.
 */
const stundenlohn = (ziel: DatevZiel): DatevExportEingabe => {
  const sandraTage = ["04", "05", "06", "07", "08", "11", "12", "13"].map((d) =>
    tagSchicht(`2026-05-${d}`),
  );
  return {
    ziel,
    monat: "2026-05",
    einstellungen: einstellungen({ sandra: "101", max: "102", leon: "103" }),
    offen: [],
    monate: [
      {
        nutzerId: "max",
        monat: "2026-05",
        tage: monatsTage(
          "2026-05",
          MO_FR,
          [{ tag: "2026-05-04", von: "07:00", bis: "15:37", pause: ["11:30", "12:00"] }],
          SOMMER,
        ),
        gegeneintraege: [],
        modelle: [stundenModell(1980)],
        standort: HAMBURG,
      },
      {
        nutzerId: "sandra",
        monat: "2026-05",
        tage: monatsTage("2026-05", MO_FR, sandraTage, SOMMER),
        gegeneintraege: [{ tag: "2026-04-30", minuten: 45 }],
        modelle: [stundenModell(2150)],
        standort: HAMBURG,
      },
      {
        nutzerId: "leon",
        monat: "2026-05",
        tage: monatsTage("2026-05", MO_FR, sandraTage, SOMMER),
        gegeneintraege: [],
        modelle: [monatsModell(95_000)],
        standort: HAMBURG,
      },
    ],
  };
};

/**
 * Minijob, Café Elbblick, November 2026, both "nach Plan" (no fixed hours, so no holiday hours).
 * Olena (21), 14,00 €: Tue 3.11. 10:00–14:00, Thu 5.11. 10:00–15:15, Tue 10.11. 17:00–21:20:
 * 240 + 315 + 260 = 815 min = 13,5833… h → 13,59. Piotr (22), 14,50 €: Sat 7.11. 9:00–13:30 =
 * 270 min = 4,50 h.
 */
const minijob = (ziel: DatevZiel): DatevExportEingabe => ({
  ziel,
  monat: "2026-11",
  einstellungen: einstellungen({ olena: "21", piotr: "22" }),
  offen: [],
  monate: [
    {
      nutzerId: "olena",
      monat: "2026-11",
      tage: monatsTage(
        "2026-11",
        NACH_PLAN,
        [
          { tag: "2026-11-03", von: "10:00", bis: "14:00" },
          { tag: "2026-11-05", von: "10:00", bis: "15:15" },
          { tag: "2026-11-10", von: "17:00", bis: "21:20" },
        ],
        WINTER,
      ),
      gegeneintraege: [],
      modelle: [minijobModell(1400)],
      standort: HAMBURG,
    },
    {
      nutzerId: "piotr",
      monat: "2026-11",
      tage: monatsTage(
        "2026-11",
        NACH_PLAN,
        [{ tag: "2026-11-07", von: "09:00", bis: "13:30" }],
        WINTER,
      ),
      gegeneintraege: [],
      modelle: [minijobModell(1450)],
      standort: HAMBURG,
    },
  ],
});

/**
 * Zuschläge, Café Elbblick, December 2026. Tom (11), 16,00 € an hour, Mo–Fr 8 h, pays 25 % night,
 * 40 % from 0 to 4 Uhr, 50 % Sunday, 125 % holiday and 150 % on 25.12.:
 * - Sun 6.12. 10:00–18:30, break 14:00–14:30: 480 min Sunday, 50 % of 16,00 € = 8,00 € an hour,
 *   64,00 € tax-free;
 * - Fri 11.12. 18:00–02:00: 20–24 Uhr 240 min at 25 % = 16,00 €, 0–2 Uhr 120 min at 40 % = 12,80 €,
 *   28,80 € night, all tax-free;
 * - Fri 25.12. 10:00–18:30, break 14:00–14:30: 480 min at 150 % = 192,00 €, tax-free; worked on the
 *   holiday, so no holiday hours;
 * worked 480 + 480 + 480 = 1.440 min = 24,00 h.
 * Olena (21), mini-job at 14,00 €, pays 70 % on Sunday: Sun 6.12. 10:00–14:00, 240 min: 39,20 €
 * paid, 50 % = 28,00 € tax-free, 11,20 € taxable; 4,00 h.
 * Lea (12), 2.800,00 € a month at 40 h a week, 50 % Sunday: Sun 13.12. 12:00–16:00, 240 min;
 * Grundlohn 2.800 € ÷ (40 × 4,35) = 16,0919… € an hour, 50 % for 4 h = 32,1839… €: paid 32,19 €
 * (rounded up), tax-free 32,18 € (rounded down), and the cent rounded up is taxable, as the limit of
 * 50 % leaves no room above the exact amount: 0,01 €. No hours: her wage is master data in payroll.
 */
const zuschlaege = (ziel: DatevZiel): DatevExportEingabe => ({
  ziel,
  monat: "2026-12",
  einstellungen: einstellungen({ tom: "11", lea: "12", olena: "21" }),
  offen: [],
  monate: [
    {
      nutzerId: "tom",
      monat: "2026-12",
      tage: monatsTage(
        "2026-12",
        MO_FR,
        [
          { tag: "2026-12-06", von: "10:00", bis: "18:30", pause: ["14:00", "14:30"] },
          { tag: "2026-12-11", von: "18:00", bis: "02:00" },
          { tag: "2026-12-25", von: "10:00", bis: "18:30", pause: ["14:00", "14:30"] },
        ],
        WINTER,
      ),
      gegeneintraege: [],
      modelle: [
        stundenModell(1600, {
          zuschlagssaetze: {
            nacht: 2500,
            nacht0bis4: 4000,
            sonntag: 5000,
            feiertag: 12_500,
            feiertag150: 15_000,
          },
        }),
      ],
      standort: HAMBURG,
    },
    {
      nutzerId: "olena",
      monat: "2026-12",
      tage: monatsTage(
        "2026-12",
        NACH_PLAN,
        [{ tag: "2026-12-06", von: "10:00", bis: "14:00" }],
        WINTER,
      ),
      gegeneintraege: [],
      modelle: [minijobModell(1400, { zuschlagssaetze: { sonntag: 7000 } })],
      standort: HAMBURG,
    },
    {
      nutzerId: "lea",
      monat: "2026-12",
      tage: monatsTage(
        "2026-12",
        MO_FR,
        [{ tag: "2026-12-13", von: "12:00", bis: "16:00" }],
        WINTER,
      ),
      gegeneintraege: [],
      modelle: [monatsModell(280_000, { zuschlagssaetze: { sonntag: 5000 } })],
      standort: HAMBURG,
    },
  ],
});

export const GOLDEN_FAELLE = { stundenlohn, minijob, zuschlaege } as const;
