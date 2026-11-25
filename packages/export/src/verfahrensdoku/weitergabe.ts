import { abschnitt, type VerfahrensdokuAbschnitt } from "./modell.ts";
import type { DokuStandDaten, DokuTerminal } from "./typen.ts";

/*
 * The user documentation of the terminal and of what leaves Soll (DATEV, Haben, Prüfexport) or
 * would come in (imports), from the state of the business (GoBD Rz. 153). German, for the German
 * authorities.
 */

const terminalZeile = (t: DokuTerminal): string => {
  const status = t.widerrufen ? "widerrufen" : t.gekoppelt ? "gekoppelt" : "noch nicht gekoppelt";
  const offline = t.offline ? ", mit Schlüssel für die Warteschlange ohne Netz" : "";
  return `Terminal „${t.name}“: ${status}${offline}`;
};

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

export const terminal = (s: DokuStandDaten): VerfahrensdokuAbschnitt => {
  if (!s.module.terminal)
    return abschnitt("3. Anwenderdokumentation: Terminal", {
      absaetze: [
        "Das Modul Terminal ist ausgeschaltet; der Server lehnt jede Anfrage eines Tablets im Kiosk-Modus ab.",
      ],
    });
  const t = s.terminal;
  return abschnitt("3. Anwenderdokumentation: Terminal", {
    absaetze: [
      "Ein Tablet im Kiosk-Modus wird mit einem einmaligen Kopplungscode an den Betrieb gekoppelt und meldet sich danach mit einem eigenen Geräte-Token an; Kopplungscode und Token stehen nur als SHA-256 in der Datenbank. Der Inhaber kann ein Terminal jederzeit widerrufen; danach nimmt der Server von ihm nichts mehr an.",
      "Am Terminal erkennt der Server die Person an ihrer PIN, ihrem QR-Code oder ihrer NFC-Karte: eine einfache Karte nur zusammen mit der PIN, eine NTAG 424 DNA allein über ihre signierte SUN-Nachricht, die nur einmal gilt. PINs und Kartennummern stehen nur als Hash mit einem Schlüssel des Servers in der Datenbank, QR-Codes als SHA-256, die Schlüssel der Karten verschlüsselt. Falsche Versuche sperren das Terminal zunehmend länger und stehen in der Audit-Kette.",
      "Ohne Netz nimmt das Terminal Stempelungen weiter an: fortlaufend nummeriert je Terminal, signiert mit einem nicht exportierbaren Schlüssel des Tablets (ECDSA P-256), der Ausweis nur verschlüsselt mit einem öffentlichen Schlüssel des Servers. Beim Übertragen erkennt der Server die Person wie mit Netz; jeder Eintrag zählt einmal, eine Lücke in den Nummern und jeder abgelehnte Eintrag stehen mit Grund beim Inhaber.",
      `Ausgegeben sind ${anzahl(t.pins, "PIN", "PINs")}, ${anzahl(t.ausweise, "QR-Code", "QR-Codes")} und ${anzahl(t.karten.uid + t.karten.ntag424, "Karte", "Karten")} in Gebrauch (${t.karten.uid} einfache, ${t.karten.ntag424} NTAG 424 DNA).`,
    ],
    liste: t.terminals.map(terminalZeile),
  });
};

const datev = (d: DokuStandDaten["datev"]): string =>
  d.eingerichtet
    ? `DATEV: Für das Lohnbüro erzeugt Soll aus dem Inhalt der abgeschlossenen Monate eine Datei für den Import von Bewegungsdaten in LODAS oder Lohn und Gehalt; ein zweiter Export desselben Monats gibt dieselbe Datei. Hinterlegt sind ${anzahl(d.lohnarten, "Lohnart", "Lohnarten")} und ${anzahl(d.personalnummern, "Personalnummer", "Personalnummern")}, Berater- und Mandantennummer ${d.nummern ? "ebenfalls" : "nicht (nur für LODAS nötig)"}. Fehlt etwas, nennt Soll es vor dem Herunterladen, statt einen Wert anzunehmen.`
    : "DATEV: Der Export für das Lohnbüro ist nicht eingerichtet.";

const haben = (s: DokuStandDaten): string => {
  if (!s.module.projektzeit) return "";
  return s.haben
    ? `Haben: Abgerechnete Projektzeit übergibt Soll als Leistung an die Buchhaltung Haben unter ${s.haben.adresse}; das Token dafür liegt verschlüsselt in Soll und steht nicht in diesem Dokument. Jede Übergabe sperrt ihre Buchung und hält fest, was gesendet wurde.`
    : "Haben: Eine Übergabe der Projektzeit an eine Buchhaltung ist nicht eingerichtet.";
};

/** The takeover from other tools (S-701, docs/umzug.md) and how often the business used it */
const importe = (i: DokuStandDaten["importe"]): string[] => [
  "Importe: Daten aus anderen Programmen übernimmt nur der Inhaber, nach Vorschau mit den Befunden der Regeln und einem Probelauf, der nichts schreibt. Die Originaldatei liegt unverändert unter ihrem SHA-256 im Datenverzeichnis; jeder Import ist eine nur angefügte Zeile mit Werkzeug, Datei, Zuordnung und Ergebnis, und jede übernommene Zeile trägt den Import und ihre Kennung im alten Programm und steht in der Audit-Kette. Ein in Soll abgeschlossener Monat nimmt nichts an; was im alten Programm abgeschlossen war, schließt Soll mit Grund ab. Was nicht übernommen wurde, bleibt im bisherigen Verfahren; es gehört in einen eigenen Abschnitt am Ende.",
  i.anzahl
    ? `Bisher übernommen: ${anzahl(i.anzahl, "Import", "Importe")} aus ${i.werkzeuge.join(", ")}.`
    : "Bisher hat der Betrieb nichts aus anderen Programmen übernommen.",
];

export const weitergabe = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("4. Anwenderdokumentation: Weitergabe und Übernahme von Daten", {
    absaetze: [
      s.module.arbeitszeit ? datev(s.datev) : "",
      s.module.arbeitszeit
        ? "Prüfexport: Für Zoll und Arbeitsschutz gibt Soll die Arbeitstage von Personen in einem Zeitraum als CSV und PDF aus, mit Änderungen von Hand, Gegeneinträgen und dem Prüfwert jedes abgeschlossenen Monats (§ 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG)."
        : "",
      haben(s),
      ...importe(s.importe),
      "Auskunft: Jede Person kann ihre Daten nach Art. 15 DSGVO abrufen; der Inhaber erteilt sie auch für Personen, die ausgeschieden sind.",
    ],
  });
