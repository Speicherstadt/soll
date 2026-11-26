import { type Stempelart, tagInBerlin } from "@soll/arbeitszeit";
import type { Betrieb } from "../sitzung/ziel.ts";

export const heuteTag = () => tagInBerlin(Date.now());

const mitUhr = (stunde: number, minute: number): number => {
  const jetzt = new Date();
  jetzt.setHours(stunde, minute, 0, 0);
  return jetzt.getTime();
};

export type DemoZustand = {
  betrieb: Betrieb;
  stempelungen: {
    stempelId: string;
    nutzerId: string;
    art: Stempelart;
    zeitpunkt: number;
    geraetZeitpunkt: number | null;
    quelle: "app" | "terminal" | "api" | "import";
    offline: boolean;
    nummer: number | null;
    korrigiert: boolean;
  }[];
  stoppuhr: {
    laufend: {
      buchungId: string;
      nutzerId: string;
      projektId: string | null;
      taetigkeitId: string;
      beginn: number;
      ende: number | null;
      tag: string;
      notiz: string;
      abgerechnetAm: number | null;
      minuten: number;
      kommen: { stempelId: string; zeitpunkt: number } | null;
    } | null;
    buchungen: {
      buchungId: string;
      nutzerId: string;
      projektId: string | null;
      taetigkeitId: string;
      beginn: number;
      ende: number | null;
      tag: string;
      notiz: string;
      abgerechnetAm: number | null;
      minuten: number;
      kommen: { stempelId: string; zeitpunkt: number } | null;
    }[];
  };
  abwesenheiten: {
    abwesenheitId: string;
    nutzerId: string;
    name: string;
    art: "urlaub" | "krank" | "kind_krank" | "sonderurlaub" | "ueberstunden";
    von: string;
    bis: string | null;
    ersterHalb: boolean;
    letzterHalb: boolean;
    status: "beantragt" | "genehmigt" | "abgelehnt" | "zurueckgezogen" | "storniert";
    kind: string | null;
    bescheinigung: "eau" | "papier" | null;
    grund: string | null;
  }[];
  pruefung: {
    branche: string | null;
    sonntagsausnahme: number | null;
    ausgleichszeitraum: string | null;
    ausgleichBeginn: string | null;
  };
  bescheinigungAbTag: number;
};

export const demoStartzustand = (): DemoZustand => ({
  betrieb: {
    betriebId: "weber-demo",
    nutzerId: "jonas",
    name: "Weber Haustechnik",
    land: "DE-HH",
    eingerichtet: true,
    rolle: "inhaber",
    module: { arbeitszeit: true, dienstplan: true, projektzeit: true, terminal: true },
    auswertungJePersonSeit: null,
  },
  stempelungen: [
    {
      stempelId: "s1",
      nutzerId: "jonas",
      art: "kommen",
      zeitpunkt: mitUhr(7, 3),
      geraetZeitpunkt: null,
      quelle: "app",
      offline: false,
      nummer: null,
      korrigiert: false,
    },
  ],
  stoppuhr: {
    laufend: null,
    buchungen: [
      {
        buchungId: "b1",
        nutzerId: "jonas",
        projektId: "p1",
        taetigkeitId: "t2",
        beginn: mitUhr(7, 15),
        ende: mitUhr(9, 45),
        tag: heuteTag(),
        notiz: "Rohinstallation 3. OG",
        abgerechnetAm: null,
        minuten: 150,
        kommen: { stempelId: "s1", zeitpunkt: mitUhr(7, 3) },
      },
    ],
  },
  abwesenheiten: [
    {
      abwesenheitId: "a1",
      nutzerId: "jonas",
      name: "Jonas Weber",
      art: "urlaub",
      von: "2026-09-14",
      bis: "2026-09-18",
      ersterHalb: false,
      letzterHalb: false,
      status: "genehmigt",
      kind: null,
      bescheinigung: null,
      grund: null,
    },
  ],
  pruefung: {
    branche: null,
    sonntagsausnahme: null,
    ausgleichszeitraum: null,
    ausgleichBeginn: null,
  },
  bescheinigungAbTag: 4,
});

export const DEMO_PERSONEN = [
  { nutzerId: "jonas", name: "Jonas Weber", rolle: "inhaber", modellId: "m1" },
  { nutzerId: "anna", name: "Anna Brandt", rolle: "planer", modellId: "m1" },
  { nutzerId: "sandra", name: "Sandra Kowalski", rolle: "mitarbeiter", modellId: "m1" },
  { nutzerId: "max", name: "Max Petersen", rolle: "mitarbeiter", modellId: "m1" },
  { nutzerId: "leon", name: "Leon Schulz", rolle: "mitarbeiter", modellId: "m2" },
];

export const DEMO_MODELLE = [
  {
    modellId: "m1",
    name: "Vollzeit 39 h",
    wochenminuten: 2340,
    tage: [480, 480, 468, 468, 444, 0, 0],
    urlaubstage: 28,
  },
  {
    modellId: "m2",
    name: "Ausbildung 39 h",
    wochenminuten: 2340,
    tage: [480, 480, 468, 468, 444, 0, 0],
    urlaubstage: 30,
  },
];

export const DEMO_KUNDEN = [
  { kundeId: "k1", name: "Elbhof Wohnungsbau", nummer: "K-1001", archiviertAm: null },
  { kundeId: "k2", name: "Familie Petersen", nummer: "K-1002", archiviertAm: null },
  { kundeId: "k3", name: "Hotel Speicherblick", nummer: "K-1003", archiviertAm: null },
];

export const DEMO_PROJEKTE = [
  {
    projektId: "p1",
    kundeId: "k1",
    name: "Elbhof, 3. OG",
    nummer: "A-2026-14",
    budgetMinuten: 24000,
    budgetCent: null,
    warnungProzent: 80,
    archiviertAm: null,
    budget: [
      {
        art: "minuten",
        verbraucht: 19440,
        budget: 24000,
        rest: 4560,
        stufe: "warnung",
      },
    ],
  },
  {
    projektId: "p2",
    kundeId: "k2",
    name: "Heizungstausch Petersen",
    nummer: "A-2026-19",
    budgetMinuten: 6000,
    budgetCent: null,
    warnungProzent: 80,
    archiviertAm: null,
    budget: [
      {
        art: "minuten",
        verbraucht: 2820,
        budget: 6000,
        rest: 3180,
        stufe: "ok",
      },
    ],
  },
  {
    projektId: "p3",
    kundeId: "k3",
    name: "Wartung Speicherblick",
    nummer: "A-2026-22",
    budgetMinuten: null,
    budgetCent: null,
    warnungProzent: 80,
    archiviertAm: null,
    budget: [],
  },
];

export const DEMO_TAETIGKEITEN = [
  { taetigkeitId: "t1", name: "Fahrt", abrechenbar: true, fest: true, archiviertAm: null },
  { taetigkeitId: "t2", name: "Montage", abrechenbar: true, fest: false, archiviertAm: null },
  { taetigkeitId: "t3", name: "Wartung", abrechenbar: true, fest: false, archiviertAm: null },
];
