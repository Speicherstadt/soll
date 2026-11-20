---
title: Regelwerk
description: >-
  Jede Regel, die Soll prüft: Norm, Grenzwerte, Ausnahmen, Schwere und Testfälle mit Quelle – vom
  Arbeitszeitgesetz über Jugend- und Mutterschutz bis zu Mindestlohn, Urlaub und Zuschlägen.
---

# Regelwerk

Soll prüft jede Zeit gegen diese Regeln, beim Stempeln, beim Einplanen und zum Monatsabschluss. Jede
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
| Werktag | jeder Tag außer Sonntag und gesetzlichem Feiertag, also auch der Samstag | § 3 ArbZG; § 3 Abs. 2 BUrlG |
| Ruhepause | eine im Voraus feststehende Unterbrechung von mindestens 15 Minuten (Jugendliche ebenso) | § 4 Satz 2 ArbZG; § 11 Abs. 1 Satz 3 JArbSchG |
| Nachtzeit | 23 bis 6 Uhr, in Bäckereien und Konditoreien 22 bis 5 Uhr | § 2 Abs. 3 ArbZG |
| Nachtarbeit | Arbeit mit mehr als zwei Stunden in der Nachtzeit | § 2 Abs. 4 ArbZG |
| Nachtarbeitnehmer | wer normalerweise Nachtarbeit in Wechselschicht leistet oder an mindestens 48 Tagen im Kalenderjahr | § 2 Abs. 5 ArbZG |
| Jugendlicher | wer 15, aber noch nicht 18 Jahre alt ist (Geburtsdatum am Mitarbeiter) | § 2 Abs. 2 JArbSchG |
| Doppelwoche | zwei aufeinanderfolgende Wochen, Sonntage eingerechnet | § 4 Abs. 1 Satz 3 MuSchG |

Dauern rechnet Soll in ganzen Minuten. Gerundet wird nie zulasten der Beschäftigten (CLAUDE.md).

## Übersicht

| Regel | Inhalt | Norm | Schwere |
| --- | --- | --- | --- |
| R-01 | Beginn, Ende und Dauer jedes Arbeitstags erfasst | BAG 1 ABR 22/21; § 3 Abs. 2 Nr. 1 ArbSchG; EuGH C-55/18 | Hinweis |
| R-02 | Höchstarbeitszeit am Tag | § 3 ArbZG | Hinweis / Verstoß |
| R-03 | Ausgleichszeitraum 6 Monate oder 24 Wochen | § 3 Satz 2 ArbZG | Verstoß |
| R-04 | Ruhepausen | § 4 ArbZG | Verstoß |
| R-05 | Ruhezeit 11 h | § 5 ArbZG | Verstoß |
| R-06 | Arbeitszeit der Nachtarbeitnehmer | §§ 2, 6 Abs. 2 ArbZG | Hinweis / Verstoß |
| R-07 | Sonn- und Feiertagsruhe | §§ 9, 10 ArbZG | Verstoß |
| R-08 | 15 beschäftigungsfreie Sonntage | § 11 Abs. 1 ArbZG | Hinweis / Verstoß |
| R-09 | Ersatzruhetag | § 11 Abs. 3 ArbZG | Hinweis / Verstoß |
| R-10 | Aufzeichnung über 8 h und Aufbewahrung 2 Jahre | § 16 Abs. 2 ArbZG | Verstoß |
| R-11 | Bereitschaftsdienst ist Arbeitszeit | §§ 2, 7 ArbZG; EuGH C-151/02, C-518/15 | Hinweis |
| R-12 | Rufbereitschaft: Einsätze sind Arbeitszeit und unterbrechen die Ruhezeit | §§ 2, 5 ArbZG; EuGH C-518/15 | Verstoß |
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

## Arbeitszeitgesetz

### R-01 Erfassung von Beginn, Ende und Dauer

- **Norm**: BAG, Beschluss vom 13.09.2022, 1 ABR 22/21; § 3 Abs. 2 Nr. 1 ArbSchG („für eine
  geeignete Organisation zu sorgen“); EuGH, Urteil vom 14.05.2019, C-55/18 (CCOO).
- **Regel**: Jeder Arbeitstag hat Beginn, Ende und Dauer. Ein Tag mit „Kommen“ ohne „Gehen“ ist
  unvollständig.
- **Grenzwerte**: Ein offener Tag gilt ab 0 Uhr des Folgetags als unvollständig, eine laufende
  Nachtschicht erst 16 h nach ihrem Beginn (danach ist ein vergessenes „Gehen“ wahrscheinlich).
