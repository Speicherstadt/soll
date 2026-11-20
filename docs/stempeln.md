---
title: Stempeln
description: >-
  Kommen, Pause und Gehen mit einem Tipp, der laufende Tag mit Soll, Ist und dem nächsten Befund,
  Nachtragen und Ändern mit Grund, und wie jede Änderung für die Person sichtbar bleibt.
---

# Stempeln

Unter **Heute** stempelt jede Person, die für den Betrieb arbeitet, ihre Arbeitszeit: am Handy, am
Tablet oder im Browser. Externe und Geräte stempeln hier nicht; das Terminal kommt später.

## Der Knopf

Der große Knopf zeigt immer den nächsten Schritt:

| Zustand | Großer Knopf | Darunter |
| --- | --- | --- |
| nicht eingestempelt | Kommen | – |
| eingestempelt | Pause starten | Gehen |
| in Pause | Pause beenden | Gehen |

Es zählt die Uhr des Servers, nicht die des Geräts: Wer um 7:58 Uhr auf „Kommen“ tippt, ist um 7:58
Uhr eingestempelt, auch wenn das Handy falsch geht. Die Zeit des Geräts speichert Soll daneben, für
das Stempeln ohne Netz.

Soll stempelt **nie selbst aus**. Wer das Gehen vergisst, bleibt eingestempelt; ab Mitternacht (bei
einer Nachtschicht 16 Stunden nach Beginn) zeigt Heute den Hinweis „Gehen fehlt“ mit
§ 3 Abs. 2 Nr. 1 ArbSchG, bis die Zeit nachgetragen ist. Wie Soll aus den Stempelungen den Tag
bildet, steht unter [Arbeitstag aus Stempelungen](arbeitstag.md).

## Der laufende Tag

Über dem Knopf stehen:

- der **Zustand** mit Uhrzeit („Eingestempelt seit 07:58“, „In Pause seit 12:00“),
- die **gearbeitete Zeit** des Tages, groß, in Stunden und Minuten,
- **Soll**, **Ist** und **Pause**. Das Soll kommt aus dem Arbeitszeitmodell der Person für den
  Wochentag. Ist ihr keins zugeordnet, steht dort „nicht hinterlegt“, nie ein geschätzter Wert.
- der **nächste Befund** mit seiner Norm:

| Was als Nächstes kommt | Beispiel | Norm |
| --- | --- | --- |
| Pause nach 6 Stunden (30 min) oder nach 9 Stunden (45 min), oder nach 6 Stunden am Stück | „Pause fällig in 1:48 · Mindestens 30 Minuten, spätestens ab 13:58“ | § 4 ArbZG |
| 8 Stunden am Tag | „8 Stunden erreicht in 1:30 · Ab 16:30 nur mit Ausgleich an anderen Tagen“ | § 3 ArbZG |
| 10 Stunden am Tag | „10 Stunden erreicht in 0:30 · Nach 18:30 ist Arbeit nicht erlaubt“ | § 3 ArbZG |
| nach dem Gehen: Ende der Ruhezeit | „Ruhezeit bis Sa., 21. Nov., 03:30“ | § 5 Abs. 1 ArbZG |

Gezählt wird, als ginge die Person jetzt: die angefangene Minute zählt mit, nie zu ihrem Nachteil.
Ist eine Grenze schon überschritten, steht der Befund selbst darunter, etwa „Pause fehlt noch
30 min · Verstoß · § 4 Satz 1 ArbZG“. Die Prüfung ist dieselbe wie für den ganzen Tag
([Prüfung nach §§ 3 bis 5 ArbZG](pruefung.md)): Höchstarbeitszeit, Ruhepausen und Ruhezeit. Den
Ausgleichszeitraum über sechs Monate prüft Soll mit dem Monatsabschluss, weil er alle Tage des
Zeitraums und die Feiertage am Standort braucht.

## Nachtragen und Ändern

Unter dem Knopf stehen die Stempelungen des Tages. Jede lässt sich **ändern** (Art, Tag, Uhrzeit)
oder **entfernen**; mit **Nachtragen** kommt eine vergessene dazu. Jede dieser Änderungen braucht
einen **Grund**, ohne Grund speichert Soll nichts.

