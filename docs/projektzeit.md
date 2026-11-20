---
description: >-
  Kunden, Aufträge, Tätigkeiten, Stundensätze und die Stoppuhr im Modul Projektzeit von Soll: die vier
  festen internen Tätigkeiten, welcher Stundensatz gilt, Budgets mit Warnung, Buchungen mit Verweis auf
  die Stempelung, der Hinweis bei mehr Projektzeit als Arbeitszeit und „abgerechnet“.
---

# Projektzeit: Kunden, Aufträge, Tätigkeiten, Stoppuhr

Unter **Projekte** legt der Betrieb an, worauf seine Leute Zeit buchen: Kunden, Aufträge und
Tätigkeiten, dazu die Stundensätze. Der Bereich gehört zum Modul Projektzeit; ist es aus, fehlt er in
der Navigation, und der Server lehnt jede seiner Routen ab (`403 modul_aus`). Die Daten bleiben
dabei erhalten. Gebucht wird mit der [Stoppuhr](#stoppuhr) unter **Heute**.

## Wer was sieht

| Rolle | Aufträge und Tätigkeiten | Kunden | Budget in Euro | Stundensätze | Buchungen |
| --- | --- | --- | --- | --- | --- |
| Inhaber, Planer | lesen und ändern | lesen und ändern | ja | lesen und ändern | alle; abrechnen |
| Mitarbeiter, Lohnbüro, Betriebsrat, Externe | lesen | lesen (über die API) | nein | nein | eigene |
| Gerät (Terminal) | nein | nein | nein | nein | nein |

Wer bucht, muss Aufträge und Tätigkeiten sehen. Geld (Budget in Euro, Stundensätze) braucht nur, wer
die Aufträge führt.

## Kunden und Aufträge

Ein **Kunde** hat einen Namen und optional eine Kundennummer. Ein **Auftrag** gehört zu genau einem
Kunden, hat einen Namen, optional eine Auftragsnummer und ein Budget. Den Kunden eines Auftrags
ändert man nicht; für einen anderen Kunden legt man einen neuen Auftrag an.

Kunde, Auftrag und eigene Tätigkeit können eine **Kennung in einer anderen Quelle** tragen
(`externQuelle` und `externId`, nur zusammen): den Kontakt in [Haben](https://haben.app/) oder die
Zeile eines Imports. Dieselbe Kennung gibt es je Betrieb nur einmal, damit ein wiederholter Abgleich
nichts doppelt anlegt. Die Quelle schreibt man wie bei Haben (`externalSource`) in Kleinbuchstaben,
Ziffern, `.`, `-` und `_`.

## Tätigkeiten

Jeder Betrieb hat vier **feste interne Tätigkeiten**: Fahrt, Werkstatt, Lager und Schulung. Sie
gehören zu Soll, nicht zum Betrieb: Sie heißen in jeder Sprache passend, lassen sich weder umbenennen
noch archivieren oder löschen und sind von Anfang an nicht abrechenbar. Ob der Betrieb eine von ihnen
doch abrechnet, etwa die Fahrt zum Kunden, stellt er an der Tätigkeit ein.

Eigene Tätigkeiten (etwa „Montage“ oder „Wartung“) legt der Betrieb an; sie sind von Anfang an
abrechenbar.

## Stundensätze

Ein Stundensatz ist ein Betrag in ganzen Cent je Stunde, gültig ab einem Tag. Er kann eine
Tätigkeit, einen Auftrag oder einen Kunden und eine Person nennen, jede Angabe auch weglassen; ein
Satz ohne Angabe ist der Satz des Betriebs. Ein Satz nennt nie Auftrag und Kunde zugleich, weil der
Auftrag seinen Kunden mitbringt. Als Person nennt ein Satz nur, wer Projektzeit bucht, kein Gerät
(`422 person_unbekannt`).

Für eine Buchung gilt der **genaueste passende Satz**:

1. Tätigkeit (mit Auftrag vor ohne)
2. Auftrag
3. Kunde
4. die Person allein
5. der Satz des Betriebs

Auf jeder Stufe geht der Satz einer Person dem Satz für alle vor. Das ist die Reihenfolge, die
[Kimai](https://www.kimai.org/) für seine Sätze verwendet (Tätigkeit 5, Projekt 3, Kunde 1 Punkt, eine
Person einen Punkt mehr, zuletzt der Satz der Person); Soll zählt die Angaben als Bits (Tätigkeit 8,
Auftrag 4, Kunde 2, Person 1), sodass auch Kombinationen eine eindeutige Stufe haben. Von mehreren
Sätzen derselben Stufe gilt der mit dem spätesten „gültig ab“ bis zum Tag der Buchung; ein Satz, der
erst später gilt, verdeckt keinen anderen. Passt kein Satz, heißt es „nicht hinterlegt“: Soll rät
keinen Betrag.

| Beispiel (Weber Haustechnik, Auftrag „Bad Elbhof“, Sandra, Montage) | gilt |
| --- | --- |
| Satz des Betriebs 55,00 € | 55,00 €, solange nichts Genaueres da ist |
| dazu Sandra 60,00 € | 60,00 € |
| dazu Kunde Elbhof 65,00 € | 65,00 € |
| dazu Auftrag „Bad Elbhof“ für Sandra 80,00 € | 80,00 € |
| dazu Montage 85,00 € | 85,00 € |

Der Betrag einer Buchung ist Minuten × Satz ÷ 60, kaufmännisch auf den Cent gerundet (ab einem halben
Cent aufwärts), in ganzen Zahlen gerechnet (`betragCent`). Gerundet wird nur der Betrag, nie die
Arbeitszeit.

## Budgets

Ein Auftrag kann ein Budget in Stunden (gespeichert in ganzen Minuten), in Euro (in ganzen Cent) oder
in beidem haben. Ab einer Schwelle (Vorgabe 80 %, je Auftrag von 1 bis 100 %) zeigt Soll eine
**Warnung**, ab 100 % heißt das Budget **aufgebraucht**. Verglichen wird in ganzen Zahlen
(verbraucht × 100 ≥ Budget × Schwelle), ohne Brüche. Was verbraucht ist, zählen die Buchungen der
Stoppuhr: jede gebuchte Minute auf dem Auftrag (eine laufende Buchung bis jetzt) und der Betrag der
abrechenbaren Minuten, eine abgerechnete Buchung mit ihrem festgehaltenen Satz, die übrigen mit dem
Satz, der an ihrem Arbeitstag gilt. Minuten ohne Satz („nicht hinterlegt“) zählen keinen Betrag.
Die Liste der Aufträge zeigt „verbraucht von Budget“ je Budget, dazu „Warnung“ oder „aufgebraucht“;
den Teil in Euro sehen nur Inhaber und Planer.

## Stoppuhr

Unter **Heute** steht die Stoppuhr, für alle, die Projektzeit buchen (alle Rollen außer Geräten); mit
Arbeitszeit unter dem Stempelknopf, ohne (Solo) allein.

- **Eine je Person.** Je Person läuft höchstens eine Stoppuhr. Der Server erzwingt das, auch bei zwei
  Tipps zugleich: Ein eindeutiger Index über die laufenden Buchungen einer Person lässt keine zweite
  zu.
- **Wechsel mit einem Tipp.** Die zuletzt gebuchten Kombinationen aus Auftrag und Tätigkeit stehen als
  Knöpfe da, die laufende gedrückt (`aria-pressed`). Ein Tipp auf eine andere beendet die laufende
  Buchung und startet die nächste in derselben Transaktion: Die eine endet in der Minute, in der die
  nächste beginnt, ohne Lücke und ohne Überschneidung. Darunter startet ein Formular jede andere
  Kombination; „Ohne Auftrag (intern)“ bucht interne Zeit, etwa Werkstatt oder Lager.
- **Ganze Minuten.** Beginn und Ende gelten auf die volle Minute (die Sekunden fallen weg), die Dauer
  hat ganze Minuten. Eine Buchung, die in ihrer ersten Minute gestoppt oder gewechselt wird, hat keine
  Minute und wird nicht gebucht. Die Nacht der Zeitumstellung zählt ihre echten Minuten.
- **Verweis auf die Stempelung.** Jede Buchung gehört zu einem Arbeitstag: dem Tag der Schicht, in die
  ihr Beginn fällt (eine Buchung nach Mitternacht in einer Nachtschicht zum Tag, an dem die Schicht
  beginnt), außerhalb jeder Schicht zum Kalendertag ihres Beginns. Der Arbeitstag wird beim Schreiben
  festgehalten, damit Satz und Abrechnung nicht mit einer späteren Korrektur wandern. Das Kommen der
  Schicht nennt Soll beim Lesen nach dem Stand der Stempelungen („Schicht ab 7:00“ oder „außerhalb
  der Schicht“).
- **Hinweis bei mehr Projektzeit als Arbeitszeit.** Übersteigt die gebuchte Zeit eines Arbeitstags
  die gestempelte Arbeitszeit (§ 2 Abs. 1 ArbZG, wie unter Heute gezählt), zeigt der Tag einen
  Hinweis mit beiden Summen und der Differenz. Projektzeit ist Teil der Arbeitszeit; mehr davon heißt,
  eine Buchung oder eine Stempelung stimmt nicht. Soll ändert nichts und sperrt nichts. Ohne Modul
  Arbeitszeit oder für jemanden, der in Soll nicht stempelt, gibt es keinen Hinweis.

| Beispiel (Sandra, 20.11.2026) | gestempelt | gebucht | Hinweis |
| --- | --- | --- | --- |
| Kommen 7:00, Gehen 9:00; Montage 7:00–9:00 | 2:00 | 2:00 | keiner |
| dazu Fahrt 10:00–10:45 | 2:00 | 2:45 | 0:45 mehr |
| Stoppuhr seit 7:00, Kommen 7:10, jetzt 8:00 | 0:50 | 1:00 | 0:10 mehr |
| keine Stempelung, Fahrt 10:00–11:00 | 0:00 | 1:00 | 1:00 mehr |
| ohne Modul Arbeitszeit, Fahrt 10:00–11:00 | – | 1:00 | keiner |

### Buchungen ändern bis „abgerechnet“

Die Person ändert, trägt nach und löscht ihre eigenen Buchungen, Inhaber und Planer die aller
Personen. Eine Buchung von Hand ist abgeschlossen: Sie endet nach ihrem Beginn, nicht in der Zukunft
und höchstens 24 Stunden danach (`422 spanne`). Buchungen derselben Person überschneiden sich nicht
(`409 ueberschneidung`); aneinander anschließen dürfen sie. Eine laufende Buchung behält ihr offenes
Ende; beendet wird sie mit Stoppen (`409 laeuft`).

**Abgerechnet** markieren Inhaber und Planer, später die Übergabe an Haben (S-606). Danach ist die
Buchung gesperrt (`409 abgerechnet`), und sie behält den Satz, mit dem sie abgerechnet wurde: den Satz,
der an ihrem Arbeitstag gilt, für eine abrechenbare Tätigkeit, sonst keinen. Eine spätere Änderung der
Sätze ändert keine Rechnung. Abgerechnet werden alle genannten Buchungen oder keine; eine laufende
nicht.

Ein **abgeschlossener Monat** sperrt Projektzeit nicht: Die Stempelungen sind die Aufzeichnung nach
§ 16 Abs. 2 ArbZG und werden gesperrt, die Projektzeit ist eine Grundlage der Rechnung und bleibt bis
„abgerechnet“ änderbar (Projektplan, „Arbeitszeit und Projektzeit“).

## Archivieren statt Löschen

Was noch etwas nennt, wird archiviert statt gelöscht: einen Kunden mit Auftrag oder Satz, einen
Auftrag oder eine Tätigkeit mit Satz oder Buchung lehnt der Server beim Löschen ab (`409 verwendet`).
Ein archivierter Kunde bekommt keine neuen Aufträge, ein archivierter Auftrag oder eine archivierte
Tätigkeit keine neuen Sätze und keine neuen Buchungen (`409 archiviert`); eine Buchung, die sie schon
nennt, bleibt änderbar. Die Aufträge eines archivierten Kunden zählen dabei
mit: Sie bekommen keine neuen Sätze, und ein archivierter Auftrag kommt erst nach seinem Kunden
zurück. Sonst geht zurückholen jederzeit. Jede Änderung steht in der
[Audit-Kette](audit-kette.md).

## API

Alle Routen liegen unter `/api/v1/projektzeit` und verlangen eine Sitzung im Betrieb:

| Route | Wer | Was |
| --- | --- | --- |
| `GET /kunden`, `GET /projekte`, `GET /taetigkeiten` | alle außer Geräten | lesen; Aufträge ohne `budgetCent` für alle außer Inhaber und Planer |
| `POST`, `PATCH /{id}`, `DELETE /{id}` auf `kunden`, `projekte`, `taetigkeiten` | Inhaber, Planer | anlegen, ändern (auch `archiviert: true` oder `false`), löschen |
| `GET /saetze`, `POST /saetze`, `DELETE /saetze/{id}` | Inhaber, Planer | Stundensätze |
| `GET /saetze/personen` | Inhaber, Planer | die Personen, die ein Satz nennen kann |
| `GET /saetze/gilt?projektId=&taetigkeitId=&nutzerId=&tag=` | Inhaber, Planer | der Satz, der für eine Buchung gilt, oder `nicht_hinterlegt` |
| `GET /stoppuhr?tag=&nutzerId=` | alle außer Geräten (eine andere Person nur Inhaber und Planer) | der Arbeitstag (ohne `tag` der der laufenden Buchung, sonst der heutige): `laufend`, `buchungen` mit `minuten` und `kommen`, `gebuchtMinuten`, `gestempeltMinuten` (`null` ohne Erfassung), `hinweis`, `zuletzt` |
| `POST /stoppuhr/start` | alle außer Geräten | `{ projektId, taetigkeitId, notiz? }`: startet die eigene Stoppuhr, `201` mit `laufend` und der beendeten Buchung `beendet`; dieselbe Kombination noch einmal ändert nichts (`200`) |
| `POST /stoppuhr/stopp` | alle außer Geräten | stoppt die eigene Stoppuhr; `beendet` ist `null` für eine Buchung ohne Minute, `409 laeuft_nicht` ohne laufende |
| `POST /buchungen` | alle außer Geräten (`nutzerId` einer anderen Person nur Inhaber und Planer) | `{ projektId, taetigkeitId, beginn, ende, notiz? }` in UTC-Millisekunden auf der vollen Minute: eine Buchung von Hand |
| `PATCH /buchungen/{id}`, `DELETE /buchungen/{id}` | die Person selbst, Inhaber und Planer | ändern (`projektId`, `taetigkeitId`, `beginn`, `ende`, `notiz`) oder löschen bis „abgerechnet“ |
| `POST /buchungen/abrechnen` | Inhaber, Planer | `{ buchungIds }`: markiert als abgerechnet, mit `centProStunde` und `betragCent` je Buchung |

`GET /projekte` nennt je Auftrag `budget`: eine Zeile je gesetztem Budget mit `verbraucht`, `rest`
und `stufe` (`ok`, `warnung`, `aufgebraucht`), die Zeile in Cent nur für Inhaber und Planer.

Antworten: `400 ungueltig` bei falschen Angaben (auch Bruchteile von Minuten oder Cent, ein Zeitpunkt
außerhalb der vollen Minute), `404 unbekannt` (auch für die Buchung einer anderen Person ohne Recht
dazu), `409` mit `verwendet`, `archiviert`, `fest` (feste Tätigkeit), `doppelt`, `ueberschneidung`,
`abgerechnet`, `laeuft` oder `laeuft_nicht`, `422` mit `kunde_unbekannt`, `projekt_unbekannt`,
`taetigkeit_unbekannt`, `person_unbekannt` oder `spanne`.
