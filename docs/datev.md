---
title: DATEV-Lohnexport
description: >-
  Wie Soll die Bewegungsdaten eines abgeschlossenen Monats für DATEV LODAS und DATEV Lohn und Gehalt
  schreibt – Stunden, Feiertagsstunden und Zuschläge nach § 3b EStG getrennt, mit Lohnarten je
  Betrieb, und aus welchen Quellen das Format stammt.
---

# DATEV-Lohnexport

Soll rechnet keinen Lohn. Es gibt dem Lohnbüro (der Steuerberatung oder der eigenen Lohnabteilung)
für jeden abgeschlossenen Monat eine Datei, die das Lohnprogramm einliest, statt dass jemand
Stunden und Zuschläge abtippt:

| Lohnprogramm | Datei | Name |
| --- | --- | --- |
| DATEV LODAS | ASCII-Import mit `[Allgemein]`, `[Satzbeschreibung]` und `[Bewegungsdaten]` | `DATEV_LODAS_JJJJ-MM.txt` |
| DATEV Lohn und Gehalt | Spaltendatei für den ASCII-Import-Assistenten | `DATEV_LuG_JJJJ-MM.txt` |

Beide Dateien sind Text in Windows-1252 (ANSI) mit CR LF am Ende jeder Zeile, Strichpunkt als
Feldtrenner und Komma als Dezimalzeichen.

## Nur abgeschlossene Monate

Die Datei entsteht aus dem Inhalt, mit dem der Betrieb den Monat
[abgeschlossen](monatsabschluss.md) hat, also aus den Stempelungen, für die der Prüfwert jeder
Person steht. Was danach geschieht, ändert sie nicht: Ein Gegeneintrag zu einem abgeschlossenen Tag
zählt im Monat, in dem er gebucht wird, und erscheint in dessen Datei. Ein zweiter Export desselben
Monats gibt dieselbe Datei.

Solange eine Person mit Arbeitszeitmodell den Monat nicht abgeschlossen hat, gibt es keine Datei:
Ihre Zahlen könnten sich noch ändern, und eine Datei ohne sie wäre unvollständig. Das gilt auch für
jemanden, der den Betrieb inzwischen verlassen, im Monat aber gestempelt hat, auch ohne
Arbeitszeitmodell; Inhaber schließen seinen Monat mit einem Grund ab. Fehlt ihm das Modell, ist es
danach „nicht hinterlegt“, mit den Tagen, an denen er gearbeitet hat.

## Was in der Datei steht

Je Person und Monat ein Posten je Art, der vorkommt; Posten mit null fallen weg.

