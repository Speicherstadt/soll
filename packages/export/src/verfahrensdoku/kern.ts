import { abschnitt, type VerfahrensdokuAbschnitt } from "./modell.ts";
import type { DokuStandDaten } from "./typen.ts";

/*
 * The texts on immutability, after packages/gobd-kern/src/verfahrensdoku/kern.ts in firsttris/haben
 * (AGPL-3.0, same author), rewritten for Soll: Haben seals rows with triggers in PostgreSQL, Soll
 * keeps its own hash chain in code and puts the Prüfwert in the hands of the employees
 * (docs/plan.md, "Unveränderbarkeit"). They promise only what the code of Soll keeps.
 *
 * Basis: GoBD, BMF-Schreiben vom 28.11.2019, Rz. 58 f. and 107 to 112 (immutability, logging),
 * Rz. 60 (proof of the controls), Rz. 100 and 103 (access control).
 */

export const KETTE_TEXTE = {
  einWeg:
    "Jede Schreiboperation in den Tabellen von Soll hängt in derselben Transaktion ein Glied an die Audit-Kette des Betriebs an; einen anderen Weg in diese Tabellen gibt es nicht. Die Module des Servers lesen über eine Verbindung, die SQLite nur lesend öffnet; die einzige schreibende Verbindung gehört der Funktion, die das Glied anhängt. Schlägt das Anhängen fehl, bleibt von der Schreiboperation nichts in der Datenbank (GoBD Rz. 107 bis 110).",
  glied:
    "Ein Glied enthält eine fortlaufende Nummer je Betrieb, den Zeitpunkt, den Akteur (die Person, auch wenn sie über einen API-Zugang schreibt, das Terminal oder Soll selbst, etwa bei der Aussonderung), Tabelle, Zeile und Art der Änderung, den SHA-256 des neuen Inhalts der Zeile, den Hash des Vorgängers und den SHA-256 über all das (Hash-Kette). Den alten Inhalt hält das vorige Glied derselben Zeile; so bleibt jede Änderung mit ihrem Stand davor erkennbar (Rz. 59 und 111).",
  inhalt:
    "Der Inhalt liegt getrennt vom Glied, das nur seinen Hash trägt. Nach Ablauf der Aufbewahrungsfrist entfernt die Aussonderung den Inhalt mit einem eigenen Glied; die Glieder bleiben, und die Kette prüft weiter ohne Befund (Art. 5 Abs. 1 lit. e und Art. 17 DSGVO).",
  korrektur:
    "Stempelungen lassen sich bis zum Monatsabschluss nur mit Grund ändern; die Person sieht jede Änderung. Nach dem Abschluss ist der Monat gesperrt, eine Korrektur ist ein Gegeneintrag mit Grund im laufenden Monat; der abgeschlossene Monat bleibt, wie er war (Rz. 58 und 111).",
  pruefung:
    "Die Prüfung rechnet die Kette Glied für Glied nach, vergleicht den gespeicherten Kopf mit dem letzten Glied, jeden gespeicherten Inhalt mit seinem Hash und jede Zeile mit dem Inhalt ihres letzten Glieds. Sie meldet geänderte, entfernte oder eingeschobene Glieder, ein abgeschnittenes Ende und jede Zeile, die an der Kette vorbei eingefügt, geändert oder gelöscht wurde. Die Kette verhindert keine Änderung durch jemanden, der den Server betreibt und die Datenbank selbst ändern kann; sie macht sie sichtbar (Rz. 60).",
  pruefwert:
    "Der Prüfwert ist Nummer und Hash eines Glieds („Nr. 1234 · <SHA-256>“). Zum Monatsabschluss bekommt jede Person auf ihrem Stundenzettel den Prüfwert des Glieds, mit dem ihr Monat abgeschlossen wurde. Wer den Server betreibt, kann die Datenbank ändern, aber nicht den Prüfwert, den die Person schon hat: Die Prüfseite unter /pruefen zeigt ohne Anmeldung, ob der Monat noch so ist, wie er abgeschlossen wurde, oder welche Tage abweichen. Das ist der Schutz gegen Änderungen durch den Betrieb selbst.",
} as const;

const befundText = (befunde: number): string => {
  if (befunde === 0) return "Die Prüfung beim Erzeugen dieses Dokuments fand keine Befunde.";
  const anzahl = befunde === 1 ? "einen Befund" : `${befunde} Befunde`;
  return `Die Prüfung beim Erzeugen dieses Dokuments fand ${anzahl}; die Einzelheiten nennt die Prüfung der Kette, und bis sie geklärt sind, gilt der Stand als verändert.`;
};

const standText = (kette: DokuStandDaten["kette"]): string =>
  kette.pruefwert
    ? `Beim Erzeugen dieses Dokuments hatte die Kette ${kette.glieder} ${kette.glieder === 1 ? "Glied" : "Glieder"}; Prüfwert ${kette.pruefwert}. Außerhalb des Servers aufbewahrt zeigt er später, ob die Kette bis dahin verändert wurde.`
    : "Beim Erzeugen dieses Dokuments hatte die Kette noch kein Glied.";

/** The section on immutability, the audit chain and the Prüfwert with the state of the chain */
export const ketteAbschnitt = (
  titel: string,
  kette: DokuStandDaten["kette"],
): VerfahrensdokuAbschnitt =>
  abschnitt(titel, {
    absaetze: [
      KETTE_TEXTE.einWeg,
      KETTE_TEXTE.glied,
      KETTE_TEXTE.inhalt,
      KETTE_TEXTE.korrektur,
      KETTE_TEXTE.pruefung,
      KETTE_TEXTE.pruefwert,
      standText(kette),
      befundText(kette.befunde),
    ],
  });
