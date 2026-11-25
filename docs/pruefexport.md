---
title: Prüfexport und Auskunft
description: >-
  Wie Soll die Arbeitszeiten je Person und Zeitraum für Zoll und Arbeitsschutz als CSV und PDF
  ausgibt und wie jede Person alle ihre Daten nach Art. 15 DSGVO als Datei bekommt.
---

# Prüfexport und Auskunft

Unter **Zeiten → Prüfexport** (und **Einstellungen → Meine Daten**) liegen zwei Exporte: der
**Prüfexport** mit den Arbeitszeiten für eine Behörde und die **Auskunft** mit allem, was Soll über
eine Person speichert.

## Prüfexport

Zoll (Finanzkontrolle Schwarzarbeit, § 17 MiLoG, § 2a SchwarzArbG) und Arbeitsschutzbehörde
(§ 16 Abs. 2 ArbZG, § 17 ArbZG) dürfen die Aufzeichnungen der Arbeitszeit verlangen. Der Prüfexport
gibt sie für einen Zeitraum aus, als **CSV** für eine Tabelle und als **PDF** zum Ausdrucken, beide
mit demselben Inhalt.

### Wer was exportiert

| Wer | Was |
| --- | --- |
| Inhaber, Planer, Lohnbüro (Recht `zeiten:alle`) | alle Personen oder eine, auch wer den Betrieb verlassen hat |
| alle, die stempeln | die eigenen Tage |
| Externe | die eigenen Tage aus der Zeit, in der sie gestempelt haben |

Der Zeitraum geht vom ersten bis zum letzten Tag und umfasst höchstens zwei Jahre, so lange, wie
die Aufzeichnungen aufzubewahren sind (§ 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG). Die Seite beginnt mit
dem Vormonat. Ist das Modul Arbeitszeit abgeschaltet, lehnt der Server den Prüfexport ab.

Der Prüfexport ist keine Auswertung je Person im Sinne von § 87 Abs. 1 Nr. 6 BetrVG: Er gibt die
Aufzeichnungen aus, die das Gesetz verlangt, und rechnet keine Leistung oder Auslastung.

### Inhalt

Eine Zeile je Person und Arbeitstag mit einer Stempelung, einer Änderung, einem Gegeneintrag oder
einem Befund:

| Spalte | Inhalt |
| --- | --- |
| Person | Name des Kontos |
| Datum | der Arbeitstag, `TT.MM.JJJJ`; eine Nachtschicht gehört zum Tag, an dem sie beginnt |
| Beginn, Ende | Uhrzeit in Berlin; ein Ende an einem späteren Tag mit Datum; „offen“, solange eine Schicht kein Ende hat (Soll ergänzt nichts) |
| Pausen (Minuten), Dauer (Minuten) | ganze Minuten, wie auf dem Stundenzettel |
| Erfasst am | wann Soll die letzte Stempelung des Tages, so wie er jetzt steht, gespeichert hat: daran prüft die Behörde die sieben Tage des § 17 Abs. 1 MiLoG |
| Änderungen | jede Änderung von Hand: nachgetragen, geändert oder entfernt, von wem, wann, vorher und nachher, mit Grund; liegt eine Stempelung an einem anderen Tag als dem Arbeitstag der Zeile (das Gehen einer Nachtschicht, eine Stempelung, die auf einen anderen Tag oder in einen anderen Monat verschoben wurde), steht ihr Datum vor der Uhrzeit |
| Gegeneinträge | Korrekturen nach dem Abschluss mit Minuten, Grund, wer und wann |
| Befunde | mit Norm, z. B. „Verstoß: Ruhepause · § 4 ArbZG“ |
| Monat abgeschlossen, Prüfwert | für einen abgeschlossenen Monat Zeitpunkt und Prüfwert, sonst leer |

Ein abgeschlossener Monat erscheint so, wie er abgeschlossen wurde: genau das deckt sein Prüfwert.
Mit dem Prüfwert prüft die Behörde auf der [Prüfseite](monatsabschluss.md), ob der Monat
seitdem unverändert ist. Das PDF (A4 quer, jede Person auf eigener Seite) listet unter der Tabelle
die Änderungen, die Gegeneinträge und alle Monate des Zeitraums mit ihrem Prüfwert oder „nicht
abgeschlossen“, dazu die Adresse der Prüfseite.

### Format der CSV

- UTF-8 mit Byte Order Mark, Trennzeichen Semikolon, Zeilenende CRLF, Anführungszeichen nach
  RFC 4180: So öffnet Excel in Deutschland die Datei mit einem Doppelklick richtig.
- Mehrere Änderungen in einer Zelle stehen je auf einer eigenen Zeile.
- Beginnt eine Textzelle mit `=`, `+`, `-`, `@`, Tab oder Wagenrücklauf, steht ein Hochkomma davor:
  Eine Tabellenkalkulation führt den Inhalt dann nicht als Formel aus (CSV-Injection).
- Dauern in ganzen Minuten, nie als Dezimalzahl.

## Auskunft nach Art. 15 DSGVO