- **Ausnahmen**: keine. Soll stempelt nie selbst aus (CLAUDE.md), es erinnert nur (S-307).
- **Schwere**: Hinweis an die Person und den Betrieb; zum Monatsabschluss sperrt ein unvollständiger
  Tag die Bestätigung, bis er nachgetragen ist.

| Fall | Stempelungen | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo 8:00 Kommen, 16:30 Gehen | kein Befund, Dauer 8:30 abzüglich Pausen | BAG 1 ABR 22/21, Rn. 64 (Beginn, Ende, Dauer) |
| Grenze | Nachtschicht Mo 22:00 Kommen, Di 13:59 noch offen (15:59 h) | kein Befund | Grenzwert dieser Regel |
| Verstoß | Mo 8:00 Kommen, kein Gehen, Di 0:00 | Hinweis „Gehen fehlt“ für Mo | § 3 Abs. 2 Nr. 1 ArbSchG |

### R-02 Höchstarbeitszeit am Tag

- **Norm**: § 3 ArbZG: „Die werktägliche Arbeitszeit der Arbeitnehmer darf acht Stunden nicht
  überschreiten. Sie kann auf bis zu zehn Stunden nur verlängert werden, wenn innerhalb von sechs
  Kalendermonaten oder innerhalb von 24 Wochen im Durchschnitt acht Stunden werktäglich nicht
  überschritten werden.“
- **Grenzwerte**: bis 8:00 kein Befund; über 8:00 bis 10:00 Hinweis (Ausgleich nötig, R-03); über
  10:00 Verstoß. Sonn- und Feiertagsarbeit zählt mit (§ 11 Abs. 2 ArbZG).
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
- **Ausnahmen**: anderer Ausgleichszeitraum nach § 7 Abs. 1 Nr. 1 Buchst. b ArbZG (Einstellung).
- **Schwere**: Hinweis, sobald der laufende Zeitraum ohne Ausgleich überschritten würde; Verstoß,
  wenn der Zeitraum endet und der Durchschnitt über 8 h liegt.

| Fall | 24 Wochen, je 6 Werktage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 12 Wochen mit 50 h, 12 Wochen mit 40 h (Ø 45 h) | kein Befund | § 3 Satz 2 ArbZG |
| Grenze | 24 Wochen mit Ø 48:00 h (1152 h) | kein Befund | § 3 Satz 2 ArbZG („nicht überschritten“) |
| Verstoß | 24 Wochen mit 1152 h und 1 Minute | Verstoß „Ausgleich nicht erreicht“ | § 3 Satz 2 ArbZG |
| Urlaub | 22 Wochen mit 1056 h und 1 Minute, 2 Wochen Urlaub | Verstoß „Ausgleich nicht erreicht“ (Ø über 48 h in den 22 Wochen ohne Urlaub) | Art. 16 Buchst. b Unterabs. 2 RL 2003/88/EG |

### R-04 Ruhepausen

- **Norm**: § 4 ArbZG: Ruhepausen „von mindestens 30 Minuten bei einer Arbeitszeit von mehr als
  sechs bis zu neun Stunden und 45 Minuten bei einer Arbeitszeit von mehr als neun Stunden“; Blöcke
  von mindestens 15 Minuten; „Länger als sechs Stunden hintereinander dürfen Arbeitnehmer nicht ohne
  Ruhepause beschäftigt werden.“
- **Grenzwerte**: Arbeitszeit bis 6:00 keine Pause; über 6:00 bis 9:00 mindestens 30 min; über 9:00
  mindestens 45 min. Eine Unterbrechung unter 15 min zählt nicht als Pause, sondern als Arbeitszeit
  (das ändert auch die Dauer). Kein Block ohne Pause über 6:00.
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

### R-05 Ruhezeit

- **Norm**: § 5 Abs. 1 ArbZG: „ununterbrochene Ruhezeit von mindestens elf Stunden“ nach Ende der
  täglichen Arbeitszeit.
- **Grenzwerte**: vom letzten „Gehen“ eines Arbeitstags bis zum ersten „Kommen“ des nächsten
  mindestens 11:00. Ein Einsatz in der Rufbereitschaft beendet die Ruhezeit (R-12).
