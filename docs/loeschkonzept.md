---
title: Löschkonzept
description: >-
  Welche Daten Soll speichert, wie lange und wer sie löscht: Datenarten, Löschklassen mit Frist und
  Startereignis nach DIN 66398, jede Tabelle der Datenbank mit dem, was der Code heute tut.
---

# Löschkonzept

!!! warning "Vorlage, juristisch zu prüfen"
    Diese Seite beschreibt, was Soll speichert und löscht, so wie der Code es heute tut. Sie ist
    eine Vorlage für das Löschkonzept des Betriebs und keine Rechtsberatung. Sie ist noch nicht
    juristisch geprüft; der Betrieb übernimmt sie in seine eigene Dokumentation und passt sie an.

Personenbezogene Daten dürfen nur so lange gespeichert werden, wie es für ihren Zweck nötig ist
(Art. 5 Abs. 1 lit. e DSGVO), und sind danach zu löschen (Art. 17 Abs. 1 lit. a DSGVO), es sei denn,
eine gesetzliche Pflicht verlangt, sie aufzubewahren (Art. 17 Abs. 3 lit. b DSGVO). Diese Seite folgt
dem Aufbau der DIN 66398: Datenarten, Löschklassen mit Regelfrist und Startereignis, Umsetzung,
Verantwortung, Sicherungen und Löschsperren.

