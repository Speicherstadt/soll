---
description: >-
  Wie Soll aus Kommen, Gehen und Pausen den Arbeitstag bildet – Schichten über Mitternacht, die
  Zeitumstellung, Pausen und Lücken, ganze Minuten und was bei fehlenden Stempelungen passiert.
---

# Arbeitstag aus Stempelungen

Aus den Stempelungen einer Person bildet Soll Schichten und Arbeitstage. Auf ihnen bauen alle
Prüfungen auf: Höchstarbeitszeit, Pausen und Ruhezeit, Nachtarbeit, Sonn- und Feiertage. Die Fälle,
die Soll dazu prüft, stehen im [Regelwerk unter R-01](regeln.md#r-01-erfassung-von-beginn-ende-und-dauer).

## Stempelungen

Es gibt vier Arten: **Kommen**, **Gehen**, **Pause** (Beginn) und **Pause-Ende**. Jede trägt ihren
Zeitpunkt als Augenblick, nicht als Uhrzeit; deshalb ist die Stunde, die im Oktober zweimal kommt,
eindeutig. Soll ordnet die Stempelungen nach der Zeit, gleich in welcher Reihenfolge sie ankommen,
etwa aus der Warteschlange eines Handys, das offline war.

## Schicht und Arbeitstag

- Von **Kommen** bis **Gehen** und von **Pause-Ende** bis **Pause** wird gearbeitet.
- Dazwischen liegt eine **Pause**: gestempelt (Pause bis Pause-Ende) oder eine **Lücke** zwischen
  zwei Paaren (Gehen bis zum nächsten Kommen). **Kommen** während einer Pause beendet sie.
- Eine Unterbrechung unter **9 Stunden** gehört zur Schicht, auch über Mitternacht. Ab 9 Stunden
  beginnt eine neue Schicht: Kürzer darf eine Ruhezeit nach dem Arbeitszeitgesetz nie sein (11
  Stunden, nach § 7 Abs. 1 Nr. 3 ArbZG um höchstens 2 Stunden gekürzt). Ob die Ruhezeit reicht,
  prüft danach § 5 ArbZG.
- Eine Schicht reicht nie 24 Stunden über ihren Beginn hinaus. Eine Stempelung danach beendet sie
  nicht: Die Schicht bleibt offen („Gehen fehlt“ oder „Pause-Ende fehlt“), und die Stempelung zählt,
  als liefe keine Schicht, ein „Gehen“ also als „Kommen fehlt“.
- Der **Arbeitstag** ist der Kalendertag in Berlin, an dem die Schicht beginnt. Eine Nachtschicht
  vom Montag, 22 Uhr, bis Dienstag, 6 Uhr, zählt ganz zum Montag. Beginnen an einem Tag zwei
  Schichten, etwa 5 bis 8 Uhr und 17 bis 21 Uhr, gehören beide zu diesem Tag.

## Minuten

Soll rechnet in ganzen Minuten und echter Zeit. Über die Zeitumstellung zählt jede Minute, die
vergangen ist:

| Schicht | Arbeitszeit | Arbeitstag |
| --- | --- | --- |
| Sa 24.10.2026, 22:00, bis So 25.10., 6:00 (Uhren 3 Uhr zurück auf 2 Uhr) | 9:00 | Sa 24.10. |
| Sa 27.03.2027, 22:00, bis So 28.03., 6:00 (Uhren 2 Uhr vor auf 3 Uhr) | 7:00 | Sa 27.03. |
| So 25.10.2026, 2:30 Sommerzeit, bis 2:30 Winterzeit | 1:00 | So 25.10. |

Gerundet wird nie zulasten der Beschäftigten: Ein Beginn zählt ab der angefangenen Minute, ein Ende
bis zur nächsten vollen. Kommen um 8:00:59 und Gehen um 16:00:01 ergeben 8:01. Zwei Schichten teilen sich nie eine Minute: Endet eine Schicht in der Minute, in der die nächste beginnt, zählt diese Minute bei der nächsten. Eine Pause wird so
auf die vollen Minuten in ihr gekürzt.

**Ruhepausen**: Nur eine Unterbrechung von mindestens 15 Minuten ist eine Pause. Eine kürzere zählt
als Arbeitszeit (§ 4 Satz 2 ArbZG). Für jede Schicht hält Soll die Teile fest: die Arbeit mit Beginn,
Ende und Minuten, jede Pause mit Art und Minuten und die Blöcke von einer Ruhepause zur nächsten,
an denen § 4 Satz 3 ArbZG („nicht länger als sechs Stunden hintereinander“) gemessen wird.

## Fehlende und doppelte Stempelungen

Soll ergänzt nie eine Stempelung und stempelt nie selbst aus.

| Was | Ergebnis |
| --- | --- |
| Kommen ohne Gehen | Die Schicht bleibt offen, ihre Zeit zählt noch nicht. Ab dem späteren von zwei Zeitpunkten, 0 Uhr des Folgetags oder 16 Stunden nach Beginn, ist das der Hinweis „Gehen fehlt“: Eine Nachtschicht darf noch laufen. Spätestens 24 Stunden nach Beginn ist es der Hinweis, denn danach kann kein Gehen die Schicht mehr beenden (am Tag der Zeitumstellung im Oktober liegt Mitternacht sonst später). |
| Pause ohne Pause-Ende | ebenso, Hinweis „Pause-Ende fehlt“; die Arbeit bis zur Pause zählt. Ein Kommen oder Pause-Ende 9 Stunden oder mehr nach Beginn der Pause beendet sie nicht, denn die Schicht ist dann vorbei: Die Stempelung zählt, als liefe keine Schicht. |
| Gehen während der Pause | Hinweis „Pause-Ende fehlt“; gezählt wird die Arbeit bis zur Pause |
| Gehen ohne Kommen | Hinweis „Kommen fehlt“ an dem Tag, nichts wird gezählt |
| Pause-Ende ohne Pause | Hinweis „Pause-Beginn fehlt“, die Stempelung zählt nicht. Ein Pause-Ende nach dem Kommen, das die Pause beendet hat, wiederholt dieses Ende: Hinweis „doppelt“. |
| dieselbe Art zweimal in einer Minute | ein doppelter Tipp oder eine erneut gesendete Stempelung, kein Hinweis |
| dieselbe Art zweimal mit Abstand | Hinweis „doppelt“; es zählt der früheste Beginn und das späteste Ende. Ein Gehen oder eine Pause 9 Stunden oder mehr nach dem letzten Ende wiederholt es nicht: Die Stempelung zählt, als liefe keine Schicht. |

Jeder dieser Hinweise nennt § 3 Abs. 2 Nr. 1 ArbSchG (Pflicht zur Erfassung, BAG 1 ABR 22/21). Bis
er nachgetragen ist, ist der Tag unvollständig und sperrt die Bestätigung des Monats. Ein doppelter
Eintrag allein lässt den Tag vollständig: Beginn, Ende und Dauer stehen fest.

## Für Entwickler

`arbeitstage(stempelungen, jetzt)` in `packages/arbeitszeit` (`src/arbeitstag/`) gibt die
Arbeitstage in Kalenderfolge zurück, je Tag die Schichten mit ihren Teilen, die Arbeits- und
Pausenminuten, ob der Tag vollständig ist, und die Befunde. `jetzt` entscheidet, ob eine offene
Schicht noch läuft oder schon ein Befund ist; die Schicht nennt den Zeitpunkt (`offen.faellig`).
Damit eine Nachtschicht am Anfang eines Zeitraums ihr Kommen behält, gibt der Aufrufer die
Stempelungen ab dem Vortag mit.