- **Ausnahmen**: § 5 Abs. 2 ArbZG: in Krankenhäusern, Pflege, Gastronomie und Beherbergung,
  Verkehr, Rundfunk, Landwirtschaft und Tierhaltung bis 10:00, wenn jede Verkürzung innerhalb eines
  Kalendermonats oder von vier Wochen durch eine Ruhezeit von mindestens 12:00 ausgeglichen wird
  (Branche am Betrieb). § 7 Abs. 1 Nr. 3 ArbZG (Tarif, bis 9:00) als Einstellung.
- **Schwere**: Verstoß unter 11:00 (mit Branchenausnahme unter 10:00); mit Branchenausnahme zwischen
  10:00 und 11:00 Hinweis „Ausgleich bis … nötig“, Verstoß, wenn der Ausgleich ausbleibt.

| Fall | Ende – nächster Beginn | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo 22:00 – Di 10:00 (12:00) | kein Befund | § 5 Abs. 1 ArbZG |
| Grenze | Mo 22:00 – Di 9:00 (11:00) | kein Befund | § 5 Abs. 1 ArbZG („mindestens elf“) |
| Verstoß | Mo 22:00 – Di 8:59 (10:59) | Verstoß „Ruhezeit 10:59“ | § 5 Abs. 1 ArbZG |
| Gastronomie | Mo 23:00 – Di 9:00 (10:00), Ausgleich am Do mit 12:00 | Hinweis, nach dem Ausgleich keiner | § 5 Abs. 2 ArbZG |
| Gastronomie | 10:00 ohne Ausgleich im Kalendermonat | Verstoß am Monatsende | § 5 Abs. 2 ArbZG |

### R-06 Arbeitszeit der Nachtarbeitnehmer

- **Norm**: § 2 Abs. 3 bis 5 ArbZG; § 6 Abs. 2 ArbZG: werktäglich 8 h, bis 10 h nur, wenn „innerhalb
  von einem Kalendermonat oder innerhalb von vier Wochen im Durchschnitt acht Stunden werktäglich
  nicht überschritten werden“.
- **Regel**: Nachtarbeit ist eine Schicht mit mehr als 2:00 zwischen 23 und 6 Uhr (Bäckerei 22 bis
  5 Uhr). Nachtarbeitnehmer ist, wer Nachtarbeit in Wechselschicht leistet (Merkmal am Mitarbeiter)
  oder an mindestens 48 Tagen im Kalenderjahr; Soll zählt die Tage mit.
- **Grenzwerte**: wie R-02, aber Ausgleich in einem Kalendermonat oder vier Wochen.
- **Ausnahmen**: § 7 Abs. 1 Nr. 4 ArbZG (Einstellung); Zeiträume ohne Nachtarbeit für Nachtarbeitnehmer
  nach § 2 Abs. 5 Nr. 2 prüft Soll mit § 3 Satz 2 (§ 6 Abs. 2 Satz 3 ArbZG).
- **Schwere**: Hinweis über 8 h und ab dem 40. Nachtarbeitstag im Jahr („bald Nachtarbeitnehmer“);
  Verstoß über 10 h oder ohne Ausgleich am Ende des Monats oder der vier Wochen.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 21:00 – 1:00 (2:00 Nachtzeit) | keine Nachtarbeit | § 2 Abs. 4 ArbZG („mehr als zwei“) |
| Grenze | 21:00 – 1:01 (2:01 Nachtzeit) | Nachtarbeit, zählt als Nachtarbeitstag | § 2 Abs. 4 ArbZG |
| Grenze | 48. Nachtarbeitstag im Kalenderjahr | ab jetzt Nachtarbeitnehmer | § 2 Abs. 5 Nr. 2 ArbZG |
| Verstoß | Nachtarbeitnehmer, 4 Wochen mit Ø 8:30 je Werktag | Verstoß „Ausgleich nicht erreicht“ | § 6 Abs. 2 Satz 2 ArbZG |
| Bäckerei | 4:00 – 7:00 in einer Bäckerei (1:00 Nachtzeit 22–5) | keine Nachtarbeit | § 2 Abs. 3 ArbZG |

### R-07 Sonn- und Feiertagsruhe

- **Norm**: § 9 Abs. 1 ArbZG: „an Sonn- und gesetzlichen Feiertagen von 0 bis 24 Uhr nicht
  beschäftigt“; § 10 ArbZG (Ausnahmen); Feiertage nach dem Standort ([Feiertage](feiertage.md)).
- **Regel**: Arbeitszeit an einem Sonntag oder Feiertag am Standort ist nur erlaubt, wenn der
  Betrieb eine Ausnahme nach § 10 Abs. 1 ArbZG angegeben hat (etwa Nr. 4 Gaststätten, Nr. 3
  Pflege) oder eine Bewilligung der Aufsichtsbehörde (§ 13 ArbZG) eingetragen ist.
