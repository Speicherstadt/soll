---
title: Umzug aus anderen Tools
description: >-
  Wie Soll Zeiten, Abwesenheiten, Kunden und Aufträge aus einem anderen Tool übernimmt – mit
  Vorschau, Probelauf, aufbewahrter Originaldatei, ohne Dubletten und mit den im alten Tool
  abgeschlossenen Monaten.
---

# Umzug aus anderen Tools

Wer zu Soll wechselt, soll nichts abtippen. Der Inhaber findet den Umzug unter **Einstellungen ›
Aus anderem Tool übernehmen** (`/umzug`). Jeder Import läuft gleich ab, egal aus welchem Tool:

1. **Werkzeug**: das bisherige Tool wählen; Soll sagt, wie man dort die Daten exportiert.
2. **Datei**: die Exportdatei hochladen (höchstens 5 MB und 20.000 Datensätze, die Kopfzeile
   höchstens 200 Spalten). Soll liest sie und
   nennt jede Zeile, die es nicht lesen kann, mit dem Grund.
3. **Zuordnung**: welche Spalte welche Angabe enthält, welche Person der Datei welche Person in
   Soll ist, welche Abwesenheitsart welcher Art in Soll entspricht, ob Kunden und Aufträge neu
   angelegt, einem vorhandenen zugeordnet oder nicht übernommen werden, und bis zu welchem Monat das
   alte Tool die Monate abgeschlossen hatte. Soll schlägt Personen nach dem Namen und Arten nach dem
   Wort vor („Urlaub“, „Vacation“, „Krankheit“ …); entscheiden tut der Inhaber.
4. **Vorschau**: die Befunde der Prüfregeln auf den Zeiten der Datei, je Person mit Norm.
5. **Übernahme**: erst der **Probelauf**, der zeigt, was neu wäre, was schon da ist, was ausgelassen
   und was abgelehnt würde (mit Zeile und Grund), und nichts schreibt; dann **Übernehmen**.

Darunter stehen die bisherigen Importe mit Werkzeug, Datei, Zeit, wer und wie viel neu angelegt
wurde; die Originaldatei lässt sich dort wieder herunterladen.

## Was übernommen wird

| Aus der Datei | In Soll |
| --- | --- |
| Zeit (Tag, Beginn, Ende, Pause) | Stempelungen Kommen und Gehen, bei einer Pause dazu Pause-Beginn und Pause-Ende in der Mitte der Zeit; Quelle `import`. Ein Ende vor dem Beginn liegt am nächsten Tag, der Arbeitstag ist der Tag des Beginns. |
| Abwesenheit (Art, von, bis) | Abwesenheit mit der zugeordneten Art, **genehmigt** (sie wurde im alten Tool gewährt oder fand statt) |
| Kunde, Auftrag | Kunde und Auftrag des Moduls Projektzeit, mit Name und Nummer |

Personen legt der Import nicht an: Sie werden vorher eingeladen ([Einrichtung](einrichtung.md)) und
in der Zuordnung gewählt. Eine Person, die auf „nicht übernehmen“ steht, und eine Abwesenheitsart
ohne Gegenstück bleiben draußen und werden als „ausgelassen“ gezählt.

Zeiten und Abwesenheiten übernimmt Soll nur, solange das Modul Arbeitszeit an ist, Kunden und
Aufträge nur mit dem Modul Projektzeit; sonst lehnt der Probelauf sie mit „Modul ist
ausgeschaltet“ ab.

## Nachvollziehbar

- Die **Originaldatei** liegt unverändert im Datenverzeichnis unter `dateien/` in einem Ordner nach
  ihrem SHA-256 (inhaltsadressiert, aus `gobd-kern` übernommen). Eine veränderte Datei fällt beim
  Herunterladen auf. Gesichert wird sie mit dem Datenverzeichnis, nicht mit `soll backup` (das
  sichert die Datenbank, siehe [Installation](installation.md)).
- Jeder Import ist eine Zeile in der Tabelle `importe`: Werkzeug, SHA-256, Name und Größe der Datei,
  die Zuordnung, was dabei herauskam, wer und wann. Sie wird nur angefügt.
- Jede übernommene Stempelung, Abwesenheit, jeder Kunde und Auftrag trägt den Import, das Werkzeug
  und seine **Kennung im alten Tool** (`extern_quelle`, `extern_id`). Bei der Person steht in der
  Liste der Stempelungen „übernommen aus Soll-CSV“; die Auskunft nach Art. 15 DSGVO nennt Import,
  Werkzeug und Kennung jeder übernommenen Stempelung.
- Alles geht über die [Audit-Kette](audit-kette.md) wie jede andere Änderung.
- Im [Prüfexport](pruefexport.md) ist „erfasst“ bei übernommenen Stempelungen der Zeitpunkt der
  Übernahme; wann sie im alten Tool erfasst wurden, steht in der Originaldatei.

## Wiederholbar

Ein zweiter Import mit denselben Daten legt nichts doppelt an: Soll findet jeden Datensatz an seiner
Kennung im alten Tool wieder und zählt ihn als „schon da“. Das gilt auch, wenn eine übernommene
Stempelung inzwischen mit Grund geändert oder entfernt wurde: Sie kommt nicht wieder. Ein geänderter
Datensatz im alten Tool überschreibt nichts in Soll; Korrekturen laufen wie immer mit Grund.

Abgelehnt werden mit Zeile und Grund:

