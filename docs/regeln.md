---
title: Regelwerk
description: >-
  Jede Regel, die Soll prüft: Norm, Grenzwerte, Ausnahmen, Schwere und Testfälle mit Quelle – vom
  Arbeitszeitgesetz über Jugend- und Mutterschutz bis zu Mindestlohn, Urlaub und Zuschlägen.
---

# Regelwerk

Soll prüft jede Zeit gegen diese Regeln, beim Stempeln, beim Einplanen und zum Monatsabschluss.
Beim Einplanen (S-502) gelten R-02 bis R-09, R-14 bis R-22 und R-32 für die geplanten Schichten,
zusammen mit dem, was vor heute gestempelt ist; wie Soll eine geplante Schicht liest, steht im
[Dienstplan](dienstplan.md#prufung-beim-einplanen). Jede
Regel hat eine Kennung (`R-…`), ihre Norm, die Grenzwerte, die Ausnahmen und eine **Schwere**:

- **Hinweis**: Etwas ist zu beachten oder bald fällig, ist aber für sich erlaubt (etwa mehr als 8 h
  an einem Tag, die ausgeglichen werden müssen).
- **Verstoß**: Die Zeit ist so nicht erlaubt (etwa mehr als 10 h an einem Tag).

Jeder Befund nennt die Norm auf Deutsch, in jeder Sprache („§ 4 ArbZG“), die Schwere und die
betroffenen Tage. Jede Regel hat mindestens drei Testfälle: **erlaubt**, **Grenze** (genau an der
Grenze) und **Verstoß** (jenseits der Grenze; bei einer Regel der Schwere Hinweis ist das Ergebnis
ein Hinweis, bei einer Berechnung der Teil über der Grenze). Weitere Fälle tragen einen eigenen
Namen. Die Tests in `packages/arbeitszeit` übernehmen sie wörtlich; `scripts/regeln.test.ts` prüft,
dass jede Regel ihre drei Fälle mit Quelle hat und jede Norm des Projektplans eine Regel.

Die Regeln sind Daten mit Gültigkeit: Eine Reform des Arbeitszeitgesetzes wird eine neue
Regelversion (S-104), keine Änderung der alten. Diese Fassung ist die **Regelversion 2026-1**, gültig
ab dem 1. Januar 2026. Grundlage sind die Gesetzestexte auf gesetze-im-internet.de, Stand
20. November 2026. Bei Widerspruch gilt das Gesetz, nicht diese Seite.

## Grundbegriffe

| Begriff | Bedeutung in Soll | Quelle |
| --- | --- | --- |
| Arbeitszeit | Zeit vom Beginn bis zum Ende der Arbeit ohne die Ruhepausen, bei mehreren Arbeitgebern zusammengerechnet | § 2 Abs. 1 ArbZG |
| Arbeitstag | der Kalendertag in `Europe/Berlin`, an dem die Schicht beginnt | CLAUDE.md, „Time“ |
| Schicht | Arbeit von „Kommen“ bis „Gehen“ samt Unterbrechungen; eine Unterbrechung ab 9 h beendet sie (kürzeste Ruhezeit, die das Gesetz überhaupt zulässt), und sie reicht nie 24 h über ihren Beginn hinaus | § 5 Abs. 1, § 7 Abs. 1 Nr. 3 ArbZG; R-01 |
| Werktag | jeder Tag außer Sonntag und gesetzlichem Feiertag, also auch der Samstag | § 3 ArbZG; § 3 Abs. 2 BUrlG |
| Ruhepause | eine im Voraus feststehende Unterbrechung von mindestens 15 Minuten (Jugendliche ebenso) | § 4 Satz 2 ArbZG; § 11 Abs. 1 Satz 3 JArbSchG |
| Bereitschaftsdienst | Warten auf Arbeit an dem Ort, den der Betrieb bestimmt; Arbeitszeit wie jede andere, Arbeitsbereitschaft ebenso | § 2 Abs. 1 ArbZG; EuGH C-151/02; R-11 |
| Rufbereitschaft | erreichbar sein, wo man will; keine Arbeitszeit, nur ihre Einsätze, außer bei einer Reaktionszeit unter 30 min | § 5 Abs. 3 ArbZG; EuGH C-518/15; R-12 |
| Einsatz | Arbeit aus der Rufbereitschaft, vom Anruf bis zum Ende der Arbeit samt Weg hin und zurück; nach ihm beginnt eine neue Ruhezeit | § 5 ArbZG; R-12 |
| Nachtzeit | 23 bis 6 Uhr, in Bäckereien und Konditoreien 22 bis 5 Uhr | § 2 Abs. 3 ArbZG |
| Nachtarbeit | Arbeit mit mehr als zwei Stunden in der Nachtzeit | § 2 Abs. 4 ArbZG |
| Nachtarbeitnehmer | wer normalerweise Nachtarbeit in Wechselschicht leistet oder an mindestens 48 Tagen im Kalenderjahr | § 2 Abs. 5 ArbZG |
| Jugendlicher | wer 15, aber noch nicht 18 Jahre alt ist (Geburtsdatum am Mitarbeiter) | § 2 Abs. 2 JArbSchG |
| Doppelwoche | zwei aufeinanderfolgende Wochen, Sonntage eingerechnet | § 4 Abs. 1 Satz 3 MuSchG |
| Nachtarbeit (Steuer) | 20 bis 6 Uhr, für die steuerfreien Zuschläge; nicht die Nachtzeit des ArbZG | § 3b Abs. 2 Satz 2 EStG |
| Grundlohn | laufender Arbeitslohn bei der regelmäßigen Arbeitszeit des Lohnzahlungszeitraums, umgerechnet in einen Stundenlohn (beim Monatslohn durch die Wochenstunden × 4,35), für die Steuerfreiheit höchstens 50 € je Stunde | § 3b Abs. 2 Satz 1 EStG; R 3b Abs. 2 LStR |

Dauern rechnet Soll in ganzen Minuten. Gerundet wird nie zulasten der Beschäftigten (CLAUDE.md).

## Übersicht

| Regel | Inhalt | Norm | Schwere |
| --- | --- | --- | --- |
| R-01 | Beginn, Ende und Dauer jedes Arbeitstags erfasst | BAG 1 ABR 22/21; § 3 Abs. 2 Nr. 1 ArbSchG; EuGH C-55/18 | Hinweis |
| R-02 | Höchstarbeitszeit am Tag | § 3 ArbZG | Hinweis / Verstoß |
| R-03 | Ausgleichszeitraum 6 Monate oder 24 Wochen | § 3 Satz 2 ArbZG | Hinweis / Verstoß |
| R-04 | Ruhepausen | § 4 ArbZG | Verstoß |
| R-05 | Ruhezeit 11 h | § 5 ArbZG | Hinweis / Verstoß |
| R-06 | Arbeitszeit der Nachtarbeitnehmer | §§ 2, 6 Abs. 2 ArbZG | Hinweis / Verstoß |
| R-07 | Sonn- und Feiertagsruhe | §§ 9, 10 ArbZG | Verstoß |
| R-08 | 15 beschäftigungsfreie Sonntage | § 11 Abs. 1 ArbZG | Hinweis / Verstoß |
| R-09 | Ersatzruhetag | § 11 Abs. 3 ArbZG | Hinweis / Verstoß |
| R-10 | Aufzeichnung über 8 h und Aufbewahrung 2 Jahre | § 16 Abs. 2 ArbZG | Verstoß |
| R-11 | Bereitschaftsdienst ist Arbeitszeit | §§ 2, 7 ArbZG; EuGH C-151/02, C-518/15 | Hinweis / Verstoß |
| R-12 | Rufbereitschaft: Einsätze sind Arbeitszeit und unterbrechen die Ruhezeit | §§ 2, 5 ArbZG; EuGH C-518/15 | Hinweis / Verstoß |
| R-13 | Aufzeichnung binnen 7 Tagen bei Minijob und in Branchen | § 17 Abs. 1 MiLoG; § 2a SchwarzArbG | Hinweis / Verstoß |
| R-14 | Mindestlohn je Monat | § 1 MiLoG | Verstoß |
| R-15 | Jugendliche: Arbeitszeit | § 8 JArbSchG | Verstoß |
| R-16 | Jugendliche: Ruhepausen | § 11 JArbSchG | Verstoß |
| R-17 | Jugendliche: Schichtzeit | § 12 JArbSchG | Verstoß |
| R-18 | Jugendliche: tägliche Freizeit 12 h | § 13 JArbSchG | Verstoß |
| R-19 | Jugendliche: Nachtruhe | § 14 JArbSchG | Verstoß |
| R-20 | Jugendliche: Fünf-Tage-Woche, Samstag, Sonntag, Feiertag | §§ 15 bis 18 JArbSchG | Verstoß |
| R-21 | Mutterschutz: Arbeitszeit, Ruhezeit, Nacht, Sonn- und Feiertage, Schutzfristen | §§ 3 bis 6 MuSchG | Verstoß |
| R-22 | Arbeit auf Abruf: 4 Tage Vorlauf, 3 Stunden am Stück | § 12 Abs. 1, 3 TzBfG | Hinweis |
| R-23 | Urlaub: Mindesturlaub, Teilurlaub, Übertragung | §§ 3, 5, 7 BUrlG | Hinweis |
| R-24 | Krank im Urlaub | § 9 BUrlG | Hinweis |
| R-25 | Zusatzurlaub schwerbehinderter Menschen | § 208 SGB IX | Hinweis |
| R-26 | Kürzung des Urlaubs bei Elternzeit | § 17 Abs. 1 BEEG | Hinweis |
| R-27 | Bescheinigung der Arbeitsunfähigkeit ab dem 4. Tag, eAU | § 5 EntgFG; § 109 SGB IV | Hinweis |
| R-28 | Kinderkrankentage | § 45 Abs. 2, 2a SGB V | Hinweis |
| R-29 | Steuerfreie Zuschläge | § 3b EStG; R 3b LStR | – (Berechnung) |
| R-30 | Auswertung je Person nur eingeschaltet | § 87 Abs. 1 Nr. 6 BetrVG | Verstoß |
| R-31 | Gesundheitsdaten, Auskunft, Löschen | Art. 5, 9, 15, 17, 88 DSGVO | Verstoß |
| R-32 | Minijob-Grenze, gelegentliches Überschreiten | § 8 Abs. 1, 1a, 1b SGB IV | Hinweis / Verstoß |
| R-33 | Soll, Ist und Überstundenkonto | § 611a Abs. 1 BGB; § 2 Abs. 1 EntgFG | – (Berechnung) |

Jede Norm der Tabelle „Rechtlicher Rahmen“ im [Projektplan](plan.md#rechtlicher-rahmen) hat eine
Regel:

| Norm im Projektplan | Regel |
| --- | --- |
| BAG 1 ABR 22/21; § 3 Abs. 2 Nr. 1 ArbSchG; EuGH C-55/18 | R-01 |
| § 3 ArbZG | R-02, R-03 |
| § 4 ArbZG | R-04 |
| § 5 ArbZG | R-05, R-12 |
| §§ 2, 6 ArbZG | R-06 |
| §§ 9 bis 11 ArbZG | R-07, R-08, R-09 |
| § 16 Abs. 2 ArbZG | R-10 |
| §§ 2, 5, 7 ArbZG; EuGH C-151/02, C-518/15 | R-11, R-12 |
| §§ 1, 17 MiLoG; § 2a SchwarzArbG | R-13, R-14 |
| §§ 8, 11 bis 14 JArbSchG | R-15 bis R-19 (dazu R-20 für §§ 15 bis 18) |
| §§ 4 bis 6 MuSchG | R-21 |
| § 12 Abs. 3 TzBfG | R-22 |
| §§ 3, 5, 7, 9 BUrlG; § 208 SGB IX; § 17 BEEG | R-23, R-24, R-25, R-26 |
| § 5 EntgFG; § 109 SGB IV | R-27 |
| § 45 SGB V | R-28 |
| § 3b EStG, R 3b LStR | R-29 |
| § 87 Abs. 1 Nr. 6 BetrVG | R-30 |
| Art. 5, 9, 15, 17, 88 DSGVO | R-31 |
| § 8 Abs. 1, 1a, 1b SGB IV | R-32 |

## Arbeitszeitgesetz

### R-01 Erfassung von Beginn, Ende und Dauer

- **Norm**: BAG, Beschluss vom 13.09.2022, 1 ABR 22/21; § 3 Abs. 2 Nr. 1 ArbSchG („für eine
  geeignete Organisation zu sorgen“); EuGH, Urteil vom 14.05.2019, C-55/18 (CCOO).
- **Regel**: Jeder Arbeitstag hat Beginn, Ende und Dauer. Ein Tag mit „Kommen“ ohne „Gehen“ ist
  unvollständig.
- **Arbeitstag aus Stempelungen** (S-201): Soll liest die Stempelungen in zeitlicher Reihenfolge,
  gleich in welcher sie ankommen. „Kommen“ bis „Gehen“ und „Pause-Ende“ bis „Pause-Beginn“ sind
  Arbeit; dazwischen liegt eine gestempelte Pause oder eine Lücke zwischen zwei Paaren. Eine
  Unterbrechung unter 9 h gehört zur Schicht, auch über Mitternacht; die ganze Schicht zählt zum
  Tag, an dem sie beginnt. Gezählt werden echte Minuten, auch über die Zeitumstellung. Beginne
  zählen ab der angefangenen Minute, Enden bis zur nächsten vollen (nie zulasten der
  Beschäftigten); eine Unterbrechung unter 15 min ist Arbeitszeit (R-04). Eine wiederholte Stempelung
  derselben Art zählt so, dass mehr Arbeitszeit entsteht (frühester Beginn, spätestes Ende), mit
  Hinweis; dieselbe Art zweimal in derselben Minute ist ein doppelter Tipp und kein Befund; es zählt der erste Tipp. „Kommen“
  während einer Pause beendet die Pause. Was fehlt, ergänzt Soll nie: Ein „Gehen“ ohne „Kommen“,
  ein „Pause-Ende“ ohne „Pause-Beginn“ und ein „Gehen“ während der Pause sind Hinweise, und die
  Zeit, deren Ende nicht feststeht, zählt nicht.
- **Grenzwerte**: Ein offener Tag gilt ab 0 Uhr des Folgetags als unvollständig, eine laufende
  Nachtschicht erst 16 h nach ihrem Beginn (danach ist ein vergessenes „Gehen“ wahrscheinlich).
  Soll nimmt den späteren der beiden Zeitpunkte: Eine Schicht, die um Mitternacht noch läuft, ist
  eine Nachtschicht. Dasselbe gilt für eine Pause ohne Ende. Spätestens 24 h nach Beginn ist es
  ein Befund, auch wenn Mitternacht später liegt (Tag der Zeitumstellung im Oktober): Danach kann
  keine Stempelung die Schicht mehr beenden.
- **Ausnahmen**: keine. Soll stempelt nie selbst aus (CLAUDE.md), es erinnert nur (S-307).
- **Schwere**: Hinweis an die Person und den Betrieb; zum Monatsabschluss sperrt ein unvollständiger
  Tag die Bestätigung, bis er nachgetragen ist.

| Fall | Stempelungen | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo 8:00 Kommen, 16:30 Gehen | kein Befund, Dauer 8:30 abzüglich Pausen | BAG 1 ABR 22/21, Rn. 64 (Beginn, Ende, Dauer) |
| Grenze | Nachtschicht Mo 22:00 Kommen, Di 13:59 noch offen (15:59 h) | kein Befund | Grenzwert dieser Regel |
| Verstoß | Mo 8:00 Kommen, kein Gehen, Di 0:00 | Hinweis „Gehen fehlt“ für Mo | § 3 Abs. 2 Nr. 1 ArbSchG |
| Herbst | Sa 24.10.2026 22:00 Kommen, So 25.10. 6:00 Gehen | 9:00 Arbeitszeit, Arbeitstag Sa 24.10. | § 2 Abs. 1 ArbZG; SoZV (Ende der Sommerzeit 3:00 MESZ) |
| Frühjahr | Sa 27.03.2027 22:00 Kommen, So 28.03. 6:00 Gehen | 7:00 Arbeitszeit, Arbeitstag Sa 27.03. | § 2 Abs. 1 ArbZG; SoZV (Beginn der Sommerzeit 2:00 MEZ) |
| doppelte Stunde | So 25.10.2026 2:30 MESZ Kommen, 2:30 MEZ Gehen | 1:00 Arbeitszeit | SoZV (die Stunde von 2 bis 3 Uhr kommt zweimal) |
| Pause | Mo 8:00 Kommen, 12:00 Pause, 12:30 Pause-Ende, 16:30 Gehen | 8:00 Arbeitszeit, 30 min Pause (gestempelt) | § 2 Abs. 1 ArbZG |
| Lücke | Mo 8:00 Kommen, 12:00 Gehen, 12:30 Kommen, 16:30 Gehen | 8:00 Arbeitszeit, 30 min Pause (Lücke) | § 2 Abs. 1 ArbZG |
| Teile | Mo 8:00 Kommen, 10:00 Pause, 10:15 Pause-Ende, 12:00 Gehen, 12:30 Kommen, 16:30 Gehen | Arbeit 120, 105 und 240 min, Pausen 15 und 30 min, 7:45 Arbeitszeit | § 2 Abs. 1 ArbZG |
| kurze Pause | Mo 8:00 Kommen, 12:00 Pause, 12:14 Pause-Ende, 16:00 Gehen | 8:00 Arbeitszeit, keine Pause | § 4 Satz 2 ArbZG |
| über Mitternacht | Mo 18:00 Kommen, 23:30 Gehen, Di 0:15 Kommen, 3:00 Gehen | eine Schicht am Mo: 8:15 Arbeitszeit, 45 min Pause | Grundbegriff „Schicht“ |
| zwei Schichten | Mo 5:00 Kommen, 8:00 Gehen, 17:00 Kommen, 21:00 Gehen | zwei Schichten am Mo, 7:00 Arbeitszeit, keine Pause | Grundbegriff „Schicht“; § 7 Abs. 1 Nr. 3 ArbZG |
| neue Schicht | Mo 22:00 Kommen, Di 6:00 Gehen, Di 15:00 Kommen, 23:00 Gehen | Mo 8:00, Di 8:00 Arbeitszeit | Grundbegriff „Schicht“; § 5 Abs. 1 ArbZG |
| 24 h | Mo 8:00 Kommen, Di 8:00 Kommen, 16:00 Gehen | Hinweis „Gehen fehlt“ für Mo (0:00 gezählt), Di 8:00 Arbeitszeit | Grundbegriff „Schicht“; § 3 Abs. 2 Nr. 1 ArbSchG |
| 24 h, Gehen | Mo 8:00 Kommen, Mi 8:00 Gehen | Hinweis „Gehen fehlt“ für Mo, „Kommen fehlt“ für Mi | Grundbegriff „Schicht“; § 3 Abs. 2 Nr. 1 ArbSchG |
| 24 h, Zeitumstellung | So 25.10.2026 0:30 MESZ Kommen, kein Gehen, So 23:30 MEZ | Hinweis „Gehen fehlt“ für So (24 h nach Beginn, vor Mitternacht) | Grundbegriff „Schicht“; § 3 Abs. 2 Nr. 1 ArbSchG |
| 9 h, Gehen | Mo 8:00 Kommen, 12:00 Gehen, Di 7:30 Gehen | Mo 4:00 Arbeitszeit, vollständig; Hinweis „Kommen fehlt“ für Di | Grundbegriff „Schicht“; § 3 Abs. 2 Nr. 1 ArbSchG |
| 9 h, Pause | Mo 8:00 Kommen, 12:00 Pause, Di 7:00 Kommen, 15:00 Gehen | Hinweis „Pause-Ende fehlt“ für Mo (4:00 gezählt), Di 8:00 Arbeitszeit | Grundbegriff „Schicht“; § 3 Abs. 2 Nr. 1 ArbSchG |
| 24 h, Sekunden | Mo 8:00:30 Kommen, Di 8:00:30 Gehen und Kommen, 12:00 Gehen | Mo 24:00, Di 4:00 Arbeitszeit: die Minute ab 8:00 zählt einmal, bei Di | Grundbegriff „Schicht“; CLAUDE.md (nie zulasten der Beschäftigten) |
| ungeordnet | dieselben Stempelungen in anderer Reihenfolge | dasselbe Ergebnis | Regel dieser Seite |
| doppelter Tipp | Mo 8:00:05 und 8:00:40 Kommen, 16:00 Gehen | kein Befund, 8:00 Arbeitszeit | Regel dieser Seite |
| doppelter Tipp, 9 h | Mo 7:00 Kommen, 16:00:05 und 16:00:50 Gehen, Di 1:00:20 Kommen, 5:00 Gehen | zwei Schichten wie ohne den zweiten Tipp: Mo 9:01, Di 4:00 Arbeitszeit | Grundbegriff „Schicht“; Regel dieser Seite |
| doppelt | Mo 8:00 und 8:10 Kommen, 16:00 und 16:20 Gehen | Hinweis „doppelt“ je Wiederholung, 8:20 Arbeitszeit, Tag vollständig | CLAUDE.md (nie zulasten der Beschäftigten) |
| Kommen fehlt | Mo 16:00 Gehen, sonst nichts | Hinweis „Kommen fehlt“ für Mo, Tag unvollständig | § 3 Abs. 2 Nr. 1 ArbSchG |
| Pause-Ende fehlt | Mo 22:00 Kommen, 23:30 Pause, Di 6:00 Gehen | Hinweis „Pause-Ende fehlt“ für Mo, 1:30 Arbeitszeit, Tag unvollständig | § 3 Abs. 2 Nr. 1 ArbSchG |
| Minuten | Mo 8:00:59 Kommen, 16:00:01 Gehen | 8:01 Arbeitszeit | CLAUDE.md (nie zulasten der Beschäftigten) |

### R-02 Höchstarbeitszeit am Tag

- **Norm**: § 3 ArbZG: „Die werktägliche Arbeitszeit der Arbeitnehmer darf acht Stunden nicht
  überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn innerhalb von sechs
  Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht
  überschritten werden.“
- **Grenzwerte**: bis 8:00 kein Befund; über 8:00 bis 10:00 Hinweis (Ausgleich nötig, R-03); über
  10:00 Verstoß. Sonn- und Feiertagsarbeit zählt mit (§ 11 Abs. 2 ArbZG). Gemessen wird die
  Arbeitszeit aller Schichten, die am Arbeitstag beginnen, in echten Minuten (S-201).
- **Ausnahmen**: Tarifvertrag oder Betriebsvereinbarung nach § 7 Abs. 1 Nr. 1 ArbZG (über 10 h bei
  Arbeitsbereitschaft oder Bereitschaftsdienst) als Einstellung des Betriebs mit Fundstelle; ohne
  diese Einstellung gilt der Grenzwert.
- **Schwere**: Hinweis über 8 h, Verstoß über 10 h.

| Fall | Arbeitszeit am Tag | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 7:59 | kein Befund | § 3 Satz 1 ArbZG |
| Grenze | 8:00 | kein Befund | § 3 Satz 1 ArbZG („nicht überschreiten“) |
| Hinweis | 8:01 | Hinweis „über 8 h, Ausgleich nötig“ | § 3 Satz 2 ArbZG |
| Grenze | 10:00 | Hinweis | § 3 Satz 2 ArbZG („bis zu zehn Stunden“) |
| Verstoß | 10:01 | Verstoß „über 10 h“ | § 3 Satz 2 ArbZG |
| Herbst | Sa 24.10.2026 22:00 – So 7:00 (10:00 echte Zeit) | Hinweis für Sa | § 3 ArbZG; SoZV (Ende der Sommerzeit) |
| Frühjahr | Sa 27.03.2027 22:00 – So 7:00 (8:00 echte Zeit) | kein Befund | § 3 ArbZG; SoZV (Beginn der Sommerzeit) |
| Sonntag | So 8:00 – 18:01 | Verstoß „über 10 h“ für So | § 11 Abs. 2 ArbZG |

### R-03 Ausgleichszeitraum

- **Norm**: § 3 Satz 2 ArbZG; § 11 Abs. 2 ArbZG (Sonn- und Feiertagsarbeit zählt mit).
- **Regel**: Im Durchschnitt von sechs Kalendermonaten oder von 24 Wochen höchstens 8 h je Werktag,
  also höchstens 48 h je Woche mit sechs Werktagen. Der Betrieb wählt den Zeitraum; ohne Wahl prüft
  Soll beide und meldet nur, wenn **beide** überschritten sind (das Gesetz lässt jeden genügen).
- **Grenzwerte**: Summe der Arbeitszeit im Zeitraum ≤ 8 h × Zahl der Werktage im Zeitraum. Urlaubs-
  und Krankheitstage sind neutral: Soll nimmt sie samt ihrer Zeit aus dem Zeitraum heraus, sie
  senken den Durchschnitt nicht und sind kein Ausgleich (Art. 16 Buchst. b Unterabs. 2
  RL 2003/88/EG; BVerwG, 09.05.2018, 8 C 13/17; Soll behandelt auch übergesetzlichen Urlaub so,
  vorsichtige Auslegung).
- **Lage der Zeiträume**: Die Zeiträume folgen lückenlos aufeinander, ab einem Beginn am Betrieb
  (Einstellung; ohne sie der 1. Januar 2026): sechs Kalendermonate ab dem Ersten des Monats, in den
  der Beginn fällt (ohne Einstellung also Kalenderhalbjahre), 24 Wochen (168 Tage) ab dem Beginn
  selbst. Werktage sind alle Tage außer Sonntagen und den Feiertagen am Standort. Ohne Wahl zählt
  ein überschrittener Zeitraum nur, wenn auch ein Zeitraum der anderen Art überschritten ist,
  gleich ob sich die beiden überschneiden (dann verstößt jede der beiden Wahlen): Verstoß, wenn
  beide beendet sind, sonst Hinweis.
- **Laufender Zeitraum**: Der Hinweis kommt, sobald die Arbeitszeit seit Beginn des Zeitraums mehr
  als 8 h je bisherigem Werktag beträgt, bei geplanten Schichten (S-502) bis zum letzten geplanten
  Tag. Er nennt die Minuten, die bis zum Ende des Zeitraums auszugleichen sind.
- **Ausnahmen**: anderer Ausgleichszeitraum nach § 7 Abs. 1 Nr. 1 Buchst. b ArbZG (Einstellung).
- **Schwere**: Hinweis, sobald der laufende Zeitraum ohne Ausgleich überschritten würde; Verstoß,
  wenn der Zeitraum endet und der Durchschnitt über 8 h liegt.

| Fall | 24 Wochen, je 6 Werktage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 12 Wochen mit 50 h, 12 Wochen mit 40 h (Ø 45 h) | kein Befund | § 3 Satz 2 ArbZG |
| Grenze | 24 Wochen mit Ø 48:00 h (1152 h) | kein Befund | § 3 Satz 2 ArbZG („nicht überschritten“) |
| Verstoß | 24 Wochen mit 1152 h und 1 Minute | Verstoß „Ausgleich nicht erreicht“ | § 3 Satz 2 ArbZG |
| Urlaub | 22 Wochen mit 1056 h und 1 Minute, 2 Wochen Urlaub | Verstoß „Ausgleich nicht erreicht“ (Ø über 48 h in den 22 Wochen ohne Urlaub) | Art. 16 Buchst. b Unterabs. 2 RL 2003/88/EG |
| Hinweis | 12 Wochen mit 50 h, der Zeitraum läuft noch | Hinweis „Ausgleich offen“: 24 h bis zum Ende der 24 Wochen auszugleichen | § 3 Satz 2 ArbZG |
| Feiertag | Hamburg, erstes Halbjahr 2026: 8 h an jedem Werktag, dazu 4 h am Karfreitag | Verstoß „Ausgleich nicht erreicht“ für den Karfreitag (kein Werktag, seine Arbeit zählt) | § 3 ArbZG („werktäglich“); § 11 Abs. 2 ArbZG |
| ohne Wahl | 24 Wochen ab 1.1.2026 um 8 h über dem Schnitt, die sechs Kalendermonate bis 30.6. darunter | kein Befund; mit gewählten 24 Wochen Verstoß | § 3 Satz 2 ArbZG („oder“) |
| ohne Wahl | 1.1.2026 bis 30.6.2027 8 h an jedem Werktag, dazu 9 h am 22.6. und 15.12.2026, 7 h am 15.9.2026: nur das Halbjahr bis 30.6.2026 und nur die 24 Wochen ab 3.12.2026 sind überschritten, sie überschneiden sich nicht | Verstoß für beide (jede Wahl hätte einen Verstoß) | § 3 Satz 2 ArbZG („oder“) |

### R-04 Ruhepausen

- **Norm**: § 4 ArbZG: Ruhepausen „von mindestens 30 Minuten bei einer Arbeitszeit von mehr als
  sechs bis zu neun Stunden und 45 Minuten bei einer Arbeitszeit von mehr als neun Stunden“; Blöcke
  von mindestens 15 Minuten; „Länger als sechs Stunden hintereinander dürfen Arbeitnehmer nicht ohne
  Ruhepause beschäftigt werden.“
- **Grenzwerte**: Arbeitszeit bis 6:00 keine Pause; über 6:00 bis 9:00 mindestens 30 min; über 9:00
  mindestens 45 min. Eine Unterbrechung unter 15 min zählt nicht als Pause, sondern als Arbeitszeit
  (das ändert auch die Dauer). Kein Block ohne Pause über 6:00.
- **Je Schicht**: Soll misst § 4 an jeder Schicht für sich. Zwischen zwei Schichten eines Tages
  liegen mindestens 9 h (Grundbegriff „Schicht“), mehr als jede Pause, die das Gesetz verlangt.
  Eine Lücke zwischen zwei Paaren von mindestens 15 min ist eine Ruhepause wie eine gestempelte.
- **Ausnahmen**: Kurzpausen in Schicht- und Verkehrsbetrieben nach § 7 Abs. 1 Nr. 2 ArbZG
  (Einstellung). Ein automatischer Pausenabzug am Arbeitszeitmodell gleicht eine fehlende Pause
  nicht aus: Soll zieht sie ab und meldet sie trotzdem, wenn sie nicht gestempelt ist.
- **Schwere**: Verstoß. Beim Stempeln zeigt Soll vorher, wie viel Pause noch fehlt („Pause fehlt
  noch 15 min · § 4 ArbZG“).

| Fall | Arbeitszeit und Pausen | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 6:00 Arbeit, keine Pause | kein Befund | § 4 Satz 1 ArbZG („mehr als sechs“) |
| Grenze | 6:01 Arbeit, 30 min Pause | kein Befund | § 4 Satz 1 ArbZG |
| Verstoß | 6:01 Arbeit, 29 min Pause | Verstoß „Pause fehlt 1 min“ | § 4 Satz 1 ArbZG |
| Grenze | 9:00 Arbeit, 30 min Pause | kein Befund | § 4 Satz 1 ArbZG („bis zu neun“) |
| Verstoß | 9:01 Arbeit, 30 min Pause | Verstoß „Pause fehlt 15 min“ | § 4 Satz 1 ArbZG („mehr als neun“) |
| Grenze | 2 × 15 min Pause bei 8:00 Arbeit | kein Befund | § 4 Satz 2 ArbZG |
| Verstoß | 14 min + 16 min Pause bei 8:00 Arbeit | Verstoß; die 14 min zählen als Arbeitszeit | § 4 Satz 2 ArbZG |
| Verstoß | 8:00 bis 14:01 ohne Pause, dann 30 min | Verstoß „über 6 h ohne Pause“ | § 4 Satz 3 ArbZG |
| ohne Pause | 8:00 bis 14:01 ohne Pause, dann Feierabend | Verstoß „Pause fehlt 30 min“ und Verstoß „über 6 h ohne Pause“ | § 4 Satz 1 und 3 ArbZG |
| zwei Schichten | Mo 5:00 – 8:00 und 17:00 – 21:00 (7:00 Arbeit) | kein Befund | § 4 Satz 1 ArbZG; Grundbegriff „Schicht“ |
| über Mitternacht | Mo 20:00 – Di 4:30, Pause 23:45 – 0:15 | kein Befund, die Pause gehört zur Schicht vom Mo | § 4 Satz 1 ArbZG; Grundbegriff „Arbeitstag“ |
| Herbst | Sa 24.10.2026 22:00 – So 5:00 ohne Pause (8:00 echte Zeit) | Verstoß „Pause fehlt 30 min“ und „über 6 h ohne Pause“ für Sa | § 4 ArbZG; SoZV (Ende der Sommerzeit) |

### R-05 Ruhezeit

- **Norm**: § 5 Abs. 1 ArbZG: „ununterbrochene Ruhezeit von mindestens elf Stunden“ nach Ende der
  täglichen Arbeitszeit.
- **Grenzwerte**: vom letzten „Gehen“ eines Arbeitstags bis zum ersten „Kommen“ des nächsten
  mindestens 11:00, auch zwischen zwei Schichten desselben Kalendertags (zwei Arbeitstage nach den
  9 h von R-01). Ein Einsatz in der Rufbereitschaft beendet die Ruhezeit (R-12).
- **Ausnahmen**: § 5 Abs. 2 ArbZG: in Krankenhäusern, Pflege, Gastronomie und Beherbergung,
  Verkehr, Rundfunk, Landwirtschaft und Tierhaltung bis 10:00, wenn jede Verkürzung innerhalb eines
  Kalendermonats oder von vier Wochen durch eine Ruhezeit von mindestens 12:00 ausgeglichen wird
  (Branche am Betrieb). § 7 Abs. 1 Nr. 3 ArbZG (Tarif, bis 9:00) als Einstellung.
- **Ausgleich nach § 5 Abs. 2**: Jede Verkürzung braucht eine eigene spätere Ruhezeit von
  mindestens 12:00, deren erste 12:00 im Ausgleichszeitraum liegen: im Kalendermonat, in dem die verkürzte
  Ruhezeit beginnt, oder in vier Wochen ab diesem Tag (28 Tage). Der Betrieb wählt; ohne Wahl genügt
  jeder der beiden (wie R-03), der Verstoß kommt erst, wenn beide abgelaufen sind. Soll zählt nur
  einen Ausgleich nach der Verkürzung (vorsichtige Auslegung). Auch die Ruhezeit nach dem letzten
  „Gehen“ zählt, sobald 12:00 vergangen sind, ehe die nächste Schicht beginnt. Ohne Branche am
  Betrieb gilt keine Verkürzung.
- **Offene Schicht**: Das Ende einer offenen Schicht steht nicht fest (R-01); die Ruhezeit danach
  misst Soll erst nach dem „Gehen“. Ihr „Kommen“ beendet die Ruhezeit davor.
- **Schwere**: Verstoß unter 11:00 (mit Branchenausnahme unter 10:00); mit Branchenausnahme zwischen
  10:00 und 11:00 Hinweis „Ausgleich bis … nötig“, Verstoß, wenn der Ausgleich ausbleibt.

| Fall | Ende – nächster Beginn | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo 22:00 – Di 10:00 (12:00) | kein Befund | § 5 Abs. 1 ArbZG |
| Grenze | Mo 22:00 – Di 9:00 (11:00) | kein Befund | § 5 Abs. 1 ArbZG („mindestens elf“) |
| Verstoß | Mo 22:00 – Di 8:59 (10:59) | Verstoß „Ruhezeit 10:59“ | § 5 Abs. 1 ArbZG |
| Gastronomie | Mo 23:00 – Di 9:00 (10:00), Ausgleich am Do mit 12:00 | Hinweis, nach dem Ausgleich keiner | § 5 Abs. 2 ArbZG |
| Gastronomie | 10:00 ohne Ausgleich im Kalendermonat | Verstoß am Monatsende | § 5 Abs. 2 ArbZG |
| unter 10 h | Gastronomie, Mo 23:00 – Di 8:59 (9:59) | Verstoß „Ruhezeit 9:59“ | § 5 Abs. 2 ArbZG („um bis zu eine Stunde“) |
| ohne Branche | Betrieb ohne Branche nach § 5 Abs. 2, Mo 23:00 – Di 9:00 (10:00) | Verstoß „Ruhezeit 10:00“ | § 5 Abs. 1 ArbZG |
| vier Wochen | Gastronomie, Fr 20.11.2026 23:00 – Sa 9:00 (10:00), die nächste Ruhezeit von 12:00 ab Di 1.12. 22:00 | kein Befund; mit gewähltem Kalendermonat Verstoß ab 1.12. | § 5 Abs. 2 ArbZG („oder innerhalb von vier Wochen“) |
| je Verkürzung | Gastronomie, zwei Verkürzungen nacheinander, danach eine Ruhezeit von 16:00 | Hinweis für die zweite Verkürzung | § 5 Abs. 2 ArbZG („jede Verkürzung“) |
| über Mitternacht | Mo 16:00 – Di 0:30, Di 11:00 Kommen (10:30) | Verstoß „Ruhezeit 10:30“ für Mo und Di | § 5 Abs. 1 ArbZG; Grundbegriff „Arbeitstag“ |
| am selben Tag | Mo 0:00 – 4:00, Mo 14:00 – 22:00 (10:00), Di 6:00 – 12:00 gehört zur zweiten Schicht | Verstoß „Ruhezeit 10:00“ für Mo | § 5 Abs. 1 ArbZG; R-01 (Schicht ab 9 h Unterbrechung) |
| Herbst | Sa 24.10.2026 22:00 – So 8:00 (11:00 echte Zeit) | kein Befund | § 5 Abs. 1 ArbZG; SoZV (Ende der Sommerzeit) |
| Frühjahr | Sa 27.03.2027 22:00 – So 9:00 (10:00 echte Zeit) | Verstoß „Ruhezeit 10:00“ | § 5 Abs. 1 ArbZG; SoZV (Beginn der Sommerzeit) |

### R-06 Arbeitszeit der Nachtarbeitnehmer

- **Norm**: § 2 Abs. 3 bis 5 ArbZG; § 6 Abs. 2 ArbZG: werktäglich 8 h, bis 10 h nur, wenn „innerhalb
  von einem Kalendermonat oder innerhalb von vier Wochen im Durchschnitt acht Stunden werktäglich
  nicht überschritten werden“.
- **Regel**: Nachtarbeit ist eine Schicht mit mehr als 2:00 zwischen 23 und 6 Uhr (Bäckerei 22 bis
  5 Uhr). Nachtarbeitnehmer ist, wer Nachtarbeit in Wechselschicht leistet (Merkmal am Mitarbeiter)
  oder an mindestens 48 Tagen im Kalenderjahr; Soll zählt die Tage mit.
- **Messung**: Die Nachtzeit ist Uhrzeit in `Europe/Berlin`, gezählt werden echte Minuten der Arbeit
  einer Schicht in ihr (Unterbrechungen unter 15 min eingerechnet, Ruhepausen nicht), auch über die
  Zeitumstellung. Nachtarbeit ist je Schicht; ein Nachtarbeitstag ist der Arbeitstag (Starttag) einer
  solchen Schicht.
- **Nachtarbeitnehmer**: mit dem Merkmal „Wechselschicht“ am Mitarbeiter (ohne Merkmal: nein) von
  Anfang an; sonst ab dem 48. Nachtarbeitstag des Kalenderjahrs bis zu seinem Ende und das ganze
  folgende Jahr (wer im Vorjahr 48 Nächte hatte, wird sie wieder haben; das Gesetz fragt nach dem
  laufenden Jahr, vorsichtige Auslegung). Ein Hinweis am 40. Nachtarbeitstag („bald
  Nachtarbeitnehmer“) und einer am 48. („Nachtarbeitnehmer“), je einmal im Jahr.
- **Grenzwerte**: wie R-02, aber Ausgleich in einem Kalendermonat oder vier Wochen. Die vier Wochen
  (28 Tage) folgen lückenlos aufeinander ab einem Beginn am Betrieb (ohne Einstellung der
  1. Januar 2026), der Kalendermonat ist der Monat selbst. Werktage, Sonn- und Feiertagsarbeit und
  Urlaubs- und Krankheitstage zählen wie in R-03; ohne Wahl des Betriebs zählt ein überschrittener
  Zeitraum nur, wenn auch einer der anderen Art überschritten ist (wie R-03).
- **Ausnahmen**: § 7 Abs. 1 Nr. 4 ArbZG (Einstellung); Zeiträume ohne Nachtarbeit für Nachtarbeitnehmer
  nach § 2 Abs. 5 Nr. 2 prüft Soll mit § 3 Satz 2 (§ 6 Abs. 2 Satz 3 ArbZG): R-06 prüft nur Zeiträume
  mit einem Nachtarbeitstag als Nachtarbeitnehmer, bei Wechselschicht jeden.
- **Schwere**: Hinweis über 8 h und ab dem 40. Nachtarbeitstag im Jahr („bald Nachtarbeitnehmer“);
  Verstoß über 10 h oder ohne Ausgleich am Ende des Monats oder der vier Wochen. Solange der Zeitraum
  läuft und schon über dem Durchschnitt liegt, ein Hinweis „Ausgleich offen“ (wie R-03).

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 21:00 – 1:00 (2:00 Nachtzeit) | keine Nachtarbeit | § 2 Abs. 4 ArbZG („mehr als zwei“) |
| Grenze | 21:00 – 1:01 (2:01 Nachtzeit) | Nachtarbeit, zählt als Nachtarbeitstag | § 2 Abs. 4 ArbZG |
| Grenze | 48. Nachtarbeitstag im Kalenderjahr | ab jetzt Nachtarbeitnehmer | § 2 Abs. 5 Nr. 2 ArbZG |
| Verstoß | Nachtarbeitnehmer, 4 Wochen mit Ø 8:30 je Werktag | Verstoß „Ausgleich nicht erreicht“ | § 6 Abs. 2 Satz 2 ArbZG |
| Bäckerei | 4:00 – 7:00 in einer Bäckerei (1:00 Nachtzeit 22–5) | keine Nachtarbeit | § 2 Abs. 3 ArbZG |
| Grenze | Nachtarbeitnehmer, 4 Wochen mit Ø 8:00 je Werktag | kein Befund | § 6 Abs. 2 Satz 2 ArbZG („nicht überschritten“) |
| Hinweis | Nachtarbeitnehmer, ein Tag mit 8:01 | Hinweis „über 8 h, Ausgleich in einem Monat oder vier Wochen“ | § 6 Abs. 2 Satz 2 ArbZG |
| Verstoß | Nachtarbeitnehmer, ein Tag mit 10:01 | Verstoß „über 10 h“ | § 6 Abs. 2 Satz 2 ArbZG („bis zu zehn Stunden“) |
| Hinweis | 40. Nachtarbeitstag im Kalenderjahr | Hinweis „bald Nachtarbeitnehmer“ | Schwere dieser Regel |
| ohne Wahl | Nachtarbeitnehmer, 29.1. bis 25.2.2026 mit Ø 8:30, Januar und Februar unter 8:00 je Werktag | kein Befund zum Ausgleich | § 6 Abs. 2 Satz 2 ArbZG („oder“) |
| Satz 3 | Nachtarbeitnehmer nach 48 Tagen, März nur Tagschichten von 9:00, April eine Nachtschicht von 9:00 | kein Befund im März (R-02 und R-03 prüfen ihn), Hinweis für den Tag im April | § 6 Abs. 2 Satz 3 ArbZG |
| Vorjahr | 48 Nachtarbeitstage 2026, Nachtarbeit am 4.1.2027 | Nachtarbeitnehmer am 4.1.2027 | § 2 Abs. 5 Nr. 2 ArbZG; Regel dieser Seite |
| Herbst | Sa 24.10.2026 22:00 – So 6:00 | 8:00 Nachtzeit (echte Zeit), Nachtarbeit | § 2 Abs. 3 ArbZG; SoZV (Ende der Sommerzeit) |
| Frühjahr | Sa 27.03.2027 22:00 – So 6:00 | 6:00 Nachtzeit (echte Zeit), Nachtarbeit | § 2 Abs. 3 ArbZG; SoZV (Beginn der Sommerzeit) |
| Silvester | Do 31.12.2026 22:00 – Fr 1.1.2027 6:00 | 7:00 Nachtzeit, Nachtarbeitstag 31.12.2026 | Grundbegriff „Arbeitstag“ |

### R-07 Sonn- und Feiertagsruhe

- **Norm**: § 9 Abs. 1 ArbZG: „an Sonn- und gesetzlichen Feiertagen von 0 bis 24 Uhr nicht
  beschäftigt“; § 10 ArbZG (Ausnahmen); Feiertage nach dem Standort ([Feiertage](feiertage.md)).
- **Regel**: Arbeitszeit an einem Sonntag oder Feiertag am Standort ist nur erlaubt, wenn der
  Betrieb eine Ausnahme nach § 10 Abs. 1 ArbZG angegeben hat (etwa Nr. 4 Gaststätten, Nr. 3
  Pflege) oder eine Bewilligung der Aufsichtsbehörde (§ 13 ArbZG) eingetragen ist.
- **Grenzwerte**: 0:00 bis 24:00 des Sonn- oder Feiertags; eine Schicht über Mitternacht zählt mit
  dem Teil, der in den Tag fällt. Mehrschichtbetriebe: Verschiebung um bis zu 6 h nach § 9 Abs. 2
  (Einstellung): Beginn und Ende rücken um die eingetragene Uhrzeit vor oder zurück, die Ruhe dauert
  aber mindestens die 24 echten Stunden ab ihrem Beginn (am 29.3.2026 also bis So 19:00, am
  25.10.2026 bis So 18:00, 25 Stunden); eine Verschiebung über
  6 h oder nicht in ganzen Minuten gilt nicht, dann bleibt es bei 0 bis 24 Uhr. Gemessen wird in
  echten Minuten (der 25.10.2026 hat 25 Stunden), nur an geschlossenen Schichten (R-01).
- **Einstellungen**: eine Ausnahme nach § 10 Abs. 1 Nr. 1 bis 16 (eine andere Nummer erlaubt nichts),
  § 10 Abs. 3 für Bäckereien (bis 3:00 je Sonn- und Feiertag) oder eine Bewilligung nach § 13 mit
  Fundstelle, für die Tage, die sie nennt, oder ohne Tage für jeden. Ohne Einstellung gilt § 9.
  Der 24. und der 31.12. sind keine gesetzlichen Feiertage.
- **Ausnahmen**: § 10 Abs. 1 Nr. 1 bis 16, Abs. 3 (Bäckereien bis 3 h) ArbZG.
- **Schwere**: Verstoß ohne Ausnahme; mit Ausnahme kein Befund, aber R-08 und R-09.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Café mit Ausnahme § 10 Abs. 1 Nr. 4, So 10:00 – 16:00 | kein Befund (R-09 folgt) | § 10 Abs. 1 Nr. 4 ArbZG |
| Grenze | SHK-Betrieb ohne Ausnahme, Sa 18:00 – 23:59 | kein Befund | § 9 Abs. 1 ArbZG („0 bis 24 Uhr“) |
| Verstoß | SHK-Betrieb ohne Ausnahme, Sa 22:00 – So 0:01 | Verstoß für 1 min am Sonntag | § 9 Abs. 1 ArbZG |
| Verstoß | SHK in Bayern, 6.1.2026 (Heilige Drei Könige), 8:00 – 12:00 | Verstoß „Feiertag“ | § 9 Abs. 1 ArbZG; Art. 1 BayFTG |
| Heiligabend | SHK in Hamburg, Do 24.12.2026, 8:00 – 16:00 | kein Befund (kein gesetzlicher Feiertag) | § 9 Abs. 1 ArbZG; § 1 FeiertagsG Hamburg |
| Weihnachten | SHK in Hamburg, Do 24.12.2026 22:00 – Fr 25.12. 6:00 | Verstoß „Feiertag“ für 6:00 am 25.12. | § 9 Abs. 1 ArbZG; § 1 FeiertagsG Hamburg |
| Silvester | SHK in Hamburg, Do 31.12.2026 20:00 – Fr 1.1.2027 2:00 | Verstoß „Feiertag“ für 2:00 am 1.1. | § 9 Abs. 1 ArbZG; § 1 FeiertagsG Hamburg |
| Herbst | SHK ohne Ausnahme, Sa 24.10.2026 22:00 – So 6:00 | Verstoß für 7:00 am Sonntag (echte Zeit) | § 9 Abs. 1 ArbZG; SoZV (Ende der Sommerzeit) |
| Mehrschicht | Ruhe 6 h vorverlegt, Sa 14:00 – 22:00 | Verstoß für 4:00 am Sonntag; So 18:00 – 23:00 kein Befund | § 9 Abs. 2 ArbZG |
| Mehrschicht | Ruhe 6 h vorverlegt, So 29.3.2026 18:00 – 19:00 (Sommerzeit) | Verstoß für 1:00 am 29.3.; 19:00 – 20:00 kein Befund | § 9 Abs. 2 ArbZG („die auf den Beginn der Ruhezeit folgenden 24 Stunden“) |
| Mehrschicht | Ruhe 6 h vorverlegt, So 25.10.2026 17:00 – 18:00 (Winterzeit) | Verstoß für 1:00 am 25.10.; 18:00 – 19:00 kein Befund | § 9 Abs. 2 ArbZG („Beginn oder Ende … um bis zu sechs Stunden“) |
| Mehrschicht | SHK in Bayern, Ruhe 6 h vorverlegt, So 31.10.2027 (Winterzeit, Mo Allerheiligen) 17:00 – 18:00 | Verstoß für 1:00 am 31.10. | § 9 Abs. 2 ArbZG; Art. 1 BayFTG |
| Mehrschicht | Verschiebung um 7 h eingetragen, Sa 14:00 – 22:00 | kein Befund (es gilt 0 bis 24 Uhr) | § 9 Abs. 2 ArbZG („um bis zu sechs Stunden“) |
| Bäckerei | Bäckerei mit § 10 Abs. 3, So 5:00 – 8:00 (3:00) | kein Befund; mit 3:01 Verstoß „über 3 h“ | § 10 Abs. 3 ArbZG |
| Bewilligung | Bewilligung nach § 13 für So 15.11.2026, Arbeit am 15. und am 22.11. | Verstoß nur für den 22.11. | § 13 ArbZG |

### R-08 Beschäftigungsfreie Sonntage

- **Norm**: § 11 Abs. 1 ArbZG: „Mindestens 15 Sonntage im Jahr müssen beschäftigungsfrei bleiben.“
- **Grenzwerte**: Je Kalenderjahr höchstens (Zahl der Sonntage − 15) Sonntage mit Arbeitszeit;
  2026 hat 52 Sonntage, also höchstens 37.
- **Gezählt** wird jeder Sonntag, in dessen Ruhe nach R-07 Arbeit fällt, auch das Ende einer
  Nachtschicht vom Samstag. Ein Jahr hat 52 oder 53 Sonntage (2023 und 2028 haben 53).
- **Schwere**: Hinweis, sobald nur noch so viele Sonntage übrig sind, wie frei bleiben müssen;
  Verstoß beim ersten Sonntag darüber. Der Hinweis kommt am Sonntag, mit dem die Höchstzahl erreicht
  ist, ein Verstoß an jedem Sonntag darüber.

| Fall | Kalenderjahr 2026 | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 30 Sonntage mit Arbeit | kein Befund | § 11 Abs. 1 ArbZG |
| Grenze | 37 Sonntage mit Arbeit, 15 frei | Hinweis „kein weiterer Sonntag mehr“ | § 11 Abs. 1 ArbZG |
| Verstoß | 38 Sonntage mit Arbeit | Verstoß | § 11 Abs. 1 ArbZG |
| Nachtschicht | 36 Sonntage mit Arbeit, dazu Sa 26.12.2026 22:00 – So 6:00 | Hinweis für den 27.12.2026 | § 11 Abs. 1 ArbZG; § 9 Abs. 1 ArbZG („0 bis 24 Uhr“) |

### R-09 Ersatzruhetag

- **Norm**: § 11 Abs. 3 ArbZG: für einen Sonntag „innerhalb eines den Beschäftigungstag
  einschließenden Zeitraums von zwei Wochen“, für einen Feiertag an einem Werktag innerhalb von acht
  Wochen; § 11 Abs. 4 ArbZG (in Verbindung mit einer Ruhezeit).
- **Regel**: Ein Ersatzruhetag ist ein Werktag ohne Arbeitszeit von 0 bis 24 Uhr. Soll ordnet jedem
  Sonntag den frühesten freien Werktag im Zeitraum zu, der noch keinem anderen zugeordnet ist. Es
  wählen zuerst die Sonn- und Feiertage, deren Zeitraum zuerst endet; so bleiben so wenige wie möglich
  ohne Ersatzruhetag (ein Feiertag mit acht Wochen nimmt einem Sonntag nicht seinen einzigen Tag).
- **Frei** ist ein Werktag erst, wenn er vorbei ist; ein Werktag, in den eine Nachtschicht reicht,
  ist nicht frei, ebenso der Tag einer offenen Schicht. Ein Feiertag an einem Sonntag folgt der Regel
  für Sonntage. Beschäftigt ist, wer in der Ruhe nach R-07 arbeitet.
- **Grenzwerte**: Sonntag: ein Zeitraum von 14 Tagen, der den Sonntag einschließt; er kann vor oder
  nach dem Sonntag liegen, der Ersatzruhetag also bis zu 13 Tage davor oder danach (Montag der
  Vorwoche bis Samstag der übernächsten Woche). Feiertag: 8 Wochen entsprechend, bis zu 55 Tage
  davor oder danach.
- **Schwere**: Hinweis, solange der Zeitraum läuft; Verstoß, wenn er ohne Ersatzruhetag endet.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Arbeit So, frei Di | kein Befund | § 11 Abs. 3 Satz 1 ArbZG |
| Grenze | Arbeit So, einziger freier Werktag am 13. Tag danach (Sa der übernächsten Woche) | kein Befund | § 11 Abs. 3 Satz 1 ArbZG („den Beschäftigungstag einschließenden Zeitraums von zwei Wochen“) |
| Verstoß | Arbeit So, 13 Tage davor und danach kein freier Werktag, der nächste am 15. Tag danach (Mo) | Verstoß „Ersatzruhetag fehlt“ | § 11 Abs. 3 Satz 1 ArbZG |
| Feiertag | Arbeit Mo 25.5.2026 (Pfingstmontag), freier Werktag nach 7 Wochen | kein Befund | § 11 Abs. 3 Satz 2 ArbZG |
| Feiertag | Arbeit Mo 25.5.2026, 55 Tage davor und danach kein freier Werktag | Verstoß „Ersatzruhetag fehlt“ | § 11 Abs. 3 Satz 2 ArbZG |
| Hinweis | Arbeit So 8.11. und So 15.11.2026 und an jedem Werktag bis Di 17.11., heute Mi 18.11. | Hinweis „Ersatzruhetag bis 21.11.“ und „bis 28.11.“ | Schwere dieser Regel |
| je Sonntag | Arbeit So 8.11. und So 15.11.2026, einziger freier Werktag Mi 11.11. | Verstoß für den 15.11. | § 11 Abs. 3 Satz 1 ArbZG |
| Vorrang | Arbeit Mo 25.5. und So 31.5.2026, frei nur Di 2.6. und Mo 13.7. | kein Befund (2.6. für den Sonntag, 13.7. für den Feiertag) | § 11 Abs. 3 ArbZG; Regel dieser Seite |
| Nachtschicht | Arbeit So 15.11.2026 17:00 – Mo 1:00, Mo sonst frei, alle anderen Werktage gearbeitet | Verstoß „Ersatzruhetag fehlt“ | § 11 Abs. 3 ArbZG („Ersatzruhetag“: 0 bis 24 Uhr) |

### R-10 Aufzeichnung und Aufbewahrung

- **Norm**: § 16 Abs. 2 ArbZG: die über 8 h werktäglich hinausgehende Arbeitszeit aufzeichnen,
  „Die Nachweise sind mindestens zwei Jahre aufzubewahren.“
- **Regel**: Soll zeichnet jede Arbeitszeit auf (R-01) und bewahrt jeden abgeschlossenen Monat mindestens
  zwei Jahre ab Ablauf seines Kalenderjahres auf, mit Lohnbezug 6 Jahre, als Buchungsbeleg 8 Jahre
  (Projektplan, „Fristen je Monatsabschluss“); die Aussonderung (S-901) entfernt nichts vor Ablauf der längsten Frist.
- **Schwere**: Verstoß, wenn eine Aussonderung eine Aufzeichnung vor Ablauf entfernen würde (die
  Aussonderung bricht dann ab).

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Monat Januar 2026 ohne Lohnbezug, Aussonderung am 1.1.2029 | entfernt | § 16 Abs. 2 Satz 2 ArbZG |
| Grenze | Monat Dezember 2026 ohne Lohnbezug, Aussonderung am 31.12.2028 | nicht entfernt (Frist mit Ablauf des Jahres 2026 + 2 Jahre) | § 16 Abs. 2 Satz 2 ArbZG; Projektplan, „Fristen“ |
| Verstoß | Aussonderung eines Monats von 2026 im Jahr 2027 | abgelehnt | § 16 Abs. 2 Satz 2 ArbZG |
| Lohnunterlage | Monat Januar 2026 mit Stundenlohn, Aussonderung am 1.1.2029 | nicht entfernt (6 Jahre als Lohnunterlage) | Projektplan, „Fristen“ |

### R-11 Bereitschaftsdienst

- **Norm**: § 2 Abs. 1 ArbZG; § 7 Abs. 1 Nr. 1 Buchst. a ArbZG; EuGH, Urteil vom 09.09.2003, C-151/02
  (Jaeger): Bereitschaftsdienst am Arbeitsplatz ist Arbeitszeit; § 7 Abs. 9 ArbZG.
- **Regel**: Bereitschaftsdienst (am vom Betrieb bestimmten Ort) zählt voll als Arbeitszeit, für
  R-02 bis R-06; Arbeitsbereitschaft ebenso. Er ist ein Stück der Schicht wie andere Arbeit: Soll
  schneidet die Schichten wie bei Stempelungen (Grundbegriff „Schicht“), eine Ruhepause ist er nie,
  und was schon gestempelt ist, zählt nicht doppelt.
- **Ausnahmen**: Tarifvertrag oder Betriebsvereinbarung nach § 7 Abs. 1 Nr. 1 Buchst. a ArbZG
  (Einstellung des Betriebs mit Fundstelle): mehr als 10 h an einem Tag, in den Bereitschaftsdienst
  fällt. Ein Tag ohne Bereitschaftsdienst bleibt beim Grenzwert von R-02, auch mit einer
  Rufbereitschaft, die ganz zählt (R-12): Die Norm nennt nur Arbeitsbereitschaft und
  Bereitschaftsdienst. Über 12 h muss im unmittelbaren Anschluss an das Ende der Arbeit des Tages
  eine Ruhezeit von mindestens 11 h folgen, ohne Verkürzung nach § 5 Abs. 2 und ohne Ausgleich von
  Einsätzen nach § 5 Abs. 3 (§ 7 Abs. 9 ArbZG). Ist sie kürzer, ist das keine Verkürzung nach § 5
  Abs. 2: Sie bekommt keinen Befund nach R-05 und nimmt keiner anderen verkürzten Ruhezeit den
  Ausgleich von 12 h. Eine Ruhezeit zwischen zwei Schichten dieses Tages
  liegt vor diesem Ende und bleibt bei R-05 und R-12. Gemessen wird bis zur nächsten Arbeit, auch bis
  zu einem Einsatz, der eine eigene Schicht ist (R-12). Ohne Einstellung gilt der Grenzwert von R-02.
- **Schwere**: kein eigener Befund ohne Einstellung; die Zeit geht in die anderen Regeln ein.
  Hinweis, wenn ein Bereitschaftsdienst über 10 h nur mit tariflicher Einstellung nach § 7 erlaubt
  ist; Verstoß, wenn nach mehr als 12 h keine 11 h Ruhezeit folgen.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 6:00 Arbeit + 2:00 Bereitschaftsdienst | 8:00 Arbeitszeit, kein Befund | EuGH C-151/02 |
| Grenze | 6:00 Arbeit + 4:00 Bereitschaftsdienst | 10:00, Hinweis nach R-02 | EuGH C-151/02; § 3 ArbZG |
| Verstoß | 6:00 Arbeit + 4:01 Bereitschaftsdienst, ohne Einstellung nach § 7 | Verstoß nach R-02 | § 3 ArbZG; § 7 Abs. 1 Nr. 1 Buchst. a ArbZG |
| Pause | 6:00 Arbeit + 2:00 Bereitschaftsdienst ohne Ruhepause | Verstoß nach R-04 „Pause fehlt 30 min“ und „über 6 h ohne Pause“ | § 4 ArbZG; EuGH C-151/02 (Bereitschaftsdienst ist keine Ruhezeit) |
| gestempelt | 8:00 – 16:00 gestempelt, davon 14:00 – 16:00 Bereitschaftsdienst | 8:00 Arbeitszeit, davon 2:00 Bereitschaftsdienst, nicht doppelt | § 2 Abs. 1 ArbZG |
| Ruhezeit | Bereitschaftsdienst Mo 22:00 – Di 6:00, Di Schicht 15:30 (9:30 Ruhe) | Verstoß nach R-05 „Ruhezeit 9:30“ | § 5 Abs. 1 ArbZG; EuGH C-151/02 |
| Herbst | Bereitschaftsdienst Sa 24.10.2026 22:00 – So 7:00 (10:00 echte Zeit) | Hinweis nach R-02 für Sa | § 3 ArbZG; SoZV (Ende der Sommerzeit) |
| Frühjahr | Bereitschaftsdienst Sa 27.03.2027 22:00 – So 7:00 (8:00 echte Zeit) | kein Befund nach R-02 | § 3 ArbZG; SoZV (Beginn der Sommerzeit) |
| Tarif | 6:00 Arbeit + 6:00 Bereitschaftsdienst, Einstellung nach § 7 Abs. 1 Nr. 1 Buchst. a | Hinweis „über 10 h nur mit Tarif“ statt Verstoß nach R-02 | § 7 Abs. 1 Nr. 1 Buchst. a ArbZG |
| Tarif ohne Bereitschaft | 10:01 Arbeit ohne Bereitschaftsdienst, mit derselben Einstellung | Verstoß nach R-02 | § 7 Abs. 1 Nr. 1 Buchst. a ArbZG („wenn in die Arbeitszeit regelmäßig und in erheblichem Umfang Arbeitsbereitschaft oder Bereitschaftsdienst fällt“) |
| über 12 h | Gastronomie, Einstellung nach § 7, Mo 6:00 Arbeit + 7:00 Bereitschaftsdienst (13:00), danach 10:30 Ruhe | Verstoß „Ruhezeit nach über 12 h“ statt Hinweis nach R-05 | § 7 Abs. 9 ArbZG |
| über 12 h, Ausgleich verpasst | Gastronomie, Einstellung nach § 7, Ausgleich im Kalendermonat, Mo 30.11.2026 6:00 Arbeit + 7:00 Bereitschaftsdienst (13:00), danach 10:30 Ruhe, kein Ausgleich bis 30.11. | Verstoß „Ruhezeit nach über 12 h“ statt Verstoß „Ausgleich fehlt“ nach R-05 | § 7 Abs. 9 ArbZG |
| über 12 h, ein Ausgleich | Beherbergung, Einstellung nach § 7, Ausgleich im Kalendermonat, Sa 28.11.2026 10:00 – 16:00 Arbeit + 16:15 – 23:00 Bereitschaftsdienst (12:45), So 9:30 – 15:30 und 16:00 – 19:30, Mo 30.11. 6:00 – 11:30, danach keine Arbeit mehr im November | Verstoß „Ruhezeit nach über 12 h“ für die 10:30 nach Sa; die 12 h ab Mo 11:30 gleichen die 10:30 nach So aus, kein Befund nach R-05 | § 7 Abs. 9 ArbZG; § 5 Abs. 2 ArbZG |
| über 12 h, am selben Tag | Gastronomie, Einstellung nach § 7, Mo Schicht 0:00 – 6:00, Mo Schicht 16:30 – 22:30 und Bereitschaftsdienst 22:45 – 23:45 (13:00), Di Schicht 12:00 (12:15 Ruhe) | kein Befund zur Ruhezeit: die 10:30 zwischen den Schichten liegen vor dem Ende der Arbeit des Tages, die Verkürzung nach § 5 Abs. 2 ist ausgeglichen | § 7 Abs. 9 ArbZG („im unmittelbaren Anschluss an die Beendigung der Arbeitszeit“) |

Die Fälle erlaubt, Grenze, Verstoß und Tarif nehmen die Ruhepausen nach § 4 ArbZG als gewährt an;
ohne sie gilt der Fall „Pause“.

### R-12 Rufbereitschaft

- **Norm**: §§ 2, 5 ArbZG; EuGH, Urteil vom 21.02.2018, C-518/15 (Matzak): Rufbereitschaft mit so
  kurzer Reaktionszeit, dass die Freizeit erheblich eingeschränkt ist, ist Arbeitszeit; § 5 Abs. 3
  und § 7 Abs. 2 Nr. 1 ArbZG.
- **Regel**: Rufbereitschaft selbst ist keine Arbeitszeit. Ein Einsatz ist Arbeitszeit, mit Wegezeit,
  und beendet die Ruhezeit: Nach dem Einsatz beginnt eine neue Ruhezeit von 11 h. Ist die
  Reaktionszeit am Dienst kürzer als 30 min (Einstellung am Rufdienst), wertet Soll die ganze
  Rufbereitschaft als Arbeitszeit (Matzak: wenige Minuten; die 30 min sind eine vorsichtige Grenze
  von Soll und als solche gekennzeichnet). Ohne eingestellte Reaktionszeit wertet Soll sie ebenso
  (vorsichtige Vorgabe: eine kurze ist nicht auszuschließen). Sie zählt dann für jeden Grenzwert,
  ist aber kein Bereitschaftsdienst für § 7 Abs. 1 Nr. 1 Buchst. a ArbZG (R-11).
- **Einsatz und Arbeitstag**: Ein Einsatz zählt zum Arbeitstag der Schicht, zu der er nach dem
  Grundbegriff „Schicht“ gehört, also zu einer Schicht, die höchstens 9 h vorher endet, sonst zum Tag,
  an dem er beginnt. Ein Einsatz verbindet nie zwei Stücke anderer Arbeit zu einer Schicht: Die
  nächste Schicht ist ein eigener Arbeitstag, wenn sie nicht binnen 9 h nach anderer Arbeit beginnt.
  Liegen weniger als 15 min zwischen einem Einsatz und anderer Arbeit, ist er ein Stück dieser Arbeit
  (§ 4 Satz 2 ArbZG); zwei Einsätze mit weniger als 15 min Abstand sind einer.
- **Ruhezeit**: Gemessen wird vom Ende der letzten Arbeit, auch eines Einsatzes, bis zur ersten
  anderen Arbeit des nächsten Arbeitstags, mit den Grenzwerten und der Branchenausnahme von R-05.
  Beginnt nach einem Einsatz eine eigene Schicht am selben Kalendertag, endet die Ruhezeit mit ihr.
  Die Ruhezeit vor einem Einsatz zählt nicht, denn nach ihm beginnt eine neue; nur die 11 h nach
  einem Tag über 12 h (§ 7 Abs. 9 ArbZG, R-11) endet er.
- **Ausnahmen**: Krankenhäuser und Pflege dürfen Kürzungen bis zur Hälfte der Ruhezeit zu anderen
  Zeiten ausgleichen (§ 5 Abs. 3 ArbZG): Dauern die Einsätze zwischen zwei Arbeitstagen zusammen
  höchstens 5:30, unterbrechen sie die Ruhezeit nicht, Soll misst sie zwischen den Schichten und
  erinnert an den Ausgleich; einen Zeitraum dafür nennt das Gesetz nicht. Tarif nach § 7 Abs. 2
  Nr. 1 ArbZG als Einstellung mit Fundstelle.
- **Schwere**: Verstoß, wenn nach einem Einsatz keine 11 h bis zur nächsten Schicht bleiben (mit
  Branchenausnahme nach § 5 Abs. 2 wie R-05); Hinweis „Einsatz ausgleichen“ nach § 5 Abs. 3.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Rufbereitschaft Mo 18:00 – Di 6:00 ohne Einsatz, Di Schicht 8:00 | kein Befund, 0:00 Arbeitszeit | § 5 Abs. 1 ArbZG |
| Grenze | Einsatz Mo 20:00 – 21:00, Di Schicht 8:00 (11:00 Ruhe) | 1:00 Arbeitszeit, kein Befund | § 5 Abs. 1 ArbZG |
| Verstoß | Einsatz Mo 23:00 – Di 0:30, Di Schicht 8:00 (7:30 Ruhe) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ | § 5 Abs. 1 ArbZG; EuGH C-518/15 |
| Matzak | Rufbereitschaft mit Reaktionszeit 8 min, 18:00 – 6:00 | 12:00 Arbeitszeit, R-02 meldet Verstoß | EuGH C-518/15, Rn. 66 |
| Matzak, Grenze | Rufbereitschaft mit Reaktionszeit 30 min, 18:00 – 6:00, ohne Einsatz | 0:00 Arbeitszeit, kein Befund | Grenzwert dieser Regel (vorsichtige Grenze von Soll) |
| ohne Reaktionszeit | Rufbereitschaft 18:00 – 6:00, Reaktionszeit nicht eingestellt | 12:00 Arbeitszeit wie bei Matzak | EuGH C-518/15; vorsichtige Vorgabe dieser Regel |
| Matzak mit Tarif | Rufbereitschaft 18:00 – 6:00 mit Reaktionszeit 8 min oder ohne, Einstellung nach § 7 Abs. 1 Nr. 1 Buchst. a | Verstoß nach R-02, kein Hinweis nach R-11 | § 7 Abs. 1 Nr. 1 Buchst. a ArbZG („Arbeitsbereitschaft oder Bereitschaftsdienst“) |
| Matzak mit Tarif und Bereitschaftsdienst | Bereitschaftsdienst 17:00 – 18:00, dann Rufbereitschaft 18:00 – 6:00 mit Reaktionszeit 8 min, Einstellung nach § 7 | Hinweis „über 10 h nur mit Tarif“ | § 7 Abs. 1 Nr. 1 Buchst. a ArbZG |
| Einsatz in der Nacht | Mo Schicht 12:00 – 18:00, Einsatz Di 3:00 – 4:00, Di Schicht 8:00 (4:00 Ruhe) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ nur für Di; die Ruhezeit vor dem Einsatz (9:00) zählt nicht | § 5 Abs. 1 ArbZG |
| zwei Einsätze | Einsätze Mo 22:00 – 23:00 und Di 2:00 – 3:00, Di Schicht 14:00 (11:00 Ruhe nach dem zweiten) | 2:00 Arbeitszeit am Mo, kein Befund | § 5 Abs. 1 ArbZG |
| zwei Einsätze, Verstoß | Einsätze Mo 22:00 – 23:00 und Di 3:00 – 4:00, Di Schicht 14:00 (10:00 Ruhe nach dem zweiten) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ für Mo und Di | § 5 Abs. 1 ArbZG |
| Gastronomie | Gastronomie, Einsatz Mo 23:00 – Di 0:30, Di Schicht 10:30 (10:00 Ruhe) | Hinweis nach R-05 „Ausgleich bis … nötig“ | § 5 Abs. 2 ArbZG |
| Krankenhaus | Krankenhaus, Mo Schicht 18:00 – 20:00, Einsatz Mo 23:00 – Di 1:00, Di Schicht 8:00 (12:00 zwischen den Schichten) | Hinweis „Einsatz ausgleichen 2:00“, kein Verstoß | § 5 Abs. 3 ArbZG |
| Krankenhaus, Grenze | Krankenhaus, Mo Schicht 18:00 – 20:00, Einsatz Mo 22:00 – Di 3:30 (5:30), Di Schicht 8:00 | Hinweis „Einsatz ausgleichen 5:30“, kein Verstoß | § 5 Abs. 3 ArbZG („nicht mehr als die Hälfte der Ruhezeit“) |
| Krankenhaus, über die Hälfte | Krankenhaus, Mo Schicht 18:00 – 20:00, Einsatz Mo 22:00 – Di 3:31 (5:31), Di Schicht 8:00 (4:29 Ruhe) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ | § 5 Abs. 3 ArbZG |
| selber Tag | Mo Schicht 5:00 – 9:00, Einsatz Mo 12:00 – 13:00, Mo Schicht 18:30 (eigene Schicht, 5:30 Ruhe) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ für Mo | § 5 Abs. 1 ArbZG |
| Krankenhaus, selber Tag | Krankenhaus, dieselbe Lage | Hinweis „Einsatz ausgleichen 1:00“, kein Verstoß | § 5 Abs. 3 ArbZG |
| Krankenhaus, selber Tag über 12 h | Krankenhaus, Einstellung nach § 7, Mo Schicht 0:00 – 6:00, Einsatz Mo 10:00 – 11:00, Mo Schicht 17:00 – 23:00 und Bereitschaftsdienst 23:15 – 23:45, Di Schicht 12:00 | Hinweis „über 10 h nur mit Tarif“ und „Einsatz ausgleichen“, kein Verstoß: die Ruhezeit 6:00 – 17:00 liegt vor dem Ende der Arbeit des Tages | § 5 Abs. 3, § 7 Abs. 9 ArbZG |
| Krankenhaus, Einsatz nach über 12 h | Krankenhaus, Einstellung nach § 7, Mo Schicht 7:00 – 14:00 und Bereitschaftsdienst 14:00 – 20:00 (13:00), Einsatz Di 6:00 – 7:00 (eigene Schicht), Di Schicht 17:00 | Verstoß „Ruhezeit nach über 12 h“ für die 10:00 von Mo 20:00 bis zum Einsatz; die Verkürzung nach § 5 Abs. 2 danach rettet sie nicht | § 7 Abs. 9 ArbZG („im unmittelbaren Anschluss an die Beendigung der Arbeitszeit“) |
| Herbst | Einsatz Sa 24.10.2026 23:00 – So 0:30, So Schicht 10:30 (11:00 echte Zeit) | kein Befund | § 5 Abs. 1 ArbZG; SoZV (Ende der Sommerzeit) |
| Frühjahr | Einsatz Sa 27.03.2027 23:00 – So 0:30, So Schicht 11:00 (9:30 echte Zeit) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ | § 5 Abs. 1 ArbZG; SoZV (Beginn der Sommerzeit) |

Die Fälle ohne Angabe der Reaktionszeit haben eine Reaktionszeit von 30 min oder mehr.

## Mindestlohn und Aufzeichnung

### R-13 Aufzeichnung binnen sieben Tagen

- **Norm**: § 17 Abs. 1 MiLoG: Beginn, Ende und Dauer „spätestens bis zum Ablauf des siebten auf den
  Tag der Arbeitsleistung folgenden Kalendertages aufzuzeichnen“, für geringfügig Beschäftigte
  (§ 8 Abs. 1 SGB IV) und in den Branchen des § 2a SchwarzArbG (u. a. Bau, Gaststätten und
  Beherbergung, Personenbeförderung, Spedition und Logistik, Gebäudereinigung, Fleischwirtschaft,
  Wach- und Sicherheitsgewerbe, Friseur- und Kosmetikgewerbe); nicht für Minijobs im Privathaushalt
  (§ 8a SGB IV).
- **Regel**: Für diese Personen muss jeder Arbeitstag bis zum Ende des siebten Folgetags vollständig
  sein (R-01). Eine Änderung danach ist erlaubt, aber als nachgetragen gekennzeichnet.
- **Schwere**: Hinweis ab dem fünften Folgetag; Verstoß, wenn der Tag nach Ablauf des siebten
  Folgetags noch unvollständig ist.

| Fall | Arbeitstag Mo 2.11.2026, Minijob | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | vollständig erfasst am Mi 4.11. | kein Befund | § 17 Abs. 1 Satz 1 MiLoG |
| Grenze | nachgetragen am Mo 9.11. um 23:59 | kein Befund | § 17 Abs. 1 Satz 1 MiLoG („Ablauf des siebten … Kalendertages“) |
| Verstoß | noch offen am Di 10.11. um 0:00 | Verstoß „Aufzeichnung verspätet“ | § 17 Abs. 1 Satz 1 MiLoG |
| ausgenommen | Minijob im Privathaushalt, offen am 10.11. | nur R-01 | § 17 Abs. 1 Satz 3 MiLoG |
| Privathaushalt ohne Minijob | Vollzeit im Privathaushalt, Branche nicht eingestellt, offen am 10.11. | Verstoß „Aufzeichnung verspätet“ | § 17 Abs. 1 Satz 3 MiLoG nimmt nur § 8a SGB IV aus, also nur Minijobs |
| vor dem Hinweis | noch offen am Fr 6.11. um 23:59 | nur R-01 | R-13, Schwere |
| Hinweis | noch offen am Sa 7.11. um 0:00 | Hinweis „Aufzeichnung fällig“, Frist bis Mo 9.11. 23:59 | R-13, Schwere |
| verspätet nachgetragen | Gehen erfasst am Di 10.11. um 0:00 | Verstoß „Aufzeichnung verspätet“, auch nachdem der Tag vollständig ist | § 17 Abs. 1 Satz 1 MiLoG |
| geändert nach der Frist | vollständig erfasst am Mi 4.11., Gehen am Do 12.11. geändert | kein Befund, als nachgetragen gekennzeichnet | R-13, Regel |
| gelöscht nach der Frist | vollständig erfasst am Mi 4.11., Kommen und Gehen am Do 12.11. gelöscht | kein Befund, als nachgetragen gekennzeichnet | R-13, Regel |
| offen gelöscht nach der Frist | Kommen erfasst am Mo 2.11., am Do 12.11. gelöscht | Verstoß „Aufzeichnung verspätet“, als nachgetragen gekennzeichnet | § 17 Abs. 1 Satz 1 MiLoG |
| gelöscht vor der Frist | Kommen erfasst am Mo 2.11., am Mi 4.11. gelöscht | kein Befund | R-13, Regel |
| erst nach der Frist erfasst, dann gelöscht | Kommen und Gehen am Do 12.11. erfasst, am Fr 13.11. gelöscht | Verstoß „Aufzeichnung verspätet“ wie ohne Löschen, als nachgetragen gekennzeichnet | § 17 Abs. 1 Satz 1 MiLoG |
| Gehen ohne Kommen nach einer offenen Schicht | Kommen am Mo 2.11. offen, Gehen am Do 5.11., am Fr 20.11. gelöscht | Verstoß „Aufzeichnung verspätet“ für den 2.11. und den 5.11., 5.11. als nachgetragen gekennzeichnet | § 17 Abs. 1 Satz 1 MiLoG |
| Gehen während der Pause nach Mitternacht | Kommen Mo 2.11. 22:00, Pause Di 1:00, Gehen Di 2:00, das Gehen am Do 12.11. gelöscht | Verstoß „Aufzeichnung verspätet“, 2.11. als nachgetragen gekennzeichnet | R-13, Regel; R-01 (ein Gehen während der Pause gehört zur Schicht) |
| Pause-Beginn knapp 24 Stunden nach dem Kommen | Kommen Mo 2.11. 8:00:30, Pause Di 3.11. 8:00:20, die Pause am Fr 20.11. gelöscht | Verstoß „Aufzeichnung verspätet“, 2.11. als nachgetragen gekennzeichnet | R-13, Regel; R-01 (die Pause beginnt in der Schicht, die erst 24 Stunden nach dem Kommen endet) |
| doppelt getippt nach der Ruhe | Kommen Mo 2.11. 20:00, Pause 22:00, Pause-Ende Di 3.11. 7:00:10 und 7:00:40, das zweite am Di 10.11. 12:00 erfasst | Verstoß „Aufzeichnung verspätet“ für den 2.11. und den 3.11., nicht als nachgetragen gekennzeichnet | R-13, Regel; R-01 (ein doppelter Tipp gehört zum Stempel, den er wiederholt) |
| nach einer offenen Schicht | Kommen am Mo 2.11. offen, Mo 16.11. vollständig erfasst am 16.11., geprüft am Sa 21.11. | kein Befund für den 16.11. | R-13, Regel |
| geändert nach einer offenen Schicht | Kommen am Mo 2.11. offen, Mo 16.11. vollständig erfasst, Gehen am Mo 30.11. geändert | 16.11. als nachgetragen gekennzeichnet | R-13, Regel |
| Branche | Vollzeit in einer Gaststätte, offen am 10.11. | Verstoß „Aufzeichnung verspätet“ | § 17 Abs. 1 Satz 1 MiLoG; § 2a Abs. 1 Nr. 2 SchwarzArbG |
| andere Branche | Vollzeit, Betrieb in keiner Branche des § 2a SchwarzArbG, offen am 10.11. | nur R-01 | § 17 Abs. 1 Satz 1 MiLoG |
| Branche nicht eingestellt | Vollzeit, Branche am Betrieb nicht eingestellt, offen am 10.11. | Verstoß „Aufzeichnung verspätet“ | nie weniger streng als das Gesetz (BAULISTE.md, S-204) |
| Zeitumstellung | Arbeitstag Mo 19.10.2026, noch offen am Di 27.10. um 0:00 (MEZ, nach dem 25.10.) | Verstoß „Aufzeichnung verspätet“ | § 17 Abs. 1 Satz 1 MiLoG |

Ob ein Tag rechtzeitig aufgezeichnet ist, entscheidet sein Stand zum Ablauf der Frist: Jede
Stempelung trägt den Zeitpunkt, zu dem sie erfasst wurde, und eine geänderte den, zu dem sie ersetzt
wurde. War der Tag zum Ablauf des siebten Folgetags vollständig, ist er rechtzeitig, auch wenn er
danach noch geändert wird (dann „nachgetragen“); war er es nicht, bleibt der Verstoß, auch wenn der
Tag später vollständig wird. Wer alle Stempelungen eines Tags nach der Frist löscht, lässt ihn
nicht verschwinden: Der Tag bleibt als nachgetragen gekennzeichnet, und war er zum Ablauf der Frist
unvollständig oder erst danach erfasst, bleibt der Verstoß. Nicht geprüft werden die Einschränkungen der
Mindestlohndokumentationspflichtenverordnung (§ 1 MiLoDokV: Monatsentgelt über 4.461 € oder über
2.974 € seit zwölf Monaten, mitarbeitende Ehegatten, Kinder und Eltern); ohne Einstellung gilt die
Pflicht.

### R-14 Mindestlohn je Monat

- **Norm**: § 1 Abs. 1 und 2 MiLoG; Höhe nach der jeweiligen Mindestlohnanpassungsverordnung
  (Jahreswert, S-104).
- **Regel**: Lohn des Monats in Cent ÷ Arbeitszeit des Monats in Minuten ≥ Mindestlohn je Stunde ÷ 60.
  Gerechnet wird ohne Rundung mit ganzen Zahlen: `lohnCent × 60 ≥ mindestlohnCent × minuten`.
  Zuschläge für Sonn- und Feiertagsarbeit zählen mit (BAG, 24.05.2017, 5 AZR 431/16; 17.01.2018,
  5 AZR 69/17), Nachtzuschläge nach § 6 Abs. 5 ArbZG nicht (Zahlung mit besonderer gesetzlicher
  Zweckbestimmung, BAG, 25.05.2016, 5 AZR 135/16). Fehlt der Mindestlohn des Jahres, heißt
  das Ergebnis „nicht hinterlegt“, nie der Wert des Vorjahres (CLAUDE.md).
- **Ausnahmen**: § 22 MiLoG (Auszubildende, Jugendliche ohne Berufsabschluss, bestimmte Praktika,
  Langzeitarbeitslose in den ersten sechs Monaten) als Merkmal am Mitarbeiter.
- **Schwere**: Verstoß.

| Fall | Monat (Mindestlohn 13,90 € angenommen, Jahreswert 2026) | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 603,00 € für 43 h (Minijob) | 14,02 €/h, kein Befund | § 1 Abs. 1 MiLoG |
| Grenze | 597,70 € für 43 h | genau 13,90 €/h, kein Befund | § 1 Abs. 1 MiLoG („mindestens“) |
| Verstoß | 597,69 € für 43 h | Verstoß „unter dem Mindestlohn“ | § 1 Abs. 1 MiLoG |
| nicht hinterlegt | Monat in einem Jahr ohne Jahreswert | „nicht hinterlegt“ | CLAUDE.md, „Never“ |
| Stundenlohn | 43 h zu 13,90 € je Stunde | kein Befund | § 1 Abs. 1 MiLoG |
| Stundenlohn darunter | 43 h zu 13,89 € je Stunde | Verstoß „unter dem Mindestlohn“, es fehlen 0,43 € | § 1 Abs. 1 MiLoG |
| Sonntagszuschlag | 590,00 € und 7,70 € Sonntagszuschlag für 43 h | kein Befund | BAG, 24.05.2017, 5 AZR 431/16 |
| Nachtzuschlag | 590,00 € und 7,70 € Nachtzuschlag für 43 h | Verstoß „unter dem Mindestlohn“, es fehlen 7,70 € | BAG, 25.05.2016, 5 AZR 135/16 |
| Jahreswechsel | Dezember 2026: Nachtschicht 31.12. 22:00 bis 1.1. 6:00 zu 13,90 € je Stunde, Mindestlohn 2027 14,60 € | Verstoß „unter dem Mindestlohn“: 120 min zu 13,90 €, 360 min zu 14,60 €, es fehlen 4,20 € | § 1 Abs. 2 MiLoG; MiLoV5 |
| Ausnahme | Auszubildender, 500,00 € für 43 h | kein Befund | § 22 Abs. 3 MiLoG |
| Ausnahme endet im Monat | langzeitarbeitslos, Ausnahme bis 15.11., 500,00 € für 43 h | Verstoß „unter dem Mindestlohn“: der Monat wird ganz geprüft | § 22 Abs. 4 MiLoG; nie weniger streng als das Gesetz (BAULISTE.md, S-204) |
| Ausnahme ohne Ende | langzeitarbeitslos ohne Ende der Ausnahme, 500,00 € für 43 h | Verstoß „unter dem Mindestlohn“ | § 22 Abs. 4 MiLoG („in den ersten sechs Monaten“) |
| Ausnahme Jugendliche ohne Ende | Jugendlicher ohne Berufsabschluss ohne Ende der Ausnahme, 500,00 € für 43 h | Verstoß „unter dem Mindestlohn“ | § 22 Abs. 2 MiLoG mit § 2 Abs. 1 und 2 JArbSchG: nur bis zum 18. Geburtstag |

Die Arbeitszeit des Monats sind die Minuten der geschlossenen Schichten seiner Arbeitstage (R-01
meldet offene). Eine Schicht über den 1. Januar schuldet jede Minute zum Mindestlohn des Kalendertags,
auf den sie fällt ([Jahreswerte](jahreswerte.md#wechsel-mitten-in-einer-schicht)). Ein Monat, den eine
Ausnahme nach § 22 MiLoG nur zum Teil deckt, wird ganz geprüft: Welcher Teil des Lohns auf die Tage
nach der Ausnahme fällt, weiß Soll nicht.

Die Höhe des Mindestlohns und die Minijob-Grenze stehen nicht hier, sondern als
[Jahreswerte](jahreswerte.md) mit Quelle in `packages/arbeitszeit`.

## Jugendliche

Gilt für Beschäftigte unter 18 Jahren am Arbeitstag (Geburtsdatum am Mitarbeiter, § 2 Abs. 2
JArbSchG); in den Testdaten Leon, Azubi bei Weber Haustechnik, 17.

- **Alter**: Soll nimmt vom Mitarbeiter nur das Geburtsdatum. Ein Lebensjahr ist mit dem Ablauf des
  Tages vor dem Geburtstag vollendet (§ 187 Abs. 2 Satz 2, § 188 Abs. 2 BGB): Die Regeln gelten bis
  zum Tag vor dem 18. Geburtstag, am Geburtstag nicht mehr. Wer am 29. Februar geboren ist, wird in
  einem Jahr ohne 29. Februar am 1. März 18 (§ 188 Abs. 2 und 3 BGB). Unter 15 gelten die strengeren
  Regeln für Kinder (§§ 5 bis 7 JArbSchG), die Soll nicht prüft; die Regeln für Jugendliche prüft
  es auch dann.
- **Woche** ist Montag bis Sonntag (§ 4 Abs. 4 Satz 1 JArbSchG). In Wochen, Monate und
  Schichtzeiten zählen nur die Tage, an denen die Person noch nicht 18 ist; für eine Ruhezeit genügt
  es, dass sie es an einem der beiden Tage ist.
- **Einstellungen** (Vorgabe nie weniger streng als das Gesetz): Branche (Gaststätten,
  Schausteller, Landwirtschaft und Tierhaltung, Bäckereien und Konditoreien, Bergbau unter Tage;
  Vorgabe keine), mehrschichtiger Betrieb (Vorgabe nein), die Tage auf Bau- und Montagestellen,
  die Berufsschultage mit Unterricht vor 9 Uhr (ohne Eintrag kann jeder Tag einer sein) und die
  Ausnahmen nach § 16 Abs. 2 und § 17 Abs. 2 (Vorgabe keine; die Branche bringt ihre mit:
  Gaststätten Samstag Nr. 6 und Sonntag Nr. 8, Schausteller Nr. 6 und Nr. 4, Landwirtschaft und
  Tierhaltung Samstag Nr. 4, Bäckereien und Konditoreien Samstag Nr. 2). Die Ausnahmen nach § 14
  Abs. 5 bis 7 (Anzeige an die Aufsichtsbehörde, Hitze, Aufführungen, Sport) und die Verteilung nach
  § 8 Abs. 2 und 3 prüft Soll nicht; ohne sie gelten die strengeren Grenzen.

### R-15 Arbeitszeit

- **Norm**: § 8 Abs. 1 JArbSchG: „nicht mehr als acht Stunden täglich und nicht mehr als 40 Stunden
  wöchentlich“; Abs. 2a: bis 8,5 h, wenn an anderen Werktagen derselben Woche weniger als 8 h.
- **Grenzwerte**: Tag ≤ 8:00, oder ≤ 8:30, wenn die Woche 40:00 nicht übersteigt und an einem
  anderen Werktag weniger als 8 h gearbeitet wird; Woche (Mo–So) ≤ 40:00.
- **Verkürzt** ist ein anderer Werktag derselben Woche (Montag bis Samstag, kein Feiertag am
  Standort), an dem die Person arbeitet, aber weniger als 8:00. Ein freier Tag ist keine verkürzte
  Arbeitszeit (vorsichtige Auslegung von „an einzelnen Werktagen die Arbeitszeit … verkürzt“).
  8:30 gelten nur an einem Werktag („an den übrigen Werktagen“), an einem Sonn- oder Feiertag
  bleibt es bei 8:00.
- **Feiertage**: Die Arbeitszeit, die an einem Werktag wegen eines gesetzlichen Feiertags ausfällt,
  zählt zur Woche (§ 4 Abs. 4 Satz 2 JArbSchG). Solange das Soll des Tages nicht bekannt ist (S-208),
  rechnet Soll 8:00 für jeden Feiertag von Montag bis Freitag ohne Arbeit, am Samstag nur mit einer
  Ausnahme nach § 16 Abs. 2, und nur so viele, dass mit den gearbeiteten Tagen höchstens fünf Tage
  der Woche Arbeitstage sind (§ 15).
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo–Fr je 8:00 (40:00) | kein Befund | § 8 Abs. 1 JArbSchG |
| Grenze | Mo–Do je 8:30, Fr 6:00 (40:00) | kein Befund | § 8 Abs. 2a JArbSchG |
| Verstoß | Mo–Fr je 8:00, Sa 0:30 (40:30) | Verstoß „über 40 h in der Woche“ | § 8 Abs. 1 JArbSchG |
| Verstoß | Mo 8:31, Di 6:00 | Verstoß „über 8:30“ für Mo | § 8 Abs. 2a JArbSchG |
| ohne kürzeren Tag | Mo 8:31 | Verstoß „über 8 h“, 31 Minuten über | § 8 Abs. 1 JArbSchG (8:30 nur nach Abs. 2a) |
| kein Ausgleich | Mo–Do je 8:30, Fr frei (34:00) | Verstoß „über 8 h“ für Mo bis Do | § 8 Abs. 2a JArbSchG („an einzelnen Werktagen die Arbeitszeit auf weniger als acht Stunden verkürzt“) |
| Feiertag | Hamburg, Woche mit Pfingstmontag 25.5.2026, Di–Do je 8:30, Fr 7:00 (32:30) | Verstoß „über 40 h in der Woche“: 8:00 für den Feiertag angerechnet (40:30) | § 4 Abs. 4 Satz 2 JArbSchG |
| Geburtstag | geboren 16.6.2008: Mo 15.6.2026 und Di 16.6.2026 (18. Geburtstag) je 8:31 | Verstoß „über 8 h“ nur für Mo | § 2 Abs. 2 JArbSchG; § 187 Abs. 2 Satz 2 BGB |
| 29. Februar | geboren 29.2.2008: Sa 28.2.2026 und So 1.3.2026 je 8:31 | Verstoß „über 8 h“ nur für den 28.2. (18 ab dem 1.3.) | § 2 Abs. 2 JArbSchG; § 187 Abs. 2 Satz 2, § 188 Abs. 2 und 3 BGB |
| Sonntag | Café, Mo 16.11.2026 6:00, So 22.11.2026 8:15 | Verstoß „über 8 h“ für So | § 8 Abs. 2a JArbSchG („an den übrigen Werktagen“) |

### R-16 Ruhepausen

- **Norm**: § 11 Abs. 1 JArbSchG: 30 min bei mehr als 4,5 bis 6 h, 60 min bei mehr als 6 h, Blöcke
  ab 15 min; Abs. 2: frühestens 1 h nach Beginn, spätestens 1 h vor Ende, höchstens 4,5 h am Stück.
- **Je Schicht** wie R-04: Arbeitszeit bis 4:30 keine Pause, über 4:30 bis 6:00 mindestens 30 min,
  über 6:00 mindestens 60 min; eine Unterbrechung unter 15 min ist Arbeitszeit; kein Block ohne Pause
  über 4:30. Die Lage prüft Soll an jeder Ruhepause einer Schicht, die eine Pause braucht: Beginn
  frühestens 1:00 nach dem Beginn der Schicht, Ende spätestens 1:00 vor ihrem Ende.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 4:30 Arbeit ohne Pause | kein Befund | § 11 Abs. 1 Nr. 1 JArbSchG („mehr als viereinhalb“) |
| Grenze | 6:01 Arbeit, 60 min Pause, erste Pause nach 1:00 | kein Befund | § 11 Abs. 1 Nr. 2, Abs. 2 JArbSchG |
| Verstoß | 6:01 Arbeit, 45 min Pause | Verstoß „Pause fehlt 15 min“ | § 11 Abs. 1 Nr. 2 JArbSchG |
| Verstoß | Pause nach 0:59 Arbeit | Verstoß „Pause zu früh“ | § 11 Abs. 2 Satz 1 JArbSchG |
| eine Pause | 1:00 Arbeit, 60 min Pause, 5:01 Arbeit | Verstoß „über 4:30 ohne Pause“ (die Grenze braucht eine zweite Pause) | § 11 Abs. 2 Satz 2 JArbSchG |
| am Stück | 4:31 Arbeit, 30 min Pause, 0:59 Arbeit (5:30) | Verstoß „über 4:30 ohne Pause“ und „Pause zu spät“ | § 11 Abs. 2 JArbSchG |
| zu spät | 4:00 Arbeit, 30 min Pause, 0:59 Arbeit (4:59) | Verstoß „Pause zu spät“ | § 11 Abs. 2 Satz 1 JArbSchG („spätestens eine Stunde vor Ende“) |

### R-17 Schichtzeit

- **Norm**: § 12 JArbSchG: Schichtzeit (Arbeitszeit mit Pausen, § 4 Abs. 2) höchstens 10 h; im
  Bergbau unter Tage 8 h; im Gaststättengewerbe, in Landwirtschaft und Tierhaltung, auf Bau- und Montagestellen 11 h.
- **Grenzwerte**: Schichtzeit eines Arbeitstags vom ersten Beginn bis zum letzten Ende seiner
  Schichten, in echten Minuten (§ 4 Abs. 2: die tägliche Arbeitszeit mit allen Pausen).
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 7:00 – 16:00 (9:00) | kein Befund | § 12 JArbSchG |
| Grenze | 7:00 – 17:00 (10:00) | kein Befund | § 12 JArbSchG |
| Verstoß | 7:00 – 17:01 (10:01), kein Montageeinsatz | Verstoß „Schichtzeit über 10 h“ | § 12 JArbSchG |
| Montage | 7:00 – 18:00 (11:00) auf einer Montagestelle | kein Befund | § 12 JArbSchG |
| Gaststätte | Café, 10:00 – 21:01 (11:01) | Verstoß „Schichtzeit über 11 h“ | § 12 JArbSchG |
| zwei Schichten | Mo 6:00 – 9:00 und 18:00 – 20:00 | Verstoß „Schichtzeit über 10 h“ (14:00 vom ersten Beginn bis zum letzten Ende) | § 4 Abs. 2, § 12 JArbSchG |

### R-18 Tägliche Freizeit

- **Norm**: § 13 JArbSchG: ununterbrochene Freizeit von mindestens 12 h nach Ende der täglichen
  Arbeitszeit.
- **Schwere**: Verstoß.

| Fall | Ende – nächster Beginn | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 17:00 – 7:00 (14:00) | kein Befund | § 13 JArbSchG |
| Grenze | 19:00 – 7:00 (12:00) | kein Befund | § 13 JArbSchG |
| Verstoß | 19:01 – 7:00 (11:59) | Verstoß „Freizeit 11:59“ | § 13 JArbSchG |
| Herbst | Sa 24.10.2026 19:00 – So 6:00 (12:00 echte Zeit) | kein Befund | § 13 JArbSchG; SoZV (Ende der Sommerzeit) |
| Frühjahr | Sa 27.3.2027 19:00 – So 7:00 (11:00 echte Zeit) | Verstoß „Freizeit 11:00“ | § 13 JArbSchG; SoZV (Beginn der Sommerzeit) |
| am selben Tag | Mo 0:00 – 4:00, Mo 14:00 – 19:00 (10:00) | Verstoß „Freizeit 10:00“ | § 13 JArbSchG; R-05 |

### R-19 Nachtruhe

- **Norm**: § 14 Abs. 1 JArbSchG: nur von 6 bis 20 Uhr; Abs. 2: über 16 Jahre im Gaststätten- und
  Schaustellergewerbe bis 22 Uhr, in mehrschichtigen Betrieben bis 23 Uhr, in der Landwirtschaft ab
  5 oder bis 21 Uhr, in Bäckereien ab 5 Uhr; Abs. 3: über 17 in Bäckereien ab 4 Uhr; Abs. 4: vor
  einem Berufsschultag mit Beginn vor 9 Uhr nicht nach 20 Uhr.
- **Grenzwerte**: Uhrzeit in `Europe/Berlin`, gezählt werden die echten Minuten der Arbeit außerhalb
  der erlaubten Zeit (kurze Unterbrechungen mit). „Über 16 Jahre“ ist, wer 16 geworden ist. Das
  Alter und die Branche des Arbeitstags bestimmen die Grenzen. In der Landwirtschaft wählt der
  Betrieb „ab 5 Uhr“ oder „bis 21 Uhr“; ohne Wahl gilt 6 bis 20 Uhr.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 17-jähriger Azubi SHK, 7:00 – 16:00 | kein Befund | § 14 Abs. 1 JArbSchG |
| Grenze | SHK, 12:00 – 20:00 | kein Befund | § 14 Abs. 1 JArbSchG |
| Verstoß | SHK, 12:00 – 20:01 | Verstoß „nach 20 Uhr“ | § 14 Abs. 1 JArbSchG |
| Gastronomie | 17-jährige im Café, 14:00 – 22:00, nächster Tag kein Berufsschultag | kein Befund | § 14 Abs. 2 Nr. 1 JArbSchG |
| Berufsschule | Café, 14:00 – 22:00, am nächsten Tag Berufsschule ab 8:00 | Verstoß | § 14 Abs. 4 JArbSchG |
| ohne Eintrag | Café, 17 Jahre, 14:00 – 22:00, keine Berufsschultage eingetragen | Verstoß für 2:00 nach 20 Uhr (jeder Tag kann ein Berufsschultag sein) | § 14 Abs. 4 JArbSchG; Regel dieser Seite |
| unter 16 | 15-jährige im Café, 14:00 – 22:00, kein Berufsschultag | Verstoß für 2:00 nach 20 Uhr | § 14 Abs. 1, Abs. 2 JArbSchG („über 16 Jahre“) |
| Bäckerei | 17-jähriger in einer Bäckerei, 4:00 – 12:00 | kein Befund; mit 16 Jahren Verstoß für 1:00 vor 5 Uhr | § 14 Abs. 2 Nr. 4, Abs. 3 JArbSchG |

### R-20 Fünf-Tage-Woche, Samstag, Sonntag, Feiertag

- **Norm**: § 15 JArbSchG (nur an fünf Tagen je Woche); § 16 (Samstag nur in den Fällen des
  Abs. 2, dann Freistellung an einem anderen Tag derselben Woche); § 17 (Sonntag nur in den Fällen
  des Abs. 2, mindestens zwei Sonntage im Monat frei); § 18 (Feiertage, am 24. und 31.12. nicht
  nach 14 Uhr; nie am 25.12., 1.1., Ostersonntag, 1.5.).
- **Grenzwerte**: Ein Tag mit Arbeit ist jeder Kalendertag, in den von 0 bis 24 Uhr Arbeit fällt.
  Je Woche (Mo–So) höchstens fünf; Samstag und Sonntag nur mit einer Ausnahme nach § 16 Abs. 2 und
  § 17 Abs. 2 (Einstellung oder Branche); mit Ausnahme sind im Kalendermonat mindestens zwei
  Sonntage frei, ein Verstoß, sobald so viele gearbeitet sind, dass es nicht mehr geht. Feiertage
  am Standort nur mit einer Ausnahme nach § 17 Abs. 2, nie am 25.12., 1.1., Ostersonntag und 1.5.;
  am 24. und 31.12. keine Arbeit nach 14 Uhr. Die Freistellung für einen Feiertag an einem Werktag
  (§ 18 Abs. 3) braucht den Dienstplan und kommt mit S-502.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo–Fr gearbeitet | kein Befund | § 15 JArbSchG |
| Grenze | Café (Gaststättengewerbe), Di–Sa gearbeitet, Mo frei | kein Befund | §§ 15, 16 Abs. 2 Nr. 6, Abs. 3 JArbSchG |
| Verstoß | Mo–Sa gearbeitet | Verstoß „sechs Arbeitstage“ | § 15 Satz 1 JArbSchG |
| Verstoß | SHK, Samstag gearbeitet | Verstoß „Samstag“ | § 16 Abs. 1 JArbSchG |
| Verstoß | Café, Februar 2026 (vier Sonntage), drei Sonntage im Monat gearbeitet | Verstoß „mindestens zwei Sonntage frei“ | § 17 Abs. 2 Satz 2 JArbSchG |
| fünf Sonntage | Café, November 2026 (fünf Sonntage), drei gearbeitet, zwei frei | kein Befund | § 17 Abs. 2 Satz 2 JArbSchG („mindestens zwei“; „jeder zweite Sonntag soll“ ist keine Pflicht) |
| Verstoß | Café, 24.12. 10:00 – 14:01 | Verstoß „nach 14 Uhr“ | § 18 Abs. 1 JArbSchG |
| Heiligabend | Café, Do 24.12.2026 10:00 – 14:00 | kein Befund | § 18 Abs. 1 JArbSchG („nach 14 Uhr“) |
| Sonntag | SHK, So 10:00 – 12:00 | Verstoß „Sonntag“ | § 17 Abs. 1 JArbSchG |
| Feiertag | SHK in Hamburg, Mo 25.5.2026 (Pfingstmontag) 8:00 – 12:00 | Verstoß „Feiertag“ | § 18 Abs. 1 JArbSchG |
| 25. Dezember | Café, Fr 25.12.2026 10:00 – 14:00 | Verstoß „Feiertag“ (auch im Gaststättengewerbe) | § 18 Abs. 2 JArbSchG |
| Ostersonntag | Café in Hamburg, So 5.4.2026 10:00 – 14:00 | Verstoß „Feiertag“ (der erste Osterfeiertag, auch wo er kein gesetzlicher Feiertag ist) | § 18 Abs. 2 JArbSchG; Regel dieser Seite |

## Mutterschutz

### R-21 Schwangere und stillende Frauen

Gilt, solange am Mitarbeiter ein Zeitraum für Mutterschutz eingetragen ist (Datenmodell,
`mitarbeiter`). Soll speichert dafür nur den Zeitraum, keinen Befund und kein Attest.

- **Norm**: § 3 MuSchG (Schutzfristen: sechs Wochen vor, acht Wochen nach der Entbindung, zwölf
  bei Früh- und Mehrlingsgeburten und auf Antrag, wenn binnen acht Wochen eine Behinderung des
  Kindes ärztlich festgestellt wird, Abs. 2 Satz 2 Nr. 3; nach einer Fehlgeburt ab der 13., 17. und
  20. Schwangerschaftswoche zwei, sechs und acht Wochen, soweit sich die Frau nicht ausdrücklich
  zur Arbeit bereit erklärt, § 3 Abs. 5 MuSchG, seit 1. Juni 2025); § 4 Abs. 1 (über 18 Jahre höchstens 8,5 h täglich und 90 h in
  der Doppelwoche, unter 18 Jahren 8 h und 80 h; nicht mehr als die vertragliche Wochenarbeitszeit im
  Monatsdurchschnitt), Abs. 2 (Ruhezeit 11 h); § 5 Abs. 1 (nicht zwischen 20 und 6 Uhr, bis 22 Uhr
  nur unter den Voraussetzungen des § 28); § 6 Abs. 1 (Sonn- und Feiertage nur mit Erklärung, mit
  Ausnahme nach § 10 ArbZG und einem Ersatzruhetag je Woche).
- **Ausnahmen**: Nach dem Tod des Kindes darf die Frau nach Ablauf der ersten zwei Wochen nach der
  Entbindung arbeiten, wenn sie es ausdrücklich verlangt und nach ärztlichem Zeugnis nichts dagegen
  spricht (§ 3 Abs. 4 MuSchG); der Betrieb trägt dann das Ende der Schutzfrist am Mitarbeiter ein,
  ohne Grund und ohne Zeugnis.
- **Eingaben**: der Zeitraum (schwanger oder stillend, ohne zu sagen, was), das Geburtsdatum (ohne
  Geburtsdatum gelten die Grenzen für unter 18 Jahre), die vertragliche Wochenarbeitszeit je Tag
  (aus dem Arbeitszeitmodell; ohne sie ist der Monat „nicht hinterlegt“), die Schutzfristen mit
  Beginn, Ende, Art und einer ausdrücklichen Erklärung der Frau, die Erklärung zur Sonn- und
  Feiertagsarbeit mit Zeitraum, die Ausnahmen nach § 10 ArbZG am Betrieb (R-07) und eine
  Genehmigung nach § 28 mit Fundstelle. Was nicht eingetragen ist, gilt als nicht gegeben.
- **Grenzwerte**: Tag ≤ 8:30 (unter 18 Jahren 8:00), gemessen wie R-02. Doppelwoche: je zwei
  aufeinanderfolgende Kalenderwochen (Mo–So), also jede Woche mit der folgenden und mit der
  vorigen, ≤ 90:00 (unter 18 Jahren, wenn sie es an einem Tag der Doppelwoche ist, 80:00).
  Monat: Arbeitszeit des Kalendermonats × 7 ≤ Summe der vertraglichen Wochenarbeitszeit über
  seine Tage, ganze Minuten ohne Rundung; es zählen nur die Tage im Zeitraum. Ruhezeit ≥ 11:00
  zwischen zwei Arbeitstagen, wenn einer davon im Zeitraum liegt (wie R-05, ohne Verkürzung).
  Nacht: keine Arbeit von 20 bis 6 Uhr, mit Genehmigung nach § 28 von 22 bis 6 Uhr, Uhrzeit, echte
  Minuten. Sonn- und Feiertag (0 bis 24 Uhr am Standort, wie R-07, ohne Verschiebung) nur mit
  Erklärung und einer Ausnahme nach § 10 ArbZG, dazu in derselben Woche (Mo–So) ein vergangener
  Werktag ohne Arbeit als Ersatzruhetag, vor dem 11:00 ohne Arbeit liegen (die Woche wird geprüft,
  wenn sie vorbei ist). Schutzfrist: jeder Kalendertag in ihr, in den Arbeit fällt.
- **Schutzfristen** rechnet Soll so: vor der Entbindung die sechs Wochen vor dem voraussichtlichen
  Tag und dieser Tag selbst, nach der Entbindung die acht (zwölf) Wochen nach dem Tag der Entbindung,
  nach einer Fehlgeburt der Tag selbst und die zwei, sechs oder acht Wochen danach. Die Woche der
  Schwangerschaft braucht Soll nur für diese Rechnung, gespeichert wird der Zeitraum.
- **Schwere**: Verstoß. In der Schutzfrist nach der Entbindung ist jede Arbeitszeit ein Verstoß (außer nach § 3 Abs. 4);
  vor der Entbindung und nach einer Fehlgeburt nur, wenn keine ausdrückliche Erklärung der Frau
  eingetragen ist (§ 3 Abs. 1 Satz 1, Abs. 5 Satz 1 MuSchG).

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo 8:00 – 16:30 mit 30 min Pause (8:00) | kein Befund | § 4 Abs. 1 Satz 1 MuSchG |
| Grenze | Arbeitszeit 8:30 an einem Tag, Doppelwoche 90:00 | kein Befund | § 4 Abs. 1 Satz 1 MuSchG |
| Verstoß | Arbeitszeit 8:31 | Verstoß „über 8:30“ | § 4 Abs. 1 Satz 1 MuSchG |
| Verstoß | Doppelwoche 90:01 | Verstoß „über 90 h in der Doppelwoche“ | § 4 Abs. 1 Satz 1 MuSchG |
| Grenze | 12:00 – 20:00 | kein Befund | § 5 Abs. 1 Satz 1 MuSchG |
| Verstoß | 12:00 – 20:01 ohne Genehmigung nach § 28 | Verstoß „nach 20 Uhr“ | § 5 Abs. 1 MuSchG |
| Verstoß | Arbeit in der Woche nach der Entbindung | Verstoß „Schutzfrist“ | § 3 Abs. 2 MuSchG |
| Fehlgeburt | Fehlgeburt in der 18. Schwangerschaftswoche, Arbeit in der 5. Woche danach ohne Erklärung | Verstoß „Schutzfrist“ | § 3 Abs. 5 Satz 1 Nr. 2 MuSchG |
| Fehlgeburt | wie zuvor, mit ausdrücklicher Erklärung der Frau | kein Befund | § 3 Abs. 5 Satz 1 MuSchG |
| unter 18 | 17 Jahre, Arbeitszeit 8:01 | Verstoß „über 8 h“ | § 4 Abs. 1 Satz 2 MuSchG |
| Geburtstag | geboren 16.6.2008: Mo 15.6.2026 und Di 16.6.2026 (18. Geburtstag) je 8:01 | Verstoß „über 8 h“ nur für Mo | § 4 Abs. 1 Satz 2 MuSchG; § 187 Abs. 2 Satz 2 BGB |
| Doppelwoche | 2.–8.11.2026 und 16.–22.11.2026 je 45:00, dazwischen 9.–15.11. 45:01 | Verstoß für die Doppelwochen ab 2.11. und ab 9.11. | § 4 Abs. 1 Satz 1 und 3 MuSchG; Grundbegriff „Doppelwoche“ |
| 18. Geburtstag | geboren 4.11.2008: Mi 4.11. bis So 15.11.2026 je 7:00 (84:00) | Verstoß „über 80 h in der Doppelwoche“ ab 2.11. (am Mo und Di noch 17) | § 4 Abs. 1 Satz 2 und 3 MuSchG |
| Monat | vertraglich 20:00 je Woche, November 2026 (30 Tage) mit 85:42 | kein Befund (20:00 × 30 ÷ 7 = 85:42 und 6/7 min); mit 85:43 Verstoß „über der vertraglichen Arbeitszeit“ | § 4 Abs. 1 Satz 4 MuSchG |
| Ruhezeit | Mo 19:30 – Di 6:29 (10:59) | Verstoß „Ruhezeit 10:59“; Mo 19:00 – Di 6:00 (11:00) kein Befund | § 4 Abs. 2 MuSchG |
| Ruhezeit am selben Tag | Mo 0:00 – 4:00, Mo 14:00 – 18:00 (10:00) | Verstoß „Ruhezeit 10:00“ | § 4 Abs. 2 MuSchG; R-05 |
| Genehmigung | Genehmigung nach § 28, 12:00 – 22:00 | kein Befund; 12:00 – 22:01 Verstoß „nach 22 Uhr“ | § 5 Abs. 1 Satz 2, § 28 MuSchG |
| Herbst | Sa 24.10.2026 22:00 – So 6:00 | Verstoß „nach 20 Uhr“ für 9:00 (echte Zeit) | § 5 Abs. 1 MuSchG; SoZV (Ende der Sommerzeit) |
| Sonntag | Café mit Ausnahme nach § 10 Abs. 1 Nr. 4 ArbZG, So 15.11.2026 10:00 – 16:00, ohne Erklärung | Verstoß „Sonntag“ | § 6 Abs. 1 Satz 1 MuSchG |
| Erklärung | wie zuvor, mit Erklärung; in derselben Woche Mo 9.11. 8:00 – 13:00, Di 10.11. frei, Mi bis Sa gearbeitet | kein Befund | § 6 Abs. 1 Satz 2 MuSchG |
| Nachtruhe | wie zuvor, aber Mo 9.11. bis 13:01 (10:59 vor dem freien Di) | Verstoß „Ersatzruhetag fehlt“ | § 6 Abs. 1 Satz 2 Nr. 3 MuSchG |
| ohne Ausnahme | SHK ohne Ausnahme nach § 10 ArbZG, mit Erklärung, So 10:00 – 12:00 | Verstoß „Sonntag“ | § 6 Abs. 1 Satz 2 Nr. 2 MuSchG |
| Feiertag | Hamburg, Fr 25.12.2026 8:00 – 12:00, ohne Erklärung | Verstoß „Feiertag“ | § 6 Abs. 1 Satz 1 MuSchG |
| Ende der Schutzfrist | Entbindung Mo 2.11.2026, Arbeit am Mo 28.12.2026 | Verstoß „Schutzfrist“ (Ablauf der acht Wochen); am Di 29.12. kein Befund | § 3 Abs. 2 Satz 1 MuSchG |

## Arbeit auf Abruf

### R-22 Vorlauf und Mindestdauer

- **Norm**: § 12 Abs. 3 Satz 2 TzBfG: Pflicht zur Arbeit nur, wenn die Lage „jeweils mindestens vier
  Tage im Voraus“ mitgeteilt wird; § 12 Abs. 1 Satz 4: ohne vereinbarte tägliche Dauer mindestens
  drei aufeinanderfolgende Stunden; § 12 Abs. 1 Satz 3: ohne vereinbarte Wochenarbeitszeit gelten
  20 Stunden; § 12 Abs. 3 Satz 1: der Betrieb legt den Zeitrahmen (Referenzstunden und -tage) fest, in dem
  abgerufen werden kann; Arbeit außerhalb verpflichtet ebenfalls nicht.
- **Regel**: Für Mitarbeiter mit Arbeit auf Abruf (Merkmal an der Person, das der Inhaber unter
  „Angaben zur Prüfung“ setzt) prüft der Dienstplan den Abstand zwischen Mitteilung und
  Schichtbeginn. Mitgeteilt ist eine Schicht mit ihrer Veröffentlichung (S-503); ein Entwurf
  frühestens heute, so warnt der Plan schon beim Einplanen. Der Tag der Mitteilung zählt nicht mit
  (§ 187 Abs. 1 BGB): Mitteilung am Mo, frühester Schichttag Sa. Eine tägliche Dauer ist vereinbart,
  wenn das Arbeitszeitmodell für den Wochentag Minuten hat; sonst gelten mindestens 3 Stunden.
- **Ausnahmen**: Tarifvertrag nach § 12 Abs. 6 TzBfG (Einstellung).
- **Schwere**: Hinweis (die Person muss dann nicht kommen; verboten ist die Schicht nicht).

| Fall | Mitteilung – Schicht | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo – Mo der Folgewoche | kein Befund | § 12 Abs. 3 Satz 2 TzBfG |
| Grenze | Mo – Sa (vier volle Tage Di bis Fr dazwischen) | kein Befund | § 12 Abs. 3 Satz 2 TzBfG; § 187 Abs. 1 BGB |
| Verstoß | Mo 10:00 – Fr 10:00 (drei volle Tage Di bis Do dazwischen) | Hinweis „keine Pflicht zur Arbeit, Vorlauf 3 Tage“: der Mitteilungstag und der Tag der Arbeit zählen nicht | § 12 Abs. 3 Satz 2 TzBfG; § 187 Abs. 1 BGB |
| Verstoß | Mo – Do (zwei volle Tage dazwischen) | Hinweis „keine Pflicht zur Arbeit, Vorlauf 2 Tage“ | § 12 Abs. 3 Satz 2 TzBfG |
| Dauer | Abruf ohne vereinbarte Tagesdauer für 2:30 | Hinweis „mindestens 3 Stunden“ | § 12 Abs. 1 Satz 4 TzBfG |
| Dauer | Abruf ohne vereinbarte Tagesdauer für 3:00, oder mit vereinbarter Tagesdauer für 2:30 | kein Befund | § 12 Abs. 1 Satz 4 TzBfG („wenn die Dauer … nicht festgelegt ist“) |
| am selben Tag | Entwurf für heute | Hinweis „keine Pflicht zur Arbeit, Vorlauf 0 Tage“ | § 12 Abs. 3 Satz 2 TzBfG |

Hinweis zur Grenze: Die Frist von vier Tagen ist erst gewahrt, wenn zwischen dem Tag der Mitteilung
und dem Tag der Arbeit vier volle Tage liegen; so lesen es die Kommentare (ErfK/Preis, § 12 TzBfG).
Soll prüft deshalb vorsichtig: Mitteilung am Montag reicht für eine Schicht ab Samstag.

## Urlaub

### R-23 Mindesturlaub, Teilurlaub, Übertragung

- **Norm**: § 3 BUrlG (mindestens 24 Werktage, Werktage sind alle Tage außer Sonn- und Feiertagen);
  § 5 (ein Zwölftel je vollem Monat, Bruchteile ab einem halben Tag aufrunden); § 7 Abs. 3 (Urlaub im
  Kalenderjahr, übertragen nur bis 31. März des Folgejahres; Teilurlaub nach § 5 Abs. 1 Buchst. a
  auf Verlangen der Person in das ganze nächste Kalenderjahr, § 7 Abs. 3 Satz 4).
- **Regel**: Das Arbeitszeitmodell gibt den Urlaub in Arbeitstagen; Soll prüft, dass er umgerechnet
  nicht unter dem gesetzlichen Mindesturlaub liegt (24 Werktage bei 6 Tagen = 20 Arbeitstage bei 5,
  allgemein `24 × Arbeitstage je Woche ÷ 6`), und rechnet darunter mit dem Mindesturlaub
  (§ 13 Abs. 1 Satz 1 BUrlG). Urlaub in halben Tagen (CLAUDE.md). Volle Monate zählen vom Tag des
  Eintritts an (§§ 187 Abs. 2, 188 Abs. 2 und 3 BGB), nicht nach Kalendermonaten; wechseln die
  Arbeitstage je Woche im Jahr, zählt jedes Modell mit seinen Tagen im Jahr (EuGH C-415/12, Brandes).
  Übertragener Urlaub verfällt nur, wenn der Betrieb die Person rechtzeitig auf den offenen Urlaub
  und den Verfall hingewiesen hat (EuGH C-684/16, Max-Planck; BAG, 19.02.2019, 9 AZR 423/16): Soll
  verlangt den Hinweis drei Monate vor dem Verfall, also bis 31. Dezember (beim übertragenen
  Teilurlaub bis 30. September des Folgejahres); ein späterer Hinweis lässt den Urlaub erst mit dem
  31. März nach dem Jahr des Hinweises verfallen, ohne Hinweis verfällt er nicht (BAG, 20.12.2022,
  9 AZR 266/20). Genommener Urlaub zählt zuerst gegen den ältesten offenen Urlaub.
- **Schwere**: Hinweis am Arbeitszeitmodell; Hinweis auf Verfall (S-208) zum 31. März, für
  übertragenen Teilurlaub nach § 7 Abs. 3 Satz 4 BUrlG zum 31. Dezember des Folgejahres.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 5-Tage-Woche, 25 Urlaubstage | kein Befund | § 3 Abs. 1 BUrlG |
| Grenze | 5-Tage-Woche, 20 Urlaubstage | kein Befund | § 3 Abs. 1 BUrlG (24 × 5 ÷ 6 = 20) |
| Verstoß | 5-Tage-Woche, 19,5 Urlaubstage | Hinweis „unter dem gesetzlichen Mindesturlaub“ | § 3 Abs. 1 BUrlG |
| Teilurlaub | Eintritt 1.8., 20 Tage, 5 volle Monate | 5 × 20 ÷ 12 = 8,33 → 8,5 Tage (nicht abgerundet; Soll führt halbe Tage und rundet zugunsten der Person auf) | § 5 Abs. 1 Buchst. a, Abs. 2 BUrlG; BAG, 26.01.1989, 8 AZR 730/87 |
| Rundung | Austritt 30.4. nach erfüllter Wartezeit, 20 Tage, 4 volle Monate: 6,67 | 7 Tage | § 5 Abs. 1 Buchst. c, Abs. 2 BUrlG |
| Wartezeit | Eintritt 1.6., 20 Tage, 7 volle Monate (Wartezeit am 30.11. erfüllt) | 20 Tage, kein Teilurlaub | §§ 4, 5 Abs. 1 Buchst. a BUrlG |
| 4-Tage-Woche | Modell Mo–Do ohne eigenen Urlaub, ganzes Jahr | 16 Tage | § 3 Abs. 1 BUrlG (24 × 4 ÷ 6) |
| Wartezeit am 31.12. | Eintritt 1.7., 20 Tage, Wartezeit am 31.12. erfüllt | 20 Tage, kein Teilurlaub | § 4 BUrlG; §§ 187 Abs. 2, 188 Abs. 2 BGB |
| Eintritt 2.7. | 20 Tage, 5 volle Monate (2.7. – 1.12.), Wartezeit erst am 1.1. erfüllt | 5 × 20 ÷ 12 = 8,33 → 8,5 Tage | § 5 Abs. 1 Buchst. a, Abs. 2 BUrlG |
| Monatsmitte | Eintritt 15.8., 20 Tage, 4 volle Monate (15.8. – 14.12.) | 4 × 20 ÷ 12 = 6,67 → 7 Tage | § 5 Abs. 1 Buchst. a, Abs. 2 BUrlG; § 188 Abs. 2 BGB |
| vor der Wartezeit | Eintritt 1.2., Austritt 30.6., 20 Tage, 5 volle Monate | 8,5 Tage | § 5 Abs. 1 Buchst. b BUrlG |
| zweites Halbjahr | Austritt 31.7. nach erfüllter Wartezeit, 20 Tage | 20 Tage | § 5 Abs. 1 Buchst. c BUrlG („in der ersten Hälfte eines Kalenderjahrs“) |
| halber Tag im vollen Jahr | Modell mit 25,5 Tagen, ganzes Jahr | 25,5 Tage (nichts zu runden) | § 5 Abs. 2 BUrlG gilt nur für § 5 Abs. 1; BAG, 26.01.1989, 8 AZR 730/87 |
| Modellwechsel | bis 30.6.2026 Mo–Fr, ab 1.7.2026 Mo–Mi, ohne eigenen Urlaub | 20 × 181 ÷ 365 + 12 × 184 ÷ 365 = 15,97 → 16 Tage | EuGH C-415/12 (Brandes); § 5 Abs. 2 BUrlG |
| Verfall mit Hinweis | Resturlaub 2026 3 Tage, Hinweis am 1.10.2026 | Hinweis „Verfall droht“ bis 31.3.2027, danach 3 Tage verfallen | § 7 Abs. 3 Satz 3 BUrlG; BAG, 19.02.2019, 9 AZR 423/16 |
| Verfall ohne Hinweis | Resturlaub 2026 3 Tage, kein Hinweis | ab 1.1.2027 Hinweis „Hinweis auf Verfall fehlt“, die 3 Tage verfallen nicht | EuGH C-684/16 (Max-Planck); BAG, 20.12.2022, 9 AZR 266/20 |
| Hinweis verspätet | Resturlaub 2026 3 Tage, Hinweis erst am 15.1.2027 | verfällt nicht zum 31.3.2027, sondern mit Ablauf des 31.3.2028 | BAG, 19.02.2019, 9 AZR 423/16 |
| Hinweis fällig | Resturlaub 2026, noch kein Hinweis, Stand 20.11.2026 | Hinweis „Hinweis auf Verfall fällig bis 31.12.2026“ | docs/plan.md, „Verfall von Urlaub“ |
| Teilurlaub übertragen | Eintritt 1.8.2026, 8,5 Tage, Übertragung verlangt, Hinweis am 1.9.2026 | verfällt mit Ablauf des 31.12.2027 | § 7 Abs. 3 Satz 4 BUrlG |

Hinweis zur Rundung: § 5 Abs. 2 BUrlG rundet nur Bruchteile ab einem halben Tag auf; kleinere
Bruchteile werden nicht abgerundet, sondern bleiben geschuldet (BAG, 26.01.1989, 8 AZR 730/87).
Soll führt Urlaub in halben Tagen und rundet sie deshalb auf den nächsten halben Tag auf (8,33 auf
8,5). § 5 Abs. 2 gilt nur für den Teilurlaub nach § 5 Abs. 1 (dieselbe Entscheidung): Ein Modell mit
25,5 Tagen gibt im ganzen Jahr 25,5 Tage, nicht 26.

### R-24 Krank im Urlaub

- **Norm**: § 9 BUrlG: durch ärztliches Zeugnis nachgewiesene Tage der Arbeitsunfähigkeit werden
  auf den Jahresurlaub nicht angerechnet.
- **Regel**: Fällt eine Krankmeldung mit „Bescheinigung liegt vor“ in genehmigten Urlaub, zählen
  diese Tage nicht als Urlaub; ohne Bescheinigung zählen sie als Urlaub und Soll weist darauf hin.
- **Schwere**: Hinweis.

| Fall | Urlaub Mo–Fr | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | ohne Krankheit | 5 Urlaubstage | § 9 BUrlG |
| Grenze | krank Fr, Bescheinigung liegt vor | 4 Urlaubstage, 1 Krankheitstag | § 9 BUrlG |
| Verstoß | krank Mi–Fr, keine Bescheinigung | 5 Urlaubstage, Hinweis „Bescheinigung fehlt“ | § 9 BUrlG („durch ärztliches Zeugnis nachgewiesen“) |

### R-25 Zusatzurlaub

- **Norm**: § 208 Abs. 1 SGB IX: fünf Arbeitstage bei fünf Arbeitstagen je Woche, entsprechend mehr
  oder weniger; Abs. 2: ein Zwölftel je vollem Monat, ab einem halben Tag aufrunden.
- **Regel**: Die Schwerbehinderung steht am Mitarbeiter nur als Zeitraum. Besteht sie während der
  ganzen Beschäftigung im Jahr, folgt der Zusatzurlaub dem Urlaub (auch dem Teilurlaub nach § 5
  BUrlG); sonst ein Zwölftel je vollem Monat (Zeiträume, die nahtlos aneinander anschließen oder sich überschneiden, zählen als einer), und bei einem Modellwechsel zählen nur die Arbeitstage
  je Woche der Tage mit Schwerbehinderung (EuGH C-415/12, Brandes). Er wird für sich gerundet und dem Urlaub hinzugerechnet
  (§ 208 Abs. 2 Satz 3 SGB IX); die Kürzung bei Elternzeit trifft ihn nicht.
- **Schwere**: Hinweis, wenn der eingetragene Zusatzurlaub darunter liegt.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 5-Tage-Woche, ganzes Jahr | 5 Tage | § 208 Abs. 1 SGB IX |
| Grenze | 4-Tage-Woche, ganzes Jahr | 4 Tage | § 208 Abs. 1 Satz 1 SGB IX |
| anteilig | Schwerbehinderung ab 1.7., 5-Tage-Woche (6 volle Monate) | 2,5 → 3 Tage | § 208 Abs. 2 SGB IX |
| Verstoß | 5-Tage-Woche, ganzes Jahr, 4 Tage eingetragen | Hinweis „Zusatzurlaub unter dem Gesetz“ | § 208 Abs. 1 Satz 1 SGB IX |
| 6-Tage-Woche | ganzes Jahr | 6 Tage | § 208 Abs. 1 Satz 1 SGB IX („entsprechend mehr“) |
| Bruchteil | Schwerbehinderung ab 15.7., 5-Tage-Woche (5 volle Monate) | 5 × 5 ÷ 12 = 2,08 → 2,5 Tage | § 208 Abs. 2 SGB IX; BAG, 26.01.1989, 8 AZR 730/87 |
| Modellwechsel | bis 30.9. Mo–Di, ab 1.10. Mo–Fr, Schwerbehinderung ab 1.10. (3 volle Monate) | 5 × 3 ÷ 12 = 1,25 → 1,5 Tage (nicht über das ganze Jahr gewichtet: 0,69 → 1) | § 208 Abs. 2 SGB IX; EuGH C-415/12 (Brandes) |
| Bescheid verlängert | Schwerbehinderung 1.2.–15.4. und nahtlos 16.4.–30.6., 5-Tage-Woche (zusammen 5 volle Monate) | 5 × 5 ÷ 12 = 2,08 → 2,5 Tage (nicht je Eintrag 2 + 2 Monate: 1,67 → 2) | § 208 Abs. 2 SGB IX; §§ 187, 188 BGB |

### R-26 Kürzung bei Elternzeit

- **Norm**: § 17 Abs. 1 BEEG: ein Zwölftel je vollem Kalendermonat der Elternzeit, nicht bei
  Teilzeit beim selben Arbeitgeber.
- **Regel**: Die Kürzung ist ein Recht des Betriebs, keine Automatik: Soll schlägt sie vor, der
  Betrieb bestätigt sie (im Audit-Log). Gekürzt wird der Jahresurlaub um die erklärten Zwölftel,
  höchstens eines je vollem Kalendermonat, und das Ergebnis wie in R-23 gerundet; ohne Erklärung
  wird nichts gekürzt.
- **Schwere**: Hinweis.

| Fall | Elternzeit | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 15.3. – 14.5. (ein voller Kalendermonat: April) | Kürzung um 1/12 vorgeschlagen | § 17 Abs. 1 Satz 1 BEEG |
| Grenze | 2.3. – 31.3. (kein voller Kalendermonat) | keine Kürzung | § 17 Abs. 1 Satz 1 BEEG („jeden vollen Kalendermonat“) |
| ausgenommen | 1.4. – 30.6. in Teilzeit beim Betrieb | keine Kürzung | § 17 Abs. 1 Satz 2 BEEG |
| Verstoß | ein voller Kalendermonat, Kürzung um 2/12 eingetragen | Hinweis „Kürzung über 1/12 je vollem Monat“ | § 17 Abs. 1 Satz 1 BEEG |
| Jahreswechsel | 15.10.2026 – 14.3.2027 | 2026: November, Dezember (2/12); 2027: Januar, Februar (2/12) | § 17 Abs. 1 Satz 1 BEEG |
| nicht erklärt | ein voller Kalendermonat, keine Erklärung des Betriebs | keine Kürzung, Hinweis mit dem Vorschlag | § 17 Abs. 1 Satz 1 BEEG („kann … kürzen“) |
| Schaltjahr | 1.2.2028 – 28.2.2028 | keine Kürzung (der 29.2. fehlt) | § 17 Abs. 1 Satz 1 BEEG |

## Krankheit

### R-27 Bescheinigung ab dem vierten Tag, eAU

- **Norm**: § 5 Abs. 1 Satz 2 EntgFG: dauert die Arbeitsunfähigkeit länger als drei Kalendertage,
  Bescheinigung „spätestens an dem darauffolgenden Arbeitstag“; Satz 3: der Arbeitgeber kann sie
  früher verlangen; Abs. 1a: gesetzlich Versicherte lassen die Arbeitsunfähigkeit nur feststellen,
  der Arbeitgeber ruft die eAU bei der Krankenkasse ab (§ 109 SGB IV).
- **Regel**: Soll erinnert die Person am Tag, an dem die Bescheinigung fällig ist, und den Betrieb,
  die eAU über sein Lohnprogramm abzurufen. Gespeichert wird nur „Bescheinigung liegt vor“ (eAU oder
  Papier im Büro), keine Diagnose und keine Datei (CLAUDE.md, Art. 9 DSGVO).
- **Grenzwerte**: Erster Krankheitstag ist Tag 1; dauert die Krankheit über Tag 3 hinaus, ist die
  Bescheinigung am nächsten Arbeitstag nach Tag 3 fällig (bei Krankheit ab Montag also Donnerstag).
  Der Betrieb kann „ab Tag 1“, „ab Tag 2“ oder „ab Tag 3“ einstellen; dann ist die Bescheinigung am
  ersten Arbeitstag ab diesem Tag fällig. Arbeitstag ist ein Tag mit Soll im Arbeitszeitmodell (kein
  Feiertag am Standort, kein freier Tag), ohne Modell Montag bis Freitag. Die Erinnerung an den
  Betrieb gilt ab dem Tag der Fälligkeit, bis „Bescheinigung liegt vor“ markiert ist; der Hinweis
  folgt am Tag danach. Für „Kind krank“ gilt § 5 EntgFG nicht.
- **Umsetzung** (S-401): `bescheinigungPruefen()` in `packages/arbeitszeit/src/abwesenheit/`; der
  Hinweis steht an der Krankmeldung und in der Liste des Betriebs, nicht im Monatsabschluss: Er gilt
  einem Dokument, nicht der Arbeitszeit, und änderte sonst die Bestätigung des Monats.
- **Schwere**: Hinweis.

| Fall | krank ab | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo – Mi (3 Kalendertage) | keine Bescheinigung nötig | § 5 Abs. 1 Satz 2 EntgFG |
| Grenze | Mo – Do (4 Kalendertage) | fällig am Do, Erinnerung an die eAU | § 5 Abs. 1 Satz 2 EntgFG |
| Wochenende | Fr – Mo (4 Kalendertage) | fällig am Mo (nächster Arbeitstag nach So) | § 5 Abs. 1 Satz 2 EntgFG |
| Einstellung | Betrieb „ab Tag 1“, krank Mo | fällig am Mo | § 5 Abs. 1 Satz 3 EntgFG |
| Einstellung „ab Tag 2“ | krank Mo – Di | fällig am Di; nur Mo: keine nötig | § 5 Abs. 1 Satz 3 EntgFG |
| Feiertag | krank ab Mo 11.5.2026, Do 14.5. Christi Himmelfahrt | fällig am Fr 15.5. | § 5 Abs. 1 Satz 2 EntgFG („Arbeitstag“) |
| Verstoß | krank Mo – Fr, am Fr noch keine Bescheinigung | Hinweis an Person und Betrieb „Bescheinigung fällig seit Do“ | § 5 Abs. 1 Satz 2 EntgFG |

### R-28 Kinderkrankentage

- **Norm**: § 45 Abs. 2 SGB V: je Kind 10 Arbeitstage, alleinerziehend 20, höchstens 25 bzw. 50;
  Abs. 2a für das Jahr 2026: je Kind 15, alleinerziehend 30, höchstens 35 bzw. 70; Kind unter 12
  Jahren oder behindert und auf Hilfe angewiesen, dann ohne Altersgrenze (Abs. 1 Satz 1).
- **Regel**: Soll zählt die Tage „Kind krank“ je Kind und Jahr; die Höchstwerte sind Jahreswerte
  (S-104). Fehlen sie für ein Jahr, „nicht hinterlegt“.
- **Schwere**: Hinweis bei Erreichen des Anspruchs (der Betrieb muss nicht ablehnen, das Krankengeld
  endet).

| Fall | 2026, ein Kind, nicht alleinerziehend | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 10 Tage | kein Befund | § 45 Abs. 2a Satz 1 SGB V |
| Grenze | 15 Tage | Hinweis „Anspruch erreicht“ | § 45 Abs. 2a Satz 1 SGB V |
| Verstoß | 16 Tage | Hinweis „über dem Anspruch auf Krankengeld“ | § 45 Abs. 2a Satz 1 SGB V |
| 2027 | 11 Tage, ohne neue Regelung | Hinweis (10 Tage nach Abs. 2) | § 45 Abs. 2 Satz 1 SGB V |

## Zuschläge

### R-29 Steuerfreie Zuschläge

- **Norm**: § 3b EStG: steuerfrei bis 25 % für Nachtarbeit (20 bis 6 Uhr), 40 % von 0 bis 4 Uhr,
  wenn die Arbeit vor 0 Uhr aufgenommen wurde; 50 % für Sonntagsarbeit; 125 % an gesetzlichen
  Feiertagen und am 31.12. ab 14 Uhr; 150 % am 24.12. ab 14 Uhr, am 25. und 26.12. und am 1.5.;
  Grundlohn höchstens 50 € je Stunde; Feiertage am Ort der Arbeitsstätte; bei Beginn vor 0 Uhr zählt
  0 bis 4 Uhr des Folgetags noch als Sonn- oder Feiertag (Abs. 3). R 3b LStR, H 3b LStH.
- **Regel**: Soll rechnet je Minute den höchsten anwendbaren Sonn- oder Feiertagssatz plus den
  Nachtsatz (die Sätze addieren sich, R 3b Abs. 3 LStR; ist ein Sonntag zugleich Feiertag, gilt nur der Feiertagssatz, R 3b Abs. 4 LStR). Der Teil des gezahlten Zuschlags über den
  steuerfreien Sätzen ist steuerpflichtig und wird getrennt an DATEV gegeben (S-308). Beträge in
  Cent, gerundet wird auf ganze Cent zugunsten der Steuerfreiheit nur bis zur Grenze.
  Im Einzelnen: Die Sätze des Betriebs (in Basispunkten, 2500 = 25 %) gelten für dieselben Zeiten
  wie § 3b EStG. Zahlt der Betrieb nur einen Zuschlag, ist er bis zur Summe der Sätze steuerfrei
  („auch dann zusammenzurechnen, wenn nur ein Zuschlag gezahlt wird“, R 3b Abs. 3 LStR). „Vor 0 Uhr
  aufgenommen“ heißt: Dieselbe Schicht hat zwischen 20 und 0 Uhr des Vorabends gearbeitet. Es zählt
  die Uhrzeit am Ort, die Nacht der Umstellung im Oktober hat von 0 bis 4 Uhr fünf Stunden, die im
  März drei. Der Stundenlohn aus dem Grundlohn bleibt ein genauer Bruch; gerundet wird erst die
  Summe eines Arbeitstags (des Tags, an dem die Schicht beginnt): der gezahlte Betrag auf, der
  steuerfreie ab, nie über die Grenze; lässt ein Abschnitt mit diesem Zuschlag unter seiner Grenze
  Raum, bleibt der aufgerundete Bruchteil eines Cents steuerfrei. 24.12. und 31.12. ab 14 Uhr sind keine Feiertage und tragen
  sich nicht in den Folgetag (Abs. 3 Nr. 2: „des auf den Sonntag oder Feiertag folgenden Tages“).
- **Schwere**: kein Befund; eine Berechnung. Die Beispiele aus R 3b LStR und H 3b LStH sind die Tests
  (S-207).

| Fall | Lage (Grundlohn 20 €, gezahlt 25 % Nacht) | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mi 22:00 – 23:00 | 5,00 € steuerfrei | § 3b Abs. 1 Nr. 1 EStG |
| Grenze | Grundlohn 50 €, Mi 22:00 – 23:00, gezahlt 25 % | 12,50 € steuerfrei | § 3b Abs. 2 Satz 1 EStG |
| Verstoß | Grundlohn 60 €, gezahlt 15 € | 12,50 € steuerfrei, 2,50 € steuerpflichtig | § 3b Abs. 2 Satz 1 EStG |
| Abs. 3 | Beginn Sa 22:00, Arbeit So 0:00 – 4:00 | 40 % Nacht + 50 % Sonntag je Stunde | § 3b Abs. 1 Nr. 2, Abs. 3 Nr. 1 EStG |
| Abs. 3 | Beginn So 22:00, Arbeit Mo 0:00 – 4:00 | 40 % Nacht + 50 % (Mo bis 4 Uhr gilt als Sonntag) | § 3b Abs. 3 Nr. 2 EStG |
| Feiertag | Arbeit am 1.5. 10:00 – 12:00 | 150 % | § 3b Abs. 1 Nr. 4 EStG |
| R 3b Abs. 3 LStR, Beispiel | Beginn 1.5. 22:00, Ende 2.5. 7:00 | 175 % von 22 bis 24 Uhr (25 % Nacht + 150 % Feiertag), 190 % von 0 bis 4 Uhr (40 % + 150 %), 25 % von 4 bis 6 Uhr, danach nichts | R 3b Abs. 3 LStR (Beispiel) |
| R 3b Abs. 3 LStR, nur ein Zuschlag | So 22:00 – 23:00, gezahlt nur 60 % Nacht | 12,00 € steuerfrei (bis 25 % + 50 %) | R 3b Abs. 3 LStR („auch dann …, wenn nur ein Zuschlag gezahlt wird“) |
| R 3b Abs. 3 LStR, über beiden Sätzen | So 22:00 – 23:00, gezahlt nur 80 % Nacht | 15,00 € steuerfrei, 1,00 € steuerpflichtig | R 3b Abs. 3 LStR |
| R 3b Abs. 4 LStR | Ostersonntag 5.4.2026 10:00 – 12:00 in Brandenburg, gezahlt 50 % Sonntag und 125 % Feiertag | 125 %, nicht 175 %; in Hamburg (kein Feiertag) 50 % | R 3b Abs. 4 LStR; § 2 FTG Brandenburg |
| R 3b Abs. 4 LStR, nur Sonntagszuschlag | Ostersonntag in Brandenburg, gezahlt nur 100 % Sonntag | 40,00 € steuerfrei (bis 125 %) | R 3b Abs. 4 LStR („auch dann, wenn nur ein Sonntagszuschlag gezahlt wird“) |
| H 3b LStH, Grundlohn | 1.589,28 € im Monat, 38 h je Woche | 9,61 € je Stunde (1.589,28 € ÷ 38 h × 4,35) | H 3b LStH (Beispiel zur Ermittlung des Grundlohns); R 3b Abs. 2 LStR |
| Beginn um 0 Uhr | Mo 0:00 – 4:00 nach freiem Sonntag | 25 %, kein Sonntag, keine 40 % | § 3b Abs. 3 EStG („vor 0 Uhr aufgenommen“) |
| Zeitumstellung Oktober | Sa 24.10.2026 22:00 – So 25.10. 6:00 | 0 bis 4 Uhr sind 5 h zu 90 %, 4 bis 6 Uhr 75 % | § 3b Abs. 2 Satz 2, Abs. 3 Nr. 1 EStG |
| Zeitumstellung März | Sa 27.3.2027 22:00 – So 28.3. 6:00 | 0 bis 4 Uhr sind 3 h zu 90 % | § 3b Abs. 2 Satz 2, Abs. 3 Nr. 1 EStG |
| Feiertag über Mitternacht | Do 30.4.2026 22:00 – Fr 1.5. 6:00 | 25 %, 190 % von 0 bis 4 Uhr, 175 % von 4 bis 6 Uhr; Arbeitstag 30.4. | § 3b Abs. 1 Nr. 4, Abs. 3 Nr. 1 EStG |
| 24.12. ab 14 Uhr | Do 24.12.2026 12:00 – 16:00 | bis 14 Uhr nichts, danach 150 % | § 3b Abs. 1 Nr. 4 EStG |
| 31.12. ab 14 Uhr | Do 31.12.2026 12:00 – 16:00 | bis 14 Uhr nichts, danach 125 % | § 3b Abs. 1 Nr. 3 EStG |
| Jahreswechsel | Do 31.12.2026 22:00 – Fr 1.1.2027 6:00 | 150 %, 165 % von 0 bis 4 Uhr (40 % + 125 % Neujahr), 150 % von 4 bis 6 Uhr | § 3b Abs. 1 Nr. 3, Abs. 3 Nr. 1 EStG |
| Grundlohn über 50 € | 80 € je Stunde, 1.5. 10:00 – 11:00, gezahlt 150 % | 75,00 € steuerfrei, 45,00 € steuerpflichtig | § 3b Abs. 2 Satz 1 EStG |
| Rundung | 13,90 € je Stunde, Mi 22:00 – 22:07, gezahlt 25 % | 0,41 € gezahlt (aufgerundet), 0,40 € steuerfrei (abgerundet), 0,01 € steuerpflichtig | CLAUDE.md, „Never“; § 3b Abs. 1 EStG („nicht übersteigen“) |
| Rundung unter der Grenze | 13,90 € je Stunde, So 22:00 – 22:07, gezahlt 25 % Nacht; So 10:00 – 10:07, gezahlt 25 % Sonntag | je 0,41 € gezahlt und 0,41 € steuerfrei (Grenze 75 % bzw. 50 %) | § 3b Abs. 1 EStG („nicht übersteigen“) |
| nicht hinterlegt | Arbeitstag 31.12.2025, vor der ersten Regelversion | „nicht hinterlegt“ | CLAUDE.md, „Never“ |

## Mitbestimmung und Datenschutz

### R-30 Auswertung je Person

- **Norm**: § 87 Abs. 1 Nr. 6 BetrVG: Mitbestimmung bei technischen Einrichtungen, die Verhalten
  oder Leistung überwachen.
- **Regel**: Eine Auswertung je Person (Auslastung, gebuchte gegen anwesende Zeit) gibt es nur,
  wenn der Betrieb sie eingeschaltet hat; die Einstellung steht im Audit-Log, und die Beschäftigten
  sehen, dass sie eingeschaltet ist (DESIGN.md, „Kontrolle sichtbar machen“). Eine Auswertung je
  Team darf keine Person erkennbar machen: Zahlen erst ab drei Personen und nur für abgelaufene
  Monate ([Auslastung](projektzeit.md#auslastung)).
- **Schwere**: Verstoß, wenn eine Auswertung je Person ohne Einstellung erzeugt würde (der Server
  lehnt ab).

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Auswertung je Team | erlaubt | § 87 Abs. 1 Nr. 6 BetrVG |
| Grenze | Auswertung je Team mit nur zwei Personen im Monat | keine Zahlen, nur „zu wenige Personen“ (S-604) | § 87 Abs. 1 Nr. 6 BetrVG; Art. 5 Abs. 1 lit. c DSGVO |
| Grenze | Auswertung je Person, eingeschaltet am 1.11., Abruf am 1.11. | erlaubt, Hinweis an die Beschäftigten | § 87 Abs. 1 Nr. 6 BetrVG |
| Verstoß | Auswertung je Person ohne Einstellung | abgelehnt | § 87 Abs. 1 Nr. 6 BetrVG |

### R-31 Gesundheitsdaten, Auskunft, Löschen

- **Norm**: Art. 9 DSGVO (Gesundheitsdaten), Art. 5 Abs. 1 lit. c und e (Datenminimierung,
  Speicherbegrenzung), Art. 15 (Auskunft), Art. 17 (Löschen), Art. 88 (Beschäftigtenkontext).
- **Regel**: „Krank“ und „Kind krank“ sehen nur die Person, der Inhaber und das Lohnbüro; alle
  anderen sehen „abwesend“. Keine Diagnose, keine hochgeladene Bescheinigung. Die Auskunft gibt alle
  Daten einer Person als Export ([Prüfexport und Auskunft](pruefexport.md)). Nach Ablauf der Frist werden Inhalte entfernt (S-901).
- **Schwere**: Verstoß, wenn eine Ansicht oder Schnittstelle einer anderen Rolle „krank“ zeigen
  würde (der Server lehnt ab).

| Fall | Rolle | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Person selbst sieht „krank“ | sichtbar | Art. 15 DSGVO |
| Grenze | Lohnbüro sieht „krank“ (für Entgeltfortzahlung) | sichtbar | Art. 9 Abs. 2 lit. b DSGVO |
| Verstoß | Planer oder Kollegin sieht „krank“ | nur „abwesend“ | Art. 9 Abs. 1 DSGVO |

## Minijob

### R-32 Minijob-Grenze

- **Norm**: § 8 Abs. 1 Nr. 1 SGB IV: eine geringfügige Beschäftigung liegt vor, wenn das
  Arbeitsentgelt „regelmäßig die Geringfügigkeitsgrenze nicht übersteigt“; Höhe nach § 8 Abs. 1a
  SGB IV (Mindestlohn × 130 ÷ 3, auf volle Euro aufgerundet; Jahreswert, S-104); § 8 Abs. 1b SGB IV:
  ein „unvorhersehbares Überschreiten“ schadet nicht, wenn die Grenze „innerhalb des … Zeitjahres in
  nicht mehr als zwei Kalendermonaten um jeweils einen Betrag bis zur Höhe der
  Geringfügigkeitsgrenze überschritten wird“.
- **Regel**: Für jeden Monat, in dem das Arbeitszeitmodell ein Minijob ist: Arbeitsentgelt des
  Monats gegen die Grenze seines Jahres, mit ganzen Zahlen ohne Rundung
  (`lohnCent × 60 ≤ grenzeCent × 60`, beim Stundenlohn `stundenlohnCent × minuten`). Zuschläge
  zählen mit, soweit sie nicht nach § 3b EStG steuerfrei sind (§ 1 Abs. 1 Satz 1 Nr. 1 SvEV); ein
  steuerfreier zählt doch mit, soweit der Lohn je gearbeiteter Stunde, auf dem er berechnet wird,
  25 € übersteigt (dort zweiter Halbsatz; dieser Teil wird aufgerundet). Das
  Zeitjahr ist der Monat mit den elf Monaten davor (Geringfügigkeits-Richtlinien vom 14.12.2023: es
  endet mit dem Monat des Überschreitens). Liegt der Monat über der Grenze, ist er
  **gelegentlich**, wenn im Zeitjahr höchstens zwei Monate über der Grenze liegen, jeder um
  höchstens die Grenze; sonst **schwankend**, wenn das Entgelt der Minijob-Monate des Zeitjahres
  zusammen ihre Grenzen nicht übersteigt (regelmäßiges Entgelt als Durchschnitt der Jahresprognose,
  Geringfügigkeits-Richtlinien); sonst ist es kein Minijob mehr. Fehlt die Grenze des Monats oder
  eines Monats im Zeitjahr, heißt das Ergebnis „nicht hinterlegt“.
- **Ausnahmen**: kurzfristige Beschäftigung (§ 8 Abs. 1 Nr. 2 SGB IV) und das Zusammenrechnen
  mehrerer Beschäftigungen (§ 8 Abs. 2 SGB IV) prüft Soll nicht: Beides steht in keiner Stempelung.
- **Schwere**: Hinweis bei gelegentlichem Überschreiten (erlaubt nur, wenn es nicht vorhersehbar
  war) und bei schwankendem (erlaubt nur, wenn die Schwankung in der Jahresprognose stand); Verstoß,
  wenn keins von beiden trägt.

| Fall | Monat November 2026 (Grenze 603 €), Minijob seit 1.1.2026, in den Monaten davor je 400,00 € | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 580,00 € | kein Befund | § 8 Abs. 1 Nr. 1 SGB IV |
| Grenze | 603,00 € | kein Befund | § 8 Abs. 1 Nr. 1 SGB IV („nicht übersteigt“) |
| Verstoß | Minijob erst seit 1.9.2026, je 650,00 € im September, Oktober und November | Verstoß „kein Minijob mehr“ im November; Hinweis „gelegentlich überschritten“ im September und Oktober | § 8 Abs. 1 Nr. 1, Abs. 1b SGB IV |
| gelegentlich | 603,01 € | Hinweis „gelegentlich überschritten“ | § 8 Abs. 1b SGB IV |
| gelegentlich, Grenze | 1.206,00 € | Hinweis „gelegentlich überschritten“ | § 8 Abs. 1b SGB IV („bis zur Höhe der Geringfügigkeitsgrenze“) |
| mehr als das Doppelte | 1.206,01 € | Hinweis „schwankend“: im Zeitjahr im Schnitt unter der Grenze | § 8 Abs. 1 Nr. 1 SGB IV; Geringfügigkeits-Richtlinien vom 14.12.2023 |
| dritter Monat | je 700,00 € im Februar, Juli und November | Hinweis „schwankend“ im November | § 8 Abs. 1b SGB IV („nicht mehr als zwei Kalendermonaten“) |
| Zeitjahr | Minijob seit 1.11.2025, je 700,00 € im November 2025, Februar und November 2026 | Hinweis „gelegentlich überschritten“ im November 2026: November 2025 liegt vor dem Zeitjahr | Geringfügigkeits-Richtlinien vom 14.12.2023 |
| Stundenlohn | 43 h zu 14,03 € je Stunde (603,29 €) | Hinweis „gelegentlich überschritten“ | § 8 Abs. 1 Nr. 1, Abs. 1a SGB IV |
| steuerfreier Zuschlag | 590,00 € und 20,00 € steuerfreier Sonntagszuschlag | kein Befund | § 1 Abs. 1 Satz 1 Nr. 1 SvEV |
| steuerfreier Zuschlag über 25 € je Stunde | 20 h zu 30,00 € je Stunde und 120,00 € steuerfreier Sonntagszuschlag | Hinweis „gelegentlich überschritten“, 20,00 € des Zuschlags zählen | § 1 Abs. 1 Satz 1 Nr. 1 SvEV („soweit das Entgelt, auf dem sie berechnet werden, mehr als 25 Euro für jede Stunde beträgt“) |
| Jahreswechsel | je 620,00 € im Dezember 2026 und im Januar 2027 (Grenze 633 €) | Hinweis „gelegentlich überschritten“ im Dezember, kein Befund im Januar | § 8 Abs. 1a SGB IV |
| nicht hinterlegt | Monat in einem Jahr ohne Jahreswert | „nicht hinterlegt“ | CLAUDE.md, „Never“ |

## Soll, Ist und Konten

### R-33 Soll, Ist und Überstundenkonto

- **Norm**: § 611a Abs. 1 BGB (die vereinbarte Arbeit, hier das Arbeitszeitmodell); § 2 Abs. 1
  EntgFG (für die Arbeitszeit, die „infolge eines gesetzlichen Feiertages ausfällt“, wird das
  Entgelt gezahlt, sie wird nicht nachgearbeitet); §§ 3, 4 Abs. 1 EntgFG (Krankheit); §§ 1, 3 Abs. 2
  BUrlG (Urlaub nur an Arbeitstagen, die keine Feiertage sind).
- **Regel**: Das Soll eines Tages sind die Minuten des Arbeitszeitmodells, das an diesem Tag gilt,
  für seinen Wochentag; ein Feiertag am Standort setzt es auf 0, vor dem Eintritt, nach dem Austritt
  und während das Arbeitsverhältnis ruht (volle Elternzeit) ist es 0. Ist sind die gearbeiteten
  Minuten der geschlossenen Schichten (R-01) und die Gutschrift für Abwesenheiten: Urlaub, Krankheit,
  Kind krank und Sonderurlaub bekommen das Soll des Tages gutgeschrieben, ein halber Tag die Hälfte,
  aufgerundet; Überstundenabbau bekommt nichts. Das Überstundenkonto ist die Summe aus Ist minus Soll
  der abgeschlossenen Monate und den Anpassungen von Hand (Startsaldo, Auszahlung, Korrektur).
- **Schwere**: kein Befund; eine Berechnung. Ein Tag der Beschäftigung ohne Arbeitszeitmodell oder
  ohne Feiertage macht den Monat „nicht hinterlegt“.

| Fall | Lage (Hamburg, Modell Mo–Fr 8:00) | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | November 2026, jeden Arbeitstag 7:30 gearbeitet | Soll 168:00 (21 Arbeitstage), Ist 157:30, Saldo −10:30 | § 611a Abs. 1 BGB |
| Grenze | November 2026, jeden Arbeitstag 8:00 | Soll 168:00, Ist 168:00, Saldo 0:00 | § 611a Abs. 1 BGB |
| Verstoß | November 2026, jeden Arbeitstag 9:00 | Ist 189:00, 21:00 über dem Soll ins Überstundenkonto | § 611a Abs. 1 BGB |
| Feiertag | Mai 2026 (1.5., 14.5. und 25.5. Feiertage) | Soll 144:00 (18 Arbeitstage), Ausfall 24:00 | § 2 Abs. 1 EntgFG |
| Feiertag am freien Tag | Oktober 2026 (3.10. und 31.10. sind Samstage) | Soll 176:00 (22 Arbeitstage), keine Minderung | § 2 Abs. 1 EntgFG („infolge eines gesetzlichen Feiertages ausfällt“) |
| Modellwechsel | ab Mo 16.11.2026 Modell Mo–Do 6:00 | Soll 134:00 (10 × 8:00 + 9 × 6:00) | docs/plan.md, „Soll eines Tages“ |
| Eintritt | Eintritt Mi 18.11.2026 | Soll 72:00 (9 Arbeitstage ab 18.11.) | § 611a Abs. 1 BGB |
| Urlaub | Urlaub Mo 9.11. – Fr 13.11.2026, sonst je 8:00 | 128:00 gearbeitet + 40:00 gutgeschrieben = Ist 168:00, 5 Urlaubstage | § 1 BUrlG |
| Urlaub am Feiertag | Urlaub Mo 11.5. – Fr 15.5.2026 (Do 14.5. Christi Himmelfahrt) | 4 Urlaubstage, 32:00 gutgeschrieben | § 3 Abs. 2 BUrlG |
| halber Tag | Modell Fr 7:15, halber Urlaubstag am Fr 27.11.2026 | 3:38 gutgeschrieben (aufgerundet), 0,5 Urlaubstage | CLAUDE.md, „Never“ (nie zulasten der Beschäftigten) |
| krank | krank Mo 2.11. – Mi 4.11.2026 | 24:00 gutgeschrieben | §§ 3 Abs. 1, 4 Abs. 1 EntgFG |
| Überstundenabbau | Überstundenabbau Fr 6.11.2026 | 0:00 gutgeschrieben, Saldo −8:00 | docs/plan.md, „Abwesenheiten im Soll“ |
| Überstundenkonto | Startsaldo 10:00 zum 1.10.2026, Oktober +2:00, November −1:30, Auszahlung 5:00 im November | Saldo 5:30 | docs/plan.md, „Konten“ |

## Was Soll nicht prüft

- Tarifverträge im Einzelnen: Abweichungen nach §§ 7, 12 ArbZG und § 12 Abs. 6 TzBfG sind
  Einstellungen des Betriebs mit Fundstelle, keine eigenen Regeln.
- Bewilligungen der Aufsichtsbehörde (§§ 13, 15 ArbZG; § 28 MuSchG): eingetragen am Betrieb mit
  Aktenzeichen und Zeitraum.
- Gefährdungsbeurteilung und Beschäftigungsverbote nach §§ 9 bis 16 MuSchG und §§ 22 ff. JArbSchG.

Die Reform des Arbeitszeitgesetzes (Referentenentwurf 2023, Koalitionsvertrag 2025:
Wochenhöchstarbeitszeit statt täglicher) ist am 20. November 2026 nicht in Kraft. Tritt sie in
Kraft, wird sie eine neue Regelversion mit eigenem Gültigkeitsbeginn.