- **Grenzwerte**: 0:00 bis 24:00 des Sonn- oder Feiertags; eine Schicht über Mitternacht zählt mit
  dem Teil, der in den Tag fällt. Mehrschichtbetriebe: Verschiebung um bis zu 6 h nach § 9 Abs. 2
  (Einstellung).
- **Ausnahmen**: § 10 Abs. 1 Nr. 1 bis 16, Abs. 3 (Bäckereien bis 3 h) ArbZG.
- **Schwere**: Verstoß ohne Ausnahme; mit Ausnahme kein Befund, aber R-08 und R-09.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Café mit Ausnahme § 10 Abs. 1 Nr. 4, So 10:00 – 16:00 | kein Befund (R-09 folgt) | § 10 Abs. 1 Nr. 4 ArbZG |
| Grenze | SHK-Betrieb ohne Ausnahme, Sa 18:00 – 23:59 | kein Befund | § 9 Abs. 1 ArbZG („0 bis 24 Uhr“) |
| Verstoß | SHK-Betrieb ohne Ausnahme, Sa 22:00 – So 0:01 | Verstoß für 1 min am Sonntag | § 9 Abs. 1 ArbZG |
| Verstoß | SHK in Bayern, 6.1.2026 (Heilige Drei Könige), 8:00 – 12:00 | Verstoß „Feiertag“ | § 9 Abs. 1 ArbZG; Art. 1 BayFTG |

### R-08 Beschäftigungsfreie Sonntage

- **Norm**: § 11 Abs. 1 ArbZG: „Mindestens 15 Sonntage im Jahr müssen beschäftigungsfrei bleiben.“
- **Grenzwerte**: Je Kalenderjahr höchstens (Zahl der Sonntage − 15) Sonntage mit Arbeitszeit;
  2026 hat 52 Sonntage, also höchstens 37.
- **Schwere**: Hinweis, sobald nur noch so viele Sonntage übrig sind, wie frei bleiben müssen;
  Verstoß beim ersten Sonntag darüber.

| Fall | Kalenderjahr 2026 | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 30 Sonntage mit Arbeit | kein Befund | § 11 Abs. 1 ArbZG |
| Grenze | 37 Sonntage mit Arbeit, 15 frei | Hinweis „kein weiterer Sonntag mehr“ | § 11 Abs. 1 ArbZG |
| Verstoß | 38 Sonntage mit Arbeit | Verstoß | § 11 Abs. 1 ArbZG |

### R-09 Ersatzruhetag

- **Norm**: § 11 Abs. 3 ArbZG: für einen Sonntag „innerhalb eines den Beschäftigungstag
  einschließenden Zeitraums von zwei Wochen“, für einen Feiertag an einem Werktag innerhalb von acht
  Wochen; § 11 Abs. 4 ArbZG (in Verbindung mit einer Ruhezeit).
- **Regel**: Ein Ersatzruhetag ist ein Werktag ohne Arbeitszeit von 0 bis 24 Uhr. Soll ordnet jedem
  Sonntag den frühesten freien Werktag im Zeitraum zu, der noch keinem anderen zugeordnet ist.
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
  (Jaeger): Bereitschaftsdienst am Arbeitsplatz ist Arbeitszeit.
- **Regel**: Bereitschaftsdienst (am vom Betrieb bestimmten Ort) zählt voll als Arbeitszeit, für
  R-02 bis R-06; Arbeitsbereitschaft ebenso.
- **Schwere**: kein eigener Befund; die Zeit geht in die anderen Regeln ein. Hinweis, wenn ein
  Bereitschaftsdienst über 10 h nur mit tariflicher Einstellung nach § 7 erlaubt ist.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 6:00 Arbeit + 2:00 Bereitschaftsdienst | 8:00 Arbeitszeit, kein Befund | EuGH C-151/02 |
| Grenze | 6:00 Arbeit + 4:00 Bereitschaftsdienst | 10:00, Hinweis nach R-02 | EuGH C-151/02; § 3 ArbZG |
| Verstoß | 6:00 Arbeit + 4:01 Bereitschaftsdienst, ohne Einstellung nach § 7 | Verstoß nach R-02 | § 3 ArbZG; § 7 Abs. 1 Nr. 1 Buchst. a ArbZG |

### R-12 Rufbereitschaft

