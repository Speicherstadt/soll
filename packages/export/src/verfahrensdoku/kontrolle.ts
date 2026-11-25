import { abschnitt, type VerfahrensdokuAbschnitt } from "./modell.ts";
import type { DokuStandDaten, Module } from "./typen.ts";

/*
 * The internal control system (GoBD, BMF-Schreiben vom 28.11.2019, Rz. 100 ff.): the controls that
 * hold for every business, and those of each module only while it is on.
 */

const arbeitszeit = (module: Module): string[] => [
  "Vier Augen beim Monat: Die Person bestätigt ihre Zeiten, der Inhaber schließt ab; ohne Bestätigung nur mit Grund, der auf dem Stundenzettel steht. Jede Änderung von Hand trägt einen Grund und ist für die Person sichtbar.",
  `Abstimmung: Jede Person hält mit dem Prüfwert auf ihrem Stundenzettel einen Beleg, den der Betrieb nicht ändern kann, und prüft ihn ohne Anmeldung auf der Prüfseite. Lücken in den Nummern der Geräte${module.terminal ? " und Terminals" : ""} zeigt Soll an, statt sie zu schließen.`,
  "Plausibilität: Jeder Tag wird gegen das Arbeitszeitgesetz und die übrigen Regeln geprüft; Befunde nennen ihre Norm und stehen im Monatsabschluss. Fehlt ein Jahreswert oder ein Arbeitszeitmodell, rechnet Soll nicht mit einem anderen, sondern sagt „nicht hinterlegt“.",
];

const weitere = (module: Module): string[] => [
  module.dienstplan
    ? "Dienstplan: Die Beschäftigten sehen nur veröffentlichte Schichten; vor dem Veröffentlichen prüft Soll jede Schicht gegen die Regeln und nennt die Norm."
    : "",
  module.projektzeit
    ? "Projektzeit: Abgerechnete Buchungen und Buchungen in einem unterschriebenen Stundennachweis sind gesperrt; der Nachweis trägt die Prüfsumme seines Inhalts."
    : "",
];

const kette = (s: DokuStandDaten): string => {
  const wo = s.module.arbeitszeit
    ? "bei jedem Erzeugen dieses Dokuments, bei jeder Wiederherstellung einer Sicherung und auf der Prüfseite für jeden Prüfwert"
    : "bei jedem Erzeugen dieses Dokuments und bei jeder Wiederherstellung einer Sicherung";
  const ergebnis = s.kette.befunde === 0 ? "ohne Befund" : "mit Befund (Abschnitt 5)";
  return `Kontrolle der Kette: Die Prüfung der Audit-Kette läuft ${wo}; beim Erzeugen dieses Dokuments ${ergebnis}.`;
};

export const kontrollsystem = (s: DokuStandDaten): VerfahrensdokuAbschnitt =>
  abschnitt("10. Internes Kontrollsystem", {
    absaetze: [
      "Zugriff: Rechte hängen an der Rolle und werden bei jeder Anfrage auf dem Server geprüft, ebenso der Betrieb: Keine Anfrage liest oder schreibt Daten eines anderen Betriebs (GoBD Rz. 100 und 103).",
      ...(s.module.arbeitszeit ? arbeitszeit(s.module) : []),
      ...weitere(s.module),
      kette(s),
      s.angaben.verantwortlich.trim()
        ? `Verantwortlich für das Verfahren: ${s.angaben.verantwortlich.trim()}`
        : "",
    ],
  });
