---
title: Umzug aus anderen Tools
description: >-
  Wie Soll Zeiten, Abwesenheiten, Schichten, Salden zum Stichtag, Kunden, Aufträge und Tätigkeiten
  aus einem anderen Tool oder einer Excel-Tabelle übernimmt – als Datei oder über die API (Clockodo,
  Kimai, Personio, Papershift, Planday, Crewmeister), mit Vorschau, Probelauf, aufbewahrter
  Originaldatei, ohne Dubletten und mit den im alten Tool abgeschlossenen Monaten.
---

# Umzug aus anderen Tools

Wer zu Soll wechselt, soll nichts abtippen. Der Inhaber findet den Umzug unter **Einstellungen ›
Aus anderem Tool übernehmen** (`/umzug`). Jeder Import läuft gleich ab, egal aus welchem Tool:

1. **Werkzeug**: das bisherige Tool wählen; Soll sagt, wie man dort die Daten exportiert.
2. **Datei**: die Exportdatei hochladen (höchstens 5 MB und 20.000 Datensätze, die Kopfzeile
   höchstens 200 Spalten), oder bei einem Werkzeug mit API die Daten eines Zeitraums **über die API
   abrufen** (siehe [Clockodo](#clockodo), [Kimai](#kimai), [Personio](#personio)). Soll liest sie und
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
| Saldo (Stichtag, Überstunden, Resturlaub) | Startsaldo des Überstundenkontos und Resturlaub zum Stichtag (siehe [Salden zum Stichtag](#salden-zum-stichtag)) |
| Kunde, Auftrag | Kunde und Auftrag des Moduls Projektzeit, mit Name und Nummer |
| Projekt und Tätigkeit einer Zeit (Excel und CSV) | Buchungen der Projektzeit auf einem vorhandenen Auftrag und einer Tätigkeit, je Arbeitsstück vor und nach der Pause |
| Tätigkeit (bei Clockodo: Leistung) | Tätigkeit des Moduls Projektzeit, nicht abrechenbar, bis der Inhaber es ändert |
| Anwesenheit (Personio) | Stempelungen wie eine Zeit, die Pausen dazwischen wie gebucht (siehe [Personio](#personio)) |
| Zeitbuchung (Kimai) | Stempelungen wie eine Zeit und eine Buchung der Projektzeit je Arbeitsstück auf das übernommene Projekt und die Tätigkeit (siehe [Kimai](#kimai)) |
| Geplante Schicht (Planday, Crewmeister) | Schicht im Dienstplan als Entwurf, an dem Standort, den du wählst (siehe [Papershift, Planday und Crewmeister](#papershift-planday-und-crewmeister)) |

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
Datensatz im alten Tool überschreibt nichts in Soll: Der Import meldet ihn mit Zeile als „im alten
Tool geändert, seit Soll es übernommen hat“ und schließt für ihn keinen Monat; die Korrektur in
Soll läuft wie immer mit Grund. Die Monate eines Datensatzes, der schon da ist, sind die seiner
Zeile in Soll.

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
  Gegeneintrag ([Monatsabschluss](monatsabschluss.md)). Zeiten einer Person schneidet der Import
  in Schichten wie Soll selbst (eine neue Schicht nach 9 Stunden Pause oder 24 Stunden nach dem
  Beginn), mit den Stempelungen, die schon in Soll sind; eine Schicht gehört zum Monat ihres
  Beginns: Eine Nachtschicht vom 30.9. auf den 1.10. mit einer Pause nach Mitternacht
  übernimmt Soll ganz oder gar nicht, nie zur Hälfte. Ob ein Monat sich ändert, prüft der Import
  wie eine Stempelung von Hand, mit allem, was derselbe Lauf schon übernimmt: Was Soll von Hand
  annähme, nimmt der Import an, und was einen abgeschlossenen Monat ändern würde, nie.
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

Ein **API-Zugang** zu einem anderen Tool wird nicht gespeichert: Er geht mit dem einen Abruf zum
Server, der damit die Daten holt, und steht danach nirgends, weder in der Datenbank noch im Log,
in einer Antwort oder in der Datei.

## Werkzeuge

| Werkzeug | Weg | Stand |
| --- | --- | --- |
| Soll-CSV | Datei | verfügbar |
| Excel/CSV mit freien Spalten | Datei | verfügbar |
| Clockodo | Datei und API | verfügbar |
| Kimai | API | verfügbar |
| Personio | API (Berichte über Excel/CSV) | verfügbar |
| Papershift, Planday, Crewmeister | Datei | folgt |
| Toggl, Clockify | Datei und API | folgt |

### Soll-CSV

Eine Tabelle mit einer Kopfzeile; die Spalte **Typ** sagt, was eine Zeile ist. Trennzeichen
(Strichpunkt, Komma oder Tabulator) erkennt Soll, ebenso Kopfzeilen auf Deutsch und Englisch. Die
Vorlage lässt sich im ersten Schritt herunterladen.

| Spalte | Bedeutung |
| --- | --- |
| Typ | `zeit`, `abwesenheit`, `kunde`, `projekt` oder `saldo` (auch `time`, `absence`, `customer`, `project`, `balance`) |
| Kennung | die Kennung im alten Tool, je Typ eindeutig |
| Person | Name oder Kennung der Person (Zeit, Abwesenheit, Saldo) |
| Datum | Tag der Zeit, erster Tag der Abwesenheit oder Stichtag des Saldos, `2026-09-01` oder `01.09.2026` |
| Beginn, Ende | Uhrzeit `7:00` (Zeit) |
| Pause | Minuten (`30`) oder Stunden und Minuten (`0:30`), leer für keine |
| Bis | letzter Tag der Abwesenheit, leer für einen Tag |
| Art | Art der Abwesenheit, wie das alte Tool sie nennt |
| Kunde | Kennung des Kunden eines Auftrags in derselben Datei |
| Name, Nummer | Name und Nummer eines Kunden oder Auftrags |
| Überstunden | Überstunden zum Stichtag mit Vorzeichen, `-12:30` oder `7,5` Stunden (Saldo) |
| Resturlaub | offener Urlaub zum Stichtag in Tagen, `8` oder `8,5` (Saldo) |

```text
Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer
zeit;z-1;Sandra Kühn;01.09.2026;7:00;15:30;30;;;;;
abwesenheit;a-1;Sandra Kühn;07.09.2026;;;;11.09.2026;Urlaub;;;
kunde;k-1;;;;;;;;;Elbhof Immobilien;K-1001
projekt;p-1;;;;;;;;k-1;Bad Elbhof;A-17
```

Eine Datei in UTF-8 (auch mit Byte-Order-Mark, wie Excel sie schreibt) oder in Windows-1252 liest
Soll gleichermaßen.

### Salden zum Stichtag

Wer mitten im Jahr wechselt, bringt Überstunden und Resturlaub mit. Dafür gibt es im ersten Schritt
eine zweite Vorlage, `soll-salden.csv`: je Person eine Zeile vom Typ `saldo` mit dem **Stichtag**
(dem Ersten eines Monats), den **Überstunden** und dem **Resturlaub** an diesem Tag, wie das alte
Tool sie zeigt. Eine der beiden Zahlen darf fehlen.

```text
Typ;Kennung;Person;Datum;Überstunden;Resturlaub
saldo;s-1;Sandra Kühn;01.10.2026;-3:15;8,5
```

- Ab dem Stichtag rechnet Soll die Konten selbst. Die Überstunden werden der Startsaldo des
  Überstundenkontos, der Resturlaub ist **aller** Urlaub, der am Stichtag offen ist, auch der des
  laufenden Jahres (in Clockodo: Anspruch und Übertrag des Jahres abzüglich der genommenen Tage). Wie das
  rechnet, steht unter [Konten](konten.md#salden-zum-stichtag).
- Die Vorschau zeigt die Salden je Person, zum Vergleich mit dem alten Tool. Der Probelauf prüft sie
  nach denselben Regeln wie einen Startsaldo von Hand: abgelehnt mit Zeile wird ein Saldo, wenn die
  Person schon einen Startsaldo hat (auch zwei Zeilen für dieselbe Person), der Stichtag in der
  Zukunft oder vor dem Eintritt liegt, in einem in Soll abgeschlossenen Monat oder danach, oder
  nach einem Hinweis auf Verfall. Als Eintritt zählen auch die Zeiten, die dieselbe Datei
  mitbringt.
- Übernommen wird jeder Saldo als Anpassung der Konten mit dem Grund „übernommen aus Soll-CSV
  (Import …)“, dem Import und der Kennung (`<Kennung>/ueberstunden`, `<Kennung>/urlaub`), vor den
  Monaten, die das alte Tool abgeschlossen hatte: Der Abschluss des Stichtagsmonats trägt den
  Saldo, der Prüfwert der Person deckt ihn.
- Ein zweiter Lauf findet den Saldo wieder („schon da“). Steht in der Datei inzwischen ein anderer
  Wert, meldet der Probelauf „im alten Tool geändert“; überschrieben wird nichts. Korrigiert wird
  unter Konten mit einer Korrektur und Grund.
- Clockodo und Kimai liefern keine Salden über den Import: Kimai führt in seiner API kein Konto,
  und wie Clockodo seine Jahresberichte rechnet (`userreports`), legt seine Beschreibung nicht so
  fest, dass Soll die Zahl ohne Raten übernehmen könnte. Die Zahl aus dem alten Tool kommt über die
  Vorlage. Personios API v2 hat für Salden keinen Endpunkt (siehe [Personio](#personio)); auch
  von dort kommt die Zahl über die Vorlage.

### Excel/CSV mit freien Spalten

Für alles, was als Tabelle vorliegt: eine Excel-Mappe (`.xlsx`, gelesen wird das erste Blatt) oder
eine CSV, die erste Zeile ist die Kopfzeile, jede weitere Zeile eine Arbeitszeit einer Person. Die
Spalten dürfen heißen, wie sie wollen: Soll schlägt sie nach dem Kopf vor (Deutsch und Englisch, etwa
„Mitarbeiter“, „Kommen“, „Gehen“, „Baustelle“), im Schritt **Zuordnung** wählst du für jede Angabe
die Spalte selbst oder „keine“. Dieselbe Spalte darf Datum und Beginn sein, wenn sie beides enthält
(`01.09.2026 07:00`). Fehlt eine nötige Spalte, nennt Soll sie („Zeile 1: Spalte fehlt: Person“).
Im ersten Schritt liegen eine Vorlage als `soll-zeiten.xlsx` und als `soll-zeiten.csv` zum
Herunterladen bereit.

| Angabe | Nötig | So darf sie aussehen |
| --- | --- | --- |
| Person | ja | Name oder Kennung, wie das alte Tool sie schreibt |
| Datum | ja | `01.09.2026`, `1.9.2026`, `1.9.26` (20xx), `2026-09-01`, auch mit Uhrzeit dahinter; in Excel ein Datum oder eine Seriennummer mit fünf Ziffern |
| Beginn | ja | `7:00`, `07:00`, `7:00:00`, `700`, `0700`, `7`; in Excel eine Uhrzeit (Bruchteil eines Tages) |
| Ende | ja, oder Dauer | wie Beginn; ein Ende vor dem Beginn liegt am nächsten Tag |
| Dauer | statt Ende | Stunden: `8`, `7,5`, `7.5` oder `7:30`; ohne Ende ist Ende = Beginn + Dauer + Pause, mit Ende muss sie auf die halbe letzte Stelle genau dazu passen (`8:01` auf 30 Sekunden, `7,5` auf 3 Minuten) |
| Pause | nein | Minuten (`30`), `0:30` oder Dezimalstunden (`0,5`); leer für keine |
| Projekt | nein | Name oder Nummer des Auftrags im alten Tool |
| Tätigkeit | nein | Name der Tätigkeit im alten Tool |
| Kennung | nein | eine eindeutige Nummer je Zeile, wenn das alte Tool eine hat |

Gerechnet wird in ganzen Minuten, nie mit Kommazahlen, und immer zugunsten der Person: Sekunden am
Beginn fallen weg, am Ende zählen sie als volle Minute (ein Ende wenige Sekunden vor dem Beginn in
derselben Minute lehnt Soll ab, statt daraus eine Minute zu machen); eine Dauer wie `7,33` Stunden (439,8
Minuten) ergibt ohne Ende 440 Minuten; eine Pause wie `0,33` Stunden zählt 19 Minuten.

**Projekt und Tätigkeit**: Jeder Wert der Spalten Projekt und Tätigkeit wird in der Zuordnung einem
vorhandenen, nicht archivierten Auftrag (mit seinem Kunden) beziehungsweise einer Tätigkeit
zugeordnet oder nicht übernommen; Soll schlägt den Auftrag oder die Tätigkeit gleichen Namens oder
gleicher Nummer vor. Für Zeiten mit Projekt, aber ohne Tätigkeit, wählst du die Tätigkeit unter
„ohne Tätigkeit“. Aus einer solchen Zeit werden neben den Stempelungen Buchungen der
[Projektzeit](projektzeit.md): eine für jedes Arbeitsstück vor und nach der Pause in der Mitte, am
Arbeitstag der Zeit, mit Import, Werkzeug und Kennung. Ist das Modul Projektzeit aus oder liegt
schon eine Buchung der Person in der Spanne, lehnt der Probelauf die Buchung mit Zeile und Grund ab;
die Zeit selbst wird trotzdem übernommen. Wird eine Zeit, die schon da ist, ein zweites Mal
eingelesen, legt Soll ihre Buchungen nicht nachträglich an.

**Wiederholbar ohne Kennung**: Hat die Tabelle keine Kennungsspalte, ist die Kennung einer Zeile
der SHA-256 über Person, Tag, Beginn, Ende und Pause, wie Soll sie gelesen hat – nicht über die Datei
und nicht über die Zeilennummer. Dieselbe Zeit in einer längeren, umsortierten oder anders
geschriebenen Tabelle (`1.9.26` statt `01.09.2026`) ist darum wieder „schon da“. Steht dieselbe Zeit
zweimal in der Datei, nennt Soll die zweite Zeile („dieselbe Zeit steht schon weiter oben“). Wurde
eine Zeit im alten Tool geändert, ist sie eine neue Zeit und überschneidet sich mit der übernommenen;
der Probelauf lehnt sie ab.

**Sicher gelesen**: Soll liest die Excel-Datei selbst, ohne Makros und ohne Formeln auszuführen (eine
Formel zählt mit ihrem gespeicherten Wert). Eine Mappe, die beim Entpacken größer als 50 MB würde,
eine mit Verweisen auf andere Dateien oder Entitäten (DTD) und eine verschlüsselte lehnt Soll als
„nicht lesbar“ ab; es gelten dieselben Grenzen wie oben (5 MB, 20.000 Zeilen, 200 Spalten).
### Clockodo

Zwei Wege, ein Werkzeug: Was über den einen übernommen wurde, findet der andere wieder, denn beide
tragen die Kennungen von Clockodo.

**Über die API** gibt der Inhaber die E-Mail und den API-Schlüssel aus Clockodo ein (in Clockodo
unter *Mein Bereich*, laut dem SDK `my.clockodo.com/en/users/editself`) und einen Zeitraum von höchstens einem Jahr, der nicht in
der Zukunft liegt. Soll holt nacheinander Mitarbeiter, Kunden, Projekte, Leistungen, die Einträge des
Zeitraums (Seite für Seite) und die Abwesenheiten seiner Jahre. Daraus wird eine Datei
(`clockodo-<von>-<bis>.jsonl`), die durch Vorschau, Probelauf und Übernahme geht wie eine
hochgeladene und bei der Übernahme unter ihrem SHA-256 aufbewahrt wird. Sie enthält nur, was Soll
liest: keine Notizen (sie können eine Diagnose enthalten), keine Angabe zur Krankmeldung, keine
E-Mail, keinen Stundensatz und keinen Umsatz. Ein zweiter Abruf desselben Stands ergibt dieselbe
Datei. Lehnt Clockodo ab, sagt Soll warum: Zugang abgelehnt, zu viele Anfragen (dann in ein paar
Minuten noch einmal), nicht erreichbar, unlesbare Antwort oder mehr als 20.000 Datensätze (dann
einen kürzeren Zeitraum wählen). Soll versucht es nicht von selbst noch einmal.

**Als Datei** liest Soll die CSV-Datensicherung der Einträge aus Clockodo (eine Zeile je Eintrag,
Kopfzeile auf Englisch wie `Id`, `Co-worker Id`, `Begin (UTC)`, `End (UTC)`). Kunden, Projekte und
Leistungen nimmt Soll aus den Spalten der Einträge; Abwesenheiten stehen nicht in dieser Datei.

| Aus Clockodo | In Soll |
| --- | --- |
| Mitarbeiter | Personen der Zuordnung, mit ihrem Namen; zwei gleiche Namen mit der Kennung in Klammern |
| Zeiteinträge | Einträge einer Person, die sich berühren oder überschneiden, werden ein Block mit Kommen und Gehen; die Lücke zwischen zwei Blöcken bleibt die Pause, wie gestempelt. Der Beginn wird auf die Minute ab-, das Ende aufgerundet, die Zeit also nie kürzer. |
| Pauschalen | keine Arbeitszeit, werden nicht gelesen |
| Abwesenheiten | nur genehmigte, als ganze Tage; die Art heißt wie in Clockodos API („Regular holiday“, „Sick day“ …), Soll schlägt Urlaub, Sonderurlaub, Überstundenabbau, Krankheit und Krankheit Kind vor |
| Kunden, Projekte | Kunden und Aufträge mit Name und Nummer |
| Leistungen | Tätigkeiten |

Abgelehnt werden mit Zeile: ein Eintrag, der noch läuft; ein Eintrag, dessen Dauer in Clockodo von
Hand korrigiert wurde (er hat keine Zeitpunkte, die Soll stempeln könnte: bitte mit Beginn und Ende
nachtragen); ein Block von 24 Stunden oder mehr; eine Uhrzeit in der zweiten Stunde von 2 bis 3 Uhr
in der Nacht der Zeitumstellung im Oktober; eine beantragte, nicht genehmigte Abwesenheit; ein
halber Tag und Überstundenabbau nach Stunden (als ganzer Tag kostete er die Person mehr, als Clockodo
gebucht hatte: bitte in Soll eintragen).

Welcher Eintrag zu welchem Kunden, Projekt und welcher Leistung gehörte, bucht Soll nicht als
Projektzeit; übernommen wird die Arbeitszeit.

### Kimai

Soll holt die Daten selbst über die REST-API von [Kimai](https://www.kimai.org/) (gebaut nach dem
Quelltext von Kimai 2.73, `src/API/`): Personen, Kunden, Projekte und Tätigkeiten (auch verborgene)
und die Zeitbuchungen des gewählten Zeitraums (höchstens ein Jahr, nicht in der Zukunft).

**Zugang**: In Kimai unter dem eigenen Profil → *API-Zugang* ein API-Token anlegen. Das Token muss
alle Personen und ihre Zeiten sehen dürfen (etwa das eines Administrators); fehlt dieses Recht, sagt
Soll das, statt nur die eigenen Zeiten zu holen. Für eine ältere Kimai ohne API-Token gibt es das
Feld *Benutzername*: dann geht das API-Passwort als `X-AUTH-TOKEN` mit dem Benutzernamen als
`X-AUTH-USER` mit (Kimai 2.73 lehnt das ab). Im Schritt **Datei** gibst du Adresse, Token und
Zeitraum ein und rufst ab.

**Nur sichere Adressen**: Soll ruft nur `https`-Adressen ohne Benutzer und Passwort ab, und nur, wenn
jede Adresse, die der Name im DNS ergibt, öffentlich ist (keine Adresse im eigenen Netz, kein
Loopback, kein Link-local wie `169.254.169.254`). Geprüft wird beim Verbinden selbst, eine
Weiterleitung folgt Soll nie; jede Antwort darf höchstens 10 MB groß sein und 30 Sekunden dauern.
Läuft Kimai im eigenen Netz, kann der Betreiber der Soll-Instanz die Adresse freigeben:
`SOLL_IMPORT_ALLOWED_ORIGINS=https://kimai.intern` (mehrere mit Komma; siehe
[Installation](installation.md)).

**Was daraus wird**:

| In Kimai | In Soll |
| --- | --- |
| Benutzer | Person der Zuordnung, mit Alias oder Benutzername; zwei gleiche Namen mit der Kennung in Klammern |
| Kunde, Projekt | Kunde und Auftrag mit Name und Nummer (`number`) |
| Tätigkeit | Tätigkeit, neu (nicht abrechenbar, das legst du fest), einer vorhandenen zugeordnet oder nicht übernommen |
| Zeitbuchung | Arbeitsstücke: die Pause (`break`) liegt in der Mitte der Buchung; Stücke einer Person, die sich berühren oder überschneiden, werden eine Zeit mit Kommen und Gehen, die Lücke dazwischen ist die Pause, wie gebucht; dazu je Stück eine Buchung der Projektzeit |

Gerechnet wird mit den gebuchten Zeitpunkten, nicht mit Kimais gerundeter Dauer: Beginn auf die
Minute abgerundet, Ende aufgerundet, die Pause abgerundet, nie zum Nachteil der Person. Abgelehnt
mit Zeile werden eine laufende Zeitbuchung, eine Zeit ab 24 Stunden und eine in der doppelten Stunde
der Zeitumstellung im Oktober. Eine Zeit, die nicht übernommen wird (abgelehnt beim Einlesen oder
im Probelauf, etwa in einem abgeschlossenen Monat), bringt auch keine Buchungen der Projektzeit
mit. Sätze und Beträge aus Kimai übernimmt Soll nicht; Stundensätze legst
du in der [Projektzeit](projektzeit.md) an. Die Beschreibung einer Zeitbuchung kommt nicht mit.

**Wiederholbar**: Kennungen sind Kimais ids (eine Zeit trägt die ihrer ersten Zeitbuchung, eine
Buchung die ihrer Zeitbuchung und ihres Stücks). Ein zweiter Abruf desselben Zeitraums legt nichts
an.

**Fehler** sagt Soll mit Grund: Adresse nicht erlaubt, Token oder Benutzername nicht sendbar
(nur Buchstaben ohne Akzente, Ziffern und Zeichen der Tastatur; ein mitkopierter Zeilenumbruch am
Ende wird entfernt), Token abgelehnt, Rechte fehlen, zu viele
Anfragen, nicht erreichbar, Weiterleitung, keine Antwort einer Kimai-API, mehr als 20.000
Datensätze (dann einen kürzeren Zeitraum wählen). Einen Abruf wiederholt Soll nicht von selbst.

### Personio

Soll holt die Daten selbst über die API v2 von [Personio](https://www.personio.de/) (gebaut nach
Personios Beschreibungen; developer.personio.de war beim Bau nicht erreichbar, die Quellen nennt der
Code): Mitarbeiter, Abwesenheitsarten, Anwesenheiten und Abwesenheiten des gewählten Zeitraums
(höchstens ein Jahr, nicht in der Zukunft). Die alte API v1 für Anwesenheiten schaltet Personio am
31.01.2027 ab, darum nutzt Soll die v2.

**Zugang**: In Personio unter *Marketplace → Verbundene Integrationen* eine eigene Integration
anlegen, die Personen, Anwesenheiten und Abwesenheiten lesen darf. Im Schritt **Datei** gibst du
Client-ID, Client-Secret und Zeitraum ein und rufst ab. Soll holt damit ein Token bei
`api.personio.de`, liest die Listen Seite für Seite und widerruft das Token am Ende. Die Adresse ist
fest, du gibst keine ein; ein Link auf eine weitere Seite, der woandershin zeigt oder auf eine schon
gelesene Seite, beendet den Abruf. Client-ID, Secret und Token speichert Soll nicht, sie stehen in
keinem Protokoll, keiner Antwort und nicht in der Datei.

**Was daraus wird**:

| In Personio | In Soll |
| --- | --- |
| Person | Person der Zuordnung mit Vor- und Nachnamen; zwei gleiche Namen mit der Kennung in Klammern. E-Mail, Geschlecht, Bild und eigene Attribute kommen nicht mit |
| Anwesenheit (`WORK`, `BREAK`) | Arbeit wird auf die Minute nach außen, Pause nach innen gerundet; die Pausen werden aus der Arbeit herausgenommen, Stücke einer Person, die sich berühren oder überschneiden, werden eine Zeit mit Kommen und Gehen, die Lücke dazwischen ist die Pause |
| Abwesenheit | Abwesenheit mit der zugeordneten Art, genehmigt; beginnt sie mit der zweiten Hälfte des Tages, ist der erste Tag halb, endet sie mit der ersten, der letzte |
| Abwesenheitsart | Art der Zuordnung, mit ihrem Namen in Personio („Urlaub“, „Krankheit“ …) |

Personio schreibt Uhrzeiten ohne Zeitzone; Soll liest sie in Europe/Berlin. Übernommen wird Arbeit, die im Zeitraum beginnt; die Pause einer Nachtschicht am letzten Tag nach Mitternacht holt Soll mit und nimmt sie heraus. Übernommen werden nur
bestätigte Anwesenheiten und genehmigte Abwesenheiten (oder solche, für die Personio keine Freigabe
führt). Mit Zeile genannt und nicht übernommen werden: eine Anwesenheit oder Abwesenheit, die noch
auf eine Entscheidung wartet, eine offene Anwesenheit ohne Ende, eine Abwesenheit ohne Ende, eine
Abwesenheit nach Stunden (etwa Freizeitausgleich nach Stunden; bitte in Soll eintragen), eine
Uhrzeit, die es wegen der Zeitumstellung nicht oder zweimal gibt, und eine Zeit ab 24 Stunden.
Abgelehnte kommen gar nicht. Von einer Krankheit übernimmt Soll nur die Art, keinen Kommentar und
keinen Grund (Art. 9 DSGVO).

**Salden** (Resturlaub, Überstunden) übernimmt Soll aus Personio noch nicht: die API v2 hat dafür
keinen Endpunkt; sie kommen mit den Salden zum Stichtag. **Berichte**, die du in Personio als CSV
oder Excel exportierst, liest das Werkzeug [Excel/CSV mit freien Spalten](#excelcsv-mit-freien-spalten).

**Wiederholbar**: Kennungen sind Personios ids (eine Zeit trägt die ihrer ersten Anwesenheit). Ein
zweiter Abruf desselben Zeitraums legt nichts an; ein Monat, der in Soll abgeschlossen ist, nimmt
nichts an.

**Fehler** sagt Soll mit Grund: Zugang abgelehnt, Rechte der Integration fehlen, zu viele Anfragen,
nicht erreichbar, Weiterleitung, keine Antwort der Personio-API, mehr als 20.000 Datensätze (dann
einen kürzeren Zeitraum wählen). Einen Abruf wiederholt Soll nicht von selbst.

### Papershift, Planday und Crewmeister

Die drei Schichtplaner holt Soll über ihre API, wie bei Kimai mit einem Zugang, der nur für diesen
einen Abruf gilt und nirgends gespeichert wird. Ihre Exporte als CSV oder Excel beschreibt keine
Quelle, die Soll erreichen konnte; wer eine solche Datei hat, nimmt
[Excel/CSV mit freien Spalten](#excelcsv-mit-freien-spalten). Die Adressen sind fest
(`app.papershift.com`, `openapi.planday.com` und `id.planday.com`, `api.crewmeister.com`), du gibst
keine ein.

**Zugang**:

| Werkzeug | Was du eingibst | Woher |
| --- | --- | --- |
| Papershift | API-Schlüssel | Einstellungen → API (die API ist bei Papershift ein Zusatz); Papershift verlangt ihn als `api_token` in der Adresse |
| Planday | App-ID und Token | Einstellungen → Integrationen → API-Zugang: eine App, die Mitarbeiter, Schichten, Stempeluhr und Abwesenheiten lesen darf; Soll tauscht das Token bei `id.planday.com` gegen ein Zugriffstoken |
| Crewmeister | E-Mail und Passwort | ein Konto mit Leserechten auf die ganze Crew, am besten ein eigenes; Crewmeisters API kennt nur diese Anmeldung |

Der **Zeitraum** ist höchstens ein Jahr lang und darf bis zu 92 Tage in die Zukunft reichen: für den
kommenden Dienstplan und genehmigten Urlaub. Gestempelte Zeiten holt Soll nur bis heute.

**Was daraus wird**:

| Beim Anbieter | In Soll |
| --- | --- |
| Mitarbeiter (Papershift `users`, Planday `employees` auch ehemalige, Crewmeister `members`) | Person der Zuordnung mit ihrem Namen; zwei gleiche Namen mit der Kennung in Klammern |
| Gestempelte Zeit (Papershift `working_sessions`, Planday Stempeluhr, Crewmeister Stempel) | Arbeitsstücke um die gestempelten Pausen; die Stücke einer Person, die sich berühren, werden eine Zeit mit Kommen und Gehen, die Lücke ist die Pause, wie gestempelt |
| Geplante Schicht (Planday, Crewmeister) | Schicht im Dienstplan an dem Standort, den du in der Zuordnung wählst, mit Position (Planday) oder Arbeitsort (Crewmeister) als Rolle; eine Schicht ohne Person bleibt offen |
| Abwesenheit | Abwesenheit mit der zugeordneten Art, genehmigt; halbe Tage als halbe Tage |

**Zeiten**: Beginn auf die Minute abgerundet, Ende aufgerundet, Pausen nach innen gerundet, nie zum
Nachteil der Person. Papershift: die Pausen einer Arbeitszeit mit ihren Zeitpunkten (`breaks`);
kennt Papershift nur ihre Länge (`break_duration`, Sekunden), liegt sie in der Mitte. Planday: die
Stempeluhr mit ihren Pausen, in Ortszeit ohne Versatz geschrieben und in Europe/Berlin gelesen.
Crewmeister: eine Kette von Stempeln (`chainStartStampId`), Arbeit von `START_WORK` bis zum
nächsten Stempel; ungültige Stempel zählen nicht. Abgelehnt mit Zeile: eine Zeit, die noch läuft,
eine ab 24 Stunden und eine Uhrzeit, die es wegen der Zeitumstellung nicht oder zweimal gibt. Die
Zeiten einer Nachtschicht, die eine Pause nach Mitternacht teilt, übernimmt Soll zusammen oder gar
nicht.

**Schichten** kommen nur mit dem Modul Dienstplan und nur an einen Standort des Betriebs; ohne
Standort bleiben sie draußen. Sie kommen als **Entwurf**: du veröffentlichst die Woche, wenn sie
stimmt, erst dann erfahren es die Mitarbeiter. Eine Schicht, die sich mit einer anderen derselben
Person überschneidet, lehnt Soll mit Zeile ab. Eine Schicht ist Plan, keine Aufzeichnung: ein
abgeschlossener Monat sperrt sie nicht. Aus Papershift kommen keine Schichten: dort ist eine Schicht
ein Platz eines Arbeitsbereichs mit einer Zahl von Personen, und wer darauf eingeplant ist, nennt
keine Quelle, die Soll erreichen konnte. Entwürfe in Planday (noch nicht veröffentlicht) und in
Crewmeister (ein Entwurf einer veröffentlichten Schicht) kommen nicht mit.

**Abwesenheiten**: nur genehmigte (Papershift bestätigt, Planday `Approved`, Crewmeister
`APPROVED`); beantragte nennt der Probelauf mit Zeile als „nicht genehmigt“, abgelehnte und
zurückgezogene kommen gar nicht. Crewmeister kennt halbe Tage (ab Nachmittag, bis Vormittag), die
als halbe Tage kommen; eine Abwesenheit nach Stunden nennt Soll mit Zeile als „nur ein Teil des
Tages“. Die Art heißt wie beim Anbieter: bei Papershift und Crewmeister die eigenen Arten, bei
Planday `Vacation`, `Absence`, `Flextime` oder `Accrued`. Eine Krankheit wird nur „krank“: Notizen,
Gründe und Bescheinigungen liest Soll nicht.

**Wiederholbar**: Kennungen sind die ids der Anbieter (eine Zeit trägt die ihres ersten Stücks). Ein
zweiter Abruf desselben Zeitraums legt nichts an; eine Schicht, die sich beim Anbieter seither
geändert hat, nennt der Probelauf mit Zeile, statt sie zu überschreiben.

**Fehler** sagt Soll mit Grund wie bei Kimai: Zugang abgelehnt, Rechte fehlen, zu viele Anfragen,
nicht erreichbar, keine lesbare Antwort, mehr als 20.000 Datensätze. Einen Abruf wiederholt Soll nicht
von selbst.

**Quellen und Annahmen**: Die Seiten der Anbieter waren nicht erreichbar. Gebaut ist nach
öffentlichen Projekten, die die APIs benutzen oder beschreiben, genannt in Code und Tests:
Papershifts eigenes `Papershift/hosted_pages_template`, `maluramichael/papershift-cli`,
`bestit/bamboohr-connector` und `HelpCode-ai/anythingmcp` für Papershift;
`borgels/mcp-server-planday` (nach Plandays OpenAPI-Dokumenten) und
`mindcloud-inc/universal-api-reference` für Planday; `mztechnik/hacs-crewmeister` und
`HelpCode-ai/anythingmcp` für Crewmeister. Was keine Quelle belegt, ist eine Annahme: bei
Papershift der Name eines Mitarbeiters (`name`, sonst Vor- und Nachname) und dass `confirmed_at` die
Bestätigung einer Abwesenheit ist; bei Planday die Pausen der Stempeluhr (`startDateTime`,
`endDateTime`); bei Crewmeister, dass eine Schicht mit `publishedShiftId` der Entwurf einer
veröffentlichten ist. Die geplante Pause einer Crewmeister-Schicht nennt keine Quelle, sie kommt
nicht mit (0 Minuten). Echte, anonymisierte Abrufe ergänzen Menschen.

### Toggl Track und Clockify

Für den Solo-Modus holt Soll Kunden, Projekte, Aufgaben (als Tätigkeiten) und Zeiten aus
Toggl Track und Clockify – wahlweise aus dem CSV-Export des **Detailed Report** oder direkt über
die API des Anbieters. Beide Wege erzeugen dieselben Kennungen (Person, Beginn und Ende auf die
Minute als SHA-256), sodass ein CSV-Export der älteren Monate und ein API-Abruf der letzten Wochen
einander als „schon da“ erkennen und nichts doppelt anlegen.

**CSV-Export**: In beiden Tools unter *Reports → Detailed* als CSV exportieren. Stelle im Profil
vorher als Datumsformat `JJJJ-MM-TT` oder `TT.MM.JJJJ` ein; Datumsangaben mit `/` (wie
`09/01/2026`) lehnt Soll mit Zeile ab, weil Monat und Tag nicht eindeutig sind. Uhrzeiten liest Soll
in `Europe/Berlin` (24-Stunden- oder 12-Stunden-Format mit AM/PM, mit oder ohne Sekunden).

**API-Abruf**:
- **Toggl Track**: API-Token aus dem Profil. Die API v9 (`api.track.toggl.com`) liefert höchstens
  die letzten **89 Tage**; ältere Zeiten lädst du als CSV-Export.
- **Clockify**: API-Schlüssel aus den Profileinstellungen sowie die Region des Arbeitsbereichs
  (Global `api.clockify.me`, EU `euc1`, USA `use2`, UK `euw2`, AU `apse2`). Im Free-Plan erlaubt
  Clockify 30 Anfragen je Stunde; Soll ruft Seiten nacheinander ab und nur so weit, wie
  `Last-Page` angibt.

**Was daraus wird**:
- **Zeiten werden Projektzeit**, keine Stempelungen der Arbeitszeit. Wer Arbeitszeit samt Kommen
  und Gehen übernehmen will, nutzt [Excel/CSV mit freien Spalten](#excelcsv-mit-freien-spalten).
- **Projekt ohne Kunden**: Ein Auftrag braucht in Soll einen Kunden. Hat ein Projekt beim Anbieter
  keinen Kunden, legt Soll es nicht neu an (`kunde_fehlt`); du ordnest es einem bestehenden Auftrag
  zu oder lässt es aus.
- **Buchung ohne Projekt** wird eine interne Buchung.
- **Buchung ohne Aufgabe**: Wähle in der Zuordnung eine Tätigkeit für „ohne Tätigkeit“; ohne sie
  wird der Eintrag ausgelassen.
- **Abgelehnt mit Zeile**: laufende Einträge, Einträge unter einer Minute oder ab 24 Stunden,
  Uhrzeiten in einer Zeitumstellung sowie Überschneidungen. Bei Clockify übernimmt Soll nur
  Einträge vom Typ `REGULAR`.

**Quellen und Annahmen**: Gebaut nach Toggls OpenAPI-Dokument der API v9 (`engineering.toggl.com`),
Clockifys OpenAPI-Dokument „Clockify API v1“ (`docs.clockify.me`) sowie den Spaltenbeschreibungen
des Detailed Report beider Anbieter. Was keine Quelle belegt, ist eine Annahme: dass der
CSV-Export in der eingestellten Profilzeitzone (`Europe/Berlin`) vorliegt und aufeinanderfolgende
Einträge durch Abrunden von Beginn und Ende auf die ganze Minute lückenlos anschließen.