- **Norm**: §§ 2, 5 ArbZG; EuGH, Urteil vom 21.02.2018, C-518/15 (Matzak): Rufbereitschaft mit so
  kurzer Reaktionszeit, dass die Freizeit erheblich eingeschränkt ist, ist Arbeitszeit; § 5 Abs. 3
  und § 7 Abs. 2 Nr. 1 ArbZG.
- **Regel**: Rufbereitschaft selbst ist keine Arbeitszeit. Ein Einsatz ist Arbeitszeit, mit Wegezeit,
  und beendet die Ruhezeit: Nach dem Einsatz beginnt eine neue Ruhezeit von 11 h. Ist die
  Reaktionszeit am Dienst kürzer als 30 min (Einstellung am Rufdienst), wertet Soll die ganze
  Rufbereitschaft als Arbeitszeit (Matzak: wenige Minuten; die 30 min sind eine vorsichtige Grenze
  von Soll und als solche gekennzeichnet).
- **Ausnahmen**: Krankenhäuser und Pflege dürfen Kürzungen bis zur Hälfte der Ruhezeit zu anderen
  Zeiten ausgleichen (§ 5 Abs. 3 ArbZG); Tarif nach § 7 Abs. 2 Nr. 1 ArbZG.
- **Schwere**: Verstoß, wenn nach einem Einsatz keine 11 h bis zur nächsten Schicht bleiben.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Rufbereitschaft Mo 18:00 – Di 6:00 ohne Einsatz, Di Schicht 8:00 | kein Befund, 0:00 Arbeitszeit | § 5 Abs. 1 ArbZG |
| Grenze | Einsatz Mo 20:00 – 21:00, Di Schicht 8:00 (11:00 Ruhe) | 1:00 Arbeitszeit, kein Befund | § 5 Abs. 1 ArbZG |
| Verstoß | Einsatz Mo 23:00 – Di 0:30, Di Schicht 8:00 (7:30 Ruhe) | Verstoß „Ruhezeit durch Einsatz unterbrochen“ | § 5 Abs. 1 ArbZG; EuGH C-518/15 |
| Matzak | Rufbereitschaft mit Reaktionszeit 8 min, 18:00 – 6:00 | 12:00 Arbeitszeit, R-02 meldet Verstoß | EuGH C-518/15, Rn. 66 |

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

Die Höhe des Mindestlohns und die Minijob-Grenze stehen nicht hier, sondern als Jahreswerte mit
Quelle in `packages/arbeitszeit` (S-104).

## Jugendliche

Gilt für Beschäftigte unter 18 Jahren am Arbeitstag (Geburtsdatum am Mitarbeiter, § 2 Abs. 2
JArbSchG); in den Testdaten Leon, Azubi bei Weber Haustechnik, 17.

### R-15 Arbeitszeit

- **Norm**: § 8 Abs. 1 JArbSchG: „nicht mehr als acht Stunden täglich und nicht mehr als 40 Stunden
  wöchentlich“; Abs. 2a: bis 8,5 h, wenn an anderen Werktagen derselben Woche weniger als 8 h.
- **Grenzwerte**: Tag ≤ 8:00, oder ≤ 8:30, wenn die Woche 40:00 nicht übersteigt und an einem
  anderen Werktag weniger als 8 h gearbeitet wird; Woche (Mo–So) ≤ 40:00.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo–Fr je 8:00 (40:00) | kein Befund | § 8 Abs. 1 JArbSchG |
| Grenze | Mo–Do je 8:30, Fr 6:00 (40:00) | kein Befund | § 8 Abs. 2a JArbSchG |
| Verstoß | Mo–Fr je 8:00, Sa 0:30 (40:30) | Verstoß „über 40 h in der Woche“ | § 8 Abs. 1 JArbSchG |
| Verstoß | Mo 8:31 | Verstoß „über 8:30“ | § 8 Abs. 2a JArbSchG |

### R-16 Ruhepausen

- **Norm**: § 11 Abs. 1 JArbSchG: 30 min bei mehr als 4,5 bis 6 h, 60 min bei mehr als 6 h, Blöcke
  ab 15 min; Abs. 2: frühestens 1 h nach Beginn, spätestens 1 h vor Ende, höchstens 4,5 h am Stück.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 4:30 Arbeit ohne Pause | kein Befund | § 11 Abs. 1 Nr. 1 JArbSchG („mehr als viereinhalb“) |