- Jede Person ändert ihre eigenen Zeiten.
- **Inhaber** und **Planer** ändern die Zeiten aller unter **Zeiten**: Person wählen, Tag wählen,
  ändern. Das **Lohnbüro** sieht die Zeiten aller, ändert sie aber nicht.
- Eine Stempelung kann nicht in der Zukunft liegen. Für die Stunde, die im Oktober zweimal kommt,
  nimmt Soll die erste (Sommerzeit); eine Uhrzeit, die es im März nicht gibt, lehnt es ab.
- Geändert wird bis zum **Monatsabschluss**. Danach ist der Monat gesperrt, eine Korrektur geht nur
  noch als Gegeneintrag.

### Jede Änderung bleibt sichtbar

Soll überschreibt keine Stempelung. Eine Änderung ist eine neue Zeile, die auf die alte verweist;
die alte bleibt, wie sie war, und beide stehen in der [Audit-Kette](audit-kette.md). Unter
**Änderungen** sieht die Person zu jedem Tag, wer was wann und warum geändert hat:

> Jonas Weber hat Gehen 14:30 auf Gehen 13:30 geändert
> Fr., 20. Nov., 09:01 · Grund: Arzttermin, früher gegangen

Eine Änderung steht an dem Arbeitstag, zu dem die Stempelung gehört: Wird das Gehen einer
Nachtschicht nach Mitternacht entfernt, steht das am Tag, an dem die Schicht begann. Eine korrigierte
Stempelung trägt in der Liste die Marke „korrigiert“.

## Arbeitszeitmodell zuordnen

Der Inhaber ordnet unter **Zeiten** jeder Person ein Arbeitszeitmodell zu; es gilt ab dem Tag der
Zuordnung. Ein Modell, das einer Person zugeordnet ist, lässt sich nicht löschen.

## Für Entwickler

Die Endpunkte liegen unter `/api/v1/arbeitszeit` und sind gesperrt, solange das Modul Arbeitszeit
aus ist:

| Endpunkt | Was | Wer |
| --- | --- | --- |
| `GET /tag?datum=&nutzerId=` | ein Tag: Soll, Stand (`tagesstand`), Stempelungen, Änderungen; ohne Datum der laufende Tag | selbst; andere: Inhaber, Planer, Lohnbüro, auch für wen nicht mehr stempelt oder ausgeschieden ist (§ 16 Abs. 2 ArbZG) |
| `POST /stempelungen` | `{ art, geraetZeitpunkt? }`, Zeitpunkt vom Server | selbst |
| `POST /stempelungen/nachtrag` | `{ nutzerId?, art, zeitpunkt, grund }` | selbst; andere: Inhaber, Planer |
| `PATCH /stempelungen/:id` | `{ art, zeitpunkt, grund }`, hängt eine neue Zeile an | selbst; andere: Inhaber, Planer |
| `POST /stempelungen/:id/entfernen` | `{ grund }`, hängt eine Entfernung an | selbst; andere: Inhaber, Planer |
| `GET /personen` | wer stempelt, mit dem Modell von heute | Inhaber, Planer, Lohnbüro |
| `PUT /personen/:nutzerId/modell` | `{ modellId, gueltigAb? }` | Inhaber |

Die Tabelle `stempelungen` hat `betrieb_id`, die Person, Art, Zeitpunkt (Server) und Zeitpunkt des
Geräts, Quelle, `ersetzt` (die Zeile, die diese ersetzt), `entfernt`, Grund, wer und wann. In Kraft
ist eine Zeile, die keine andere ersetzt und die nichts entfernt. Vor jeder Änderung fragt der
Server `monatAbgeschlossen()`, das bis zum Monatsabschluss (S-306) „offen“ sagt. Den laufenden Tag
rechnet `tagesstand()` aus `packages/arbeitszeit`, auf dem Server und in der App mit derselben
Funktion; die App zählt mit der Uhr des Servers weiter.
