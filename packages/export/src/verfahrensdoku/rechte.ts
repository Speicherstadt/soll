import type { Module } from "./typen.ts";

/*
 * The roles of Soll and their rights in words, for the section on access (GoBD Rz. 100 and 103).
 * The server passes each role with the rights `apps/server/src/auth/rollen.ts` grants it; a test
 * there asks a text here for every right and every role, so a new one cannot go unnamed.
 */

export const ROLLEN_NAMEN: Record<string, string> = {
  inhaber: "Inhaber",
  planer: "Planer",
  mitarbeiter: "Mitarbeiter",
  lohnbuero: "Lohnbüro",
  betriebsrat: "Betriebsrat",
  extern: "Extern",
  geraet: "Gerät",
};

export const RECHTE_TEXTE: Record<string, string> = {
  "betrieb:lesen": "den Betrieb und seine Module sehen",
  "betrieb:module": "Module ein- und ausschalten",
  "betrieb:einrichten": "den Betrieb einrichten und die Einstellungen der Prüfung ändern",
  "modelle:lesen": "Arbeitszeitmodelle mit Lohn lesen",
  "mitglieder:lesen": "die Mitglieder lesen",
  "mitglieder:einladen": "Personen einladen",
  "mitglieder:rolle": "Rollen ändern und Mitglieder entfernen",
  "pin:setzen": "PINs für das Terminal setzen",
  "pin:pruefen": "PINs am Terminal prüfen",
  stempeln: "selbst stempeln und die eigenen Zeiten sehen",
  "zeiten:alle": "die Zeiten aller lesen",
  "zeiten:korrigieren": "Zeiten anderer mit Grund korrigieren und Gegeneinträge buchen",
  "modelle:zuordnen": "Arbeitszeitmodelle anlegen und zuordnen",
  "monat:abschliessen": "Monate abschließen",
  "abwesenheiten:freigeben": "Abwesenheiten genehmigen und ablehnen",
  "abwesenheiten:gesundheit": "Krankheit als solche sehen",
  "abwesenheiten:einstellen": "festlegen, ab welchem Krankheitstag eine Bescheinigung fällig ist",
  "konten:pflegen": "Konten von Hand anpassen",
  "projekte:lesen": "Kunden, Aufträge und Tätigkeiten lesen",
  "projekte:verwalten": "Kunden, Aufträge, Tätigkeiten und Stundensätze pflegen",
  "erinnerungen:regeln": "die Zeiten der Erinnerungen festlegen",
  "plan:lesen": "den Dienstplan lesen",
  "plan:planen": "den Dienstplan planen und veröffentlichen",
  "personen:angaben":
    "Angaben zu Personen für die Prüfung pflegen (etwa Geburtsdatum, Mutterschutz)",
  "terminal:verwalten": "Terminals koppeln und widerrufen, QR-Codes und Karten ausgeben",
  "lohn:datev": "den DATEV-Export einrichten und herunterladen",
  "auskunft:erteilen": "Auskunft nach Art. 15 DSGVO erteilen",
  "api:zugang": "eigene API-Zugänge anlegen",
  "verfahrensdoku:verwalten": "die Verfahrensdokumentation pflegen und herunterladen",
};

/**
 * The module a right belongs to; a right without one holds whatever the business switched on.
 * The document names a right only while its module is on.
 */
const RECHT_MODUL: Record<string, keyof Module> = {
  "pin:setzen": "terminal",
  "pin:pruefen": "terminal",
  "terminal:verwalten": "terminal",
  "modelle:lesen": "arbeitszeit",
  "modelle:zuordnen": "arbeitszeit",
  stempeln: "arbeitszeit",
  "zeiten:alle": "arbeitszeit",
  "zeiten:korrigieren": "arbeitszeit",
  "monat:abschliessen": "arbeitszeit",
  "abwesenheiten:freigeben": "arbeitszeit",
  "abwesenheiten:gesundheit": "arbeitszeit",
  "abwesenheiten:einstellen": "arbeitszeit",
  "konten:pflegen": "arbeitszeit",
  "erinnerungen:regeln": "arbeitszeit",
  "lohn:datev": "arbeitszeit",
  "projekte:lesen": "projektzeit",
  "projekte:verwalten": "projektzeit",
  "plan:lesen": "dienstplan",
  "plan:planen": "dienstplan",
};

export const rechtAktiv = (recht: string, module: Module): boolean => {
  const modul = RECHT_MODUL[recht];
  return modul === undefined || module[modul];
};

export const rolleName = (rolle: string): string => ROLLEN_NAMEN[rolle] ?? rolle;

export const rechtText = (recht: string): string => RECHTE_TEXTE[recht] ?? recht;