| Grenze | 6:01 Arbeit, 60 min Pause, erste Pause nach 1:00 | kein Befund | § 11 Abs. 1 Nr. 2, Abs. 2 JArbSchG |
| Verstoß | 6:01 Arbeit, 45 min Pause | Verstoß „Pause fehlt 15 min“ | § 11 Abs. 1 Nr. 2 JArbSchG |
| Verstoß | Pause nach 0:59 Arbeit | Verstoß „Pause zu früh“ | § 11 Abs. 2 Satz 1 JArbSchG |

### R-17 Schichtzeit

- **Norm**: § 12 JArbSchG: Schichtzeit (Arbeitszeit mit Pausen, § 4 Abs. 2) höchstens 10 h; im
  Bergbau unter Tage 8 h; im Gaststättengewerbe, in Landwirtschaft und Tierhaltung, auf Bau- und Montagestellen 11 h.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 7:00 – 16:00 (9:00) | kein Befund | § 12 JArbSchG |
| Grenze | 7:00 – 17:00 (10:00) | kein Befund | § 12 JArbSchG |
| Verstoß | 7:00 – 17:01 (10:01), kein Montageeinsatz | Verstoß „Schichtzeit über 10 h“ | § 12 JArbSchG |
| Montage | 7:00 – 18:00 (11:00) auf einer Montagestelle | kein Befund | § 12 JArbSchG |

### R-18 Tägliche Freizeit

- **Norm**: § 13 JArbSchG: ununterbrochene Freizeit von mindestens 12 h nach Ende der täglichen
  Arbeitszeit.
- **Schwere**: Verstoß.

| Fall | Ende – nächster Beginn | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 17:00 – 7:00 (14:00) | kein Befund | § 13 JArbSchG |
| Grenze | 19:00 – 7:00 (12:00) | kein Befund | § 13 JArbSchG |
| Verstoß | 19:01 – 7:00 (11:59) | Verstoß „Freizeit 11:59“ | § 13 JArbSchG |

### R-19 Nachtruhe

- **Norm**: § 14 Abs. 1 JArbSchG: nur von 6 bis 20 Uhr; Abs. 2: über 16 Jahre im Gaststätten- und
  Schaustellergewerbe bis 22 Uhr, in mehrschichtigen Betrieben bis 23 Uhr, in der Landwirtschaft ab
  5 oder bis 21 Uhr, in Bäckereien ab 5 Uhr; Abs. 3: über 17 in Bäckereien ab 4 Uhr; Abs. 4: vor
  einem Berufsschultag mit Beginn vor 9 Uhr nicht nach 20 Uhr.
- **Schwere**: Verstoß.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 17-jähriger Azubi SHK, 7:00 – 16:00 | kein Befund | § 14 Abs. 1 JArbSchG |
| Grenze | SHK, 12:00 – 20:00 | kein Befund | § 14 Abs. 1 JArbSchG |
| Verstoß | SHK, 12:00 – 20:01 | Verstoß „nach 20 Uhr“ | § 14 Abs. 1 JArbSchG |
| Gastronomie | 17-jährige im Café, 14:00 – 22:00, nächster Tag kein Berufsschultag | kein Befund | § 14 Abs. 2 Nr. 1 JArbSchG |
| Berufsschule | Café, 14:00 – 22:00, am nächsten Tag Berufsschule ab 8:00 | Verstoß | § 14 Abs. 4 JArbSchG |

### R-20 Fünf-Tage-Woche, Samstag, Sonntag, Feiertag

- **Norm**: § 15 JArbSchG (nur an fünf Tagen je Woche); § 16 (Samstag nur in den Fällen des
  Abs. 2, dann Freistellung an einem anderen Tag derselben Woche); § 17 (Sonntag nur in den Fällen
  des Abs. 2, mindestens zwei Sonntage im Monat frei); § 18 (Feiertage, am 24. und 31.12. nicht
  nach 14 Uhr; nie am 25.12., 1.1., Ostersonntag, 1.5.).
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

## Arbeit auf Abruf

### R-22 Vorlauf und Mindestdauer

- **Norm**: § 12 Abs. 3 Satz 2 TzBfG: Pflicht zur Arbeit nur, wenn die Lage „jeweils mindestens vier
  Tage im Voraus“ mitgeteilt wird; § 12 Abs. 1 Satz 4: ohne vereinbarte tägliche Dauer mindestens
  drei aufeinanderfolgende Stunden; § 12 Abs. 1 Satz 3: ohne vereinbarte Wochenarbeitszeit gelten
  20 Stunden; § 12 Abs. 3 Satz 1: der Betrieb legt den Zeitrahmen (Referenzstunden und -tage) fest, in dem
  abgerufen werden kann; Arbeit außerhalb verpflichtet ebenfalls nicht.
