import { angabenAbsaetze } from "./angaben.ts";
import { abschnitt, type VerfahrensdokuAbschnitt } from "./modell.ts";
import { rechtAktiv, rechtText, rolleName } from "./rechte.ts";
import type { DokuStandDaten } from "./typen.ts";

/*
 * The technical system documentation and the operations documentation (GoBD Rz. 153), after the
 * sections `zugaenge` and `betrieb` of apps/web/src/server/modules/verfahrensdoku/texte.ts in
 * firsttris/haben (AGPL-3.0, same author): Soll runs on SQLite with its own backup command, and its
 * roles are those of a business, not of a bookkeeping.
 */

export const programm = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("6. Technische Systemdokumentation: Programm und Datenhaltung", {
    absaetze: [
      `Eingesetzt ist Soll ${s.version}. Soll ist ein Server (eine einzelne ausführbare Datei, auch als Container-Image) mit einer SQLite-Datenbank im WAL-Modus und einer App für Browser, Handy (PWA) und Tablet (Terminal). Was sich je Version geändert hat, nennen die Versionshinweise; die Version steht im Stand jeder Fassung dieses Dokuments.`,
      "Die Migrationen der Datenbank sind im Programm enthalten und laufen beim Start; eine schon angewendete Migration, die sich geändert hat oder fehlt, verhindert den Start. SQLite schreibt mit synchronous = FULL, so dass ein bestätigter Eintrag auch einen Stromausfall übersteht.",
      `Zeitpunkte stehen als Millisekunden in UTC, Kalendertage als JJJJ-MM-TT in Europe/Berlin, Dauern in ganzen Minuten, Geldbeträge in Cent; nichts wird als Gleitkommazahl gerechnet.${s.module.arbeitszeit ? " Ein Arbeitstag ist der Tag, an dem die Schicht beginnt." : ""}`,
      "Geheimnisse (Zugangsdaten zu anderen Diensten, Schlüssel von Karten, Abos für Web Push) liegen mit AES-256-GCM verschlüsselt in der Datenbank, mit dem Schlüssel aus SOLL_SECRET_KEY, ohne den der Server nicht startet. API-Tokens, PINs, QR-Codes und Kopplungscodes stehen nur als Hash darin. In diesem Dokument steht keins davon.",
      "Mehrere Betriebe können eine Instanz teilen: Jede Tabelle von Soll trägt die Kennung des Betriebs, jede Abfrage filtert danach, und jeder Betrieb hat seine eigene Audit-Kette.",
    ],
  });

const rolleZeile = (r: DokuStandDaten["rollen"][number]): string =>
  `${rolleName(r.rolle)} (${r.mitglieder} ${r.mitglieder === 1 ? "Mitglied" : "Mitglieder"}): ${r.rechte.length ? r.rechte.map(rechtText).join("; ") : "keine Rechte in den eingeschalteten Modulen"}`;

/**
 * Each role with the rights of the modules that are on; a role left without rights and without
 * members is not named (a device's role while the terminal is off)
 */
const rollenListe = (s: DokuStandDaten): string[] =>
  s.rollen
    .map((r) => ({ ...r, rechte: r.rechte.filter((recht) => rechtAktiv(recht, s.module)) }))
    .filter((r) => r.rechte.length > 0 || r.mitglieder > 0)
    .map(rolleZeile);

export const zugaenge = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("7. Betriebsdokumentation: Zugänge und Rechte", {
    absaetze: [
      "Personen melden sich mit Passkey oder Passwort an. Wer den Betrieb nicht selbst angelegt hat, kommt nur über eine Einladung hinein; jede Einladung gilt für eine Rolle. Der Server prüft Rolle und Modul bei jeder Anfrage; ein abgeschaltetes Modul lehnt er ab, statt es nur auszublenden. Jede Änderung der Mitgliedschaft und der Rolle steht in der Audit-Kette (GoBD Rz. 100 und 103).",
      s.apiZugaenge
        ? `Programme greifen mit persönlichen API-Zugängen zu, die jede Person für sich anlegt und widerruft; ein Token hat nie mehr Rechte als die Rolle seiner Person zur Zeit des Aufrufs, und in der Audit-Kette steht die Person als Akteur. Gültig sind ${s.apiZugaenge} ${s.apiZugaenge === 1 ? "Zugang" : "Zugänge"}.`
        : "Gültige API-Zugänge für Programme gibt es nicht.",
      "Die Rollen und was jede darf, mit der Zahl ihrer Mitglieder beim Erzeugen; ein Mitglied mit mehreren Rollen zählt bei jeder:",
    ],
    liste: rollenListe(s),
  });

