---
title: Audit-Kette und Prüfwert
description: >-
  Wie Soll jede Änderung in einer Hash-Kette festhält, wie die Prüfung Änderungen an der Datenbank
  findet und was der Prüfwert auf dem Stundenzettel bedeutet.
---

# Audit-Kette und Prüfwert

Jede Schreiboperation in Soll hängt in derselben Transaktion ein **Kettenglied** an. Einen anderen
Weg in die Tabellen von Soll gibt es nicht: Die Module des Servers lesen über eine Verbindung, die
SQLite nur lesend öffnet, und die einzige schreibende Verbindung hat die Funktion, die das Glied
anhängt. Ein Test prüft zusätzlich den Quellcode darauf, dass keine Datei an der Kette vorbei
schreibt. Schlägt eine Schreiboperation fehl, etwa weil ihr Kettenglied nicht
angehängt werden kann, bleibt von ihr nichts in der Datenbank, auch wenn der aufrufende Code den
Fehler abfängt und weiterschreibt.

## Wogegen die Kette schützt

Die Trennung in eine lesende und eine schreibende Verbindung und der Test über den Quellcode schützen
vor **Versehen im Code**: Kein Modul kann aus Versehen an der Kette vorbei schreiben. Gegen den, der
den Server betreibt, schützen sie nicht, und das sollen sie auch nicht: Wer den Server betreibt,
kann seine Datenbank und seinen Code ändern. Dagegen steht der **Prüfwert** in der Hand jeder Person
(siehe unten), den der Betreiber nicht mehr ändern kann.

## Was ein Kettenglied enthält

| Feld | Bedeutung |
| --- | --- |
| Nummer | fortlaufend je Betrieb, ab 1 |
| Zeitpunkt | wann geschrieben wurde (UTC) |
| Akteur | wer geschrieben hat |
| Tabelle und Zeile | was geschrieben wurde |
| Aktion | eingefügt, geändert oder gelöscht |
| Hash des Inhalts | SHA-256 des neuen Inhalts der Zeile |
| Hash des Vorgängers | Hash des vorigen Glieds |
| Hash | SHA-256 über alles Vorige |

Jeder Betrieb hat seine eigene Kette. Der Inhalt selbst liegt getrennt vom Glied. Nach Ablauf der
Aufbewahrungsfrist kann er entfernt werden, ohne dass die Kette bricht, denn das Glied enthält nur
seinen Hash (Art. 5 Abs. 1 lit. e und Art. 17 DSGVO, GoBD Rz. 107 ff.).

## Was die Prüfung findet

- ein geändertes, entferntes oder eingeschobenes Kettenglied,
- einen geänderten Inhalt (ein entfernter Inhalt ist erlaubt),
- ein abgeschnittenes Ende der Kette, auch wenn danach weiter geschrieben wurde: das nächste Glied
  baut auf dem gespeicherten Kopf der Kette auf, nicht auf dem letzten verbliebenen Glied,
- eine Zeile, die an der Kette vorbei geändert, eingefügt oder gelöscht wurde.

## Prüfwert

Der Prüfwert ist die Nummer und der Hash des letzten Glieds, etwa
`Nr. 1234 · 3f9a…` (64 Zeichen). Das Format stammt aus Haben. Zum Monatsabschluss bekommt jede
Person den Prüfwert auf ihren Stundenzettel. Wer den Server betreibt, kann die Datenbank ändern,
aber nicht den Prüfwert, den die Person schon hat: Fehlt das Glied mit dieser Nummer (auch wenn die
Kette samt Kopf dahinter abgeschnitten wurde), stimmt es nicht mehr mit dem Hash überein, oder ist
die Kette bis dahin nicht mehr in sich stimmig, zeigt die Prüfung eine Abweichung. Ein Prüfwert
stammt immer aus der Kette; eine Nummer, die sie nicht erreicht, heißt deshalb, dass Glieder fehlen.

## Datenbank

Soll speichert in SQLite im WAL-Modus, die Datei `soll.db` liegt im Datenverzeichnis
(`SOLL_DATA_DIR`, Standard `data`). Die Migrationen sind im Programm enthalten und laufen beim Start;
eine schon angewendete Migration, die sich geändert hat oder im Programm fehlt (etwa eine ältere
Version auf einer neueren Datenbank), verhindert den Start. Während der Migrationen sind die Fremdschlüssel
abgeschaltet, damit der Umbau einer Tabelle keine Zeilen mitlöscht, die auf sie verweisen; vor dem
Abschluss jeder Migration prüft Soll alle Verweise und nimmt die Migration bei einem Fehler zurück.