- **Regel**: Für Mitarbeiter mit Arbeit auf Abruf (Merkmal am Arbeitszeitmodell) prüft der
  Dienstplan beim Veröffentlichen den Abstand zwischen Mitteilung und Schichtbeginn. Der Tag der
  Mitteilung zählt nicht mit (§ 187 Abs. 1 BGB): Mitteilung am Mo, frühester Schichttag Sa.
- **Ausnahmen**: Tarifvertrag nach § 12 Abs. 6 TzBfG (Einstellung).
- **Schwere**: Hinweis (die Person muss dann nicht kommen; verboten ist die Schicht nicht).

| Fall | Mitteilung – Schicht | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo – Mo der Folgewoche | kein Befund | § 12 Abs. 3 Satz 2 TzBfG |
| Grenze | Mo – Sa (vier volle Tage Di bis Fr dazwischen) | kein Befund | § 12 Abs. 3 Satz 2 TzBfG; § 187 Abs. 1 BGB |
| Verstoß | Mo 10:00 – Fr 10:00 (drei volle Tage Di bis Do dazwischen) | Hinweis „keine Pflicht zur Arbeit, Vorlauf 3 Tage“: der Mitteilungstag und der Tag der Arbeit zählen nicht | § 12 Abs. 3 Satz 2 TzBfG; § 187 Abs. 1 BGB |
| Verstoß | Mo – Do (zwei volle Tage dazwischen) | Hinweis „keine Pflicht zur Arbeit, Vorlauf 2 Tage“ | § 12 Abs. 3 Satz 2 TzBfG |
| Dauer | Abruf ohne vereinbarte Tagesdauer für 2:30 | Hinweis „mindestens 3 Stunden“ | § 12 Abs. 1 Satz 4 TzBfG |

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
  allgemein `24 × Arbeitstage je Woche ÷ 6`). Urlaub in halben Tagen (CLAUDE.md).
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

Hinweis zur Rundung: § 5 Abs. 2 BUrlG rundet nur Bruchteile ab einem halben Tag auf; kleinere
Bruchteile werden nicht abgerundet, sondern bleiben geschuldet (BAG, 26.01.1989, 8 AZR 730/87).
Soll führt Urlaub in halben Tagen und rundet sie deshalb auf den nächsten halben Tag auf (8,33 auf
8,5).

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
- **Schwere**: Hinweis, wenn der eingetragene Zusatzurlaub darunter liegt.

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 5-Tage-Woche, ganzes Jahr | 5 Tage | § 208 Abs. 1 SGB IX |
| Grenze | 4-Tage-Woche, ganzes Jahr | 4 Tage | § 208 Abs. 1 Satz 1 SGB IX |
| anteilig | Schwerbehinderung ab 1.7., 5-Tage-Woche (6 volle Monate) | 2,5 → 3 Tage | § 208 Abs. 2 SGB IX |
| Verstoß | 5-Tage-Woche, ganzes Jahr, 4 Tage eingetragen | Hinweis „Zusatzurlaub unter dem Gesetz“ | § 208 Abs. 1 Satz 1 SGB IX |

### R-26 Kürzung bei Elternzeit

- **Norm**: § 17 Abs. 1 BEEG: ein Zwölftel je vollem Kalendermonat der Elternzeit, nicht bei
  Teilzeit beim selben Arbeitgeber.
- **Regel**: Die Kürzung ist ein Recht des Betriebs, keine Automatik: Soll schlägt sie vor, der
  Betrieb bestätigt sie (im Audit-Log).
- **Schwere**: Hinweis.

| Fall | Elternzeit | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | 15.3. – 14.5. (ein voller Kalendermonat: April) | Kürzung um 1/12 vorgeschlagen | § 17 Abs. 1 Satz 1 BEEG |
| Grenze | 2.3. – 31.3. (kein voller Kalendermonat) | keine Kürzung | § 17 Abs. 1 Satz 1 BEEG („jeden vollen Kalendermonat“) |
| ausgenommen | 1.4. – 30.6. in Teilzeit beim Betrieb | keine Kürzung | § 17 Abs. 1 Satz 2 BEEG |
| Verstoß | ein voller Kalendermonat, Kürzung um 2/12 eingetragen | Hinweis „Kürzung über 1/12 je vollem Monat“ | § 17 Abs. 1 Satz 1 BEEG |

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
  Der Betrieb kann „ab Tag 1“ oder „ab Tag 2“ einstellen.
