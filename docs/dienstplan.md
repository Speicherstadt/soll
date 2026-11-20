---
title: Dienstplan
description: >-
  Die Woche je Standort planen: Schichtvorlagen, Ziehen und Ablegen mit Maus und Tastatur, Bedarf je
  Rolle und wo er nicht gedeckt ist, Entwürfe bis zur Veröffentlichung und was die Zeitumstellung mit
  einer Nachtschicht macht.
---

# Dienstplan

Mit dem Modul **Dienstplan** plant der Betrieb die Schichten einer Woche, je Standort. Das Modul
schaltet der Inhaber in der Einrichtung („Schichten oder Plan“) oder später unter Einstellungen.
Ist es aus, lehnt der Server jede Anfrage an den Dienstplan ab, nicht nur die App blendet ihn aus;
die geplanten Schichten bleiben erhalten.

## Wer was sieht

| Rolle | Dienstplan |
| --- | --- |
| Inhaber, Planer | planen: Vorlagen, Schichten, Bedarf; sehen den Entwurf |
| Mitarbeiter, Lohnbüro, Betriebsrat | sehen nur veröffentlichte Schichten |
| Externe, Geräte | nichts |

Alles, was geplant wird, ist zunächst ein **Entwurf**. Den sehen nur Inhaber und Planer; im Kopf
der Woche steht dann „Entwurf“. Erst das Veröffentlichen (kommt mit S-503, mit Benachrichtigung und
Kalender-Feed) macht Schichten für die Beschäftigten sichtbar. Wer nicht plant, sieht auch keine
Mitgliederliste, sondern nur die Personen, die in der Woche eine veröffentlichte Schicht haben.

Soll zeigt im Plan keine Summen je Person, etwa geplante Stunden oder Auslastung: Eine Auswertung
je Person gibt es nur, wenn der Betrieb sie eingeschaltet hat (§ 87 Abs. 1 Nr. 6 BetrVG).

## Die Woche

Die Woche läuft von Montag bis Sonntag, im Kopf steht die Kalenderwoche nach ISO 8601 (die Woche mit
dem ersten Donnerstag des Jahres ist KW 1). Am Desktop ist der Plan ein Raster: Personen als Zeilen,
Tage als Spalten, die Schichten als Blöcke mit Uhrzeit, Vorlage und Rolle. Unten steht eine eigene
Zeile **Offen** für Schichten, für die noch niemand eingeplant ist. Hat der Betrieb mehrere
Standorte, wählt der Kopf den Standort; jede Schicht gehört zu genau einem.

Am Handy zeigt der Plan einen Tag zur Zeit: oben die sieben Tage der Woche zum Antippen, darunter,
wer an dem Tag arbeitet.

## Schichtvorlagen

Unter **Vorlagen** legt der Planer Schichten an, die immer wiederkehren, etwa „Früh“ 7:00 bis 15:00
an der Theke oder „Spät“ 14:00 bis 22:00 im Service: Name, Beginn, Ende, Pause in ganzen Minuten und
Rolle. Eine Vorlage lässt sich ändern und entfernen; Schichten, die schon aus ihr geplant sind,
behalten ihre Zeiten.

## Planen, ziehen und ablegen

- **Aus einer Vorlage**: Am Desktop eine Vorlage aus der Leiste über dem Plan auf einen Tag einer
  Person ziehen (oder auf „Offen“).
- **Von Hand**: Das „+“ in einer Zelle öffnet „Schicht hinzufügen“: Vorlage oder eigene Zeiten,
  Tag, Person oder offen, Pause und Rolle.
- **Verschieben mit der Maus**: Den Block auf einen anderen Tag oder eine andere Person ziehen.
- **Verschieben mit der Tastatur**: Den Griff neben dem Block fokussieren, mit Enter aufnehmen, mit
  den Pfeiltasten Person (hoch, runter) und Tag (links, rechts; Pos1 und Ende für Montag und Sonntag)
  wählen, mit Enter ablegen oder mit Escape abbrechen. Ein Screenreader hört dabei jedes Ziel.
- **Ändern und entfernen**: Ein Klick auf den Block öffnet die Schicht; dort lassen sich alle
  Angaben ändern, auch Tag und Person, und die Schicht entfernen.

