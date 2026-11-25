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
  aussonderungen:
    "aussonderungen (welcher Monat nach Ablauf der Frist entfernt wurde, ohne Inhalt)",
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
  kunden: "ausgenommen: Kunden des Betriebs, keine Daten der Person",
  projekte: "ausgenommen: Aufträge des Betriebs, keine Daten der Person",
  taetigkeiten: "ausgenommen: Tätigkeiten des Betriebs, keine Daten der Person",
  stundensaetze: "stundensaetze (nur die Sätze mit der Person, nicht die für alle)",
  projektzeiten: "projektzeiten",
  stundennachweise:
    "ausgenommen: Nachweis des Betriebs an seinen Kunden; die Buchungen der Person darin stehen unter projektzeiten, Name und Unterschrift des Kunden sind Daten eines Dritten (Art. 15 Abs. 4)",
  stundennachweis_buchungen:
    "ausgenommen: welche Buchungen ein Nachweis sperrt, die Buchungen selbst stehen unter projektzeiten",
  datev_einstellungen:
    "ausgenommen: Berater, Mandant und Lohnarten des Betriebs, keine Daten der Person",
  datev_personalnummern: "personalnummer",
  api_zugaenge: "zugaenge (ohne Hash und Anfang des Tokens)",
  terminals: "ausgenommen: Tablets des Betriebs am Eingang, keine Daten der Person",
  ausweise: "ausweis (wann und von wem ausgestellt, ohne den Hash des QR-Codes)",
  haben_zugaenge: "ausgenommen: Adresse und Token des Betriebs für Haben, keine Daten der Person",
  haben_uebergaben:
    "ausgenommen: Leistung des Betriebs an seinen Kunden ohne Namen der Person; die Buchung selbst steht unter projektzeiten",
  karten: "karten (Art, wann und von wem eingetragen, widerrufen; ohne UID, Schlüssel und Zähler)",
  abwesenheiten:
    "abwesenheiten (Art, Zeitraum, Status, Grund, Bescheinigung ja oder nein, Kind als Nummer; keine Diagnose)",
  personenangaben:
    "personenangaben (Geburtsdatum, Wechselschicht, Arbeit auf Abruf, Zeiträume des Mutterschutzes)",
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
  aussonderungen: frei(
    "welcher Monat nach Ablauf der Frist entfernt wurde, wie der Monat es zeigt",
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
  kunden: aus("keine Daten der Person (Kunden des Betriebs)"),
  projekte: aus("keine Daten der Person (Aufträge des Betriebs)"),
  taetigkeiten: aus("keine Daten der Person (Tätigkeiten des Betriebs)"),
  stundensaetze: frei("Sätze der Person, die der Inhaber unter Projekte festlegt und sieht"),
  projektzeiten: frei("Buchungen der Person, die Inhaber und Planer sehen, ändern und abrechnen"),
  stundennachweise: aus("Nachweis an den Kunden mit dessen Unterschrift, Daten eines Dritten"),
  stundennachweis_buchungen: aus("keine eigenen Daten: die Buchungen stehen unter projektzeiten"),
  datev_einstellungen: aus("keine Daten der Person (Einstellungen des Betriebs für DATEV)"),
  datev_personalnummern: frei(
    "Personalnummer, die der Inhaber in den Einstellungen für DATEV festlegt",
  ),
  api_zugaenge: aus("Zugänge der Person zur API sieht der Inhaber sonst nirgends"),
  terminals: aus("keine Daten der Person (Tablets des Betriebs)"),
  ausweise: frei(
    "ob und wann der Inhaber den QR-Code ausgestellt hat, wie die Einstellungen es zeigen",
  ),
  haben_zugaenge: aus("keine Daten der Person (Zugang des Betriebs zu Haben)"),
  haben_uebergaben: aus("keine eigenen Daten: die Buchungen stehen unter projektzeiten"),
  karten: frei(
    "welche Karten der Inhaber der Person eingetragen hat, wie die Einstellungen es zeigen",
  ),
  abwesenheiten: frei(
    "Abwesenheiten mit Art, die der Inhaber freigibt und sieht (abwesenheiten:gesundheit)",
  ),
  personenangaben: frei(
    "Angaben für die Prüfung, die der Inhaber selbst einträgt und liest (personen:angaben)",
  ),
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