- **Schwere**: Hinweis.

| Fall | krank ab | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Mo – Mi (3 Kalendertage) | keine Bescheinigung nötig | § 5 Abs. 1 Satz 2 EntgFG |
| Grenze | Mo – Do (4 Kalendertage) | fällig am Do, Erinnerung an die eAU | § 5 Abs. 1 Satz 2 EntgFG |
| Wochenende | Fr – Mo (4 Kalendertage) | fällig am Mo (nächster Arbeitstag nach So) | § 5 Abs. 1 Satz 2 EntgFG |
| Einstellung | Betrieb „ab Tag 1“, krank Mo | fällig am Mo | § 5 Abs. 1 Satz 3 EntgFG |
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

## Mitbestimmung und Datenschutz

### R-30 Auswertung je Person

- **Norm**: § 87 Abs. 1 Nr. 6 BetrVG: Mitbestimmung bei technischen Einrichtungen, die Verhalten
  oder Leistung überwachen.
- **Regel**: Eine Auswertung je Person (Auslastung, gebuchte gegen anwesende Zeit) gibt es nur,
  wenn der Betrieb sie eingeschaltet hat; die Einstellung steht im Audit-Log, und die Beschäftigten
  sehen, dass sie eingeschaltet ist (DESIGN.md, „Kontrolle sichtbar machen“).
- **Schwere**: Verstoß, wenn eine Auswertung je Person ohne Einstellung erzeugt würde (der Server
  lehnt ab).

| Fall | Lage | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Auswertung je Team | erlaubt | § 87 Abs. 1 Nr. 6 BetrVG |
| Grenze | Auswertung je Person, eingeschaltet am 1.11., Abruf am 1.11. | erlaubt, Hinweis an die Beschäftigten | § 87 Abs. 1 Nr. 6 BetrVG |
| Verstoß | Auswertung je Person ohne Einstellung | abgelehnt | § 87 Abs. 1 Nr. 6 BetrVG |

### R-31 Gesundheitsdaten, Auskunft, Löschen

- **Norm**: Art. 9 DSGVO (Gesundheitsdaten), Art. 5 Abs. 1 lit. c und e (Datenminimierung,
  Speicherbegrenzung), Art. 15 (Auskunft), Art. 17 (Löschen), Art. 88 (Beschäftigtenkontext).
- **Regel**: „Krank“ und „Kind krank“ sehen nur die Person, der Inhaber und das Lohnbüro; alle
  anderen sehen „abwesend“. Keine Diagnose, keine hochgeladene Bescheinigung. Die Auskunft gibt alle
  Daten einer Person als Export. Nach Ablauf der Frist werden Inhalte entfernt (S-901).
- **Schwere**: Verstoß, wenn eine Ansicht oder Schnittstelle einer anderen Rolle „krank“ zeigen
  würde (der Server lehnt ab).

| Fall | Rolle | Erwartet | Quelle |
| --- | --- | --- | --- |
| erlaubt | Person selbst sieht „krank“ | sichtbar | Art. 15 DSGVO |
| Grenze | Lohnbüro sieht „krank“ (für Entgeltfortzahlung) | sichtbar | Art. 9 Abs. 2 lit. b DSGVO |
| Verstoß | Planer oder Kollegin sieht „krank“ | nur „abwesend“ | Art. 9 Abs. 1 DSGVO |

## Was Soll nicht prüft

- Tarifverträge im Einzelnen: Abweichungen nach §§ 7, 12 ArbZG und § 12 Abs. 6 TzBfG sind
  Einstellungen des Betriebs mit Fundstelle, keine eigenen Regeln.
- Bewilligungen der Aufsichtsbehörde (§§ 13, 15 ArbZG; § 28 MuSchG): eingetragen am Betrieb mit
  Aktenzeichen und Zeitraum.
- Gefährdungsbeurteilung und Beschäftigungsverbote nach §§ 9 bis 16 MuSchG und §§ 22 ff. JArbSchG.

Die Reform des Arbeitszeitgesetzes (Referentenentwurf 2023, Koalitionsvertrag 2025:
Wochenhöchstarbeitszeit statt täglicher) ist am 20. November 2026 nicht in Kraft. Tritt sie in
Kraft, wird sie eine neue Regelversion mit eigenem Gültigkeitsbeginn.