| Posten | Einheit | Woher |
| --- | --- | --- |
| Stunden (Stundenlohn) | Stunden | gearbeitete Minuten der Tage mit einem Modell „je Stunde“, dazu die Gegeneinträge des Monats |
| Stunden (Minijob mit Stundenlohn) | Stunden | ebenso für ein Minijob-Modell „je Stunde“ |
| Feiertagsstunden | Stunden | für Stundenlohn das Soll des Modells an einem gesetzlichen Feiertag am Standort, abzüglich der an ihm gearbeiteten Minuten (§ 2 Abs. 1 EntgFG: bezahlt wird die Zeit, die „infolge eines gesetzlichen Feiertages ausfällt“; nicht an Tagen mit [Soll aus dem Plan](dienstplan.md#soll-aus-dem-plan)) |
| Urlaub, Krank, Kind krank, Sonderurlaub | Stunden | die Gutschrift der Abwesenheit (siehe [Konten](konten.md)); folgt mit den Abwesenheiten (S-401) |
| Ausgezahlte Überstunden | Stunden | eine Auszahlung aus dem Überstundenkonto; folgt mit den Anpassungen des Kontos |
| Nachtzuschlag, steuerfrei und steuerpflichtig | Euro | [Zuschläge](zuschlaege.md) nach § 3b EStG |
| Sonntagszuschlag, steuerfrei und steuerpflichtig | Euro | ebenso |
| Feiertagszuschlag, steuerfrei und steuerpflichtig | Euro | ebenso, mit 24.12. und 31.12. ab 14 Uhr und dem Satz von 150 % |

- **Monatslohn ist kein Posten**: Gehalt und Festbezüge pflegt das Lohnbüro in den Stammdaten des
  Lohnprogramms. Für Personen mit Monatslohn stehen nur Zuschläge und Abwesenheiten in der Datei.
- **Zuschläge als Betrag**: Soll rechnet sie mit dem Grundlohn und den Sätzen des
  Arbeitszeitmodells auf den Cent, getrennt in den steuerfreien Teil und den steuerpflichtigen Rest.
  Das Lohnprogramm übernimmt die Beträge mit den Lohnarten des Betriebs, statt sie aus Stunden noch
  einmal selbst zu rechnen.
- **Stunden mit zwei Stellen**: Soll zählt ganze Minuten und rundet erst die Summe eines Postens
  auf Hundertstel, und zwar auf, nie zulasten der Person: 487 Minuten sind 8,1166… Stunden, in der
  Datei 8,12.
- **Ein Tag, ein Modell**: Wechselt das Modell im Monat (etwa von Stundenlohn auf Monatslohn ab dem
  16.), zählt jeder Tag nach seinem Modell, auch für die Sätze der Zuschläge.

Die Sätze der Zuschläge stehen am [Arbeitszeitmodell](einrichtung.md) in Prozent des
Stundenlohns (in der Einrichtung unter „Zuschläge (§ 3b EStG)“: Nacht, Sonntag, Feiertag; 0 bis
4 Uhr gilt wie Nacht, der 25. und 26.12. und der 1.5. wie Feiertag). Ohne Satz wird kein Zuschlag
gezahlt.

## Einrichten

Unter **Einstellungen → DATEV-Lohnexport**, für Inhaber und Lohnbüro:

| Angabe | Form | Wofür |
| --- | --- | --- |
| Beraternummer | 4 bis 7 Ziffern | Kopf der LODAS-Datei |
| Mandantennummer | 1 bis 5 Ziffern | Kopf der LODAS-Datei |
| Personalnummer je Person | 1 bis 5 Ziffern, im Betrieb nur einmal (als Zahl: `7` und `07` sind dieselbe) | jede Zeile |
| Lohnart je Posten | bis 4 Ziffern | jede Zeile |

Eine Personalnummer bekommt jedes Mitglied, das im Betrieb arbeitet, und jeder, der ihn mit einem
abgeschlossenen Monat verlassen hat: Auch dessen Monat geht noch an die Lohnabrechnung.

Welche Lohnart welcher Posten bekommt, legt der Betrieb mit dem Lohnbüro fest; Soll schlägt keine
Nummern vor, denn sie hängen von den Lohnarten des Mandanten ab. Die Lohnarten der Zuschläge legt
das Lohnbüro im Lohnprogramm als steuerfreie und als steuerpflichtige Bezüge an. Jede Änderung der
Zuordnung steht in der [Audit-Kette](audit-kette.md).

## Herunterladen

Unter **Auswertungen → DATEV-Lohnexport** Monat und Lohnprogramm wählen und **Datei herunterladen**.
Fehlt etwas, nennt Soll alles auf einmal, statt etwas anzunehmen:

- ein Monat, der für eine Person mit Modell nicht abgeschlossen ist;
- Berater- oder Mandantennummer (nur LODAS, die Datei für Lohn und Gehalt hat keinen Kopf);
- die Personalnummer einer Person, die einen Posten hat;
- die Lohnart eines Postens, der im Monat vorkommt;
- ein Arbeitszeitmodell an einem gearbeiteten Tag, der Lohn eines Modells mit Zuschlägen, die
  Feiertage am Standort oder eine Regelversion für die Zuschläge („nicht hinterlegt“);
- Stunden, die durch Gegeneinträge unter null fielen.

Die API dazu (Rolle Inhaber oder Lohnbüro, Modul Arbeitszeit eingeschaltet):

| Aufruf | Was |
| --- | --- |
| `GET /api/v1/arbeitszeit/datev` | Zuordnung, Posten und Personen mit Personalnummer |
| `PUT /api/v1/arbeitszeit/datev` | Zuordnung setzen; eine Personalnummer `null` entfernt sie |
| `GET /api/v1/arbeitszeit/datev/export?monat=JJJJ-MM&ziel=lodas` | die Datei (`ziel=lug` für Lohn und Gehalt) oder 409 mit `fehlend` |

## LODAS

```text
[Allgemein]
Ziel=LODAS
Version_SST=1.0
BeraterNr=1234567
MandantenNr=10001
Feldtrennzeichen=;
Zahlenkomma=,
Datumsformat=TT.MM.JJJJ

[Satzbeschreibung]
1;u_lod_bwd_buchung_standard;abrechnung_zeitraum#bwd;pnr#bwd;la_eigene#bwd;bs_nr#bwd;bs_wert_butab#bwd;

[Bewegungsdaten]
1;01.12.2026;11;1000;1;24,00;
1;01.12.2026;11;1310;2;64,00;
```

Jede Zeile der Bewegungsdaten bucht in die Erfassungstabelle „Standard“ des Abrechnungsmonats
(`u_lod_bwd_buchung_standard`, nicht in die Nachberechnung): Abrechnungsmonat (sein erster Tag),
Personalnummer, Lohnart, Bearbeitungsschlüssel (`1` Stunden, `2` Betrag) und Wert. Import in LODAS
unter Datenübernahme → ASCII-Daten importieren, mit Prüflauf.

## Lohn und Gehalt

Elf Felder je Zeile, ohne Kopf: Personalnummer, Kalendertag, Ausfallschlüssel, Lohnartennummer,
Stundenanzahl, Tagesanzahl, Wert, abweichender Faktor, abweichende Lohnveränderung,
Kostenstellennummer, Kostenträger. Soll füllt Personalnummer, Lohnart und Stunden oder Wert:

```text
11;;;1000;24,00;;;;;;
11;;;1310;;;64,00;;;;
```

Die Satzbeschreibung legt das Lohnbüro einmal im ASCII-Import-Assistenten an: Trennzeichen
Strichpunkt, Satztrenner Zeilenende, Zahlenkomma, die elf Felder in dieser Reihenfolge.

## Quellen

Die Feldregeln stehen mit ihrer Quelle im Code (`packages/export/src/datev/`). Erreichbar waren beim
Bau (November 2026):

- **developer.datev.de**, über die Inhalte des Portals: „Lohnimportdatenservice“, „Interface
  requirements“ und „Interface requirements ASCII-Format“ (hr:imports 2.0.0, Fassung 1.1 vom
  16.04.2025). Sie beschreiben den Weg der Dateien und verlangen einen Testimport in der
  DATEV-Anwendung; für Lohn und Gehalt gilt der Aufbau der `Standard.ini`. Die Felder selbst
  verweisen dort auf das Schnittstellenhandbuch im DATEV Help-Center.
- **Nicht erreichbar** aus der Bauumgebung: das DATEV Help-Center (apps.datev.de, unter anderem
  Dok.-Nr. 0906285, 1080789 und 9226266) und die DATEV-Community.

Deshalb folgt das Format öffentlichen Dateien, die LODAS und Lohn und Gehalt einlesen:

- JeffreyL26/admin, `docs/datev-lohnexport.md` und `payrollExport/lodas.ts` (nennt das
  Schnittstellenhandbuch LODAS, Fach 3 und 4): Kopf, Tabelle, Feldnamen, Bearbeitungsschlüssel,
  Zeichensatz, CR LF, die elf Felder für Lohn und Gehalt, die Formen der Nummern;
- spaeth/docassemble-onboarding, `templates/lodas.txt`: Tabelle, Feldnamen, Bearbeitungsschlüssel 1
  und 2, Strichpunkt am Satzende;
- huskycare/odoo_german_wage_supplements, `hr_attendance_export.py`: Kopf und Tabelle;
- replikativ/kontor, `payroll_de_datev/emit.clj`: CR LF, Feldtrennzeichen.

Ein Testimport bei einer Steuerberatung steht unter den Schritten für Menschen in der
[Bauliste](https://github.com/Speicherstadt/soll/blob/main/BAULISTE.md); bis dahin ist der Export
gegen diese Quellen gebaut, nicht gegen das Handbuch selbst.
