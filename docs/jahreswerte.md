---
description: Mindestlohn, Minijob-Grenze, Kinderkrankentage und die Regelversion als Daten mit Gültigkeit; ein fehlender Wert heißt „nicht hinterlegt“.
---

# Jahreswerte und Regelversionen

Manche Grenzen ändern sich jedes Jahr. Soll führt sie als Daten mit Gültigkeitszeitraum und Quelle
in `packages/arbeitszeit` (`src/jahreswerte/werte.ts`), nicht als Zahlen im Code der Regeln.

## Was hinterlegt ist

| Wert | Einheit | Zeiträume | Quelle |
| --- | --- | --- | --- |
| Mindestlohn | Cent je Stunde | 2024: 12,41 €; 2025: 12,82 €; 2026: 13,90 €; 2027: 14,60 € | MiLoV4, MiLoV5 |
| Minijob-Grenze | Cent je Monat | 2024: 538 €; 2025: 556 €; 2026: 603 €; 2027: 633 € | § 8 Abs. 1a SGB IV |
| Kinderkrankentage | Arbeitstage je Jahr | 2026: 15 je Kind (alleinerziehend 30), höchstens 35 (70); 2027: 10 (20), höchstens 25 (50) | § 45 Abs. 2 und 2a SGB V |
| Regelversion | Kennung | 2026-1 ab 1.1.2026 | [Regelwerk](regeln.md) |

Die Minijob-Grenze folgt aus dem Mindestlohn: Mindestlohn × 130 ÷ 3, auf volle Euro aufgerundet
(§ 8 Abs. 1a SGB IV). Ein Test prüft, dass jeder hinterlegte Wert zu dieser Formel passt.

## Fehlt ein Wert

Jeder Betrag gilt bis zum Ende seines Jahres. Für ein Jahr ohne Eintrag heißt das Ergebnis **„nicht
hinterlegt“**; Soll rechnet nie mit dem Wert des Vorjahres. Die Regelversion gilt ohne Enddatum, bis
eine neue sie ablöst: Eine Reform des Arbeitszeitgesetzes wird eine neue Version mit eigenem
Beginn, die alte bleibt für die Tage davor.

## Wechsel mitten in einer Schicht

Werte gelten für Kalendertage in `Europe/Berlin`, ein Wechsel fällt deshalb immer auf Mitternacht.
Eine Nachtschicht vom 31.12.2026, 22:00, bis zum 1.1.2027, 6:00, teilt Soll in 120 Minuten zum
Mindestlohn 2026 und 360 Minuten zum Mindestlohn 2027. Liegt der zweite Teil in einem Jahr ohne
Wert, ist nur dieser Teil „nicht hinterlegt“. Gezählt werden echte Minuten, auch über die
Zeitumstellung.

## Neue Werte eintragen

Ein neuer Wert ist ein neuer Eintrag mit `von`, `bis` und Quelle (Verordnung oder Gesetz mit
Fundstelle); alte Einträge bleiben unverändert. Einzige Ausnahme: Löst eine neue Regelversion
die offene alte ab, bekommt die alte als `bis` den Tag vor dem Beginn der neuen. Der Gesetzeswächter (S-906) meldet, wenn für das
nächste Jahr ein Wert fehlt.
