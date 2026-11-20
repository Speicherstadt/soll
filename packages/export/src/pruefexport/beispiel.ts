import type { Pruefexport } from "./typen.ts";

const ms = (text: string) => Date.parse(text);

/**
 * Café Elbblick, October and November 2026, for the golden files: Lea with a closed October, a
 * changed Gehen, a finding and a counter-entry, and a night shift; Olena (mini-job) with a name the
 * PDF fonts cannot write and a reason that looks like a formula
 */
export const beispiel: Pruefexport = {
  betrieb: "Café Elbblick",
  von: "2026-10-01",
  bis: "2026-11-30",
  erstelltAm: ms("2026-12-02T10:00:00+01:00"),
  pruefseite: "https://soll.test/pruefen?betrieb=b1",
  personen: [
    {
      name: "Lea Schröder",
      tage: [
        {
          tag: "2026-10-06",
          beginn: ms("2026-10-06T08:00:00+02:00"),
          ende: ms("2026-10-06T18:15:00+02:00"),
          pauseMinuten: 30,
          arbeitsMinuten: 585,
          erfasstAm: ms("2026-10-07T09:12:00+02:00"),
          aenderungen: [
            {
              aktion: "geaendert",
              vorher: { art: "gehen", zeitpunkt: ms("2026-10-06T17:00:00+02:00") },
              nachher: { art: "gehen", zeitpunkt: ms("2026-10-06T18:15:00+02:00") },
              grund: "Inventur, Gehen vergessen",
              von: "Mia Hansen",
              am: ms("2026-10-07T09:12:00+02:00"),
            },
          ],
          befunde: [{ regel: "R-04", norm: "§ 4 ArbZG", schwere: "verstoss" }],
          gegeneintraege: [
            {
              minuten: -15,
              grund: "Pause nicht gestempelt",
              von: "Mia Hansen",
              am: ms("2026-11-04T11:00:00+01:00"),
            },
          ],
        },
        {
          tag: "2026-10-31",
          beginn: ms("2026-10-31T20:00:00+01:00"),
          ende: ms("2026-11-01T02:00:00+01:00"),
          pauseMinuten: 0,
          arbeitsMinuten: 360,
          erfasstAm: ms("2026-11-01T02:00:00+01:00"),
          aenderungen: [],
          befunde: [],
          gegeneintraege: [],
        },
        {
          tag: "2026-11-03",
          beginn: ms("2026-11-03T09:00:00+01:00"),
          ende: null,
          pauseMinuten: 0,
          arbeitsMinuten: 0,
          erfasstAm: ms("2026-11-03T09:00:00+01:00"),
          aenderungen: [],
          befunde: [{ regel: "R-01", norm: "BAG 1 ABR 22/21", schwere: "hinweis" }],
          gegeneintraege: [],
        },
      ],
      monate: [
        {
          monat: "2026-10",
          pruefwert: `Nr. 42 · ${"ab".repeat(32)}`,
          abgeschlossenAm: ms("2026-11-03T10:00:00+01:00"),
        },
        { monat: "2026-11", pruefwert: null, abgeschlossenAm: null },
      ],
    },
    {
      name: "Олена Коваль",
      tage: [
        {
          tag: "2026-11-10",
          beginn: ms("2026-11-10T10:00:00+01:00"),
          ende: ms("2026-11-10T14:00:00+01:00"),
          pauseMinuten: 0,
          arbeitsMinuten: 240,
          erfasstAm: ms("2026-11-18T08:00:00+01:00"),
          aenderungen: [
            {
              aktion: "nachgetragen",
              vorher: null,
              nachher: { art: "kommen", zeitpunkt: ms("2026-11-10T10:00:00+01:00") },
              grund: "=Zettel; Mia",
              von: "Олена Коваль",
              am: ms("2026-11-18T08:00:00+01:00"),
            },
          ],
          befunde: [],
          gegeneintraege: [],
        },
      ],
      monate: [
        { monat: "2026-10", pruefwert: null, abgeschlossenAm: null },
        { monat: "2026-11", pruefwert: null, abgeschlossenAm: null },
      ],
    },
  ],
};
