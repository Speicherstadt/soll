---
title: Verfahrensdokumentation
description: >-
  Wie Soll die Verfahrensdokumentation nach den GoBD bei jedem Abruf aus dem Stand des Betriebs
  erzeugt, was der Inhaber selbst einträgt und wie er sie als PDF oder Markdown herunterlädt.
---

# Verfahrensdokumentation

Sobald die Arbeitszeiten Grundlage des Lohns sind (Stundenlohn, Minijob, Zuschläge; § 41 EStG,
§ 4 LStDV), gelten für sie die GoBD, und zu den GoBD gehört eine **Verfahrensdokumentation**: eine
Beschreibung, wie die Daten entstehen, verarbeitet, geschützt und aufbewahrt werden
(BMF-Schreiben vom 28.11.2019, Rz. 151 bis 155). Soll schreibt sie selbst, und zwar aus dem
**Stand des Betriebs** in dem Moment, in dem sie abgerufen wird. Was nur der Betrieb wissen kann,
trägt der Inhaber dazu ein.

Die Seite liegt unter **Einstellungen → Verfahrensdokumentation öffnen** (`/verfahrensdoku`). Sie
ist nur für den Inhaber; der Server lehnt jede andere Rolle ab.

## Was im Dokument steht

Die Gliederung folgt Rz. 153 (allgemeine Beschreibung, Anwenderdokumentation, technische
Systemdokumentation, Betriebsdokumentation) und Rz. 100 ff. (internes Kontrollsystem):

