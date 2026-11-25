import { angabenAbsaetze } from "./angaben.ts";
import { abschnitt, type VerfahrensdokuAbschnitt } from "./modell.ts";
import type { DokuStandDaten, Module } from "./typen.ts";

/*
 * The general description and the user documentation (GoBD, BMF-Schreiben vom 28.11.2019, Rz. 153),
 * after the sections `allgemein` and `anwender` of apps/web/src/server/modules/verfahrensdoku/texte.ts
 * in firsttris/haben (AGPL-3.0, same author), written for what Soll records: working time, not books.
 * German, because the document is for the German authorities.
 */

const LAND_NAMEN: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

export const landName = (land: string | null): string =>
  land ? (LAND_NAMEN[land] ?? land) : "nicht hinterlegt";

const MODUL_NAMEN: Record<keyof Module, string> = {
  arbeitszeit: "Arbeitszeit (mit Abwesenheiten)",
  dienstplan: "Dienstplan",
  projektzeit: "Projektzeit",
  terminal: "Terminal",
};

const modulListe = (module: Module): string[] =>
  (Object.keys(MODUL_NAMEN) as (keyof Module)[]).map(
    (modul) => `Modul ${MODUL_NAMEN[modul]}: ${module[modul] ? "eingeschaltet" : "ausgeschaltet"}`,
  );

const standortText = (s: DokuStandDaten["standorte"][number]): string =>
  `Standort „${s.name}“: ${landName(s.land)}${s.regionen.length ? `, regionale Feiertage: ${s.regionen.join(", ")}` : ""}`;

export const allgemein = (s: DokuStandDaten): VerfahrensdokuAbschnitt => {
  const angaben = angabenAbsaetze(s.angaben, [
    "rechtsform",
    "anschrift",
    "verantwortlich",
    "aufbewahrungsort",
  ]);
  return abschnitt("1. Allgemeine Beschreibung", {
    absaetze: [
      s.module.arbeitszeit
        ? `${s.betrieb.name} zeichnet die Arbeitszeit seiner Beschäftigten elektronisch mit Soll ${s.version} auf, einer selbst betriebenen Software für Zeiterfassung und Dienstplanung. Die Pflicht zur Aufzeichnung folgt aus § 3 Abs. 2 Nr. 1 ArbSchG (BAG, Beschluss vom 13.09.2022, 1 ABR 22/21), § 16 Abs. 2 ArbZG und § 17 Abs. 1 MiLoG. Steuerlich bedeutsam sind die Aufzeichnungen, sobald sie Grundlage des Lohns sind (Stundenlohn, Minijob, Zuschläge; § 41 EStG, § 4 LStDV); dann gelten die GoBD.`
        : `${s.betrieb.name} nutzt Soll ${s.version}, eine selbst betriebene Software für Zeiterfassung und Dienstplanung, ohne das Modul Arbeitszeit. Die GoBD gelten für Aufzeichnungen, die Grundlage von Rechnungen sind, etwa abgerechnete Projektzeit.`,
      "Diese Verfahrensdokumentation beschreibt das Verfahren in Soll. Soll erzeugt sie bei jedem Abruf aus dem Stand des Betriebs und den Angaben, die nur der Betrieb machen kann; andere Programme und Abläufe des Betriebs gehören in die eigenen Abschnitte am Ende. Die Anleitung für Anwender steht unter https://soll.work/.",
      `Bundesland des Betriebs: ${landName(s.betrieb.land)}.`,
      ...angaben.absaetze,
    ],
    liste: [...modulListe(s.module), ...s.standorte.map(standortText)],
    luecken: angaben.luecken,
  });
};

const erfassung = (terminal: boolean): string =>
  `Erfassung: Jede Person stempelt selbst Kommen, Pause und Gehen in der App im Browser oder als PWA auf dem Handy, über die REST-API${terminal ? " oder am Terminal" : ""}. Jede Stempelung trägt die Zeit des Servers, ihre Quelle (${terminal ? "App, API, Terminal" : "App, API"}) und, wenn sie ohne Netz entstand, die Zeit des Geräts und die Marke „offline“. Soll stempelt nie selbst aus und rundet keine Arbeitszeit zum Nachteil der Person.`;

