/**
 * Where each table of the database stands in the Auskunft: the part that carries the person's rows,
 * or why it holds none of them. auskunft.test.ts fails for a table missing here, so a new table
 * comes with a decision about the Auskunft (Art. 15 DSGVO).
 */
export const ABDECKUNG: Readonly<Record<string, string>> = {
  // Soll's tables (db/schema.ts)
  betriebe: "verantwortlicher",
  mitgliedschaften: "mitgliedschaft",
  einladungen: "einladungen",
  pins: "pin",
  stempelungen: "stempelungen",
  korrekturen: "gegeneintraege",
  monatsabschluesse: "monatsabschluesse",
  modellzuordnungen: "arbeitszeitmodelle",
  arbeitszeitmodelle: "arbeitszeitmodelle",
  schichten: "schichten",
  geraete: "geraete",
  erinnerungseinstellungen: "erinnerungseinstellungen",
  erinnerungen: "erinnerungen",
  push_abos: "pushAbos (ohne Endpunkt und Schlüssel: ein Geheimnis, das auf dem Gerät liegt)",
  erinnerungsregeln: "ausgenommen: Zeiten des Betriebs für Erinnerungen, keine Daten der Person",
  instanzschluessel: "ausgenommen: VAPID-Schlüssel der Instanz, keine Daten der Person",
  audit_glieder: "auditKette",
  audit_inhalte: "ausgenommen: der Inhalt jedes Glieds steht in den Teilen oben",
  audit_koepfe: "ausgenommen: Kopf der Kette des Betriebs, keine Daten der Person",
  standorte: "ausgenommen: Orte des Betriebs, keine Daten der Person",
  schichtvorlagen: "ausgenommen: Vorlagen des Betriebs, keine Daten der Person",
  bedarfe: "ausgenommen: Bedarf des Betriebs, keine Daten der Person",
  // Better Auth's tables (db/auth-schema.ts)
  user: "konto",
  session: "sitzungen",
  account: "anmeldung",
  passkey: "anmeldung",
  organization: "verantwortlicher",
  member: "mitgliedschaft (Spiegel in mitgliedschaften)",
  invitation: "ausgenommen: Einladungen per Mail kennt Soll nicht, es lädt per Link ein (S-106)",
  verification: "ausgenommen: kurzlebige Codes zum Bestätigen, kein Teil der Aufzeichnungen",
};