| Abschnitt | Aus dem Stand des Betriebs |
| --- | --- |
| 1. Allgemeine Beschreibung | Name und Bundesland, eingeschaltete und ausgeschaltete Module, Standorte mit regionalen Feiertagen, dazu Rechtsform, Anschrift, Verantwortliche und Ort der Aufbewahrung aus den Angaben |
| 2. Erfassung und Verarbeitung | Stempeln in App, PWA, API und Terminal, ohne Netz, Änderungen mit Grund, Prüfung mit Norm, Monatsabschluss; Dienstplan und Projektzeit nur, wenn eingeschaltet |
| 3. Terminal | Kopplung, PIN, QR-Code, NFC-Karten und Warteschlange ohne Netz, mit jedem Terminal (gekoppelt, widerrufen, mit Schlüssel ohne Netz) und der Zahl der PINs, QR-Codes und Karten; ist das Modul aus, steht nur das da |
| 4. Weitergabe und Übernahme | DATEV (eingerichtet oder nicht, Zahl der Lohnarten und Personalnummern), Prüfexport, Haben (nur die Adresse, nie das Token), Importe, Auskunft |
| 5. Audit-Kette und Prüfwert | wie die [Audit-Kette](audit-kette.md) und der Prüfwert schützen, mit dem Prüfwert und der Zahl der Glieder beim Erzeugen und dem Ergebnis der Kettenprüfung, die dabei läuft |
| 6. Programm und Datenhaltung | Version von Soll, SQLite, Migrationen, Formate für Zeit und Geld, Verschlüsselung der Geheimnisse, mehrere Betriebe in einer Instanz |
| 7. Zugänge und Rechte | Anmeldung und Einladung, jede Rolle mit der Zahl ihrer Mitglieder und allem, was sie in den eingeschalteten Modulen darf, Zahl der API-Zugänge, mit denen man sich jetzt anmelden könnte (einer Person, die Mitglied ist, angelegt seit ihrer Mitgliedschaft, nicht abgelaufen); keine Namen und keine E-Mail-Adressen |
| 8. Aufbewahrung und Aussonderung | Fristen je Monatsabschluss (2 oder 8 Jahre), Aussonderung, Zahl der aufbewahrten und der ausgesonderten Monate |
| 9. Betrieb und Datensicherung | `soll backup` und `soll restore` ([Installation](installation.md#sicherung)), dazu Betrieb des Servers, Datensicherung und Ablage der Schlüssel aus den Angaben |
| 10. Internes Kontrollsystem | Rechte auf dem Server, Bestätigen und Abschließen, Prüfwert bei den Beschäftigten, Lücken in Nummern, Plausibilität, Kontrolle der Kette |
| 11. Fassungen | jede gespeicherte Änderung der Angaben mit Zeitpunkt und Kettenglied |
| 12 ff. | die eigenen Abschnitte des Betriebs |

Ein ausgeschaltetes Modul heißt im ersten Abschnitt so, und kein Abschnitt beschreibt seine Abläufe: Ohne Arbeitszeit fehlen Stempeln, Monatsabschluss, Stundenzettel, Prüfung nach dem Arbeitszeitgesetz, die Fristen je Monat, DATEV und Prüfexport, ohne Terminal das Terminal, ohne Dienstplan und Projektzeit deren Abläufe und Kontrollen; Rechte eines ausgeschalteten Moduls stehen nicht bei den Rollen.

Oben steht der **Stand**: Tag, Version von Soll und der Prüfwert der Kette beim Erzeugen
(Rz. 154). Eine Fassung, die der Betrieb herunterlädt und ablegt, bleibt damit eindeutig: Mit dem
Prüfwert zeigt die [Prüfseite](monatsabschluss.md#prufwert-und-prufseite) später, ob die Kette bis
dahin verändert wurde.

Das Dokument ist auf Deutsch, in jeder Sprache der App, weil es für die deutsche Finanzverwaltung
ist. Es enthält kein Geheimnis, kein Token, keinen Hash eines Tokens, keine Personalnummer und
keinen Namen eines Mitglieds.

## Angaben zum Betrieb

Manches kann kein Programm wissen. Der Inhaber trägt es auf der Seite ein:

| Feld | Was hinein gehört | Grundlage |
| --- | --- | --- |
| Rechtsform | etwa Einzelunternehmen, GmbH, UG | Rz. 153 |
| Anschrift | Straße, Postleitzahl, Ort | Rz. 153 |
| Verantwortlich | wer für Aufzeichnung und Aufbewahrung verantwortlich ist und wer vertritt | Rz. 100, 102 |
| Ort der Aufbewahrung | wo Server, Daten und Sicherungen stehen | § 146 Abs. 2 bis 2b AO |
| Betrieb des Servers | wer den Server betreibt und Updates einspielt | Rz. 101, 153 |
| Datensicherung | wie, wohin und wie oft gesichert wird und wer die Wiederherstellung prüft | Rz. 103 bis 106 |
| Ablage von Schlüsseln und Passwörtern | wo `SOLL_SECRET_KEY`, Passwörter und Zertifikate liegen; nur der Ort, nie das Geheimnis | Rz. 103 |

Ein leeres Feld steht im Dokument als **Fehlt**, und das Dokument heißt dann **unvollständig**;
so sieht nichts ausgefüllt aus, was es nicht ist. Dazu kommen bis zu **20 eigene Abschnitte** mit
Titel und Text, etwa für Stundenzettel auf Papier aus der Zeit vor Soll oder weitere Programme;
eine Leerzeile trennt Absätze. Jede Änderung der Angaben steht mit altem und neuem Inhalt in der
Audit-Kette, und das Dokument nennt sie unter „Fassungen“.

## Herunterladen

**PDF herunterladen** gibt das Dokument als PDF (A4), **Markdown herunterladen** als Markdown, beide
als `verfahrensdokumentation-<Tag>.pdf` bzw. `.md`. Derselbe Stand am selben Tag ergibt dieselbe
Datei. Text aus den Angaben wird im Markdown maskiert: Ein Stern oder ein `#` wird nicht zur
Formatierung, HTML kommt nicht durch.

## Herkunft

Gliederung, Datenmodell (Abschnitte mit Absätzen, Listen und Lücken), die Angaben zum Betrieb und
das Markdown stammen aus `packages/gobd-kern/src/verfahrensdoku/` in
[Haben](https://github.com/firsttris/haben) und sind für Soll angepasst: Haben sichert mit Triggern
in PostgreSQL, Soll mit seiner eigenen Kette im Code und dem Prüfwert bei den Beschäftigten
(Projektplan, „Unveränderbarkeit“). Der Code liegt in `packages/export/src/verfahrensdoku/` (reine
Funktionen, Golden-Tests für „Weber Haustechnik“ und „Café Elbblick“) und
`apps/server/src/modules/verfahrensdoku/` (Stand und Angaben).

## API

| Aufruf | Was |
| --- | --- |
| `GET /api/v1/verfahrensdoku` | das Dokument als JSON und die Angaben |
| `GET /api/v1/verfahrensdoku/datei?format=pdf` | das Dokument als PDF (`format=md` als Markdown) |
| `PUT /api/v1/verfahrensdoku/angaben` | alle Angaben und die eigenen Abschnitte auf einmal speichern |

Alle drei nur mit dem Recht `verfahrensdoku:verwalten` (Inhaber); sie hängen an keinem Modul.