Ein Test (`apps/server/src/db/loeschkonzept.test.ts`) vergleicht die Tabelle
[unten](#tabellen) mit allen Tabellen der Datenbank: Kommt eine neue Tabelle hinzu, schlägt er fehl,
bis sie hier mit ihrer Löschklasse steht.

## Verantwortung

| Rolle | Aufgabe |
| --- | --- |
| Betrieb (Inhaber) | Verantwortlicher nach Art. 4 Nr. 7 DSGVO für die Daten seiner Beschäftigten; legt fest, welche Daten gelöscht werden, löscht von Hand, was Soll nicht selbst löscht, und beantwortet Anträge nach Art. 17 DSGVO |
| Betreiber der Instanz | wer den Server betreibt (der Betrieb selbst oder ein Dienstleister als Auftragsverarbeiter nach Art. 28 DSGVO); hält Soll aktuell, damit die Aussonderung läuft, und räumt Sicherungen und Logs nach den Fristen unten weg |
| Soll | sondert abgeschlossene Monate nach Ablauf ihrer Frist von selbst aus (alle sechs Stunden), löscht Zugangsmittel beim Widerruf und schreibt jede Löschung in die [Audit-Kette](audit-kette.md) |

## Datenarten

| Datenart | Beispiele | Zweck |
| --- | --- | --- |
| Arbeitszeit | Stempelungen mit jeder Änderung und ihrem Grund, Gegeneinträge, Monatsabschlüsse mit Prüfwert | Aufzeichnung nach § 3 Abs. 2 Nr. 1 ArbSchG (BAG, 13.09.2022, 1 ABR 22/21), § 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG; Grundlage des Lohns |
| Abwesenheiten | Urlaub, Krankheit (ohne Diagnose), Kind krank, Bescheinigung liegt vor ja oder nein | Urlaub nach BUrlG, Entgeltfortzahlung nach EntgFG, Kinderkrankengeld nach § 45 SGB V |
| Angaben für die Prüfung | Geburtsdatum (Jugendliche), Zeiträume des Mutterschutzes, Wechselschicht, Arbeit auf Abruf | Prüfung nach JArbSchG, MuSchG und TzBfG |
| Lohn und Konten | Arbeitszeitmodell mit Lohn, Personalnummer, Startsaldo, Auszahlung, Hinweise auf den Verfall von Urlaub | Soll, Ist, Konten, DATEV-Export |
| Dienstplan | Schichten, Kalender-Abo | Planung, Information der Beschäftigten |
| Projektzeit | Buchungen auf Aufträge, Stundensätze, Stundennachweise mit Unterschrift des Kunden | Abrechnung beim Kunden |
| Zugangsmittel | Konto, Passwort als Hash, Passkeys, Sitzungen, PIN als Hash, QR-Code und NFC-Karte als Hash, Zugänge zur API als Hash, Push-Abos | Anmeldung und Stempeln |
| Protokoll | Glieder der Audit-Kette mit Akteur, Zeit, Tabelle, Zeile und Hash des Inhalts | Unveränderbarkeit nach GoBD Rz. 107 ff., Prüfwert der Beschäftigten |
| Import | Originaldatei aus dem alten Tool mit Namen und Zeiten aller Personen darin, Zuordnung der Personen, was übernommen wurde | Umzug zu Soll ohne Abtippen; Nachweis, woher eine übernommene Zeit stammt ([Umzug](umzug.md)) |
| Daten des Betriebs | Standorte, Vorlagen, Bedarf, Kunden, Aufträge, Tätigkeiten, Einstellungen | Betrieb der Software; keine Daten der Beschäftigten (ein Kunde kann eine Person sein) |

## Löschklassen

| Klasse | Daten | Regelfrist und Startereignis | Grundlage | Umsetzung in Soll |
| --- | --- | --- | --- | --- |
| M | Aufzeichnungen eines abgeschlossenen Monats | 2 Jahre, 8 Jahre, wenn das Lohnbüro aus dem Monat bucht; ab Ende des Kalenderjahres, in dem der Monat abgeschlossen wurde | § 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG; § 147 Abs. 1 Nr. 4, Abs. 3 AO, § 257 Abs. 4 HGB | von selbst: [Aussonderung](monatsabschluss.md#aufbewahrung-und-aussonderung) (S-901), mit den gespeicherten Inhalten der Kettenglieder |
| K | kurzlebige Daten der Anmeldung | mit ihrem Ablauf (Sitzung 7 Tage nach Voreinstellung von Better Auth, Einladung 7 Tage, Bestätigungscodes) | Art. 5 Abs. 1 lit. e DSGVO | Sitzungen löscht Better Auth beim Abmelden und wenn eine abgelaufene vorgezeigt wird; Einladungen bleiben (offener Punkt) |
| Z | Zugangsmittel eines Geräts oder einer Karte | bis zum Widerruf, spätestens bis zum Austritt der Person | Art. 5 Abs. 1 lit. c und e DSGVO | Zeile oder Schlüssel wird beim Widerruf gelöscht; nach dem Austritt gilt das Mittel nicht mehr, die Zeile bleibt (offener Punkt) |
| P | Stammdaten der Person im Betrieb | bis die letzte Aufzeichnung der Person ausgesondert ist, die sie braucht; Startereignis Austritt | Art. 5 Abs. 1 lit. e, Art. 17 Abs. 3 lit. b DSGVO | noch nicht: Soll löscht sie nicht von selbst (offener Punkt) |
| V | Planung und Hinweise zu einem Tag | wie der Monat, zu dem der Tag gehört (Klasse M) | Art. 5 Abs. 1 lit. e DSGVO | von Hand, solange der Monat offen ist; von selbst noch nicht (offener Punkt) |
| L | Leistungsnachweise an Kunden | abgerechnet: 8 Jahre ab Ende des Kalenderjahres der Abrechnung als Beleg der Rechnung; nicht abgerechnet: bis sie gelöscht wird | § 147 Abs. 1 Nr. 4, Abs. 3 AO, § 257 Abs. 4 HGB | von Hand, solange nicht abgerechnet; von selbst noch nicht (offener Punkt) |
| B | Daten des Betriebs | solange der Betrieb Soll nutzt | Vertrag mit dem Kunden, berechtigtes Interesse | von Hand in den Einstellungen; Kunden, Aufträge und Tätigkeiten werden archiviert und erst gelöscht, wenn nichts sie mehr nennt |
| A | Protokoll der Audit-Kette | für die Lebensdauer der Instanz; gespeicherte Inhalte folgen der Klasse ihrer Zeile | GoBD Rz. 107 ff.; Art. 17 Abs. 3 lit. b DSGVO | Glieder und Köpfe bleiben, sie halten nur Hashes, Kennungen und Zeiten; Inhalte entfernt die Aussonderung und das Entziehen einer Karte |
| I | Schlüssel der Instanz | solange die Instanz läuft | keine personenbezogenen Daten | bleibt |

Warum die Glieder der Kette bleiben: Jede Person hält den Prüfwert ihres Monats; er ist ein Glied
der Kette. Würden Glieder gelöscht, ließe sich kein Prüfwert mehr nachprüfen, auch nicht der eines
Monats, der noch aufbewahrt wird. Ein Glied hält nur den Hash des Inhalts, nicht den Inhalt
([Audit-Kette](audit-kette.md)); der Inhalt selbst wird mit seiner Zeile gelöscht.

## Tabellen

Jede Tabelle der Datenbank mit Klasse, Inhalt und dem, was Soll heute mit ihr tut. „Löscht“ heißt:
die Zeile verschwindet, ein Glied der Audit-Kette hält fest, dass sie gelöscht wurde. Die
gespeicherten Inhalte ihrer früheren Glieder bleiben dabei in `audit_inhalte`, außer bei der
Aussonderung und beim Entziehen einer Karte (siehe [Offene Punkte](#offene-punkte)).

| Tabelle | Klasse | Inhalt | Was Soll heute tut |
| --- | --- | --- | --- |
| `stempelungen` | M | Kommen, Pause, Gehen mit Zeit, Quelle, jeder Fassung und ihrem Grund | sondert jede Fassung mit dem Monat ihres Arbeitstags aus; vorher nie gelöscht, nur ersetzt oder als entfernt markiert |
| `importe` | M | Werkzeug, SHA-256, Name und Größe der Originaldatei, Zuordnung der Personen, was dabei herauskam, wer und wann | sondert die Zeile aus, sobald alle Monate ausgesondert sind, in denen übernommene Zeiten oder Abwesenheiten liegen |
| `korrekturen` | M | Gegeneinträge nach dem Abschluss mit Grund | sondert sie mit dem Monat aus, in dem sie gebucht sind |
| `monatsabschluesse` | M | Bestätigung und Abschluss mit Inhalt und Prüfwert | sondert beide Schritte mit dem Monat aus |
| `abwesenheiten` | M | Art, Zeitraum, Status, Grund, Bescheinigung ja oder nein, Kind als Nummer | sondert sie aus, wenn alle Monate entfernt sind, die sie berührt; eine offene Krankheit nie |
| `aussonderungen` | A | welcher Monat welcher Person mit welcher Frist entfernt wurde, ohne Inhalt | bleibt als Nachweis der Löschung |
| `audit_glieder` | A | Akteur, Zeit, Tabelle, Zeile, Aktion, Hash des Inhalts und des Vorgängers | bleibt |
| `audit_inhalte` | A | der Inhalt jedes Glieds als JSON | entfernt bei der Aussonderung und beim Entziehen einer NFC-Karte; sonst bleibt er (offener Punkt) |
| `audit_koepfe` | A | letztes Glied der Kette je Betrieb | bleibt |
| `einladungen` | K | Name und Rolle, Hash des Links, gültig bis, wer angenommen hat | bleibt nach Ablauf und Annahme (offener Punkt) |
| `session` | K | Sitzung mit Ablauf, Token, IP-Adresse und Browser | löscht Better Auth beim Abmelden und wenn eine abgelaufene vorgezeigt wird; eine nie wieder vorgezeigte bleibt (offener Punkt) |
| `verification` | K | Bestätigungswerte von Better Auth mit Ablauf, etwa die Challenge beim Anlegen eines Passkeys | löscht Better Auth, wenn der Wert gebraucht wird; ein nie gebrauchter bleibt nach Ablauf (offener Punkt) |
| `invitation` | K | Einladungen per Mail von Better Auth | leer: Soll lädt per Link ein (S-106) |
| `pins` | Z | PIN als Hash (Argon2id) und Kennung (HMAC), Fehlversuche, Sperre | ersetzt beim neuen Setzen; nach dem Austritt nicht mehr erkannt, die Zeile bleibt (offener Punkt) |
| `ausweise` | Z | Hash des QR-Codes, wer ihn wann ausgestellt hat | löscht beim Widerruf, ersetzt beim neuen Ausstellen |
| `karten` | Z | NFC-Karte mit Art, Kennung, Schlüssel einer NTAG 424 DNA, Zähler | Entziehen löscht den Schlüssel aus der Zeile und aus allen Inhalten ihrer Glieder; die Zeile bleibt mit dem Zähler gegen Wiederholung |
| `geraete` | Z | öffentlicher Schlüssel je Gerät für die Warteschlange ohne Netz | bleibt (offener Punkt) |
| `push_abos` | Z | Abo für Web Push, verschlüsselt, mit Sprache | löscht beim Abmelden des Geräts und wenn der Push-Dienst es nicht mehr kennt (404, 410) |
| `api_zugaenge` | Z | Name, SHA-256 und Anfang des Tokens, Ablauf, Tag der letzten Nutzung | löscht beim Widerruf; ein abgelaufener bleibt (offener Punkt) |
| `kalender_abos` | Z | SHA-256 des Tokens des Kalender-Feeds, Sprache | löscht beim Widerruf, ersetzt beim neuen Ausstellen |
| `passkey` | Z | öffentlicher Schlüssel eines Passkeys mit Gerätename | bleibt; einen Weg zum Entfernen in der App gibt es nicht (offener Punkt) |
| `user` | P | Konto mit Name, E-Mail-Adresse oder Benutzername | bleibt; ein Konto kann mehreren Betrieben angehören, Soll löscht keine Konten (offener Punkt) |
| `account` | P | Anmeldeweg mit Passwort als Hash | bleibt mit dem Konto |
| `member` | P | Mitgliedschaft und Rolle in Better Auth | löscht Better Auth beim Austritt |
| `mitgliedschaften` | P | Spiegel von `member` in der Audit-Kette mit Rolle und Beginn | löscht beim Austritt |
| `personenangaben` | P | Geburtsdatum, Wechselschicht, Arbeit auf Abruf, Zeiträume des Mutterschutzes | bleibt nach dem Austritt (offener Punkt) |
| `modellzuordnungen` | P | welches Arbeitszeitmodell ab welchem Tag gilt | bleibt nach dem Austritt (offener Punkt) |
| `datev_personalnummern` | P | Personalnummer für DATEV | löscht, wenn der Inhaber sie leert; sonst bleibt sie (offener Punkt) |
| `konto_anpassungen` | P | Startsaldo und Resturlaub zum Stichtag, Auszahlung, Korrekturen der Konten mit Grund; bei einem übernommenen Saldo Import, Werkzeug und Kennung im alten Tool | bleibt nach dem Austritt (offener Punkt) |
| `urlaubshinweise` | P | Tag und Inhalt jedes Hinweises auf den Verfall von Urlaub | bleibt nach dem Austritt (offener Punkt) |
| `erinnerungseinstellungen` | P | abgeschaltete Erinnerungen, Mail der Person | bleibt nach dem Austritt (offener Punkt) |
| `schichten` | V | Schicht mit Person, Zeit, Rolle, Standort, veröffentlicht oder Entwurf; bei einer aus Planday oder Crewmeister übernommenen Import, Werkzeug und Kennung im alten Tool | Planer und Inhaber löschen von Hand; von selbst nichts (offener Punkt) |
| `schichttausche` | V | Tausch einer Schicht: wer anbietet, an wen, wer übernimmt, Status, Grund einer Ablehnung | sondert zwei Jahre nach Ablauf des Kalenderjahrs der Schicht aus |
| `erinnerungen` | V | welche Erinnerung wann an wen ging | bleibt (offener Punkt) |
| `projektzeiten` | L | Buchungen mit Person, Auftrag, Tätigkeit, Zeit, Notiz, abgerechnet am; bei einer aus einer Tabelle oder aus Kimai übernommenen Buchung Import, Werkzeug und Kennung im alten Tool | die Person oder Inhaber und Planer löschen von Hand, bis sie abgerechnet ist; danach bleibt sie (offener Punkt) |
| `stundensaetze` | L | Stundensätze in Cent, auch je Person | Inhaber löscht von Hand |
| `stundennachweise` | L | unterschriebener Nachweis mit Name und Unterschrift des Kunden | unveränderlich; bleibt (offener Punkt) |
| `stundennachweis_buchungen` | L | welche Buchungen ein Nachweis sperrt | bleibt mit dem Nachweis |
| `haben_uebergaben` | L | Leistung an Haben ohne Namen der Person, Ergebnis | bleibt (offener Punkt) |
| `betriebe` | B | Name, Module, Bundesland, Schalter wie die Auswertung je Person | bleibt; einen Betrieb löschen kann man nicht |
| `organization` | B | Betrieb in Better Auth | bleibt; Löschen über Better Auth ist gesperrt |
| `standorte` | B | Name, Adresse, Bundesland je Standort | Inhaber löscht von Hand |
| `arbeitszeitmodelle` | B | Soll je Wochentag, Lohn, Minijob, Zuschläge | Inhaber löscht ein Modell, das keiner Person zugeordnet ist |
| `schichtvorlagen` | B | Vorlagen für Schichten | löscht von Hand |
| `bedarfe` | B | Bedarf an Personen je Rolle und Zeit | löscht von Hand |
| `kunden` | B | Kunden mit Nummer (ein Kunde kann eine Person sein) | archiviert; löscht, wenn nichts ihn nennt |
| `projekte` | B | Aufträge mit Budget | archiviert; löscht, wenn nichts ihn nennt |
| `taetigkeiten` | B | eigene Tätigkeiten und Einstellung der festen; bei einer aus Kimai übernommenen Import, Werkzeug und Kennung im alten Tool | archiviert; löscht, wenn nichts sie nennt |
| `datev_einstellungen` | B | Berater, Mandant, Lohnarten | bleibt, wird geändert |
| `haben_zugaenge` | B | Adresse und Token für Haben, verschlüsselt | löscht beim Trennen |
| `tauschregeln` | B | ob ein Tausch eine Freigabe braucht | bleibt, wird geändert |
| `sollquellen` | B | ab welchem Tag das Tagessoll aus dem Dienstplan statt aus dem Arbeitszeitmodell kommt | bleibt, wird ergänzt oder für offene Tage geändert |
| `verfahrensdoku_angaben` | B | Angaben des Betriebs zu seiner [Verfahrensdokumentation](verfahrensdokumentation.md): Rechtsform, Anschrift, Verantwortliche, Ort der Aufbewahrung, Betrieb des Servers, Datensicherung, Ort der Schlüssel und eigene Abschnitte; ein Name nur, wenn der Inhaber ihn einträgt | bleibt, der Inhaber ändert oder leert die Felder; frühere Fassungen bleiben als gespeicherte Inhalte ihrer Kettenglieder (Klasse A) |
| `erinnerungsregeln` | B | Zeiten des Betriebs für Erinnerungen | bleibt, wird geändert |
| `terminals` | B | Tablet mit Name, Hash des Tokens, Schlüssel, Sperren | Entkoppeln sperrt es, die Zeile bleibt |
| `terminal_eintraege` | B | Nummer und Ergebnis jedes Eintrags eines Tablets ohne Netz, nie der Ausweis | bleibt (offener Punkt) |
| `instanzschluessel` | I | VAPID-Schlüsselpaar der Instanz, privater Teil verschlüsselt | bleibt |

## Außerhalb der Datenbank

| Wo | Was | Frist |
| --- | --- | --- |
| Sicherungen (`soll backup`) | eine Kopie der ganzen Datenbank, auch was danach ausgesondert wurde | der Betreiber räumt sie weg ([Installation](installation.md#sicherung)); eine Sicherung sollte nicht länger liegen als die längste Frist der Daten in ihr, höchstens 8 Jahre und ein Kalenderjahr; wer aus einer alten Sicherung wiederherstellt, lässt danach die Aussonderung laufen, sie holt Fälliges von selbst nach |
| Dateispeicher `/data/dateien/` (`SOLL_DATA_DIR/dateien/`) | jede Originaldatei eines Imports unverändert unter ihrem SHA-256 (CSV oder Excel-Mappe `.xlsx`, auch mit weiteren Blättern, die Soll nicht liest; bei einem Abruf die Datei, die der Abruf wurde, ohne Token, Beschreibungen und Sätze), mit Namen, Zeiten und Salden aller Personen darin; die Tabelle `importe` nennt Name und Hash | Regelfrist wie Klasse M: sobald alle zugehörigen `importe`-Zeilen ausgesondert sind und kein anderer Import denselben SHA-256 nutzt, löscht Soll die Datei automatisch; sie liegt nicht in `soll backup`, sondern im Backup des Datenverzeichnisses |
| Log des Servers | je Anfrage Zeit, Methode, Pfad ohne Query, Status und Dauer; keine Header, keine Inhalte; ein Pfad kann die Kennung einer Person enthalten | der Betreiber legt sie im Log-System fest (Vorschlag: 14 Tage) |
| Gerät der Person | die Warteschlange ohne Netz und der zuletzt geladene Tag (IndexedDB) | bis die Warteschlange gesendet ist; der Tag bis zum nächsten Laden |
| Tablet am Eingang | die Warteschlange des Terminals ohne Netz, der Ausweis darin nur verschlüsselt für den Server | bis sie gesendet ist |
| Lohnbüro, DATEV, Haben, Kunden | was der Betrieb exportiert oder überträgt | nach den Regeln des Empfängers; Soll löscht dort nichts |

## Löschsperren

Eine Frist kann länger laufen als oben: Solange die Festsetzungsfrist für Steuern noch läuft
(Ablaufhemmung nach § 147 Abs. 3 AO; welcher Satz, ist bei der juristischen Prüfung nachzusehen), etwa während einer Außenprüfung, oder solange ein
Rechtsstreit die Unterlagen braucht. Soll kennt solche Sperren nicht. Wer eine hat, sichert die
Datenbank vorher (`soll backup`) und bewahrt die Sicherung bis zum Ende der Sperre auf.

## Löschen auf Verlangen

Eine Person kann verlangen, dass ihre Daten gelöscht werden (Art. 17 Abs. 1 DSGVO). Was eine
gesetzliche Pflicht aufzubewahren verlangt (Klasse M, L nach der Abrechnung), bleibt bis zum Ende der
Frist (Art. 17 Abs. 3 lit. b DSGVO). Anderes löscht der Inhaber von Hand, wo Soll einen Weg hat:
QR-Code, NFC-Karte (der Schlüssel), Zugänge zur API, Kalender-Abo, Push-Abos, Personalnummer,
Schichten, nicht abgerechnete Buchungen. Keinen Weg zum Löschen gibt es für die PIN (der Inhaber
kann sie nur durch eine neue ersetzen), die Geräte der Warteschlange, Passkeys, das Konto und die
Angaben für die Prüfung; das sind offene Punkte unten, bis dahin bleibt nur der Betreiber mit
Zugriff auf die Datenbank. Was über eine Person gespeichert ist, zeigt die
[Auskunft](pruefexport.md#auskunft-nach-art-15-dsgvo).

## Offene Punkte

Was Soll heute nicht von selbst löscht und ein Betrieb bis dahin anders regeln muss:

- **Daten nach dem Austritt** (Klasse P): Angaben für die Prüfung (mit dem Mutterschutz), Zuordnung
  der Modelle, Konten, Hinweise, Einstellungen der Erinnerungen, PIN, Geräte und das Konto selbst
  bleiben, bis die Datenbank gelöscht wird. Gebraucht werden sie, bis der letzte Monat der Person
  ausgesondert ist.
- **Planung und Hinweise** (Klasse V): Schichten und gesendete Erinnerungen haben keine Frist.
- **Leistungsnachweise** (Klasse L): abgerechnete Buchungen, Stundennachweise und Übergaben an Haben
  bleiben ohne Frist.
- **Inhalte gelöschter Zeilen**: Löscht Soll eine Zeile außerhalb der Aussonderung, bleiben die
  Inhalte ihrer früheren Glieder in `audit_inhalte`, etwa die Notiz einer gelöschten Buchung.
- **Abgelaufenes**: Einladungen, Zugänge zur API, Sitzungen und Bestätigungswerte bleiben nach
  ihrem Ablauf als Zeile.
