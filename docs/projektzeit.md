---
description: >-
  Kunden, Aufträge, Tätigkeiten und Stundensätze im Modul Projektzeit von Soll: die vier festen
  internen Tätigkeiten, welcher Stundensatz gilt, Budgets mit Warnung und Archivieren statt Löschen.
---

# Projektzeit: Kunden, Aufträge, Tätigkeiten

Unter **Projekte** legt der Betrieb an, worauf seine Leute Zeit buchen: Kunden, Aufträge und
Tätigkeiten, dazu die Stundensätze. Der Bereich gehört zum Modul Projektzeit; ist es aus, fehlt er in
der Navigation, und der Server lehnt jede seiner Routen ab (`403 modul_aus`). Die Daten bleiben
dabei erhalten. Die Stoppuhr, mit der gebucht wird, kommt mit S-602.

## Wer was sieht

| Rolle | Aufträge und Tätigkeiten | Kunden | Budget in Euro | Stundensätze |
| --- | --- | --- | --- | --- |
| Inhaber, Planer | lesen und ändern | lesen und ändern | ja | lesen und ändern |
| Mitarbeiter, Lohnbüro, Betriebsrat, Externe | lesen | lesen (über die API) | nein | nein |
| Gerät (Terminal) | nein | nein | nein | nein |

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
Auftrag seinen Kunden mitbringt.

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
Stoppuhr (S-602).

## Archivieren statt Löschen

Was noch etwas nennt, wird archiviert statt gelöscht: einen Kunden mit Auftrag oder Satz, einen
Auftrag oder eine Tätigkeit mit Satz lehnt der Server beim Löschen ab (`409 verwendet`). Ein
archivierter Kunde bekommt keine neuen Aufträge, ein archivierter Auftrag oder eine archivierte
Tätigkeit keine neuen Sätze (`409 archiviert`); zurückholen geht jederzeit. Jede Änderung steht in der
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

Antworten: `400 ungueltig` bei falschen Angaben (auch Bruchteile von Minuten oder Cent), `404
unbekannt`, `409` mit `verwendet`, `archiviert`, `fest` (feste Tätigkeit) oder `doppelt`, `422` mit
`kunde_unbekannt`, `projekt_unbekannt`, `taetigkeit_unbekannt` oder `person_unbekannt`.
