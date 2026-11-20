---
title: Projektplan
description: >-
  Der Plan für Soll: Ziel, Entscheidungen, Technologie, Recht, GoBD, Datenmodell, Import aus anderen
  Tools, Anbindungen, Bauplan im Agenten-Loop und Tests.
---

# Projektplan

Soll ist eine selbst gehostete Zeiterfassung mit Dienstplan für kleine Betriebe. Soll erfüllt die
Pflicht zur Arbeitszeiterfassung, prüft jede Zeit gegen das Arbeitszeitgesetz und nennt dabei den
Paragraphen, schließt den Monat manipulationssicher ab und gibt die Daten an DATEV und Haben weiter.
Was im Einzelnen gebaut wird und in welcher Reihenfolge, steht in der
[Bauliste](https://github.com/Speicherstadt/soll/blob/main/BAULISTE.md).

## Ziel und Positionierung

Zielgruppe sind Betriebe mit 2 bis 50 Beschäftigten, vor allem mit Schichten, Minijobs oder
Zuschlägen: Gastronomie, Einzelhandel, Handwerk, Praxen und Agenturen. Die meisten haben eine
Steuerberatung, die den Lohn mit DATEV rechnet. Freelancer sind eine Nebenzielgruppe (Projektzeit
im Solo-Modus), den Mittelstand ab etwa 50 Beschäftigten nimmt Soll später in den Blick.

Was Soll anders macht:

- **Prüfung mit Paragraph**: Jeder Befund nennt seine Norm („Pause fehlt, § 4 ArbZG“), schon beim
  Stempeln und beim Einplanen.
- **Nachweislich unverändert**: Audit-Log als Hash-Kette; zum Monatsabschluss bekommt jede Person
  den Prüfwert der Kette, an dem eine spätere Änderung auffällt.
- **Lohn mit Zuschlägen**: DATEV-Export mit den Zuschlägen nach § 3b EStG, auch für Minijobs.
- **Keine Kosten pro Kopf**: AGPL, selbst gehostet frei; gehostet zum Preis pro Betrieb.
- **Daten mitnehmen**: Import aus Clockodo, Personio, Kimai, Papershift, Planday, Crewmeister,
  Toggl, Clockify und Excel.

**Bewusst nicht**: Lohnabrechnung (Haben oder das Lohnprogramm), Bewerbermanagement, Personalakte,
Abruf der eAU, GPS-Verfolgung, Biometrie, Dienstpläne für die Pflege, eigene Hardware-Terminals.

## Markt

| Werkzeug | Zielgruppe | Lücke, die Soll füllt |
| --- | --- | --- |
| Clockodo | Freelancer, Agenturen, KMU | DATEV-Export nur für Stundenlöhner und ohne Zuschläge ([Hilfe](https://support.clockodo.com/en/help-center/wie-verbinde-ich-die-lohnbuchhaltung-datev-mit-clockodo)); kein Dienstplan belegt |
| Kimai | Freelancer, Agenturen | Projektzeit, keine Prüfung nach ArbZG, kein Dienstplan |
| Personio | Mittelstand | zu groß für Kleinbetriebe |
| Papershift, Planday, Crewmeister | Gastronomie, Handel, Handwerk | nicht Open Source, nicht selbst zu hosten, keine Prüfung mit Norm |

## Entscheidungen

Der Loop entscheidet danach und trägt neue Entscheidungen hier mit Grund ein.

| Frage | Entscheidung | Warum |
| --- | --- | --- |
| Mandanten | mehrere Betriebe in einer Instanz; jede Tabelle mit `betrieb_id`, Test je Endpunkt | gehostete Variante und Partner (Steuerberatungen, IT-Dienstleister) brauchen es; bewusste Abweichung von Haben |
| Module | Arbeitszeit (mit Abwesenheiten), Dienstplan, Projektzeit, Terminal; geschaltet über vier Fragen in der Einrichtung, später unter Einstellungen; ein abgeschaltetes Modul fehlt in Navigation, Routen und API, seine Daten bleiben; Arbeitszeit ist Pflicht, solange der Betrieb Beschäftigte hat | ein Freelancer sieht nur Projektzeit, ein Café keine Aufträge; das Gesetz bestimmt, was nicht abschaltbar ist |
| Arbeitszeit und Projektzeit | getrennte Tabellen, Projektzeit kann auf eine Stempelung verweisen | eigene Regeln: Arbeitszeit wird gesperrt, Projektzeit bleibt bis „abgerechnet“ änderbar |
| Änderungen an Stempelungen | bis zum Monatsabschluss erlaubt, mit Grund, im Audit-Log, für den Mitarbeiter sichtbar; danach gesperrt, Korrektur als Gegeneintrag | gleicher Schutz, weniger Reibung als eine Sperre ab dem Einfügen |
| Unveränderbarkeit | eigene Hash-Kette im Code, Prüfwert auf dem Stundenzettel jeder Person, keine Datenbank-Trigger und kein gobd-kern | der Betreiber ist der Arbeitgeber und könnte Trigger abschalten; den Prüfwert in der Hand der Beschäftigten kann er nicht ändern. Die GoBD verlangen Protokollierung und Verfahrensdokumentation, keine Trigger |
| Konten | aus den Abschlüssen berechnet, nur Anpassungen von Hand gespeichert | keine doppelte Wahrheit |
| Aussonderung | die Kette läuft über den Hash des Inhalts, sodass der Inhalt nach Ablauf der Frist entfernt werden kann | DSGVO verlangt Löschen, die GoBD Unveränderbarkeit |
| Regeln | als Daten mit Gültigkeit (Regelversion je Zeitraum) | eine Reform des ArbZG wird eine neue Version, keine Codeänderung |
| Jahreswerte | als Daten mit Gültigkeit und Quelle in `packages/arbeitszeit`, nicht in der Datenbank; jeder Betrag endet mit seinem Jahr | die reinen Funktionen brauchen sie ohne Datenbank; ein neuer Wert kommt mit einer Version von Soll, geprüft durch Tests, und kein Betrieb kann ihn verändern |
| Bescheinigungen | kein Hochladen; nur „liegt vor“ (eAU oder Papier im Büro) und eine Erinnerung an den Betrieb, die eAU abzurufen | seit 2023 kommt die AU für gesetzlich Versicherte elektronisch an den Betrieb; eine hochgeladene Datei wäre ein Gesundheitsdatum (Art. 9 DSGVO) für seltene Fälle |
| Rundung | nur der abrechenbaren Projektzeit, nie der Arbeitszeit | Abrunden der Arbeitszeit ginge zulasten der Beschäftigten |
| Terminal | PWA im Kiosk-Modus auf einem Tablet; keine eigene Hardware | derselbe Code wie im Browser |
| Haben | wird von hier aus nicht geändert; Prüfwert, Texte der Verfahrensdokumentation und Dateispeicher aus gobd-kern werden mit Quellenangabe kopiert | gemeinsame Pakete werden erst herausgelöst, wenn der Code in beiden Apps stabil ist |
| Sprachen | Deutsch und Englisch überall; Türkisch, Polnisch, Ukrainisch, Arabisch für die Ansichten der Beschäftigten | viele Beschäftigte in Gastronomie und Handwerk sprechen kein Deutsch |
| PDF | `pdf-lib` | reines JavaScript ohne native Teile, läuft im Server und in `bun build --compile` |
| Geheimnisse | verschlüsselte Spalten mit dem Schlüssel aus `SOLL_SECRET_KEY`, Start ohne Schlüssel verweigert; API-Tokens und PINs als Hash; VAPID-Schlüssel erzeugt die Instanz beim ersten Start | nichts Geheimes im Repo oder in der Datenbank im Klartext |
| Was sich in der CI nicht echt testen lässt | Ersatz für `NDEFReader`, Push-Dienst, SMTP, Haben-API und die APIs der Import-Quellen, nach deren Doku gebaut | die Kriterien für „fertig“ bleiben erfüllbar |
| Übersetzungen | der Loop übersetzt `tr`, `pl`, `uk` und `ar` selbst; Muttersprachler prüfen später | er wartet nicht auf Menschen |
| Merge | der Loop merged selbst, wenn CI grün ist und das unabhängige Review keine Befunde mehr hat | er wartet nie auf einen Menschen |
| Arbeitszeit-Pflicht bei neuen Beschäftigten | kommt die erste beschäftigte Person in einen Betrieb ohne Modul Arbeitszeit (Einladung angenommen, Rolle gewechselt), schaltet Soll die Arbeitszeit wieder ein, statt die Aufnahme abzulehnen | die Pflicht zur Erfassung beginnt mit der Beschäftigung (BAG 1 ABR 22/21); eine abgelehnte, schon angenommene Einladung hinterließe ein Konto ohne Betrieb |
| Wer die Mitgliederliste sieht | Inhaber, Planer, Lohnbüro und Betriebsrat; Mitarbeiter, Externe und Geräte nur sich selbst | Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO): die Liste mit E-Mail-Adressen braucht, wer Personen verwaltet, abrechnet oder nach § 80 Abs. 2 BetrVG unterrichtet wird; Namen von Kollegen im Dienstplan zeigen die Module selbst |
| Vier Fragen und Module | die Regel „Beschäftigte ja → Arbeitszeit fest, nein → nur Projektzeit“ ist eine reine Funktion in `packages/arbeitszeit` (`moduleAusFragen`), die Server und App teilen; die Antworten werden nicht gespeichert, sondern aus den Modulen zurückgelesen | die Pflicht zur Erfassung ist Recht (BAG 1 ABR 22/21) und gehört zu den Regeln; eine Quelle für beide Seiten, keine doppelte Wahrheit |
| Mitarbeiter per CSV | der Parser ist eine reine Funktion in `packages/import` (RFC 4180, Trennzeichen erkannt, Rollen auf Deutsch und Englisch, mit fast-check gefuzzt); die App liest die Datei im Browser und zeigt die Vorschau, der Server bekommt nur die geprüfte Liste als JSON und prüft sie mit Zod noch einmal | eine Tabelle aus Excel ist eine Importquelle wie die Exporte anderer Tools; die Vorschau braucht keinen Aufruf, und der Server liest nie eine Datei |
| Einladungen aus der Einrichtung | eine Liste wird in einer Transaktion zu Links (`POST /api/v1/einladungen/liste`, höchstens 200), alle oder keiner; die Links zeigt die App nur einmal | es gilt dieselbe Einladung per Link wie in S-106, ohne E-Mail; gespeichert ist nur der Hash |
| Bundesland und Standorte | der Betrieb hat ein Bundesland als Vorgabe, jeder Standort sein eigenes mit den Regionen seiner Gemeinde (`REGIONEN`); ein Betrieb mit Beschäftigten braucht mindestens einen Standort | Feiertage gelten je Standort (S-105), Regionen je Gemeinde; ein Betrieb mit Werkstatt in Hamburg kann eine Baustelle in Augsburg haben |
| Lohn im Arbeitszeitmodell | Art des Lohns (Monat oder Stunde) und Minijob als eigenes Merkmal, Lohn in Cent oder leer („nicht hinterlegt“); ein Minijob hat in der Vorlage keine festen Stunden (nach Plan), die Minijob-Grenze nennt der Assistent nicht | ein Minijob wird oft stündlich bezahlt, die Grenze ist ein Jahreswert (S-104) und darf nicht aus einem anderen Jahr kommen |
| Wer Löhne sieht | die Arbeitszeitmodelle mit ihren Löhnen lesen Inhaber und Lohnbüro, ändern nur der Inhaber | Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO): Planer und Betriebsrat brauchen keine Löhne für ihre Aufgaben in Soll |
| Passwort | mindestens 10 Zeichen, beim eigenen Konto wie bei einer Einladung | eine Regel für alle Konten |
| Sitzung in der App | die App fragt den Server (`GET /api/v1/betrieb`) und merkt sich den zuletzt gesehenen Betrieb nur auf dem Gerät, damit sie offline startet; was erlaubt ist, entscheidet bei jedem Aufruf der Server | eine PWA muss ohne Netz öffnen; die Sperre eines Moduls gehört dem Server |
| Icons | Daten aus `lucide` mit eigener `Icon`-Komponente in `packages/ui` statt `lucide-solid` | `lucide-solid` trägt nur Solid 1 (`peerDependencies` `solid-js ^1.4.7`); die Icon-Daten sind dieselben |
| Schicht und Arbeitstag | eine Unterbrechung ab 9 h beendet die Schicht, darunter gehört sie dazu, auch über Mitternacht; eine Schicht reicht nie 24 h über ihren Beginn hinaus; alle Schichten, die an einem Kalendertag beginnen, sind sein Arbeitstag | 9 h ist die kürzeste Ruhezeit, die das Gesetz überhaupt zulässt (11 h, nach § 7 Abs. 1 Nr. 3 ArbZG um bis zu 2 h gekürzt): Was kürzer ist, kann keine Ruhezeit sein, und eine Ruhezeit von 10 h nach § 5 Abs. 2 ArbZG bleibt eine; die 24 h folgen dem Werktag, der mit dem Beginn der Arbeit zählt |
| Minuten aus Stempelungen | Beginne (Kommen, Pause-Ende) zählen ab der angefangenen Minute, Enden (Gehen, Pause-Beginn) bis zur nächsten vollen; bei wiederholten Stempelungen gilt der früheste Beginn und das späteste Ende, mit Hinweis; ein doppelter Tipp derselben Art in derselben Minute ändert nichts, es zählt der erste | nie zulasten der Beschäftigten (CLAUDE.md); der Hinweis lässt den Betrieb den Fall prüfen, statt still zu entscheiden; ein zweiter Tipp verschöbe sonst das Ende und damit die 9 h, ab denen eine Schicht endet, und hängte die nächste Schicht an diese |
| Fehlende Stempelungen | nie ergänzt: ein offenes Kommen bleibt offen und ist nach R-01 ab Mitternacht oder 16 h nach Beginn ein Hinweis (der spätere Zeitpunkt, höchstens 24 h nach Beginn), ein Gehen in der Pause zählt die Arbeit bis zum Pausenbeginn; Kommen während der Pause beendet sie | Soll stempelt nie selbst aus (CLAUDE.md); ein Terminal bietet unter Umständen nur Kommen und Gehen |
| Ausgleichszeitraum (§ 3 Satz 2 ArbZG) | feste, lückenlos aufeinanderfolgende Zeiträume ab einem Beginn am Betrieb (Vorgabe 1.1.2026): sechs Kalendermonate ab dem Monatsersten, 24 Wochen ab dem Beginn; ohne Wahl zählt ein überschrittener Zeitraum nur, wenn auch einer der anderen Art überschritten ist, ob er sich mit ihm überschneidet oder nicht (Verstoß, wenn beide beendet sind); Hinweis, sobald der laufende Zeitraum mehr als 8 h je bisherigem Werktag hat | ein Zeitraum mit Ende braucht einen festen Anfang, und ein gleitendes Fenster meldete Fälle, die ein Betrieb mit festen Halbjahren erlaubt hätte; das Gesetz lässt jeden der beiden Zeiträume genügen, aber der Betrieb hat nur einen: Ist in jeder Art ein Zeitraum überschritten, verstößt jede Wahl (Review von PR #12); die Vorgabe ergibt Kalenderhalbjahre und hängt nicht davon ab, welche Tage gerade geladen sind |
| Ausgleich verkürzter Ruhezeit (§ 5 Abs. 2 ArbZG) | jede Verkürzung bekommt eine eigene spätere Ruhezeit von mindestens 12 h, deren erste 12 h im Kalendermonat oder in den vier Wochen (28 Tage) ab dem Tag liegen, an dem die verkürzte beginnt; ohne Wahl genügt jeder der beiden; die Ruhezeit seit dem letzten Gehen zählt, sobald 12 h vergangen sind; ohne Branche am Betrieb keine Verkürzung | „jede Verkürzung“ verlangt einen Ausgleich je Verkürzung; dass er vorher kommen darf, sagt das Gesetz nicht (vorsichtige Auslegung); ohne die laufende Ruhezeit wäre wer nach der Verkürzung frei hat, ohne Ausgleich; die Branche ist erst bekannt, wenn der Betrieb sie einstellt (S-303) |
| Prüfung nach §§ 3 bis 5 ArbZG | reine Funktionen auf Arbeitstagen in der Form `PruefTag`, die Stempelungen und geplante Schichten teilen; nur geschlossene Schichten; § 4 je Schicht; Grenzwerte als Daten je Regelversion, ein Tag ohne Regelversion „nicht hinterlegt“ statt geprüft | eine Prüfung für Ist und Plan (S-502); die Zeit einer offenen Schicht steht nicht fest (R-01 meldet sie); zwischen zwei Schichten liegen mindestens 9 h, mehr als jede Pause; Soll rechnet nie mit den Werten einer anderen Version (CLAUDE.md) |
| Stempelungen ändern | nur anfügen: Nachtrag, Änderung und Entfernung sind je eine neue Zeile in `stempelungen` mit Grund, die auf die ersetzte Zeile verweist (`ersetzt`, eindeutig je Betrieb); in Kraft ist, was keine Zeile ersetzt und nichts entfernt; kein Grund, keine Änderung | die Audit-Kette zeigt die ganze Geschichte, das Original bleibt, und die Person sieht wer, wann, was und warum (Projektplan, „Änderungen an Stempelungen“); eine zweite gleichzeitige Änderung derselben Fassung scheitert am eindeutigen Index statt eine zu überschreiben |
| Wer Stempelungen ändert | jede Person ihre eigenen, mit Grund; Inhaber und Planer die aller, mit Grund; das Lohnbüro liest nur; Externe und Geräte stempeln hier nicht | ein vergessenes Gehen trägt am schnellsten die Person selbst nach; die Kontrolle ist die für beide Seiten sichtbare Änderung und die Bestätigung des Monats durch beide (S-306) |
| Zeit einer Live-Stempelung | die Uhr des Servers; die Zeit des Geräts steht daneben (`geraet_zeitpunkt`) | eine falsch gehende Uhr am Handy verschiebt keine Arbeitszeit; die Warteschlange ohne Netz (S-305) braucht die Zeit des Geräts trotzdem |
| Soll eines Tages | aus dem Arbeitszeitmodell, das der Person ab einem Tag zugeordnet ist (`modellzuordnungen`, nur der Inhaber); ohne Zuordnung „nicht hinterlegt“; ein zugeordnetes Modell lässt sich nicht löschen | das Soll gehört zur Person und kann wechseln (Teilzeit ab März); nie ein geschätzter Wert (CLAUDE.md) |
| Nächster Befund beim Stempeln | `tagesstand()` in `packages/arbeitszeit` rechnet den Tag, als ginge die Person jetzt (angefangene Minute zählt), prüft R-01, R-02, R-04 und R-05 mit den Funktionen aus S-201 und S-202 und nennt die nächste Grenze (Pause, 8 h, 10 h, Ende der Ruhezeit); R-03 erst mit dem Monat; die App rechnet mit derselben Funktion auf der Uhr des Servers weiter | eine Prüfung für Server und App, ohne Aufruf je Minute; der Ausgleichszeitraum braucht alle Tage des Zeitraums, Feiertage und Abwesenheiten, die erst mit S-306 und Phase 4 vollständig sind; ein offenes Gehen über die Frist rechnet Soll nicht hoch, weil sein Ende nicht feststeht |
| Monat gesperrt | jede Schreibfunktion für Stempelungen fragt vorher `monatAbgeschlossen()`, das bis S-306 „offen“ sagt; gefragt wird für den Berliner Tag des alten und des neuen Zeitpunkts | die Sperre kommt mit dem Abschluss ohne Änderung an den Schreibwegen |
| Uhrzeit eingeben | Berliner Wanduhr; in der doppelten Stunde im Oktober gilt die erste (Sommerzeit), eine Uhrzeit, die es im März nicht gibt, wird abgelehnt (`eingabeInBerlin` in `kalender/wanduhr.ts`) | eindeutig und ohne Raten; anders als `zeitpunktInBerlin` für die Regeln, das eine fehlende Uhrzeit ab Mitternacht weiterzählt, darf eine Eingabe nie einen Zeitpunkt erfinden; wer die zweite Stunde meint, korrigiert mit Grund |
| Nachtarbeitnehmer (§ 2 Abs. 5 ArbZG) | Wechselschicht ist ein Merkmal am Mitarbeiter (Vorgabe: nein); daneben zählt Soll die Nachtarbeitstage je Schicht und Starttag, ab dem 48. ist die Person Nachtarbeitnehmer für den Rest des Jahres und das ganze folgende; Hinweise am 40. und 48. Nachtarbeitstag | ob jemand in Wechselschicht arbeitet, steht in keiner Stempelung; das Gesetz meint mit „leisten“ das laufende Jahr, das Soll erst am Ende kennt: Wer im Vorjahr 48 Nächte hatte, wird sie wieder haben (vorsichtige Auslegung), und für Zeiträume ohne Nachtarbeit greift ohnehin § 3 (§ 6 Abs. 2 Satz 3) |
| Ausgleich für Nachtarbeitnehmer (§ 6 Abs. 2 ArbZG) | Kalendermonat oder vier Wochen (28 Tage lückenlos ab dem Beginn am Betrieb, Vorgabe 1.1.2026), ohne Wahl wie in § 3 nur, wenn beide Arten überschritten sind; geprüft werden Zeiträume mit einem Nachtarbeitstag als Nachtarbeitnehmer, bei Wechselschicht jeder | dieselbe Lesart wie beim Ausgleichszeitraum nach § 3 (S-202); § 6 Abs. 2 Satz 3 verweist Zeiträume ohne Nachtarbeit auf § 3 |
| Sonn- und Feiertagsruhe (§§ 9 bis 11 ArbZG) | die Ruhe ist 0 bis 24 Uhr Uhrzeit am Standort, eine Verschiebung nach § 9 Abs. 2 rückt Beginn und Ende um die Uhrzeit, die Ruhe dauert dann mindestens 24 echte Stunden (im März 24 statt 23, im Oktober 25); Ausnahmen nach § 10 Abs. 1, § 10 Abs. 3 und § 13 sind Einstellungen (Vorgabe: keine), eine ungültige Einstellung erlaubt nichts; dieselbe Ruhe entscheidet, ob ein Sonntag für § 11 Abs. 1 und 3 gearbeitet ist | eine Einstellung, die Soll nicht kennt, darf nie mehr erlauben als das Gesetz; eine Messung für drei Regeln, keine doppelte Wahrheit; § 9 Abs. 2 nennt „die auf den Beginn der Ruhezeit folgenden 24 Stunden“ als Bedingung und erlaubt, „Beginn oder Ende“ nur „um bis zu sechs Stunden“ zu verlegen: ein Ende nach genau 24 Stunden läge am 25.10. sieben Stunden früher (Review von PR #13) |
| Ersatzruhetag (§ 11 Abs. 3 ArbZG) | ein vergangener Werktag ohne Arbeit von 0 bis 24 Uhr; jeder Sonn- oder Feiertag bekommt den frühesten freien Werktag seines Zeitraums, die Zeiträume, die zuerst enden, wählen zuerst | ein künftiger Tag kann noch Arbeit bekommen; die Reihenfolge nach dem Ende des Zeitraums lässt so wenige ohne Ersatzruhetag wie möglich (ein Feiertag mit acht Wochen nimmt einem Sonntag nicht seinen einzigen Tag) |
| Aufzeichnung binnen sieben Tagen (§ 17 MiLoG) | jede Stempelung trägt, wann sie erfasst und wann sie ersetzt wurde; ein Arbeitstag wird so geprüft, wie er zum Ablauf des siebten Folgetags stand: vollständig ist rechtzeitig, eine spätere Änderung nur „nachgetragen“, unvollständig bleibt ein Verstoß; Hinweis ab dem fünften Folgetag; ohne Branche am Betrieb gilt die Pflicht | das Gesetz fragt, ob bis zum Ablauf aufgezeichnet war, nicht wie der Tag heute aussieht; Änderungen sind bis zum Abschluss erlaubt (siehe „Änderungen an Stempelungen“), dürfen eine verspätete Aufzeichnung aber nicht verdecken; die Branche ist erst bekannt, wenn der Betrieb sie einstellt, und eine Vorgabe darf nie weniger streng sein als das Gesetz |
| Mindestlohn je Monat (§ 1 MiLoG) | Lohn × 60 gegen Mindestlohn × Minuten in ganzen Zahlen, jede Minute zum Mindestlohn ihres Kalendertags; Sonn- und Feiertagszuschläge zählen, Nachtzuschläge nicht; Ausnahmen nach § 22 MiLoG nur für ganze Monate, befristete nur mit Ende | keine Brüche, keine Rundung (CLAUDE.md); eine Nachtschicht über den 1. Januar schuldet die Stunden nach Mitternacht zum neuen Satz; welcher Teil eines Monatslohns auf die Tage nach einer Ausnahme fällt, weiß Soll nicht, also prüft es den Monat ganz |
| Minijob-Grenze (§ 8 SGB IV) | eigene Regel R-32; Zeitjahr = der Monat und die elf davor; gelegentlich (höchstens zwei Monate, je bis zur Grenze darüber) und schwankend (im Zeitjahr im Schnitt unter der Grenze) sind Hinweise, sonst Verstoß; steuerfreie Zuschläge zählen nicht, außer soweit der Lohn je Stunde 25 € übersteigt; ohne Angabe gilt ein Zuschlag als versteuert | ob ein Überschreiten vorhersehbar war oder in der Jahresprognose stand, steht in keiner Stempelung, das entscheidet der Betrieb; das Zeitjahr endet nach den Geringfügigkeits-Richtlinien mit dem Monat des Überschreitens; steuerfreie Zuschläge sind kein Arbeitsentgelt (§ 1 SvEV), berechnet erst S-207 |
| Uhrzeit in Berlin | `zeitpunktInBerlin(tag, minuten)` in `kalender/zeit.ts` ist für die Regeln die Brücke von einer Uhrzeit zum Augenblick (eine Eingabe geht über `eingabeInBerlin`); die doppelte Stunde im Oktober nimmt die erste, die fehlende im März zählt ab Mitternacht | Nachtzeit und der Beginn einer verschobenen Sonntagsruhe sind Uhrzeiten, die Arbeit wird in echten Minuten gemessen |
| Alter (§ 2 Abs. 2 JArbSchG) | vom Mitarbeiter nur das Geburtsdatum; das Alter nach § 187 Abs. 2 Satz 2 und § 188 Abs. 2 und 3 BGB: 18 am Geburtstag, wer am 29. Februar geboren ist, in Jahren ohne ihn am 1. März (`alterAm`); die Regeln für Jugendliche gelten auch unter 15; Wochen, Monate und Schichtzeiten zählen nur die Tage unter 18, für eine Ruhezeit genügt einer der beiden Tage | das Gesetz rechnet Lebensalter so, und der spätere Tag ist der strengere; mehr Daten zur Person braucht keine Regel; für Kinder gelten strengere Regeln, die Soll nicht prüft, also mindestens die für Jugendliche |
| Arbeitszeit der Jugendlichen (§ 8 JArbSchG) | 8:30 nur, wenn an einem anderen Werktag der Woche mit Arbeit weniger als 8 h gearbeitet wird, ein freier Tag zählt nicht; Ausfall an einem Feiertag (§ 4 Abs. 4 Satz 2) mit dem Soll des Tages, bis S-208 mit 8 h für so viele Feiertage von Montag bis Freitag (Samstag nur mit Ausnahme nach § 16 Abs. 2), wie die Fünf-Tage-Woche neben den gearbeiteten Tagen zulässt | „an einzelnen Werktagen die Arbeitszeit … verkürzt“ meint einen Arbeitstag, keinen freien (vorsichtige Auslegung); ohne Feiertagsausfall wäre die Vorgabe weniger streng als das Gesetz, und ein Tag, der neben fünf gearbeiteten kein Arbeitstag sein konnte (§ 15), verliert keine Zeit |
| Einstellungen nach JArbSchG | Branche am Betrieb (Gaststätten, Schausteller, Landwirtschaft und Tierhaltung, Bäckerei, Konditorei, Bergbau unter Tage) bringt ihre Ausnahmen nach § 12, § 14 Abs. 2 und 3, § 16 Abs. 2 und § 17 Abs. 2 mit; weitere Nummern als Einstellung; Tage auf Bau- und Montagestellen; Berufsschultage vor 9 Uhr, ohne Eintrag kann jeder Tag einer sein; am Ostersonntag nie, auch wo er kein gesetzlicher Feiertag ist; die Schichtzeit vom ersten Beginn bis zum letzten Ende des Tages | das Gesetz knüpft die Ausnahmen an diese Branchen; ohne Eintrag darf Soll nicht annehmen, dass morgen keine Berufsschule ist; § 18 Abs. 2 nennt den ersten Osterfeiertag ohne Bezug auf das Land (vorsichtige Auslegung); Schichtzeit ist die tägliche Arbeitszeit mit den Pausen (§ 4 Abs. 2), auch zwischen zwei Schichten |
| Daten zum Mutterschutz | am Mitarbeiter nur ein Zeitraum (schwanger oder stillend, ohne zu sagen, was), dazu die Daten, die eine Regel braucht: Geburtsdatum, Schutzfristen mit Beginn, Ende und Erklärung, Erklärung zur Sonn- und Feiertagsarbeit, Genehmigung nach § 28; die Woche einer Fehlgeburt nur für die Rechnung der Schutzfrist (`schutzfristNachFehlgeburt`), gespeichert wird der Zeitraum; ohne Geburtsdatum die Grenzen für unter 18 Jahre, ohne vertragliche Wochenarbeitszeit „nicht hinterlegt“ | eine Schwangerschaft ist ein Gesundheitsdatum (Art. 9 DSGVO, Art. 5 Abs. 1 lit. c); §§ 4 bis 6 MuSchG gelten für Schwangere und Stillende gleich; was nicht eingetragen ist, darf nichts erlauben |
| Grenzen des MuSchG | Doppelwoche: jede Kalenderwoche mit der vorigen und der folgenden; Monatsdurchschnitt: Arbeitszeit × 7 ≤ Summe der vertraglichen Wochenarbeitszeit über die Tage des Monats im Zeitraum, ganze Minuten; Ersatzruhetag nach § 6: ein Werktag derselben Kalenderwoche ohne Arbeit, vor dem 11 h ohne Arbeit liegen, geprüft, wenn die Woche vorbei ist; eine Bewilligung nach § 13 ArbZG ist keine Ausnahme nach § 10 ArbZG | „zwei aufeinanderfolgende Wochen“ ohne festen Anfang: überlappende Paare lassen keine Einteilung eine Überschreitung verdecken; ein Siebtel je Tag folgt einem Wechsel des Modells im Monat und braucht keine Rundung; § 6 Abs. 1 Satz 2 Nr. 2 nennt nur § 10 ArbZG |
| Bereitschaftsdienst (§§ 2, 7 ArbZG) | Bereitschaftsdienst, Arbeitsbereitschaft und Rufbereitschaft, die ganz zählt, sind Stücke Arbeit in der Schicht (`bereitschaft`), geschnitten wie Stempelungen und mit ihnen vereinigt; die Rufbereitschaft zählt ganz bei einer Reaktionszeit unter 30 min und ohne eingestellte Reaktionszeit; § 7 Abs. 1 Nr. 1 Buchst. a ist eine Einstellung mit Fundstelle, die nur Tage mit Bereitschaftsdienst über 10 h hebt, und bringt § 7 Abs. 9 mit | Bereitschaftsdienst ist Arbeitszeit (EuGH C-151/02), so lesen ihn die Regeln von S-202 und S-203 ohne Änderung; Matzak (C-518/15) nennt keine Zahl, darum eine vorsichtige Grenze und eine Vorgabe, die nie weniger streng ist als das Gesetz |
| Rufbereitschaft und Tarif nach § 7 Abs. 1 Nr. 1 Buchst. a ArbZG | eine Rufbereitschaft, die ganz zählt (Reaktionszeit unter 30 min oder keine eingestellt), ist Arbeitszeit für jeden Grenzwert, aber kein Bereitschaftsdienst: Sie öffnet die tarifliche Ausnahme über 10 h nicht und bringt § 7 Abs. 9 nicht mit; nur ein Tag mit Bereitschaftsdienst oder Arbeitsbereitschaft tut es (`bereitschaftsdienstMinuten`) | § 7 Abs. 1 Nr. 1 Buchst. a nennt nur Arbeitsbereitschaft und Bereitschaftsdienst; das ist die strengere Lesart, und eine Vorgabe ist nie weniger streng als das Gesetz |
| Einsätze in der Rufbereitschaft (§ 5 ArbZG) | ein Einsatz ist ein Block der Schicht (`einsaetze`), der zum Arbeitstag nach dem Grundbegriff „Schicht“ gehört, aber nie zwei Stücke anderer Arbeit verbindet; unter 15 min Abstand zu anderer Arbeit ist er Teil von ihr; `ruhezeit` misst vom Ende der letzten Arbeit, auch eines Einsatzes, bis zur ersten anderen Arbeit des nächsten Arbeitstags, eine zu kurze Ruhezeit nach einem Einsatz ist R-12; nach § 5 Abs. 3 unterbrechen Einsätze bis zur Hälfte der Ruhezeit (5:30) sie nicht und sind ein Hinweis ohne Frist | nach dem Einsatz beginnt eine neue Ruhezeit (R-12), die davor zählt nicht; eine kleine Änderung an `ruhezeit` statt einer zweiten Messung; das Gesetz nennt für den Ausgleich nach § 5 Abs. 3 keinen Zeitraum |
| Lizenz | AGPL-3.0 mit Namensnennung nach § 7(b) und kommerzieller Lizenz wie bei Haben | |

## Technologie

Derselbe Stack wie Kennwort, ohne Tauri. Gegenüber `tech-stack.md` aus firsttris/workflows gibt es
zwei begründete Abweichungen, beide wie bei Kennwort; sie stehen auch im CLAUDE.md.

| Teil | Wahl | Begründung |
| --- | --- | --- |
| Monorepo | Bun Workspaces, Biome, TypeScript strict, Vitest, Playwright | wie überall |
| Server | Bun, Hono, Drizzle, Zod, `bun build --compile` | **Abweichung von TanStack Start**, wie Kennwort: eine API für Web-App, PWA-Warteschlange, Terminal, REST und MCP |
| Web-App | Solid 2, Vite, statische SPA/PWA; `@tanstack/solid-router` und `solid-query`, wenn sie Solid 2 tragen | **Abweichung von React**, wie Kennwort: ein Look in der Suite, kleines Bundle für Handy und Terminal; der Service Worker hält die ganze App offline |
| Oberfläche | shadcn-Stil **ohne Abhängigkeiten**: `<dialog>`, Popover-API, CSS Anchor Positioning, eigene `cn()` und `variants()`, Tailwind 4, `lucide-solid`, Geist, Zinc-Tokens (DESIGN.md) | wie Kennwort, `packages/ui` von dort kopiert |
| Texte | Paraglide JS, `messages/{sprache}.json` | typisiert, vom `i18n`-Check geprüft |
| PWA | Service Worker, Offline-Warteschlange in IndexedDB, Web Push, Wake Lock, Web NFC | Stempeln am Handy und am Terminal, auch ohne Netz |
| Datenbank | SQLite (WAL) mit Drizzle, Migrationen eingecheckt und im Binary | ein Container ohne Datenbankserver; Stempelungen sind kleine Schreibvorgänge, die SQLite auch bei 50 Betrieben mit je 50 Personen trägt (S-904) |
| Unveränderbarkeit | Audit-Kette im Code, Prüfwert nach `pruefwert.ts` aus gobd-kern (kopiert) | siehe „Entscheidungen“ |
| Anmeldung | Better Auth: Organization-Plugin (Betriebe), Passkeys, Einladungslinks, PIN für das Terminal | Stack-Vorgabe für Apps mit vielen Benutzern |
| Validierung | Zod an jeder Grenze | |
| Exporte | eigene Funktionen in `packages/export`: DATEV-ASCII, CSV; PDF mit `pdf-lib` für Stundenzettel, Prüfexport und Regiebericht | |
| Import | reine Funktionen in `packages/import`, Fuzzing mit fast-check | |
| Betrieb | Docker-Image (amd64, arm64), Compose, Quadlet; Release-Workflow aus firsttris/workflows | |
| Doku | Zensical auf GitHub Pages unter soll.work | wie Kennwort |

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `packages/arbeitszeit` | Prüfregeln, Feiertage, Jahreswerte, Soll/Ist, Konten, Zuschläge; reine Funktionen |
| `packages/import` | Parser für die Exporte anderer Tools |
| `packages/export` | DATEV, CSV, PDF |
| `packages/ui` | Komponenten nach DESIGN.md, Vorbild Kennwort |
| `apps/server` | Hono-API, Drizzle mit SQLite, Better Auth; Routen dünn, Logik in `src/modules` |
| `apps/web` | Solid-SPA/PWA: App, Terminal-Ansicht, Offline-Warteschlange |
| `e2e/` | Playwright `desktop`, `phone`, `terminal` |

## Rechtlicher Rahmen

Jede Regel steht mit Grenzwerten und Testfällen in `docs/regeln.md` (S-103). Die Regeln sind Daten
mit Gültigkeit; der Gesetzeswächter (S-906) meldet, wenn sich ein Gesetzestext ändert.

| Regel | Norm |
| --- | --- |
| Pflicht zur Erfassung von Beginn, Ende und Dauer | BAG 1 ABR 22/21; § 3 Abs. 2 Nr. 1 ArbSchG; EuGH C-55/18 |
| Höchstarbeitszeit 8 h, bis 10 h mit Ausgleich | § 3 ArbZG |
| Pausen 30 min ab 6 h, 45 min ab 9 h, Blöcke ab 15 min | § 4 ArbZG |
| 11 h Ruhezeit; ein Einsatz in der Rufbereitschaft unterbricht sie | § 5 ArbZG |
| Nachtarbeit | §§ 2, 6 ArbZG |
| Sonn- und Feiertage, Ersatzruhetag | §§ 9 bis 11 ArbZG |
| Aufzeichnung über 8 h, 2 Jahre aufbewahren | § 16 Abs. 2 ArbZG |
| Bereitschaftsdienst und Rufbereitschaft | §§ 2, 5, 7 ArbZG; EuGH C-151/02, C-518/15 |
| Minijobs und Branchen: Erfassung binnen 7 Tagen, Mindestlohn | §§ 1, 17 MiLoG; § 2a SchwarzArbG |
| Minijob-Grenze, gelegentliches Überschreiten | § 8 Abs. 1, 1a, 1b SGB IV |
| Jugendliche | §§ 8, 11 bis 14 JArbSchG |
| Mutterschutz | §§ 4 bis 6 MuSchG |
| Arbeit auf Abruf: Schicht 4 Tage vorher | § 12 Abs. 3 TzBfG |
| Urlaub, Zusatzurlaub, Elternzeit, Krankheit im Urlaub | §§ 3, 5, 7, 9 BUrlG; § 208 SGB IX; § 17 BEEG |
| Krankmeldung, Bescheinigung ab dem 4. Tag, eAU | § 5 EntgFG; § 109 SGB IV |
| Kinderkrankentage | § 45 SGB V |
| Steuerfreie Zuschläge | § 3b EStG, R 3b LStR |
| Mitbestimmung bei technischer Überwachung | § 87 Abs. 1 Nr. 6 BetrVG |
| Datenschutz | Art. 5, 9, 15, 17, 88 DSGVO |

Vor dem Start ist der Stand der Reform des ArbZG zu prüfen (Referentenentwurf 2023, Koalitionsvertrag
2025: elektronische Erfassung, Wochenhöchstarbeitszeit); eine Reform wird eine neue Regelversion.

## GoBD und Aufbewahrung

Arbeitszeiten sind steuerlich relevant, sobald sie Grundlage des Lohns sind (Stundenlohn, Minijob,
Zuschläge; § 41 EStG, § 4 LStDV). Die GoBD verlangen dann Unveränderbarkeit durch Protokollierung
und eine Verfahrensdokumentation (Rz. 107 ff., 151 ff.). Soll löst das so:

- **Audit-Kette**: Jede Schreiboperation hängt in derselben Transaktion ein Kettenglied an (Akteur,
  Zeitpunkt, Tabelle, Zeile, Hash des Inhalts, Hash des Vorgängers); es gibt keinen anderen Weg in
  die Datenbank.
- **Monatsabschluss**: Danach sind die Zeilen gesperrt; eine Korrektur ist ein Gegeneintrag mit Grund.
- **Prüfwert bei den Beschäftigten**: Der Stundenzettel jeder Person trägt den Prüfwert der Kette
  („Nr. 1234 · <SHA-256>“). Wer den Server betreibt, kann seine Datenbank ändern, aber nicht den
  Prüfwert, den die Person schon hat; eine Prüfseite zeigt jede Abweichung.
- **Verfahrensdokumentation** aus dem Stand, Texte aus gobd-kern übernommen.

**Fristen je Monatsabschluss**: 2 Jahre ohne Lohnbezug (§ 16 Abs. 2 ArbZG, § 17 MiLoG), 6 Jahre als
Lohnunterlage, 8 Jahre als Buchungsbeleg (§ 147 Abs. 3 Satz 1 AO, seit 1. Januar 2025); Beginn mit Ablauf des Kalenderjahres.
Nach Ablauf entfernt die Aussonderung den Inhalt; die Kettenglieder bleiben, die Aussonderung steht
selbst in der Kette (Art. 5 Abs. 1 lit. e, Art. 17 DSGVO). Die Kette wird dafür von Anfang an über
den Hash des Inhalts gebildet (S-102), gebaut wird die Aussonderung in S-901.

## Datenmodell

| Tabelle | Inhalt | Schutz |
| --- | --- | --- |
| `betriebe`, `standorte` | Name, Module, Bundesland, Abschluss der Einrichtung; je Standort Name, Adresse, Bundesland und Regionen | Audit-Kette |
| `mitarbeiter` | Eintritt, Austritt, Geburtsdatum, Personalnummer, Art (beschäftigt, extern), Mutterschutz mit Zeitraum | Audit-Kette |
| `arbeitszeitmodelle` | Soll in Minuten je Wochentag, Lohn je Monat oder Stunde in Cent (oder nicht hinterlegt), Minijob, gültig ab; Zuschläge und Pausenabzug folgen mit S-207 und S-208 | Audit-Kette |
| `stempelungen` | Person, Art, Zeitpunkt Server und Gerät, Quelle, Grund bei Nachtrag, Änderung und Entfernung, ersetzte Zeile; für § 17 MiLoG gilt `erstellt_am` als erfasst und das `erstellt_am` der ersetzenden Zeile als ersetzt | Audit-Kette; nur anfügen; gesperrt beim Abschluss |
| `modellzuordnungen` | Person, Arbeitszeitmodell, gültig ab | Audit-Kette |
| `korrekturen` | nach dem Abschluss: Tag, neuer Wert, Grund, Bestätigung | Audit-Kette; nur anfügen |
| `abwesenheiten` | Art, von, bis, halbe Tage, Status, Bescheinigung liegt vor (eAU oder Papier im Büro) | Audit-Kette; im abgeschlossenen Monat gesperrt |
| `schichten`, `schichttausch` | Plan, Rolle, Standort, veröffentlicht am | Audit-Kette |
| `monatsabschluesse` | Summen, Befunde, Bestätigungen, Prüfwert, Frist | Audit-Kette; nur anfügen |
| `konto_anpassungen` | Startsaldo, Auszahlung, Resturlaub | Audit-Kette |
| `kunden`, `projekte`, `taetigkeiten`, `projektzeiten` | Sätze, Budgets, Zeiten, abgerechnet am | Audit-Kette; gesperrt ab „abgerechnet“ |
| `importe` | Tool, Datei-Hash, Zuordnung, Zeitpunkt, wer | Audit-Kette; nur anfügen |
| `jahreswerte` | Mindestlohn, Minijob-Grenze, Kinderkrankentage, Regelversion | keine Tabelle: Daten mit Gültigkeit in `packages/arbeitszeit` (siehe „Entscheidungen“) |

Dauern in ganzen Minuten, Geld in Cent, Urlaub in halben Tagen, Zeitpunkte als UTC-Millisekunden
(Integer), Kalendertage als Text `JJJJ-MM-TT` in `Europe/Berlin`; ein Arbeitstag ist der Tag, an dem
die Schicht beginnt. Der Lohn am Arbeitszeitmodell braucht es für Mindestlohn, Minijob-Grenze und den
steuerfreien Teil der Zuschläge (Grundlohn bis 50 € je Stunde, § 3b Abs. 2 EStG). Die Tabellen von
Better Auth (Benutzer, Sitzungen, Organisationen, Mitglieder) gehören Better Auth, haben keine
`betrieb_id` und stehen nicht in der Audit-Kette; Mitgliedschaft und Rolle schreiben Hooks in die
Kette.

## Import aus anderen Tools

Wer wechselt, soll nichts abtippen. Jeder Import läuft gleich ab (S-701): Tool wählen, Anleitung zum
Export, Datei oder API-Zugang, Zuordnung von Personen, Spalten, Projekten und Abwesenheitsarten,
Vorschau mit den Befunden der Prüfregeln, Probelauf, Übernahme.

| Quelle | Weg | Was übernommen wird |
| --- | --- | --- |
| Excel und CSV | Datei, freie Spaltenzuordnung, Vorlage zum Herunterladen | Zeiten, Projekte |
| Clockodo | Export und REST-API | Mitarbeiter, Zeiten, Abwesenheiten, Kunden, Projekte |
| Personio | Export und API | Mitarbeiter, Anwesenheiten, Abwesenheiten, Salden |
| Kimai | REST-API | Kunden, Projekte, Tätigkeiten, Zeitbuchungen |
| Papershift, Planday, Crewmeister | Export | Mitarbeiter, Schichten, Zeiten, Abwesenheiten |
| Toggl, Clockify | Export und API | Kunden, Projekte, Zeiten (Solo-Modus) |
| Salden zum Stichtag | von Hand oder aus dem Import | Überstunden, Resturlaub |

Regeln für jeden Import:

- **Nachvollziehbar**: Die Originaldatei wird unter ihrem SHA-256 aufbewahrt, jeder Eintrag trägt
  „übernommen aus …“ und seine Kennung im alten Tool; der Import selbst steht unveränderlich in
  `importe`.
- **Wiederholbar**: Ein zweiter Import mit denselben Daten legt nichts doppelt an.
- **Robust**: Kaputte oder böswillige Dateien stürzen nie ab und hängen nie (Fuzzing); ein Fehler
  nennt die Zeile.
- **Ehrlich**: Übernommene Zeiten werden geprüft wie eigene; Verstöße aus der Vergangenheit zeigt die
  Vorschau, ändert sie aber nicht.
- **Abgeschlossen bleibt abgeschlossen**: Übernommene, abgeschlossene Monate werden als übernommen
  gesperrt.

## Anbindungen

| Ziel | Was fließt | Weg |
| --- | --- | --- |
| DATEV Lohn (LODAS, Lohn und Gehalt) | Stunden, Zuschläge nach § 3b EStG, Abwesenheiten je Personalnummer und Lohnart | ASCII-Import-Datei |
| Haben › Zeiteinträge | abrechenbare Projektzeit je Kunde, Stundennachweis | `POST /api/v1/leistungen` mit `source` und `externalId` |
| Kalender | veröffentlichte Schichten, genehmigte Abwesenheiten | ICS-Feed je Mitarbeiter mit geheimem Token |
| Andere Programme, KI-Assistenten | Stempelungen, Abwesenheiten, Schichten, Projektzeit | REST-API mit Token, MCP-Server |
| Prüfung | Zeiten je Person und Zeitraum | CSV und PDF für Zoll und Arbeitsschutz |

## Bauplan im Agenten-Loop

Soll wird als fertiges Produkt gebaut: Ein Agent arbeitet die
[Bauliste](https://github.com/Speicherstadt/soll/blob/main/BAULISTE.md) Punkt für Punkt ab, bis
jedes Häkchen gesetzt und jede Prüfung grün ist. Er wartet nie auf einen Menschen.

1. **Spezifikation zuerst**: `docs/regeln.md` und die Kriterien je Punkt. Ohne Kriterium kein Code.
2. **Ein Durchlauf, ein Punkt**: reservieren (Draft-Pull-Request), Tests zuerst, umsetzen, Doku und
   Texte nachziehen, `bun run check` grün, unabhängiges Review, CI grün, selbst mergen, abhaken.
3. **Entscheiden statt fragen**: offene Fragen nach dem Abschnitt „Entscheidungen“; neue
   Entscheidungen mit Grund dort eintragen.
4. **Nicht hängen bleiben**: dreimal gescheitert heißt zurückgestellt, weiter mit dem nächsten
   unabhängigen Punkt.
5. **Parallel, wo es geht**: Prüfregeln und Oberfläche ab S-104; Abwesenheiten, Dienstplan,
   Projektzeit und Terminal ab S-306; die einzelnen Importe ab S-701.

Reihenfolge: 1 Fundament · 2 Prüfregeln · 3 Arbeitszeit in der App (Stempeln, Abschluss, DATEV) ·
4 Abwesenheiten · 5 Dienstplan · 6 Projektzeit und Anbindungen · 7 Umzug aus anderen Tools ·
8 Tablet-Terminal · 9 Härtung und Betrieb.

Was nur Menschen erledigen können, steht am Ende der Bauliste: Marke, Domain, Übersetzungen durch
Muttersprachler, juristische Durchsicht des Regelwerks, Testimport bei einer Steuerberatung, echte
Exporte als Fixtures, Pilotbetriebe, gehostete Variante.

## Tests

| Art | Was geprüft wird | Werkzeug |
| --- | --- | --- |
| Regeln | jede Regel mit erlaubt, Grenze und Verstoß aus `docs/regeln.md` | Vitest |
| Zeit | Zeitumstellung, Mitternacht, Jahreswechsel, Feiertage 2026 bis 2035 | Vitest |
| Unveränderbarkeit | Schreiben an der Kette vorbei, manipulierte Zeile und Kette, Prüfwert nach Änderung, Aussonderung | Vitest mit SQLite |
| Mandanten | kein Endpunkt liefert Daten eines anderen Betriebs | Vitest mit SQLite |
| Exporte | DATEV und Prüfexport als Golden Files | Vitest |
| Import | Fixtures je Tool, Fuzzing, Wiederholung ohne Dubletten | Vitest, fast-check |
| Abläufe | Einrichtung, Stempeln, offline, Abschluss, Dienstplan, Import, Terminal | Playwright `desktop`, `phone`, `terminal` |
| Barrierefreiheit | jede Seite | axe, `pages`-Check |
| Sprachen | jeder Text in jeder Sprache, Arabisch von rechts nach links | `i18n`-Check, Playwright |
| Last | 50 Betriebe mit je 50 Personen zur selben Minute | Lasttest-Skript mit Bun |

## Dokumentation

Zensical in `docs/`, auf GitHub Pages unter soll.work, nur Deutsch; die Startseite ist zugleich die
Produktseite. Seiten: Überblick, Installation, Einrichtung, Stempeln, Terminal, Abwesenheiten,
Dienstplan, Projektzeit, Umzug aus anderen Tools, DATEV, Haben, Regeln, Datenschutz und
Betriebsvereinbarung, Verfahrensdokumentation, FAQ.

## Offene Fragen

- Marke „Soll“: Eintrag bei DPMA und EUIPO in den Klassen 9 und 42?
- Erreicht der Loop die Schnittstellenbeschreibung von DATEV, oder braucht es eine Freigabe für
  developer.datev.de?
- Stand der Reform des ArbZG zum Start.
