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

/** Whether the owner's copy of someone else's Auskunft holds a table's rows, and why */
export type Freigabe = { frei: boolean; grund: string };

const frei = (grund: string): Freigabe => ({ frei: true, grund });
const aus = (grund: string): Freigabe => ({ frei: false, grund });

/**
 * The owner's copy of someone else's Auskunft (`auskunft:erteilen`) is an allowlist: it holds a
 * table only where the owner already sees its rows elsewhere in Soll; everything else, a new table
 * included, stays out (Art. 5 Abs. 1 lit. b and c DSGVO; docs/plan.md, "Auskunft"). auskunft.test.ts
 * fails for a table missing here, so a new table waits for that decision.
 */
export const INHABERKOPIE: Readonly<Record<string, Freigabe>> = {
  // Soll's tables (db/schema.ts)
  betriebe: frei("der eigene Betrieb als Verantwortlicher"),
  mitgliedschaften: frei("Rolle und Beginn, wie die Mitgliederliste sie zeigt"),
  einladungen: frei("Name und Rolle, auf die der Betrieb selbst eingeladen hat"),
  pins: aus("der Inhaber setzt die PIN, Fehlversuche und Sperre sieht er sonst nirgends"),
  stempelungen: frei(
    "Zeiten mit jeder Änderung und ihrem Grund, wie Monat und Prüfexport sie zeigen",
  ),
  korrekturen: frei("Gegeneinträge, die der Betrieb im Monat bucht"),
  monatsabschluesse: frei(
    "Schritte des Abschlusses mit Inhalt und Prüfwert, wie der Monat sie zeigt",
  ),
  modellzuordnungen: frei("Modelle, die der Inhaber der Person zuordnet"),
  arbeitszeitmodelle: frei("Soll und Lohn, die der Inhaber festlegt"),
  schichten: frei("Schichten im Dienstplan, den der Betrieb plant, auch im Entwurf"),
  geraete: aus("Geräte und Schlüssel der Person sieht der Inhaber sonst nirgends"),
  erinnerungseinstellungen: aus(
    "welche Erinnerungen die Person abgeschaltet hat, sieht er nirgends",
  ),
  erinnerungen: aus("welche Erinnerungen an die Person gingen, sieht der Inhaber nirgends"),
  push_abos: aus("wie viele Geräte, in welcher Sprache: sieht der Inhaber nirgends"),
  erinnerungsregeln: aus("keine Daten der Person (Zeiten des Betriebs)"),
  instanzschluessel: aus("keine Daten der Person (Schlüssel der Instanz)"),
  audit_glieder: frei("nur die Glieder zu Tabellen, die hier freigegeben sind"),
  audit_inhalte: aus("keine eigenen Daten: der Inhalt jedes Glieds steht in den Teilen"),
  audit_koepfe: aus("keine Daten der Person (Kopf der Kette)"),
  standorte: aus("keine Daten der Person (Orte des Betriebs)"),
  schichtvorlagen: aus("keine Daten der Person (Vorlagen des Betriebs)"),
  bedarfe: aus("keine Daten der Person (Bedarf des Betriebs)"),
  // Better Auth's tables (db/auth-schema.ts)
  user: frei("nur Name und Adresse, wie die Mitglieder des Betriebs sie zeigen"),
  session: aus("wann, von wo und womit sich die Person anmeldet, sieht der Inhaber nirgends"),
  account: aus("Anmeldewege gehören zum Konto über alle Betriebe, nicht zum Betrieb"),
  passkey: aus("Anmeldewege gehören zum Konto über alle Betriebe, nicht zum Betrieb"),
  organization: frei("der eigene Betrieb als Verantwortlicher"),
  member: frei("Rolle, wie die Mitgliederliste sie zeigt"),
  invitation: aus("Einladungen per Mail kennt Soll nicht (S-106)"),
  verification: aus("kurzlebige Codes zum Bestätigen, kein Teil der Aufzeichnungen"),
};
