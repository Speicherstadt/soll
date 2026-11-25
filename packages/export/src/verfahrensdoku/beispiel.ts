import { LEERE_ANGABEN } from "./angaben.ts";
import type { DokuRolle, DokuStandDaten } from "./typen.ts";

/*
 * The states of the two test businesses of CLAUDE.md for the golden files: Weber Haustechnik (SHK,
 * Hamburg; working and project time, Haben, every statement given, an own section) and Café
 * Elbblick (Hamburg; working time, shift plan and a terminal, statements missing).
 */

const PRUEFWERT = `Nr. 4711 · ${"3f9a".repeat(16)}`;

const rolle = (name: string, mitglieder: number, rechte: string[]): DokuRolle => ({
  rolle: name,
  mitglieder,
  rechte,
});

export const weber: DokuStandDaten = {
  version: "1.0.0",
  betrieb: { name: "Weber Haustechnik", land: "HH" },
  module: { arbeitszeit: true, dienstplan: false, projektzeit: true, terminal: false },
  standorte: [{ name: "Werkstatt Wandsbek", land: "HH", regionen: [] }],
  rollen: [
    rolle("inhaber", 1, ["betrieb:lesen", "monat:abschliessen", "verfahrensdoku:verwalten"]),
    rolle("planer", 1, ["betrieb:lesen", "zeiten:korrigieren"]),
    rolle("mitarbeiter", 3, ["betrieb:lesen", "stempeln"]),
    rolle("lohnbuero", 0, ["lohn:datev"]),
  ],
  apiZugaenge: 1,
  kette: { pruefwert: PRUEFWERT, glieder: 4711, befunde: 0 },
  aufbewahrung: { abgeschlossen: 15, ausgesondert: { zweiJahre: 0, achtJahre: 0 } },
  terminal: { terminals: [], karten: { uid: 0, ntag424: 0 }, ausweise: 0, pins: 0 },
  datev: { eingerichtet: true, nummern: true, lohnarten: 4, personalnummern: 5 },
  haben: { adresse: "https://haben.weber-haustechnik.test" },
  angaben: {
    rechtsform: "Einzelunternehmen",
    anschrift: "Wandsbeker Chaussee 1\n22089 Hamburg",
    verantwortlich: "Jonas Weber (Inhaber), vertreten durch Anna Weber (Büro)",
    aufbewahrungsort: "Server im Büro in Hamburg, Sicherungen auf einem NAS im selben Gebäude",
    serverbetrieb: "Jonas Weber spielt Updates monatlich nach einer Sicherung ein.",
    datensicherung:
      "Täglich um 3:15 mit soll backup, danach restic auf das NAS; Anna prüft einmal im Quartal eine Wiederherstellung.",
    schluesselablage: "Tresor im Büro, Umschlag „Soll“",
    eigene: [
      {
        titel: "Stundenzettel auf Papier vor Soll",
        text: "Bis Oktober 2026 schrieben die Monteure Stundenzettel auf Papier.\n\nDie Zettel liegen im Ordner *2026* im Büro.",
      },
    ],
  },
  angabenAenderungen: [
    { seq: 4700, zeitpunkt: Date.UTC(2026, 10, 2, 9, 15) },
    { seq: 4705, zeitpunkt: Date.UTC(2026, 10, 20, 15, 40) },
  ],
};

export const elbblick: DokuStandDaten = {
  version: "1.0.0",
  betrieb: { name: "Café Elbblick", land: "HH" },
  module: { arbeitszeit: true, dienstplan: true, projektzeit: false, terminal: true },
  standorte: [{ name: "Café am Hafen", land: "HH", regionen: [] }],
  rollen: [
    rolle("inhaber", 1, ["betrieb:lesen", "terminal:verwalten"]),
    rolle("mitarbeiter", 5, ["betrieb:lesen", "stempeln", "plan:lesen"]),
    rolle("geraet", 0, ["pin:pruefen"]),
  ],
  apiZugaenge: 0,
  kette: { pruefwert: PRUEFWERT.replace("4711", "812"), glieder: 812, befunde: 2 },
  aufbewahrung: { abgeschlossen: 1, ausgesondert: { zweiJahre: 3, achtJahre: 1 } },
  terminal: {
    terminals: [
      { name: "Tresen", gekoppelt: true, widerrufen: false, offline: true },
      { name: "Altes Tablet", gekoppelt: true, widerrufen: true, offline: false },
    ],
    karten: { uid: 2, ntag424: 3 },
    ausweise: 4,
    pins: 6,
  },
  datev: { eingerichtet: false, nummern: false, lohnarten: 0, personalnummern: 0 },
  haben: null,
  angaben: { ...LEERE_ANGABEN, rechtsform: "GmbH", anschrift: "# Elbstraße 5 <b>" },
  angabenAenderungen: [],
};

/** A freelancer with project time only: working time, shift plan and terminal are off */
export const solo: DokuStandDaten = {
  ...weber,
  betrieb: { name: "Max Klempner", land: "HH" },
  module: { arbeitszeit: false, dienstplan: false, projektzeit: true, terminal: false },
  standorte: [],
  rollen: [
    rolle("inhaber", 1, ["betrieb:lesen", "stempeln", "projekte:verwalten", "terminal:verwalten"]),
    rolle("geraet", 0, ["pin:pruefen"]),
  ],
  apiZugaenge: 0,
  kette: { pruefwert: PRUEFWERT.replace("4711", "37"), glieder: 37, befunde: 0 },
  aufbewahrung: { abgeschlossen: 0, ausgesondert: { zweiJahre: 0, achtJahre: 0 } },
  datev: { eingerichtet: false, nummern: false, lohnarten: 0, personalnummern: 0 },
  haben: null,
  angaben: { ...weber.angaben, eigene: [] },
  angabenAenderungen: [],
};