- eine Zeit, die sich mit einer vorhandenen Stempelung oder einer anderen Zeit der Datei
  überschneidet, die in der Zukunft liegt oder deren Uhrzeit es wegen der Zeitumstellung nicht gibt
  (die doppelte Stunde im Oktober gilt als die erste, wie bei jeder Eingabe);
- eine Abwesenheit, die sich mit einer vorhandenen überschneidet (Krankheit im Urlaub ist erlaubt,
  § 9 BUrlG);
- alles, was einen in Soll abgeschlossenen Monat ändern würde (siehe unten);
- ein Auftrag, dessen Kunde nicht übernommen wird.
- ein Datensatz, den ein früherer Import schon für eine andere Person übernommen hat, als die
  Zuordnung jetzt nennt („schon für eine andere Person übernommen“); er schließt auch keinen
  Monat.

## Ehrlich geprüft

Übernommene Zeiten werden geprüft wie eigene. Die Vorschau zeigt die Befunde der Vergangenheit je
Person (Pausen, Höchstarbeitszeit, Ruhezeit, mit Norm), ändert aber nichts an den Zeiten. Folgen
zwei Zeiten mit weniger als neun Stunden Abstand, sind sie wie beim Stempeln eine Schicht
([Arbeitstag](arbeitstag.md)).

## Abgeschlossen bleibt abgeschlossen

- Ein Monat, den der Betrieb **in Soll** schon abgeschlossen hat, nimmt nichts an: Was ihn ändern
  würde, lehnt der Probelauf mit „Monat ist in Soll abgeschlossen“ ab. Die Korrektur bleibt der
  Gegeneintrag ([Monatsabschluss](monatsabschluss.md)).
- Waren Monate **im alten Tool** schon abgeschlossen, trägt der Inhaber in der Zuordnung den letzten
  davon ein (höchstens den Vormonat). Nach der Übernahme schließt Soll für jede Person jeden dieser
  Monate ab, in den Zeiten oder Abwesenheiten fallen, die jetzt übernommen werden oder schon übernommen waren (ein abgelehnter Datensatz schließt keinen Monat): eine Zeile in
  `monatsabschluesse` mit dem Grund „übernommen aus Soll-CSV (Import …)“ und dem Import, ohne
  Bestätigung der Person, mit Prüfwert wie jeder Abschluss. Der Grund steht auf dem Stundenzettel.
  Danach ist der Monat gesperrt wie jeder andere.
- Ließ sich ein Monat nicht abschließen (etwa weil er noch eine offene Schicht hat), sagt das die
  Übernahme; ein zweiter Lauf mit derselben Datei versucht es wieder und legt sonst nichts an.

## Wer darf was

Den Umzug sieht und nutzt nur der **Inhaber**; der Server lehnt jede andere Rolle ab (`403`). Eine
Zuordnung zu einer Person, einem Kunden oder einem Auftrag eines anderen Betriebs lehnt er ab
(`422`); ein Betrieb sieht weder die Importe noch die Dateien eines anderen.

Ein **API-Zugang** zu einem anderen Tool (für die Werkzeuge, die ihn brauchen) wird nicht
gespeichert: Er gilt nur für den einen Lauf. Diesen Weg bringen die einzelnen Werkzeuge mit.

## Werkzeuge

| Werkzeug | Weg | Stand |
| --- | --- | --- |
| Soll-CSV | Datei | verfügbar |
| Excel und CSV mit freien Spalten | Datei | folgt |
| Clockodo, Personio, Kimai | Datei und API | folgt |
| Papershift, Planday, Crewmeister | Datei | folgt |
| Toggl, Clockify | Datei und API | folgt |

### Soll-CSV

Eine Tabelle mit einer Kopfzeile; die Spalte **Typ** sagt, was eine Zeile ist. Trennzeichen
(Strichpunkt, Komma oder Tabulator) erkennt Soll, ebenso Kopfzeilen auf Deutsch und Englisch. Die
Vorlage lässt sich im ersten Schritt herunterladen.

| Spalte | Bedeutung |
| --- | --- |
| Typ | `zeit`, `abwesenheit`, `kunde` oder `projekt` (auch `time`, `absence`, `customer`, `project`) |
| Kennung | die Kennung im alten Tool, je Typ eindeutig |
| Person | Name oder Kennung der Person (Zeit, Abwesenheit) |
| Datum | Tag der Zeit oder erster Tag der Abwesenheit, `2026-09-01` oder `01.09.2026` |
| Beginn, Ende | Uhrzeit `7:00` (Zeit) |
| Pause | Minuten (`30`) oder Stunden und Minuten (`0:30`), leer für keine |
| Bis | letzter Tag der Abwesenheit, leer für einen Tag |
| Art | Art der Abwesenheit, wie das alte Tool sie nennt |
| Kunde | Kennung des Kunden eines Auftrags in derselben Datei |
| Name, Nummer | Name und Nummer eines Kunden oder Auftrags |

```text
Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer
zeit;z-1;Sandra Kühn;01.09.2026;7:00;15:30;30;;;;;
abwesenheit;a-1;Sandra Kühn;07.09.2026;;;;11.09.2026;Urlaub;;;
kunde;k-1;;;;;;;;;Elbhof Immobilien;K-1001
projekt;p-1;;;;;;;;k-1;Bad Elbhof;A-17
```

Eine Datei in UTF-8 (auch mit Byte-Order-Mark, wie Excel sie schreibt) oder in Windows-1252 liest
Soll gleichermaßen.
