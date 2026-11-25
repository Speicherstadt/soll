import { zeitpunktText } from "../stundenzettel/format.ts";
import { allgemein, anwender } from "./anwender.ts";
import { aufbewahrung, programm, sicherung, zugaenge } from "./betrieb.ts";
import { ketteAbschnitt } from "./kern.ts";
import {
  abschnitt,
  type Verfahrensdoku,
  type VerfahrensdokuAbschnitt,
  verfahrensdoku,
} from "./modell.ts";
import type { DokuStandDaten } from "./typen.ts";
import { terminal, weitergabe } from "./weitergabe.ts";

/*
 * The Verfahrensdokumentation of one business (S-902), made from its state at each call: structure
 * after GoBD, BMF-Schreiben vom 28.11.2019, Rz. 151 to 155 (general description, user
 * documentation, technical system documentation, operations documentation) and Rz. 100 ff.
 * (internal control system), as `buildProcedureDocument` in firsttris/haben,
 * apps/web/src/server/modules/verfahrensdoku/dokument.ts (AGPL-3.0, same author), does for Haben.
 * A pure function of the state and the day, so the same input gives the same document.
 */

const kontrollsystem = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("10. Internes Kontrollsystem", {
    absaetze: [
      "Zugriff: Rechte hängen an der Rolle und werden bei jeder Anfrage auf dem Server geprüft, ebenso der Betrieb: Keine Anfrage liest oder schreibt Daten eines anderen Betriebs (GoBD Rz. 100 und 103).",
      "Vier Augen beim Monat: Die Person bestätigt ihre Zeiten, der Inhaber schließt ab; ohne Bestätigung nur mit Grund, der auf dem Stundenzettel steht. Jede Änderung von Hand trägt einen Grund und ist für die Person sichtbar.",
      "Abstimmung: Jede Person hält mit dem Prüfwert auf ihrem Stundenzettel einen Beleg, den der Betrieb nicht ändern kann, und prüft ihn ohne Anmeldung auf der Prüfseite. Lücken in den Nummern der Geräte und Terminals zeigt Soll an, statt sie zu schließen.",
      "Plausibilität: Jeder Tag wird gegen das Arbeitszeitgesetz und die übrigen Regeln geprüft; Befunde nennen ihre Norm und stehen im Monatsabschluss. Fehlt ein Jahreswert oder ein Arbeitszeitmodell, rechnet Soll nicht mit einem anderen, sondern sagt „nicht hinterlegt“.",
      `Kontrolle der Kette: Die Prüfung der Audit-Kette läuft bei jedem Erzeugen dieses Dokuments, bei jeder Wiederherstellung einer Sicherung und auf der Prüfseite für jeden Prüfwert; beim Erzeugen dieses Dokuments ${s.kette.befunde === 0 ? "ohne Befund" : "mit Befund (Abschnitt 5)"}.`,
      s.angaben.verantwortlich.trim()
        ? `Verantwortlich für das Verfahren: ${s.angaben.verantwortlich.trim()}`
        : "",
    ],
  });

const fassungen = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("11. Fassungen dieser Dokumentation", {
    absaetze: [
      "Jede Fassung trägt oben ihren Tag, die Version von Soll und den Prüfwert der Kette beim Erzeugen (Rz. 154). Die Angaben des Betriebs ändert nur der Inhaber; jede gespeicherte Änderung steht mit altem und neuem Inhalt in der Audit-Kette:",
      s.angabenAenderungen.length ? "" : "Die Angaben wurden noch nicht gespeichert.",
    ],
    liste: s.angabenAenderungen.map(
      (a) => `${zeitpunktText(a.zeitpunkt)}: Angaben gespeichert (Glied Nr. ${a.seq})`,
    ),
  });

/** The business's own sections, numbered after the generated ones; paragraphs at empty lines */
const eigene = (s: DokuStandDaten, ab: number): VerfahrensdokuAbschnitt[] =>
  s.angaben.eigene
    .filter((teil) => teil.titel.trim() || teil.text.trim())
    .map((teil, index) =>
      abschnitt(`${ab + index}. ${teil.titel.trim() || "Ohne Titel"}`, {
        absaetze: teil.text.split(/\n\s*\n/),
      }),
    );

/** Today in Europe/Berlin as YYYY-MM-DD, whatever the server's time zone */
export const tagInDeutschland = (zeitpunkt: number): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(zeitpunkt);

export const verfahrensdokuAus = (s: DokuStandDaten, datum: string): Verfahrensdoku => {
  const erzeugt = [
    allgemein(s),
    anwender(s),
    terminal(s),
    weitergabe(s),
    ketteAbschnitt("5. Technische Systemdokumentation: Audit-Kette und Prüfwert", s.kette),
    programm(s),
    zugaenge(s),
    aufbewahrung(s),
    sicherung(s),
    kontrollsystem(s),
    fassungen(s),
  ];
  return verfahrensdoku({
    titel: `Verfahrensdokumentation ${s.betrieb.name}`,
    stand: { datum, programm: "Soll", version: s.version, pruefwert: s.kette.pruefwert },
    abschnitte: [...erzeugt, ...eigene(s, erzeugt.length + 1)],
  });
};