Jede Person lädt unter **Einstellungen → Meine Daten** eine JSON-Datei mit allem, was Soll in
diesem Betrieb über sie speichert, unabhängig von Rolle und Modulen. Für eine Person, die den
Betrieb verlassen hat und sich nicht mehr anmelden kann, erteilt der Inhaber die Auskunft (Recht
`auskunft:erteilen`, Aufruf `GET /api/v1/auskunft?nutzerId=…`). Diese Auskunft enthält nur, was
der Inhaber in Soll ohnehin sieht: Name und E-Mail des Kontos, Mitgliedschaft und Einladung,
Stempelungen mit allen Fassungen und Gründen, Gegeneinträge, Abschlüsse mit Inhalt und Prüfwert,
Modelle mit Lohn und Zuschlägen, Schichten, Stundensätze, Buchungen der Projektzeit,
Abwesenheiten mit Art (Krankheit ohne Diagnose), Angaben für die Prüfung, Schichttausche, Personalnummer, QR-Code und NFC-Karten der Person (wann eingetragen) und die Glieder der Audit-Kette zu diesen Tabellen. Alles andere bleibt
draußen, auch jeder Teil, der später dazukommt, bis jemand ihn freigibt: Anmeldewege und Sitzungen,
Benutzername, PIN-Zustand, Geräte und Erinnerungen. Der Inhaber sieht sie sonst nirgends, und sie
verrieten dem Arbeitgeber, wo, wann und womit sich die Person anmeldet, welche Erinnerungen sie
abgeschaltet hat und auf wie vielen Geräten und in welcher Sprache sie die App nutzt (Art. 5 Abs. 1
lit. b und c DSGVO).

| Teil | Inhalt |
| --- | --- |
| `hinweise` | Zwecke, Rechtsgrundlage, Empfänger, Speicherdauer, Rechte, Herkunft, keine automatisierte Entscheidung (Art. 15 Abs. 1 lit. a bis h) |
| `konto`, `anmeldung`, `sitzungen` | Name, E-Mail, Benutzername; Anmeldewege und Passkeys; Sitzungen in diesem Betrieb mit Adresse und Browser |
| `mitgliedschaft`, `einladungen`, `pin` | Rolle und seit wann; die angenommene Einladung; ob eine PIN gesetzt und gesperrt ist |
| `stempelungen` | jede Fassung jeder Stempelung mit Grund, wer und wann; nichts wird überschrieben |
| `gegeneintraege`, `monatsabschluesse` | Korrekturen; Bestätigungen und Abschlüsse mit dem Inhalt des Monats und dem Prüfwert |
| `aussonderungen` | die Monate, deren Inhalt nach Ablauf der Aufbewahrungsfrist entfernt wurde (S-901): Monat, Frist, abgeschlossen und entfernt am, ohne Inhalt |
| `arbeitszeitmodelle`, `schichten`, `geraete` | zugeordnete Modelle mit Soll, Lohn und Sätzen der Zuschläge; Schichten, auch im Entwurf; Geräte mit öffentlichem Schlüssel |
| `schichttausche` | jeder Tausch einer Schicht (S-504), den die Person angeboten, an sich gerichtet bekommen oder übernommen hat: ihre Rolle darin, Status, Zeitpunkte und der Grund einer Ablehnung, ohne die andere Person und ohne den, der entschied |
| `ausweis` | wann und von wem der QR-Code für das Terminal ausgestellt wurde (S-801), ohne seinen Wert und Hash, sonst `null` |
| `karten` | die NFC-Karten der Person (S-802) mit Art, wann und von wem eingetragen und wann entzogen, ohne UID, Schlüssel und Lesezähler |
| `personalnummer` | die Personalnummer im Lohnprogramm für den DATEV-Export (S-308), sonst `null` |
| `stundensaetze` | Stundensätze, die der Betrieb für die Person festgelegt hat (Projektzeit, S-601), nicht die Sätze für alle |
| `projektzeiten` | die Buchungen der Stoppuhr und von Hand mit Auftrag, Tätigkeit, Beginn, Ende, Arbeitstag und Notiz, abgerechnete mit dem Satz der Abrechnung (S-602) |
| `auditKette` | die Glieder der Kette zu den eigenen Zeilen (wer, wann, Hash; bei einem Schichttausch steht für jeden, der nicht die Person selbst ist, „eine andere Person“, auch an dem Glied der Schicht, mit dem der Tausch ihre Person wechselte) und die Glieder, die die Person selbst geschrieben hat, nur mit Tabelle, Aktion und Zeitpunkt |

Zeitpunkte stehen als ISO 8601 in UTC. Nicht enthalten sind Kennwort, Tokens, der Hash der PIN und
der Einladung (sie schützen das Konto) und Daten anderer Personen: Von den Gliedern, die die Person
für andere geschrieben hat, nennt die Auskunft weder Zeile noch Inhalt (Art. 15 Abs. 4 DSGVO).
Stundennachweise (S-605) stehen nicht darin: Die Buchungen der Person darin stehen unter
`projektzeiten`, Name und Unterschrift des Kunden sind Daten eines Dritten.
Dazu kommen die Wünsche zu Erinnerungen, die gesendeten Erinnerungen und die Geräte für Push-Nachrichten (ohne Endpunkt und Schlüssel, S-307); Abwesenheiten kommen dazu, sobald es sie gibt (S-401). Ein Test hält
fest, dass jede Tabelle der Datenbank in der eigenen Auskunft steht oder mit Grund ausgenommen ist,
und für die Auskunft durch den Inhaber freigegeben oder mit Grund ausgelassen ist.

## Schnittstelle

| Aufruf | Antwort |
| --- | --- |
| `GET /api/v1/arbeitszeit/pruefexport?von=2026-10-01&bis=2026-10-31&format=csv` | die eigenen Tage als CSV (`format=pdf`: als PDF) |
| … `&nutzerId=<id>&nutzerId=<id>` | diese Personen, für `zeiten:alle` |
| `GET /api/v1/auskunft` | die eigene Auskunft als JSON |
| `GET /api/v1/auskunft?nutzerId=<id>` | die Auskunft einer Person, die Mitglied ist oder war, für den Inhaber |

Ein ungültiger oder zu langer Zeitraum gibt 400, eine Person ohne Recht 403, eine Person eines
anderen Betriebs 404.