const FRISTEN = [
  "Aufbewahrt wird je abgeschlossenem Monat einer Person. Bucht das Lohnbüro aus dem Monat Stunden oder Beträge (Stundenlohn, Minijob, Zuschläge oder kein Arbeitszeitmodell an einem Tag), ist er Buchungsbeleg und bleibt 8 Jahre (§ 147 Abs. 1 Nr. 4 und Abs. 3 Satz 1 AO, § 257 Abs. 4 HGB); sonst ist er Aufzeichnung nach § 16 Abs. 2 ArbZG und § 17 Abs. 1 MiLoG und bleibt 2 Jahre. Die Frist beginnt mit dem Ende des Kalenderjahres, in dem der Monat abgeschlossen wurde; wo offen ist, ob ein Monat Beleg ist, gilt die längere.",
  "Nach Ablauf entfernt Soll den Inhalt des Monats (Stempelungen, Gegeneinträge, Bestätigung, Abschluss und Abwesenheiten, die nur ihn betreffen) mit den gespeicherten Inhalten ihrer Glieder; die Glieder bleiben, eine eigene Zeile hält fest, welcher Monat welcher Person mit welcher Frist entfernt wurde, und steht selbst in der Kette. Der Server prüft das beim Start und alle sechs Stunden. Die Ablaufhemmung während einer Außenprüfung (§ 147 Abs. 3 AO) kennt Soll nicht: Wer eine Prüfung hat, sichert vorher.",
];

const bestand = (a: DokuStandDaten["aufbewahrung"]): string => {
  const ausgesondert = a.ausgesondert.zweiJahre + a.ausgesondert.achtJahre;
  return `${a.abgeschlossen} abgeschlossene ${a.abgeschlossen === 1 ? "Monat" : "Monate"} von Personen aufbewahrt, nach Ablauf der Frist ${ausgesondert} ausgesondert (${a.ausgesondert.zweiJahre} nach 2 Jahren, ${a.ausgesondert.achtJahre} nach 8 Jahren).`;
};

/**
 * Retention per closed month while working time is on; while it is off only what is left from
 * the time it was on, which Soll still keeps and removes after its period
 */
export const aufbewahrung = (s: DokuStandDaten): VerfahrensdokuAbschnitt => {
  const a = s.aufbewahrung;
  const vorhanden = a.abgeschlossen + a.ausgesondert.zweiJahre + a.ausgesondert.achtJahre > 0;
  return abschnitt("8. Betriebsdokumentation: Aufbewahrung und Aussonderung", {
    absaetze: s.module.arbeitszeit
      ? [...FRISTEN, `Beim Erzeugen: ${bestand(a)}`]
      : [
          "Das Modul Arbeitszeit ist ausgeschaltet; Soll schließt keine Monate ab.",
          vorhanden
            ? `Aus der Zeit, in der es eingeschaltet war: ${bestand(a)} Was noch aufbewahrt wird, entfernt Soll nach Ablauf seiner Frist (2 oder 8 Jahre).`
            : "",
        ],
  });
};

export const sicherung = (s: DokuStandDaten): VerfahrensdokuAbschnitt => {
  const angaben = angabenAbsaetze(s.angaben, [
    "serverbetrieb",
    "datensicherung",
    "schluesselablage",
  ]);
  return abschnitt("9. Betriebsdokumentation: Betrieb und Datensicherung", {
    absaetze: [
      `Der Befehl soll backup schreibt eine in sich stimmige Kopie der Datenbank, auch während der Server schreibt (SQLite VACUUM INTO), prüft sie mit PRAGMA integrity_check und überschreibt nie eine vorhandene Datei. Verschlüsseln, Auslagern und Wegräumen alter Sicherungen übernimmt das Backup des Rechners; Soll tut das nicht selbst.${s.module.arbeitszeit ? " Sicherungen sollen so lange erreichbar bleiben wie die Fristen oben." : ""}`,
      "soll restore legt eine Sicherung nur in ein leeres Datenverzeichnis, prüft danach die Audit-Kette jedes Betriebs und nennt das Ergebnis. Der Server startet nur mit demselben SOLL_SECRET_KEY wie zur Zeit der Sicherung; der Schlüssel gehört deshalb getrennt von den Sicherungen verwahrt.",
      s.importe.anzahl
        ? "Die Originaldateien der Importe liegen im Datenverzeichnis unter dateien/; soll backup sichert nur die Datenbank, das Verzeichnis gehört deshalb mit in das Backup des Rechners."
        : "",
      ...angaben.absaetze,
    ],
    luecken: angaben.luecken,
  });
};