const arbeitszeit = (module: Module): string[] =>
  module.arbeitszeit
    ? [
        erfassung(module.terminal),
        "Ohne Netz hält das Gerät die Stempelung in einer Warteschlange, fortlaufend nummeriert und mit einem nicht exportierbaren Schlüssel des Geräts signiert (ECDSA P-256); der Server prüft Signatur, Gerät und Nummer, nimmt dieselbe Stempelung nur einmal an und zeigt eine Lücke in den Nummern als Hinweis.",
        "Änderungen: Nachtragen, Ändern und Entfernen einer Stempelung geht bis zum Monatsabschluss, immer mit Grund; die Person sieht, wer was wann und warum geändert hat. Abwesenheiten (Urlaub, Krankheit, Kinderkrankentage und andere) stehen ohne Diagnose und ohne hochgeladene Bescheinigung in Soll (Art. 9 DSGVO).",
        "Prüfung: Jeder Tag wird gegen das Arbeitszeitgesetz und die übrigen Regeln geprüft; jeder Befund nennt seine Norm. Die Regeln sind als Daten mit Gültigkeit hinterlegt, ebenso Mindestlohn und Minijob-Grenze je Jahr; fehlt ein Wert, heißt das Ergebnis „nicht hinterlegt“, nie der Wert eines anderen Jahres.",
        "Monatsabschluss: Die Person bestätigt ihren Monat, der Inhaber schließt ihn ab (ohne Bestätigung nur mit Grund). Danach ist der Monat gesperrt, eine Korrektur ist ein Gegeneintrag mit Grund im laufenden Monat. Die Person bekommt ihren Stundenzettel als PDF mit dem Prüfwert des Abschlusses.",
      ]
    : [
        "Das Modul Arbeitszeit ist ausgeschaltet: Der Betrieb hat keine Beschäftigten, deren Arbeitszeit Soll aufzeichnet. Sobald eine beschäftigte Person Mitglied wird, schaltet Soll es wieder ein, weil die Pflicht zur Aufzeichnung dann gilt.",
      ];

const weitere = (module: Module): string[] => [
  module.dienstplan
    ? `Dienstplan: Planer legen Schichten an und veröffentlichen sie; erst dann sehen die Beschäftigten sie. Der Plan wird vor dem Veröffentlichen gegen die Regeln des Arbeitszeitgesetzes geprüft.${module.arbeitszeit ? " Der Plan ist Soll-Zeit, die Aufzeichnung bleibt die Stempelung." : ""}`
    : "",
  module.dienstplan
    ? "Schichttausch: Wer eine veröffentlichte Schicht hat, die noch nicht begonnen hat, bietet sie allen an, die sie übernehmen können, oder einer Kollegin mit Namen, ohne Grund. Wer zur selben Zeit keine Schicht hat, übernimmt sie; danach geben Inhaber oder Planer den Tausch frei oder lehnen ihn mit Grund ab. Bis zur Freigabe bleibt die Schicht bei der bisherigen Person; die Freigabe ändert die veröffentlichte Schicht in einem Schritt mit dem Tausch in der Audit-Kette und gilt als neue Mitteilung nach § 12 TzBfG. Ein Angebot läuft ab, wenn die Schicht beginnt, und wird hinfällig, wenn der Planer die Schicht ändert."
    : "",
  module.projektzeit
    ? "Projektzeit: Buchungen auf Kunden, Aufträge und Tätigkeiten stehen getrennt von der Arbeitszeit; sie bleiben änderbar, bis sie abgerechnet oder in einem unterschriebenen Stundennachweis sind, danach sind sie gesperrt."
    : "",
];

export const anwender = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("2. Anwenderdokumentation: Erfassung und Verarbeitung", {
    absaetze: [...arbeitszeit(s.module), ...weitere(s.module)],
  });