Beim Verschieben bleibt die Uhrzeit, nicht die Dauer: Eine Schicht von 22:00 bis 6:00 bleibt 22:00
bis 6:00, auch wenn sie in die Nacht der Zeitumstellung rückt.

## Bedarf je Rolle und Standort

Unter **Bedarf** legt der Planer fest, wie viele Personen einer Rolle an einem Wochentag von wann bis
wann am Standort gebraucht werden, etwa „Montag 14:00 bis 22:00, Service, 2“. Der Bedarf gilt jede
Woche. Unter dem Plan steht, für jeden Tag der Woche, ob er gedeckt ist:

- Gezählt werden die eingeplanten Schichten derselben Rolle am selben Standort. Maßgeblich ist der
  Moment mit den wenigsten Personen: Zwei Schichten nacheinander (7:00 bis 15:00 und 14:00 bis
  22:00) decken einen Bedarf von 10:00 bis 22:00 einmal; eine Lücke dazwischen lässt ihn ungedeckt.
  Wer zur selben Zeit zweimal eingeplant ist, zählt als eine Person.
- Eine Nachtschicht vom Vortag zählt mit, soweit sie in den Bedarf reicht.
- Offene Schichten decken nichts, sie werden aber daneben genannt.
- „fehlt 1“ steht als Wort neben der Farbe, nie nur als Farbe.

Die Rolle ist ein kurzer Text wie „Service“ oder „Küche“ und muss in Bedarf und Schicht gleich
geschrieben sein; die App schlägt die Rollen der Vorlagen vor.

## Zeit, Mitternacht und Zeitumstellung

- Eine Schicht speichert Beginn und Ende als Zeitpunkte (UTC-Millisekunden) und den Tag, an dem sie
  beginnt. Dieser Tag ist ihr **Arbeitstag**, auch wenn sie über Mitternacht geht; ein Ende vor dem
  Beginn liegt am nächsten Tag.
- Beginn und Ende werden auf der Uhr in Berlin eingegeben. Eine Nachtschicht von 22:00 bis 6:00 hat
  in der Nacht auf den letzten Sonntag im März 7 Stunden, in der Nacht auf den letzten Sonntag im
  Oktober 9 Stunden.
- Eine Uhrzeit, die es wegen der Zeitumstellung nicht gibt (2:30 am letzten Sonntag im März), lehnt
  der Server ab. Von der doppelten Stunde im Oktober gilt die erste, in Sommerzeit.
- Eine Pause, die so lang ist wie die Schicht, lehnt der Server ab; Minuten nur ganz.

Die Prüfung der geplanten Schichten nach dem Arbeitszeitgesetz und § 12 TzBfG folgt mit S-502, mit
denselben Regeln wie für gestempelte Zeiten.

## Schnittstelle

Alle Pfade unter `/api/v1/dienstplan`, nur bei eingeschaltetem Modul; jeder Aufruf gilt dem Betrieb
der Sitzung, eine `betriebId` im Inhalt lehnt der Server ab.

| Methode und Pfad | Wer | Was |
| --- | --- | --- |
| `GET /woche?standortId=…&tag=JJJJ-MM-TT` | alle, die planen oder lesen | die Woche um den Tag; für Planer mit Entwurf, Personen und Deckung (`deckung`), sonst nur Veröffentlichtes und `deckung: null` |
| `GET`, `POST /vorlagen`; `PUT`, `DELETE /vorlagen/:id` | Inhaber, Planer | Schichtvorlagen |
| `GET /bedarf?standortId=…`, `POST /bedarf`, `DELETE /bedarf/:id` | Inhaber, Planer | Bedarf je Rolle und Wochentag (1 Montag bis 7 Sonntag) |
| `POST /schichten`, `PATCH`, `DELETE /schichten/:id` | Inhaber, Planer | Schichten: `standortId`, `tag`, `beginnMinute`, `endeMinute`, `pauseMinuten`, `rolle`, `nutzerId` (oder `null` für offen), beim Anlegen `vorlageId` |

Ein Standort, eine Person oder eine Vorlage eines anderen Betriebs ergibt 404
(`standort_unbekannt`, `person_unbekannt`, `vorlage_unbekannt`), eine Uhrzeit, die es nicht gibt,
422 `zeit_gibt_es_nicht`. Ein Standort mit Schichten oder Bedarf lässt sich nicht entfernen (409
`verplant`). Jede Änderung steht in der [Audit-Kette](audit-kette.md).
