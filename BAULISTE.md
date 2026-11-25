# Bauliste

Die Liste, die der Agenten-Loop abarbeitet, in der Reihenfolge der Bauphasen aus dem
[Projektplan](https://soll.work/plan.html). Soll 1.0 ist fertig, wenn jeder Punkt abgehakt ist und
die Schritte für Menschen am Ende erledigt sind.

## So arbeitet der Loop

1. Den **ersten offenen Punkt** nehmen, dessen Abhängigkeiten (`nach:`) abgehakt sind und für den es
   keinen offenen Pull Request gibt (Titel beginnt mit seiner Nummer). Ohne `nach:` hängt ein Punkt
   am vorigen Punkt seiner Phase.
2. **Sofort reservieren**: Branch von aktuellem `origin/main`, Draft-Pull-Request mit Titel
   `S-xxx: …`, damit parallele Sessions den Punkt als vergeben sehen.
3. **Kriterien zuerst**: Die Zeile „Fertig, wenn“ ist das Minimum. Reicht sie nicht, schärft der
   Loop sie im selben Pull Request nach, bevor er Code schreibt; streichen darf er keins.
4. Tests zuerst, dann Code, Doku und Texte in allen Sprachen, `bun run check` grün.
5. **Unabhängiges Review** durch einen eigenen Sub-Agenten (`tdd-review`): ein Befund braucht einen
   fehlschlagenden Test. Befunde fixen, bis keine mehr kommen.
6. **CI grün → selbst mergen** (Squash), den Punkt hier im selben Pull Request abhaken. Der Loop
   wartet nie auf einen Menschen. Offene Fragen entscheidet er nach dem Projektplan
   („Entscheidungen“); eine neue Entscheidung schreibt er dort mit Grund hinein.
7. **Nicht hängen bleiben**: Scheitert ein Punkt dreimal, trägt der Loop ihn mit Grund unter
   „Zurückgestellt“ ein und macht mit dem nächsten Punkt weiter, der nicht davon abhängt. Am Ende
   kommt er auf die zurückgestellten Punkte zurück. Was nur ein Mensch erledigen kann, steht unten
   unter „Schritte für Menschen“ und liegt nicht auf dem Weg des Loops.

**Parallel**: Ab S-104 laufen Phase 2 (Regeln, reine Funktionen) und S-301/S-302 (Oberfläche)
unabhängig voneinander; ab S-306 können Phase 4, 5, 6 und 8 je eine eigene Session bekommen, ab
S-701 die einzelnen Importe. Jede
Session hakt nur in ihrer Phase ab und rebased vor jedem Merge auf `origin/main`.

## Phase 1 – Fundament

- [x] **S-101 Repo-Gerüst** – Workspaces `packages/arbeitszeit`, `packages/import`,
  `packages/export`, `packages/ui`, `apps/server` (Bun, Hono, Zod, `/health`, Logs ohne Geheimnisse,
  `bun build --compile`), `apps/web` (Solid 2, Vite, statische SPA/PWA); wie Kennwort ohne Tauri;
  Paraglide mit `de`, `en`, `tr`, `pl`, `uk`, `ar`; Playwright mit Projekten `desktop`, `phone` und
  `terminal`; `checks.json` um `i18n` und `pages` erweitern; `@firsttris/checks` in `package.json`,
  wo es sich installieren lässt (bis dahin installiert die CI es selbst).
  Fertig, wenn: `bun run check` auf einem frischen Klon grün ist, CI alle Workspaces prüft und eine
  Startseite in jeder Sprache rendert, Arabisch mit `dir="rtl"` (Playwright). Dazu: `/health`
  antwortet (Test), ein Log enthält weder Query-Werte noch `Authorization`- oder Cookie-Header (Test),
  das kompilierte Binary startet und beantwortet `/health` (CI), die Checks `i18n` und `pages` laufen
  in der CI, und die Playwright-Projekte `desktop`, `phone` und `terminal` laufen in der CI.
- [x] **S-102 Datenbank und Audit-Kette** – Drizzle mit SQLite (WAL), Migrationen eingecheckt und im
  Binary eingebettet. Jede Schreiboperation hängt in derselben Transaktion ein Kettenglied an
  (Akteur, Zeitpunkt, Tabelle, Zeile, Hash des Inhalts, Hash des Vorgängers); der Inhalt liegt
  getrennt vom Kettenglied, damit er nach der Frist ausgesondert werden kann. Prüfung der Kette und
  Prüfwert „Nr. 1234 · <SHA-256>“ nach `pruefwert.ts` aus gobd-kern in `firsttris/haben` (kopiert,
  Quelle im Kommentar).
  Fertig, wenn: eine geänderte Zeile und ein geändertes Kettenglied bei der Prüfung auffallen, ein
  entfernter Inhalt die Prüfung nicht bricht und ein Test über alle Schreibfunktionen zeigt, dass
  keine an der Kette vorbei schreibt. Dazu: ein entferntes oder abgeschnittenes Kettenglied und eine
  an der Kette vorbei eingefügte oder gelöschte Zeile fallen auf, eine Zeile eines anderen Betriebs
  lässt sich nicht schreiben, ein Fehler mitten in der Transaktion nimmt Zeile und Glied zurück, eine
  schon angewendete, später geänderte Migration verhindert den Start, und das Binary legt in einem
  leeren Datenverzeichnis die Datenbank an (CI).
- [x] **S-103 Regelwerk** – `docs/regeln.md`: jede Regel aus dem Projektplan mit Norm, Grenzwerten,
  Ausnahmen, Schwere (Hinweis oder Verstoß) und einer Tabelle von Testfällen.
  Fertig, wenn: jede Norm der Tabelle „Rechtlicher Rahmen“ im Projektplan eine Regel hat und jede
  Regel mindestens drei Fälle (erlaubt, genau an der Grenze, Verstoß), jeweils mit Quelle. Dazu:
  jede Regel hat eine feste Kennung (`R-01` …), die Fälle nennen Minuten oder Cent statt Brüche, eine
  vorsichtige Auslegung ist als solche gekennzeichnet, und ein Test prüft, dass jede Regel ihre drei
  Fälle und jede Norm des Projektplans ihre Regel hat.
- [x] **S-104 Jahreswerte und Regelversionen** – Mindestlohn, Minijob-Grenze und die Version des
  Regelwerks als Daten mit Gültigkeit in `packages/arbeitszeit`; fehlt ein Wert, heißt das Ergebnis
  „nicht hinterlegt“.
  nach: S-103. Fertig, wenn: ein Jahr ohne Wert nie mit dem Vorjahr rechnet (Test) und ein Wechsel
  zum 1. Januar mitten in einer Nachtschicht richtig getrennt wird. Dazu: jeder Wert nennt seine Quelle,
  die Minijob-Grenze passt in jedem Zeitraum zur Formel aus § 8 Abs. 1a SGB IV (Test), und der Teil
  einer Schicht in einem Jahr ohne Wert ist „nicht hinterlegt“.
- [x] **S-105 Feiertage** – alle 16 Länder, bewegliche Feiertage nach der Osterformel, regionale
  Feiertage nach Landesrecht, Feiertag je Standort.
  nach: S-101. Fertig, wenn: 2026 bis 2035 gegen amtliche Listen besteht (Fixtures mit Quelle). Dazu:
  Ostersonntag nach Gauß mit Lichtenbergs Formel stimmt für 1900 bis 2100 mit einer unabhängigen
  Tabelle, jeder Feiertag nennt das Landesgesetz, und ein Standort mit Region (Augsburg, katholische
  Gemeinden in Bayern, Fronleichnam in Gemeinden in Sachsen und Thüringen) bekommt seine regionalen
  Feiertage, einer ohne Region nicht.
- [x] **S-106 Betriebe, Anmeldung, Rollen** – Better Auth mit Organization-Plugin (ein Betrieb je
  Organisation, mehrere je Instanz), Passkeys, Einladung per Link oder QR-Code auch ohne E-Mail, PIN
  mit Sperre nach fünf Fehlversuchen; Rollen Inhaber, Planer, Mitarbeiter, Lohnbüro, Betriebsrat,
  Extern, Gerät. Module je Betrieb: Arbeitszeit (mit Abwesenheiten), Dienstplan, Projektzeit,
  Terminal; der Server lehnt jeden Aufruf eines abgeschalteten Moduls ab; Arbeitszeit lässt sich
  nicht abschalten, solange der Betrieb Beschäftigte hat; Abschalten löscht keine Daten. Die
  Tabellen von Better Auth bleiben außerhalb der Audit-Kette; Mitgliedschaft und Rolle schreiben
  Hooks von Better Auth in die Kette. `SOLL_SECRET_KEY` wird beim Start geprüft.
  nach: S-102. Fertig, wenn: ein Test je Endpunkt zeigt, dass kein Betrieb Daten eines anderen sieht,
  die PIN-Sperre greift, eine Einladung ohne E-Mail-Adresse zum Konto führt, ein Rollenwechsel in der
  Kette steht, der Server ohne Schlüssel nicht startet und ein Test je Modul zeigt, dass ein
  abgeschaltetes Modul abgelehnt wird. Dazu: Passkeys werden einem angemeldeten Konto angeboten, ein
  Wechsel in einen fremden Betrieb scheitert ohne Daten, eine Einladung gilt einmal und sieben Tage,
  ein Planer lädt nur Mitarbeiter und Externe ein, Arbeitszeit bleibt an, solange es Beschäftigte
  gibt, und das Binary verweigert ohne `SOLL_SECRET_KEY` den Start (CI).

## Phase 2 – Prüfregeln

Reine Funktionen in `packages/arbeitszeit`, jede mit den Fällen aus `docs/regeln.md`; jeder Befund
nennt Norm, Schwere und die betroffenen Tage. Alle Punkte: nach S-104.

- [x] **S-201 Arbeitstag aus Stempelungen** – Paare, Pausen, Schicht über Mitternacht,
  Zeitumstellung.
  Fertig, wenn: 22:00 bis 6:00 über den 25.10.2026 9 h und über den 28.03.2027 7 h ergibt und der
  Arbeitstag der Starttag ist.
  Dazu: jeder Teil (Arbeit, gestempelte Pause, Lücke zwischen zwei Paaren) hat Beginn, Ende und
  Minuten, und Arbeit und Pausen füllen die Schicht von Beginn bis Ende; eine Stempelung in der
  doppelten Stunde im Oktober zählt als der Zeitpunkt, der sie ist; ein offenes „Kommen“ ohne
  „Gehen“ wird nie beendet, sondern ist ab 0 Uhr des Folgetags, bei einer Nachtschicht 16 h nach
  Beginn, der Hinweis „Gehen fehlt“ (R-01), ebenso eine Pause ohne Ende; Stempelungen in beliebiger
  Reihenfolge ergeben dasselbe, ein doppelter Tipp keinen Befund, eine wiederholte Stempelung einen
  Hinweis und die für die Beschäftigten günstigere Zeit; mehrere Schichten an einem Tag bleiben
  getrennt, eine Pause über Mitternacht bleibt in der Schicht des Starttags; eine Unterbrechung
  unter 15 min ist Arbeitszeit (R-04); jeder Fall dazu steht in `docs/regeln.md` unter R-01.
- [x] **S-202 Höchstarbeitszeit, Pausen, Ruhezeit** – §§ 3, 4, 5 ArbZG, Ausgleichszeitraum 6 Monate
  oder 24 Wochen.
  Fertig, wenn: jeder Fall von R-02 bis R-05 in `docs/regeln.md` wörtlich als Test besteht, auch über
  Mitternacht und beide Zeitumstellungen. Dazu: die Regeln nehmen Arbeitstage aus S-201 und geplante
  Schichten in derselben Form; jeder Befund nennt Regel, Norm, Schwere, Tage und die Minuten (über
  der Grenze, fehlende Pause, Dauer der Ruhezeit); Branche (§ 5 Abs. 2), Ausgleichszeitraum, sein
  Beginn und der Zeitraum für den Ausgleich der Ruhezeit sind Parameter mit sicherer Vorgabe; ein
  Tag ohne Regelversion wird „nicht hinterlegt“ statt mit fremden Grenzwerten geprüft.
- [x] **S-203 Nacht, Sonn- und Feiertage** – §§ 2, 6, 9 bis 11 ArbZG, Ersatzruhetag.
  nach: S-104, S-105.
  Fertig, wenn: jeder Fall von R-06 bis R-09 in `docs/regeln.md` wörtlich als Test besteht, auch über
  Mitternacht, beide Zeitumstellungen, den 24.12. und den 31.12. Dazu: die Regeln nehmen dieselben
  Arbeitstage wie S-202 (`PruefTag`); Nachtzeit ist Uhrzeit, gemessen in echten Minuten je Schicht;
  jeder Befund nennt Regel, Norm, Schwere und Tage, dazu die Minuten, den Zeitraum oder die Zahl der
  Sonntage; Bäckerei, Wechselschicht, Ausgleichszeitraum und sein Beginn, Ausnahmen nach §§ 10 und 13
  und die Verschiebung nach § 9 Abs. 2 sind Parameter, deren Vorgabe nie weniger streng ist als das
  Gesetz; Feiertage kommen aus S-105 nach dem Standort; ein Tag ohne Regelversion oder Feiertage wird
  „nicht hinterlegt“ statt geprüft.
- [x] **S-204 Mindestlohn und Minijob** – § 17 MiLoG (7 Tage), Mindestlohn je Monat, Minijob-Grenze.
  Fertig, wenn: jeder Fall von R-13, R-14 und R-32 in `docs/regeln.md` wörtlich als Test besteht,
  auch über den 1. Januar und die Zeitumstellung. Dazu: § 17 MiLoG liest Stempelungen mit dem
  Zeitpunkt der Erfassung und der Ersetzung (S-304) und prüft jeden Tag, wie er zum Ablauf des
  siebten Folgetags stand, eine spätere Änderung ist „nachgetragen“; der Mindestlohn rechnet
  `lohnCent × 60 ≥ mindestlohnCent × minuten` nur mit ganzen Zahlen, jede Minute zum Mindestlohn
  ihres Kalendertags, mit Sonn- und Feiertagszuschlägen, ohne Nachtzuschläge; die Minijob-Grenze
  kommt aus S-104 mit dem gelegentlichen Überschreiten nach § 8 Abs. 1b SGB IV im Zeitjahr; Branche
  nach § 2a SchwarzArbG, Privathaushalt und Ausnahmen nach § 22 MiLoG sind Parameter, deren Vorgabe
  nie weniger streng ist als das Gesetz; ein Jahr ohne Mindestlohn oder Grenze und ein Tag ohne
  Regelversion werden „nicht hinterlegt“ statt mit fremden Werten geprüft.
- [x] **S-205 Jugendliche und Mutterschutz** – §§ 8, 11 bis 14 JArbSchG; §§ 4 bis 6 MuSchG.
  Fertig, wenn: jeder Fall von R-15 bis R-21 in `docs/regeln.md` wörtlich als Test besteht, auch
  am Tag vor und am Tag des 18. Geburtstags, bei einem Geburtstag am 29. Februar, über beide
  Zeitumstellungen und an den Grenzen von Woche, Doppelwoche und Monat. Dazu: die Regeln nehmen
  dieselben Arbeitstage wie S-202 (`PruefTag`); vom Mitarbeiter nur das Geburtsdatum und für den
  Mutterschutz nur den Zeitraum und die Daten, die eine Regel braucht (Schutzfristen, Erklärungen,
  Genehmigung nach § 28), nie eine Angabe zur Schwangerschaft selbst; jeder Befund nennt Regel,
  Norm, Schwere und Tage, dazu die Minuten, die Grenze oder die fehlende Bedingung; Branche,
  mehrschichtiger Betrieb, Bau- und Montagestellen, Berufsschultage, Ausnahmen nach §§ 16 und 17
  JArbSchG und § 10 ArbZG, Genehmigungen und Erklärungen sind Parameter, deren Vorgabe nie weniger
  streng ist als das Gesetz; Feiertage kommen aus S-105 nach dem Standort; ein Tag ohne
  Regelversion, Feiertage oder vertragliche Wochenarbeitszeit wird „nicht hinterlegt“ statt geprüft.
- [x] **S-206 Bereitschaft** – Bereitschaftsdienst als Arbeitszeit, Rufbereitschaft mit Einsätzen,
  Unterbrechung der Ruhezeit.
  Fertig, wenn: jeder Fall von R-11 und R-12 in `docs/regeln.md` wörtlich als Test besteht, auch
  über Mitternacht, beide Zeitumstellungen und mit mehreren Einsätzen in einer Nacht. Dazu:
  Bereitschaftsdienst und Rufbereitschaft, die ganz zählt, sind Stücke Arbeit in der Schicht und
  gehen ohne eigene Prüfung in §§ 3 bis 5 ein, schon gestempelte Arbeit zählt nicht doppelt; die
  Arbeitstage haben die Form `PruefTag` (für S-505 und jede Regel der Phase 2), jede Schicht nennt
  Bereitschaft und Einsätze, jeder Tag ihre Minuten; ein Einsatz unterbricht die Ruhezeit, nach ihm
  beginnt eine neue, und der Befund nennt den Einsatz; Reaktionszeit am Rufdienst, Tarif nach § 7
  Abs. 1 Nr. 1 Buchst. a mit § 7 Abs. 9 und die Branche für § 5 Abs. 3 sind Einstellungen, deren
  Vorgabe nie weniger streng ist als das Gesetz; ohne Bereitschaft bleiben die Tage aus S-201 und
  die Befunde von S-202 unverändert; ein Tag ohne Regelversion wird „nicht hinterlegt“ statt
  geprüft.
- [x] **S-207 Zuschläge** – steuerfreie Anteile nach § 3b EStG getrennt von steuerpflichtigen.
  Fertig, wenn: die Beispiele aus R 3b LStR und H 3b LStH als Tests bestehen.
  Dazu: jeder Fall von R-29 in `docs/regeln.md` besteht wörtlich als Test, die Beispiele aus R 3b
  und H 3b stehen dort als Fälle mit Quelle; die Sätze des Betriebs (Basispunkte) werden je Minute
  in den steuerfreien Teil und den steuerpflichtigen Rest geteilt und je Arbeitstag (Starttag der
  Schicht) und Art (Nacht, Sonntag, Feiertag) in ganzen Cent ausgegeben, gezahlt aufgerundet,
  steuerfrei abgerundet, ohne Gleitkommazahlen; getestet sind die Nächte der Zeitumstellung (0 bis
  4 Uhr fünf und drei Stunden), eine Schicht über Mitternacht in einen Feiertag, 24.12. und 31.12.
  um 14 Uhr, Beginn um 0 Uhr (keine 40 %), die 50-€-Grenze, der Jahreswechsel und „nicht
  hinterlegt“ vor der ersten Regelversion; das Ergebnis speist `Lohnmonat.zuschlaege` von S-204 mit
  berechnetem `steuerfrei` (Test mit der Minijob-Grenze).
- [x] **S-208 Soll, Ist, Konten** – Soll aus dem Arbeitszeitmodell, Überstundenkonto aus den
  Abschlüssen, Urlaub anteilig, Zusatzurlaub (§ 208 SGB IX), Kürzung bei Elternzeit (§ 17 BEEG),
  Hinweis auf Verfall.
  Fertig, wenn: jeder Fall von R-23 bis R-26, R-28 und R-33 in `docs/regeln.md` wörtlich als Test
  besteht, auch bei Eintritt und Austritt mitten im Monat, am 1. und am letzten Tag, im Schaltjahr,
  bei einem Modellwechsel mitten im Monat und im Jahr, an Feiertagen auf Arbeitstagen und auf freien
  Tagen des Modells, an den Grenzen der Rundung auf halbe Tage, bei Elternzeit über den Jahreswechsel
  und beim Verfall mit, ohne und mit verspätetem Hinweis. Dazu: reine Funktionen in
  `packages/arbeitszeit` ohne Speicher (Projektplan, „Konten“); das Soll eines Tages kommt aus dem
  Modell, das an ihm gilt, ein Feiertag am Standort setzt es auf 0 und nennt die ausgefallenen Minuten
  (§ 2 Abs. 1 EntgFG), vor dem Eintritt, nach dem Austritt und während das Arbeitsverhältnis ruht ist
  es 0; Abwesenheiten in ganzen und halben Tagen schreiben dem Ist gut, Überstundenabbau nicht, krank
  mit Bescheinigung geht im Urlaub vor (R-24); das Überstundenkonto rechnet aus den Abschlüssen und den
  Anpassungen von Hand (Startsaldo, Auszahlung, Korrektur); Urlaub in halben Tagen als exakter Bruch,
  einmal gerundet (ab einem halben Tag auf den vollen, darunter auf einen halben), volle Monate nach
  §§ 187, 188 BGB, Teilurlaub nach § 5 Abs. 1 Buchst. a bis c BUrlG, Zusatzurlaub nach § 208 SGB IX,
  die Kürzung nach § 17 BEEG erst mit der Erklärung des Betriebs; Urlaub verfällt nach § 7 Abs. 3
  BUrlG nur nach einem rechtzeitigen Hinweis (EuGH C-684/16), sonst ein Befund; Kinderkrankentage je
  Kind und zusammen gegen den Jahreswert (S-104); jeder Befund nennt Regel, Norm, Schwere und Tage;
  ein Tag ohne Modell oder Feiertage und ein Jahr ohne Jahreswert werden „nicht hinterlegt“ statt mit
  fremden Werten gerechnet.

## Phase 3 – Arbeitszeit in der App

- [x] **S-301 UI-Paket** – `packages/ui` nach DESIGN.md: Button, Input, Dialog, Menü, Popover,
  Tooltip, Toast, Combobox, Tabs, Badge, Tabelle; native Elemente, eigene `cn()` und `variants()`,
  Vorbild `packages/ui` in Kennwort (kopieren, Quelle nennen).
  nach: S-101. Fertig, wenn: jede Komponente mit Tastatur bedienbar ist und axe keine Fehler findet.
  Dazu: je Komponente ein Playwright-Test auf einer Musterseite (nur in der Entwicklung, nicht im
  Build) in hell und dunkel, Icon-Knöpfe ohne `aria-label` scheitern schon im Typcheck, kein Text
  steht fest in einer Komponente (alles über Props), und Arabisch spiegelt Menüs und Tabs.
- [x] **S-302 App-Rahmen** – Navigation, hell und dunkel, Sprachwahl, Handy mit Tab-Leiste.
  nach: S-301. Fertig, wenn: Playwright `desktop` und `phone` jede Seite öffnet, axe grün ist und der
  `pages`-Check jede Route kennt. Dazu: die Seitenleiste (Desktop) und die Tab-Leiste (Handy) führen
  zu jeder Seite und markieren die aktuelle mit `aria-current`, hell und dunkel und die Sprache
  bleiben nach dem Neuladen erhalten, Arabisch spiegelt das Layout, und axe ist in beiden Themen grün.
- [x] **S-303 Einrichtung** – Assistent: Betrieb, Bundesland, Standorte, Arbeitszeitmodelle mit
  Vorlagen (Vollzeit, Teilzeit, Minijob), Mitarbeiter per CSV, Einladungen. Er beginnt mit vier
  Fragen, die die Module schalten: Beschäftigte ja oder nein (nein: nur Projektzeit; ja: Arbeitszeit
  mit Abwesenheiten, fest), Schichten oder Plan (Dienstplan), Stunden mit Kunden abrechnen
  (Projektzeit), fester Stempelort (Terminal). Die Schritte des Assistenten, die Navigation und die
  Hinweise richten sich nach den Modulen; unter Einstellungen lassen sie sich später ändern.
  nach: S-106, S-302. Fertig, wenn: Playwright die Einrichtung für einen Freelancer (nur
  Projektzeit), ein Café (Arbeitszeit, Dienstplan), einen SHK-Betrieb (Arbeitszeit, Projektzeit,
  Terminal) und einen Betrieb mit allen Modulen zeigt, jeweils mit der passenden Navigation.
  Dazu: Konto anlegen und Anmelden in der App, der Betrieb als Organisation mit dem Inhaber; die vier
  Fragen schalten die Module nach einer reinen Funktion mit Test, ohne Beschäftigte endet der
  Assistent nach dem ersten Schritt; Standorte mit Bundesland und Regionen, Arbeitszeitmodelle in
  ganzen Minuten und Cent (Brüche lehnt der Server ab), jede neue Tabelle mit `betrieb_id` in der
  Audit-Kette und ein Test je neuem Endpunkt, dass kein Betrieb Daten eines anderen sieht; der
  CSV-Parser als reine Funktion mit Fuzzing, der eine unlesbare Zeile mit ihrer Nummer nennt; ein
  Link aus der Einrichtung führt zum Konto im Betrieb; Seitenleiste, Tab-Leiste und „Mehr“ zeigen
  nur die Bereiche der Module, ein Bereich eines abgeschalteten Moduls führt zu Heute, und unter
  Einstellungen schaltet der Inhaber die Module um und die Navigation folgt; jeder Schritt in
  `desktop` und `phone`, axe grün in hell und dunkel.
- [x] **S-304 Stempeln** – großer Knopf Kommen, Pause, Gehen; der laufende Tag mit Soll, Ist und dem
  nächsten Befund; Nachtragen und Ändern mit Grund bis zum Abschluss, jede Änderung für den
  Mitarbeiter sichtbar.
  nach: S-303, S-202. Fertig, wenn: Playwright in `desktop` und `phone` einen Tag stempelt (Kommen,
  Pause, Pause beenden, Gehen), Heute dabei den Zustand, Soll und Ist in Minuten und den nächsten
  Befund mit Norm zeigt, und eine Korrektur mit Grund durch den Inhaber, die die Person danach mit
  wer, wann, was und warum sieht. Dazu: eine neue Tabelle `stempelungen` mit `betrieb_id` in der
  Audit-Kette über eine neue Migration; eine Änderung oder ein Nachtrag hängt eine neue Zeile an und
  überschreibt nie die alte, ohne Grund lehnt der Server ab; bei einer Live-Stempelung zählt die Zeit
  des Servers, eine Zeit des Geräts wird nur daneben gespeichert; eine Mitarbeiterin stempelt und
  liest nur für sich, Inhaber und Planer korrigieren mit Grund für andere; ein Endpunkt des
  abgeschalteten Moduls Arbeitszeit wird abgelehnt; ein Test je Endpunkt, dass kein Betrieb Daten
  eines anderen sieht oder ändert; eine Prüfung „Monat abgeschlossen“ vor jeder Änderung, die bis
  S-306 „offen“ sagt; Soll und nächster Befund als reine Funktion in `packages/arbeitszeit` mit Tests
  (Pause nach § 4, 8 und 10 Stunden nach § 3, Ruhezeit nach § 5, nicht hinterlegt vor der ersten
  Regelversion); Soll stempelt nie selbst aus und rundet nie zulasten der Person; Texte in allen
  sechs Sprachen, Arabisch von rechts nach links; axe grün in hell und dunkel.
- [x] **S-305 Offline-Stempeln** – Warteschlange in IndexedDB mit fortlaufender Nummer, signiert mit
  einem nicht exportierbaren Schlüssel (WebCrypto); Server- und Gerätezeit.
  Fertig, wenn: offline gestempelt, wieder online übertragen und markiert wird und eine Lücke in der
  Nummer auffällt. Dazu: jede Stempelung der App bekommt auf dem Gerät eine fortlaufende Nummer je
  Gerät und Person und eine Signatur mit einem ECDSA-P-256-Schlüssel, den WebCrypto nicht exportierbar
  erzeugt und in IndexedDB ablegt; das Gerät meldet seinen öffentlichen Schlüssel beim Server an
  (eine neue Tabelle mit `betrieb_id` in der Audit-Kette über eine neue Migration), der Server prüft
  Signatur, Gerät und Person je Eintrag und lehnt eine falsche Signatur, ein fremdes Gerät und eine
  schon vergebene Nummer mit anderem Inhalt ab; derselbe Eintrag zweimal übertragen ergibt eine
  Stempelung (idempotent), ein später nachgereichter Eintrag mit kleinerer Nummer wird angenommen und
  schließt die Lücke; eine Lücke in den Nummern eines Geräts sieht die Person auf Heute und der
  Inhaber in den Zeiten der Person; eine offline erfasste Stempelung speichert die Zeit des Geräts und
  den Empfang beim Server und ist als offline markiert; Heute zeigt, was noch wartet, rechnet den
  Zustand mit den wartenden Einträgen weiter und öffnet ohne Netz mit dem zuletzt geladenen Tag; Soll
  stempelt dabei nie selbst aus; die Warteschlange und die Lückenprüfung als reine Funktionen mit
  Vitest, IndexedDB und WebCrypto in Unit-Tests durch einen Ersatz im Speicher; ein Test je neuem
  Endpunkt, dass kein Betrieb Daten eines anderen sieht oder ändert; Playwright in `desktop` und
  `phone` mit `context.setOffline`; Texte in allen sechs Sprachen.
- [x] **S-306 Monatsabschluss** – Bestätigung durch Mitarbeiter und Betrieb, danach gesperrt;
  Korrektur nur als Gegeneintrag mit Grund; Stundenzettel als PDF mit dem Prüfwert der Kette, den
  jede Person per Mail und zum Herunterladen bekommt; Prüfseite, auf der eine Person ihren Prüfwert
  gegen den Stand prüft.
  Fertig, wenn: eine nachträgliche Änderung an einem abgeschlossenen Monat auf der Prüfseite als
  Abweichung erscheint (Test). Dazu: der Inhalt eines Monats je Person (Stempelungen je Arbeitstag,
  Soll des Modells je Tag, Summen, Befunde mit Norm) ist eine reine Funktion mit kanonischer Form und
  Testvektoren, sein Hash steht in der Zeile des Abschlusses und damit in der Audit-Kette; der
  Prüfwert der Person ist das Kettenglied dieser Zeile („Nr. 1234 · <SHA-256>“). Erst bestätigt die
  Person, dann schließt der Betrieb ab (ohne Bestätigung nur mit Grund, eine Bestätigung zu einem
  danach geänderten Stand zählt nicht; Entscheidung im Projektplan); eine offene Schicht verhindert
  den Abschluss. Danach lehnt der Server jede Schreibfunktion ab, die den abgeschlossenen Monat der
  Person ändern würde, mit einem Test je Weg: Stempeln, Nachtragen, Ändern, Entfernen, auch eine
  Nachtschicht über den Monatswechsel, und eine Zuordnung des Arbeitszeitmodells, die ein Soll darin
  ändert. Eine Korrektur danach ist nur ein Gegeneintrag mit Grund (eigene Tabelle, nur anfügen),
  der die gesperrten Zeilen und den Prüfwert unverändert lässt und auf dem Stundenzettel und der
  Prüfseite erscheint. Der Stundenzettel ist ein PDF mit `pdf-lib` mit Tagen, Soll und Ist, Befunden
  mit Norm und dem Prüfwert; die Person bekommt ihn beim Abschluss per Mail (Test gegen einen
  SMTP-Testserver) und lädt ihn jederzeit herunter. Die Prüfseite (öffentlich, Entscheidung im
  Projektplan) nimmt den Prüfwert und sagt „übereinstimmend“ oder „Abweichung“ mit den geänderten
  Tagen; auch eine an der Kette vorbei geänderte Stempelung, eine geänderte Zeile des Abschlusses und
  eine neu berechnete Kette fallen dort auf (Test). Ein Test je Endpunkt, dass kein Betrieb Daten
  eines anderen sieht oder ändert; ein Endpunkt des abgeschalteten Moduls Arbeitszeit wird
  abgelehnt; Playwright in `desktop` und `phone` bestätigt und schließt einen Monat ab und prüft den
  Prüfwert; axe grün in hell und dunkel; Texte in allen sechs Sprachen; Verfahrensdokumentation zum
  Prüfwert in `docs/`.
- [x] **S-307 Erinnerungen** – Ausstempeln vergessen, Pause fällig, Monat bestätigen; Web Push mit
  VAPID-Schlüsseln, die die Instanz beim ersten Start erzeugt, und Mail über SMTP aus der
  Konfiguration; nie automatisch ausstempeln.
  Fertig, wenn: Tests mit einem Ersatz für den Push-Dienst und einem SMTP-Testserver jede Erinnerung
  zeigen. Dazu: welche Erinnerung fällig ist, entscheidet eine reine Funktion aus Daten und einem
  übergebenen Zeitpunkt (Tests mit fester Uhr, auch über beide Zeitumstellungen); eine kleine
  Schleife im Server ruft sie jede Minute und schreibt selbst nie eine Stempelung (Test: nach jedem
  Lauf dieselben Stempelungen). „Ausstempeln vergessen“ kommt, wenn eine Schicht eine im Betrieb
  einstellbare Zeit offen ist (Vorgabe 10 Stunden), „Pause fällig“ eine einstellbare Zeit vor der
  nächsten Pause nach § 4 ArbZG aus `tagesstand()` (nach 6 Stunden am Stück, 30 Minuten ab 6 und
  45 Minuten ab 9 Stunden), „Monat bestätigen“ ab einem einstellbaren Tag des Folgemonats, solange
  die Person den vergangenen Monat mit Aufzeichnungen nicht gültig bestätigt hat und er nicht
  abgeschlossen ist. Jede Erinnerung geht höchstens einmal hinaus: sie wird mit Person, Art und
  Bezug in einer neuen Tabelle mit `betrieb_id` in der Audit-Kette vermerkt, eindeutig, bevor sie
  gesendet wird. Web Push nach RFC 8030 mit VAPID (RFC 8292) und verschlüsseltem Inhalt
  (`aes128gcm`, RFC 8291, Test mit den Werten aus Anhang A); das Schlüsselpaar erzeugt die Instanz
  beim ersten Start und legt den privaten Teil mit `SOLL_SECRET_KEY` verschlüsselt ab (Test: im
  Klartext nirgends in der Datenbank, beim zweiten Start derselbe Schlüssel); ein Abo meldet sich
  je Gerät an und ab (Endpunkt und Schlüssel verschlüsselt gespeichert, ein Schlüssel außerhalb von
  P-256 abgelehnt), ein Abo, das der Push-Dienst mit 404 oder 410 ablehnt, wird entfernt; ohne Abo
  oder wenn kein Push ankommt, geht die Erinnerung per Mail über SMTP aus der Konfiguration an eine
  zustellbare Adresse. Jede Person schaltet jede Art und die Mail für sich ab, der Inhaber stellt
  die Zeiten des Betriebs ein; ein Endpunkt des abgeschalteten Moduls Arbeitszeit wird abgelehnt,
  und ein Test je Endpunkt zeigt, dass kein Betrieb Abos, Einstellungen oder Erinnerungen eines
  anderen sieht oder ändert. Der Service Worker zeigt die Benachrichtigung und öffnet beim Tippen
  die passende Seite (Test). Playwright in `desktop` und `phone` meldet ein Gerät mit einem Ersatz
  für den Push-Dienst des Browsers an und ab und ändert die Einstellungen; Texte in allen sechs
  Sprachen, Arabisch von rechts nach links.
- [x] **S-308 DATEV-Lohn-Export** – Bewegungsdaten für LODAS und Lohn und Gehalt mit Zuordnung der
  Lohnarten je Betrieb, Zuschläge nach § 3b EStG getrennt.
  nach: S-306, S-207. Fertig, wenn: Golden-File-Tests für Stundenlohn, Minijob und Zuschläge bestehen
  und jede Feldregel ihre Quelle im Code nennt.
  Dazu: reine Funktionen in `packages/export/src/datev/` schreiben aus den Lohnposten eines Monats
  die ASCII-Importdatei für LODAS (`[Allgemein]` mit `Ziel=LODAS`, `Version_SST`, `BeraterNr`,
  `MandantenNr`, `Feldtrennzeichen`, `Zahlenkomma` und `Datumsformat`, `[Satzbeschreibung]` mit
  `u_lod_bwd_buchung_standard`, `[Bewegungsdaten]` je Personalnummer und Lohnart mit Stunden oder
  Betrag) und die Bewegungsdatei für Lohn und Gehalt (Satzaufbau aus den erreichbaren Quellen,
  Entscheidung im Projektplan), in Windows-1252 mit CRLF und Dezimalkomma aus ganzen Minuten und
  Cent ohne Gleitkommazahlen, Stunden nie zulasten der Person gerundet. Jede Feldregel nennt im
  Code ihre Quelle; welche Quellen erreichbar waren, steht im Pull Request und in `docs/`. Je
  Betrieb eine Zuordnung in einer neuen Tabelle mit `betrieb_id` in der Audit-Kette über eine neue
  Migration: Berater- und Mandantennummer, Personalnummer je Person und eine Lohnart je Posten
  (Stunden, Minijob, Feiertagsstunden, Urlaub, Krank, Kind krank, Sonderurlaub, Überstunden und die
  Zuschläge für Nacht, Sonntag und Feiertag je steuerfrei und steuerpflichtig nach § 3b EStG aus
  S-207); die Sätze der Zuschläge speichert das Arbeitszeitmodell. Exportiert werden nur
  abgeschlossene Monate aus ihrem festgeschriebenen Inhalt (S-306), so dass sich die Zahlen nach
  dem Export nicht mehr ändern; ein Monat einer Person, der nicht abgeschlossen ist, und jede
  fehlende Angabe (Beraternummer, Personalnummer, Lohnart eines vorkommenden Postens) verhindern
  den Export mit einer Liste dessen, was „nicht hinterlegt“ ist. Golden Files für Stundenlohn
  (Weber Haustechnik), Minijob (Café Elbblick) und Zuschläge, je für LODAS und Lohn und Gehalt;
  Abwesenheiten (S-401) gehen als Eingabe der reinen Funktion ein, ohne von S-401 abzuhängen.
  Herunterladen in der App für Inhaber und Lohnbüro, ein Endpunkt des abgeschalteten Moduls
  Arbeitszeit wird abgelehnt, ein Test je Endpunkt, dass kein Betrieb Einstellungen oder Exporte
  eines anderen sieht oder ändert; Playwright `desktop` stellt die Zuordnung ein und lädt die
  Datei herunter, axe grün in hell und dunkel; Texte in allen sechs Sprachen; `docs/datev.md`.
- [x] **S-309 Prüfexport und Auskunft** – Zeiten je Person und Zeitraum als CSV und PDF für Zoll und
  Arbeitsschutz; Auskunft nach Art. 15 DSGVO als Export.
  Fertig, wenn: der Prüfexport je Person und Arbeitstag Datum, Beginn, Ende, Pausen und Dauer in
  ganzen Minuten, den Zeitpunkt der Erfassung (§ 17 Abs. 1 MiLoG), die Änderungen von Hand mit Grund,
  wer und wann, die Gegeneinträge, die Befunde mit Norm und den Prüfwert des abgeschlossenen Monats
  zeigt; das CSV ist eine reine Funktion in `packages/export` (RFC 4180, UTF-8 mit BOM, Semikolon,
  CRLF; eine Zelle, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnt, bekommt ein Hochkomma davor,
  Entscheidung im Projektplan), das PDF mit `pdf-lib` zeigt denselben Inhalt, beide mit
  Golden-File-Tests; Zeitraum (höchstens zwei Jahre) und Personen wählt, wer alle Zeiten sehen darf
  (`zeiten:alle`), jede Person exportiert ihre eigenen Tage; ein Endpunkt des abgeschalteten Moduls
  Arbeitszeit wird abgelehnt. Die Auskunft nach Art. 15 DSGVO gibt der Person alles, was Soll im
  Betrieb über sie speichert (Konto ohne Kennwort, Mitgliedschaft, Stempelungen mit allen Fassungen
  und Gründen, Gegeneinträge, Abschlüsse mit Prüfwert, Modelle, Schichten, Geräte, PIN ohne Hash,
  Einladung, Glieder der Audit-Kette), als JSON, ohne Daten anderer Personen; ein Test hält fest, dass
  jede Tabelle in der Auskunft steht oder mit Grund ausgenommen ist; der Inhaber erteilt sie auch
  einer Person, die den Betrieb verlassen hat. Ein Test je Endpunkt, dass kein Betrieb Daten eines
  anderen sieht und niemand ohne Recht die einer anderen Person; Playwright in `desktop` und `phone`
  lädt beide Exporte herunter; axe grün in hell und dunkel; Texte in allen sechs Sprachen; Doku in
  `docs/`.

## Phase 4 – Abwesenheiten

Alle Punkte: nach S-306.

- [x] **S-401 Abwesenheiten** – Arten Urlaub, Krank, Kind krank, Sonderurlaub, Überstundenabbau;
  ganze und halbe Tage.
  - **Urlaub**: Antrag mit Resturlaub und Hinweis auf eigene Schichten im Zeitraum; Freigabe oder
    Ablehnung mit Grund durch Inhaber oder Planer, Benachrichtigung beider Seiten; Zurückziehen des
    Antrags; Storno eines genehmigten Urlaubs nur durch den Betrieb mit Grund. Krankheitstage mit
    Bescheinigung im Urlaub zählen nicht als Urlaub (§ 9 BUrlG).
  - **Krankmeldung**: in der App oder am Terminal, ab heute, ohne Diagnose; Hinweis auf die
    Bescheinigung ab dem 4. Tag oder früher, wenn der Betrieb es so einstellt (§ 5 EntgFG); Haken
    „Bescheinigung liegt vor“ mit „als eAU“ oder „auf Papier im Büro“ und Erinnerung an den
    Betrieb, die eAU über sein Lohnprogramm abzurufen, sobald sie fällig ist; kein Hochladen von
    Bescheinigungen (Datensparsamkeit, siehe Projektplan); Zähler der Kinderkrankentage
    (§ 45 SGB V); eine eingeplante Schicht wird als offen gemeldet.
  - **Datenschutz**: „krank“ ist ein Gesundheitsdatum (Art. 9 DSGVO); im Teamkalender und im
    Dienstplan steht nur „abwesend“.
  Fertig, wenn: Playwright Antrag, Freigabe, Ablehnung und Krankmeldung zeigt und Tests „krank im
  Urlaub“, die Frist am 4. Tag, die Erinnerung an die eAU und die Sichtbarkeit von „krank“ je Rolle
  abdecken. Dazu: eine neue Tabelle `abwesenheiten` mit `betrieb_id` in der Audit-Kette über eine
  neue Migration (Art, von, bis, halbe Tage, Status, Bescheinigung „eAU“ oder „Papier“, Kennung des
  Kinds; keine Diagnose, keine Datei); R-27 als reine Funktion in `packages/arbeitszeit` mit allen
  Fällen aus `docs/regeln.md` (dazu „ab Tag 2“ und ein Feiertag am Fälligkeitstag), die Einstellung
  „Bescheinigung ab Tag“ am Betrieb; genehmigte Abwesenheiten gehen in Soll und Ist des Monats
  (Gutschrift, Urlaubstage, R-24), in den Inhalt des Monatsabschlusses und auf den Stundenzettel, ein
  Monat ohne Abwesenheit behält seinen Inhalt aus S-306 (Prüfwerte bleiben gültig); eine
  Abwesenheit, die einen Tag eines abgeschlossenen Monats ändern würde, wird abgelehnt (409), die
  Korrektur geht über den Gegeneintrag aus S-306; Resturlaub des Jahres und Urlaubstage des Antrags
  ohne Wochenenden und Feiertage; Überschneidungen abgelehnt außer Krankheit im Urlaub; Zähler der
  Kinderkrankentage je Kind gegen den Jahreswert, „nicht hinterlegt“ ohne ihn; eine Schnittstelle,
  über die der Dienstplan (S-501) eigene Schichten im Antrag zeigt und Schichten einer Krankmeldung als
  offen meldet; Mails an Betrieb und Person über das Mail-Modul aus S-306 (Test mit SMTP-Ersatz);
  ein Test je neuem Endpunkt, dass kein Betrieb Daten eines anderen sieht oder ändert, und dass die
  Routen bei abgeschaltetem Modul Arbeitszeit abgelehnt werden; Playwright in `desktop` und `@phone`,
  axe grün auf `/abwesenheiten` in hell und dunkel; Texte in allen sechs Sprachen, Arabisch von rechts
  nach links.
- [x] **S-402 Teamkalender und Konten** – Kalender je Standort, Konten in der App, Datum des
  Hinweises auf Verfall.
  - **Teamkalender**: je Standort die Tage eines Zeitraums mit den Feiertagen des Standorts (S-105)
    und den genehmigten Abwesenheiten, jede nur als „abwesend“, für jede Rolle, auch für den
    Inhaber (Art. 9 DSGVO, S-401); keine Zahl je Person (Tage abwesend, Anteil, Rangfolge), keine
    Auswertung je Person (BetrVG § 87 Abs. 1 Nr. 6).
  - **Konten**: Resturlaub mit Übertrag und Verfall je Jahr (R-23, `urlaubskonto`) und
    Überstundenkonto aus den abgeschlossenen Monaten (`ueberstundenkonto`), beide berechnet, nicht
    gespeichert; jede Person sieht ihre eigenen in der App, wer alle Zeiten sieht (`zeiten:alle`) die
    einer Person; es gibt keine Liste der Konten aller Personen.
  - **Hinweis auf Verfall**: Urlaub verfällt nur, wenn der Betrieb die Person rechtzeitig und
    konkret auf ihren offenen Urlaub und den Verfall hingewiesen hat (§ 7 Abs. 3 BUrlG, EuGH
    C-684/16 Max-Planck, BAG 19.02.2019 9 AZR 541/15 und 9 AZR 423/16: Mitwirkungsobliegenheit).
    Soll hält den Tag des Hinweises fest, mit dem, was er nannte (offene Tage je Jahr und Tag des
    Verfalls), und zeigt ihn der Person.
  Fertig, wenn: Playwright zeigt, wie der Inhaber den Hinweis gibt, die Person ihn mit Resturlaub,
  Verfallstag und Überstunden in der App sieht und der Teamkalender je Standort Feiertage und
  „abwesend“ zeigt, in `desktop` und `@phone`, axe grün auf `/abwesenheiten` in hell und dunkel.
  Dazu: neue Tabellen `konto_anpassungen` (Startsaldo, Auszahlung und Korrektur des
  Überstundenkontos je Monat in ganzen Minuten; Resturlaub vor Soll und Korrektur des Urlaubs je Jahr
  in halben Tagen; jede mit Grund) und `urlaubshinweise` (Tag, Inhalt, wer, wann), beide mit
  `betrieb_id` in der Audit-Kette über eine neue Migration und in der Auskunft nach Art. 15 DSGVO;
  der Inhalt eines Hinweises als reine Funktion in `packages/arbeitszeit` mit Vitest (Hinweis
  rechtzeitig, am letzten Tag, verspätet, zweiter Hinweis, nichts offen); ein Hinweis liegt nie in der
  Zukunft und nie vor dem Beginn des Kontos, ein zweiter am selben Tag wird abgelehnt (409);
  Anpassungen und Hinweise nur durch den Inhaber (neues Recht `konten:pflegen`), ein zweiter
  Startsaldo oder einer nach einem abgeschlossenen Monat wird abgelehnt (409); ein abgeschlossener
  Monat ohne Summen, ein Jahr ohne Urlaubsanspruch oder ein ausgesonderter Monat machen das Konto
  „nicht hinterlegt“ statt mit Lücken zu rechnen; genehmigter, noch nicht genommener Urlaub steht
  als „davon genehmigt“; wer Krankheit nicht sieht, bekommt vom Konto einer anderen Person keinen
  genommenen Urlaub je Jahr (er verriete Krankheit im Urlaub, § 9 BUrlG); der Teamkalender nimmt
  einen Standort (`standortId`), ein Standort eines anderen Betriebs ist 404; ein Test je neuem
  Endpunkt, dass kein Betrieb Daten eines anderen sieht oder ändert, dass niemand ohne Recht die
  Konten einer anderen Person liest oder ändert und dass die Routen bei abgeschaltetem Modul
  Arbeitszeit abgelehnt werden; Texte in allen sechs Sprachen, Arabisch von rechts nach links; Doku
  in `docs/abwesenheiten.md`, Entscheidungen im Projektplan.

## Phase 5 – Dienstplan

Alle Punkte: nach S-306.

- [x] **S-501 Planung** – Schichtvorlagen, Wochenansicht, Ziehen und Ablegen, Bedarf je Rolle und
  Standort.
  Fertig, wenn: ein Planer eine Woche je Standort aus Vorlagen plant, Schichten per Ziehen und
  Ablegen und ebenso mit der Tastatur verschiebt und sieht, wo der Bedarf je Rolle nicht gedeckt ist
  (Playwright). Dazu: Wochenraster (Montag bis Sonntag, Kalenderwoche), Zeiten einer Schicht aus Tag
  und Uhrzeit und Deckung des Bedarfs als reine Funktionen in `packages/arbeitszeit` mit Vitest,
  auch für die Wochen der Zeitumstellung (eine Nachtschicht 22:00 bis 6:00 hat dort 7 oder 9
  Stunden) und für Schichten über Mitternacht, die zum Tag ihres Beginns gehören; eine Uhrzeit, die
  es wegen der Zeitumstellung nicht gibt, lehnt der Server ab. Neue Tabellen für Vorlagen, Schichten
  und Bedarf mit `betrieb_id` in der Audit-Kette über eine neue Migration; Vorlagen anlegen, ändern
  und entfernen; eine Schicht nennt Standort, Rolle, Person oder „offen“ und Pause in ganzen Minuten
  und ist bis zur Veröffentlichung (S-503) ein Entwurf, den nur Inhaber und Planer sehen und ändern:
  Mitarbeiter sehen nichts Unveröffentlichtes (Test); keine Auswertung je Person (BetrVG § 87). Eine
  Person, ein Standort oder eine Vorlage eines anderen Betriebs wird abgelehnt; ein Endpunkt des
  abgeschalteten Moduls Dienstplan wird abgelehnt; ein Test je Endpunkt, dass kein Betrieb Daten
  eines anderen sieht oder ändert. Playwright in `desktop` und `phone` (am Handy ein Tag zur Zeit),
  axe grün in hell und dunkel; Texte in allen sechs Sprachen; Doku `docs/dienstplan.md`.
- [x] **S-502 Prüfung beim Einplanen** – alle Regeln aus Phase 2 auf geplante Schichten, dazu § 12
  TzBfG (4 Tage Vorlauf bei Arbeit auf Abruf).
  Fertig, wenn: jede Regel aus Phase 2 im Plan einen Playwright-Fall hat.
  Dazu: eine reine Funktion in `packages/arbeitszeit` baut aus den geplanten Schichten einer Person
  `PruefTag`s (Tage vor heute aus den Stempelungen, ab heute aus dem Plan; geplante Schichten mit
  weniger als 9 h Abstand sind eine Schicht wie in S-201; eine Pause ab 15 min liegt in der Mitte der
  Arbeitszeit, eine kürzere ist Arbeitszeit) und gibt mit den vorhandenen Regelfunktionen, ohne
  zweite Umsetzung einer Regel, die Befunde je Schicht mit Regel, Norm und Schwere zurück, geprüft,
  als wäre der Plan gearbeitet (Vitest auch über Mitternacht und beide Zeitumstellungen); § 12 TzBfG
  (R-22) als reine Funktion mit den Fällen aus `docs/regeln.md`, Mitteilung ist die
  Veröffentlichung, im Entwurf der heutige Tag; angewendet werden R-02 bis R-09, R-14 bis R-22 und
  R-32, nicht R-01, R-10 und R-13 (sie betreffen Stempelungen), R-11 und R-12 (Bereitschaft im Plan
  kommt mit S-505) und die Berechnungen R-29 und R-33; jede angewendete Regel hat einen
  Playwright-Fall im Plan (desktop, einer auch am Handy); ein Befund warnt am Block (Icon, Text,
  Norm) und in der Liste „Hinweise zum Plan“ unter dem Plan und verhindert das Speichern nicht;
  Befunde sieht nur, wer plant; die Angaben, die eine Regel braucht (Geburtsdatum, Wechselschicht,
  Arbeit auf Abruf, Zeitraum des Mutterschutzes), trägt nur der Inhaber ein, gespeichert wird nur
  das, in der Audit-Kette; die Einstellungen des Betriebs zur Prüfung (Branche nach § 5 Abs. 2 ArbZG,
  Ausnahme nach § 10 Abs. 1 ArbZG, Ausgleichszeitraum mit Beginn) haben eine Vorgabe, die nie
  weniger streng ist als das Gesetz; ein Test je neuem Endpunkt, dass kein Betrieb Daten eines
  anderen sieht oder ändert, und dass das abgeschaltete Modul abgelehnt wird; axe grün in hell und
  dunkel; Texte in allen sechs Sprachen, Normen auf Deutsch; Doku in `docs/dienstplan.md` und
  `docs/regeln.md`.
- [x] **S-503 Veröffentlichen** – Benachrichtigung, ICS-Feed je Mitarbeiter mit geheimem Token (RFC
  5545).
  Fertig, wenn: ein Planer eine Woche je Standort veröffentlicht, die Beschäftigten danach ihre
  Schichten sehen und sie als Kalender abonnieren (Playwright). Dazu: „Veröffentlichen“ im Kopf des
  Plans (nur Inhaber und Planer, Test je Rolle) setzt `veroeffentlicht_am` aller Entwürfe der Woche am
  Standort in einer Transaktion über die Audit-Kette; Entwürfe anderer Wochen und Standorte bleiben
  Entwurf (Test); jede Person mit einer neu veröffentlichten Schicht bekommt eine Benachrichtigung
  über Web Push, ohne Gerät per Mail, über die Module aus S-306/S-307 (Test mit Push- und
  SMTP-Ersatz), in der Sprache ihres Geräts, die Mail auf Deutsch, wer veröffentlicht, bekommt keine;
  eine Änderung oder das Entfernen einer veröffentlichten Schicht bleibt sichtbar, gilt als neue
  Mitteilung (`veroeffentlicht_am` neu, § 12 TzBfG, Entscheidung aus S-502) und benachrichtigt die
  bisherige und die neue Person, eine Änderung an einem Entwurf niemanden (Test); der ICS-Feed je
  Person und Betrieb liegt unter einem nicht erratbaren Token (32 Zufallsbytes), gespeichert nur als
  SHA-256 wie die API-Tokens (S-607), in der Audit-Kette, nur mit Sitzung angelegt, neu ausgestellt
  (der alte gilt sofort nicht mehr) und widerrufen; der Feed ist nur lesbar, zeigt nur veröffentlichte
  Schichten der Person, keine Entwürfe, keine anderen Personen und keine Abwesenheiten mit Art
  (Art. 9 DSGVO), wird abgelehnt bei abgeschaltetem Modul Dienstplan, widerrufenem Token oder einer
  Person, die nicht mehr Mitglied ist, und das Token steht nicht im Log; der Feed ist korrektes RFC
  5545 als reine Funktion mit Vitest und Golden File: CRLF und Faltung bei 75 Oktetten ohne ein
  UTF-8-Zeichen zu teilen (3.1), Escaping von Text (3.3.11), Zeiten in UTC (3.3.5), `UID` stabil je
  Schicht (3.8.4.7), `DTSTAMP`, `LAST-MODIFIED` und `SEQUENCE` folgen jeder Änderung (3.8.7),
  entfernte Schichten fehlen; Nachtschichten über Mitternacht und in beiden Nächten der
  Zeitumstellung mit 7 und 9 Stunden (Test); ein Test je neuem Endpunkt, dass kein Betrieb Daten
  eines anderen sieht oder ändert; Playwright in `desktop` und `@phone`, axe grün in hell und
  dunkel; Texte in allen sechs Sprachen; Doku in `docs/dienstplan.md`, README.
- [x] **S-504 Schichttausch** – anbieten, übernehmen, freigeben.
  Fertig, wenn: ein Mitarbeiter eine eigene veröffentlichte Schicht zum Tausch anbietet, eine
  Kollegin sie übernimmt und der Planer den Tausch mit den Befunden der Prüfung für die Übernehmende
  freigibt, wonach die Schicht ihr gehört (Playwright). Dazu: angeboten wird nur eine eigene
  veröffentlichte Schicht, die noch nicht begonnen hat, an alle, die sie übernehmen können
  (Mitglieder mit `plan:lesen` und `stempeln`), oder an eine genannte Kollegin; je Schicht ein
  offenes Angebot; übernehmen kann nur, an wen es gerichtet ist, nie der Anbietende und nicht, wer
  zur selben Zeit schon eine veröffentlichte Schicht hat; Inhaber und Planer (`plan:planen`) geben
  frei oder lehnen mit Grund ab (Test je Rolle); hat der Inhaber „Tausch ohne Freigabe“
  eingestellt, gilt die Übernahme sofort, solange die Prüfung keinen Verstoß findet, sonst wartet
  sie auf die Freigabe; die Schicht wechselt die Person erst mit der Freigabe, in einer Transaktion
  mit dem Tausch über die Audit-Kette (Test); vor der Freigabe laufen die Regeln aus S-502 für die
  Übernehmende, als hätte sie die Schicht (Tests für § 5 ArbZG, JArbSchG beim Auszubildenden Leon,
  MuSchG), ihre Befunde mit Norm sieht nur, wer freigibt, nie Anbietender und Übernehmende
  (Art. 9 DSGVO); die Freigabe ist eine neue Mitteilung nach § 12 TzBfG (`veroeffentlicht_am` neu,
  Entscheidung aus S-503), vor ihr gilt für die Prüfung heute; jeder Schritt benachrichtigt über
  die Zustellung aus S-503 (Web Push, sonst Mail; Test mit Push- und SMTP-Ersatz) mit dem Tag der
  Schicht (`plan-<schichtId>`): das Angebot die, an die es geht, die Übernahme den Anbietenden und
  wer freigibt, Freigabe und Ablehnung beide Seiten, das Zurückziehen die Übernehmende, nie den, der
  handelt; der ICS-Feed beider Personen folgt der Freigabe (Test); der Anbietende zieht ein Angebot
  zurück, solange es nicht entschieden ist; ein Angebot läuft ab, wenn die Schicht beginnt, und
  eine Änderung oder das Entfernen der Schicht durch den Planer macht es hinfällig (Test); ein
  Entwurf lässt sich nicht anbieten; ein Angebot hat keinen Grund des Anbietenden (keine
  Gesundheitsdaten, Art. 9 DSGVO); der Tausch steht in der Auskunft (Art. 15 DSGVO) ohne Daten der
  anderen Person; ein Test je neuem Endpunkt, dass kein Betrieb Daten eines anderen sieht oder
  ändert, und dass das abgeschaltete Modul abgelehnt wird; Playwright in `desktop` und `@phone`,
  axe grün in hell und dunkel; Texte in allen sechs Sprachen; Doku in `docs/dienstplan.md`, README.
- [ ] **S-505 Rufbereitschaft und Soll aus dem Plan** – Rufbereitschaft im Plan, Einsätze als
  Arbeitszeit, Soll aus dem Plan gegen Ist.

## Phase 6 – Projektzeit und Anbindungen

Alle Punkte: nach S-306.

- [x] **S-601 Kunden, Aufträge, Tätigkeiten** – feste interne Tätigkeiten (Fahrt, Werkstatt, Lager,
  Schulung), Stundensätze nach Kunde, Projekt, Tätigkeit und Person, Budgets mit Warnung.
  Fertig, wenn: der Stundensatz eine reine Funktion in `packages/arbeitszeit` ist, deren Vorrang
  dokumentiert und für jede Stufe getestet ist (Tätigkeit vor Auftrag vor Kunde, auf jeder Stufe die
  Person vor allen, dann die Person allein, dann der Satz des Betriebs, wie die Punktzahl der Sätze in
  Kimai), mit „nicht hinterlegt“ ohne passenden Satz und dem Satz, der am Tag gilt (gültig ab); ein
  Budget in Minuten und in Cent je Auftrag als reine Funktion mit Warnung ab einer Schwelle (Vorgabe
  80 %) und „aufgebraucht“ ab 100 %, ganze Zahlen ohne Brüche, und der Betrag aus Minuten und Satz
  kaufmännisch auf den Cent gerundet (Test). Dazu: die vier festen internen Tätigkeiten sind in jedem
  Betrieb da und lassen sich weder umbenennen noch archivieren oder löschen; was ein Auftrag oder ein
  Satz noch nennt, wird archiviert statt gelöscht (409); ein Kunde, ein Auftrag und eine Tätigkeit
  tragen optional eine Kennung in einer anderen Quelle (Haben, ein Import), eindeutig je Betrieb;
  Anlegen, Ändern, Archivieren und Löschen gehen über die Audit-Kette und eine neue Migration; der
  Server lehnt jede Route ab, solange das Modul Projektzeit aus ist; ein Test je Endpunkt zeigt, dass
  kein Betrieb die Daten eines anderen sieht oder ändert; Sätze sehen und ändern nur Inhaber und
  Planer; Playwright legt Kunde, Auftrag mit Budget, Tätigkeit und Satz an und archiviert (desktop und
  `@phone`); axe grün in hell und dunkel; Texte in allen sechs Sprachen.
- [x] **S-602 Stoppuhr** – eine laufende je Person, Wechsel mit einem Tipp, Verweis auf die
  Stempelung, Hinweis bei mehr Projektzeit als Arbeitszeit; änderbar bis „abgerechnet“.
  Fertig, wenn: je Person höchstens eine Stoppuhr läuft, vom Server erzwungen (auch bei zwei
  Anfragen zugleich); ein Tipp auf einen anderen Auftrag oder eine andere Tätigkeit die laufende
  Buchung beendet und die nächste in derselben Transaktion startet, ohne Lücke und ohne
  Überschneidung; Beginn und Ende auf die volle Minute gelten und die Dauer ganze Minuten hat;
  jede Buchung ihren Arbeitstag (den Tag der Schicht, in die sie fällt) und das Kommen dieser
  Schicht nennt oder keins; eine reine Funktion in `packages/arbeitszeit` einen Hinweis mit Grund
  (gebuchte und gestempelte Minuten) gibt, wenn die Projektzeit eines Arbeitstags die gestempelte
  Arbeitszeit übersteigt (Test, auch für eine Nachtschicht über Mitternacht und die Nacht der
  Zeitumstellung); Buchungen derselben Person sich nicht überschneiden (409); die Person ihre
  eigenen Buchungen ändert, nachträgt und löscht, Inhaber und Planer alle, bis eine Buchung
  „abgerechnet“ ist (danach 409); Inhaber und Planer (später S-606) als abgerechnet markieren und
  dabei der geltende Satz festgehalten wird; die gebuchten Minuten und Beträge `budgetStand` des
  Auftrags speisen (Warnung und „aufgebraucht“ in der Liste der Aufträge); Kunde, Auftrag und
  Tätigkeit mit Buchung archiviert statt gelöscht werden (409) und ein archivierter Auftrag oder
  eine archivierte Tätigkeit keine neue Buchung annimmt; ob ein abgeschlossener Monat Projektzeit
  sperrt, im Projektplan entschieden ist. Dazu: Schreiben über die Audit-Kette und eine neue
  Migration; der Server lehnt jede Route ab, solange das Modul Projektzeit aus ist; ein Test je
  Endpunkt zeigt, dass kein Betrieb die Buchungen eines anderen sieht oder ändert; Playwright
  startet, wechselt und stoppt die Stoppuhr, ändert eine Buchung und sieht den Hinweis (desktop
  und `@phone`); axe grün in hell und dunkel; Texte in allen sechs Sprachen.
- [x] **S-603 Betrieb ohne Beschäftigte (Solo-Modus)** – nur das Modul Projektzeit, ohne
  Arbeitszeitprüfung, Abwesenheiten und Dienstplan. Lädt der Betrieb später die erste beschäftigte
  Person ein, schaltet Soll die Arbeitszeit ein und sagt warum (Pflicht zur Erfassung).
  Fertig, wenn: ein Test diesen Wechsel zeigt und ein abgeschaltetes Modul in Navigation, Routen und
  API fehlt. Genauer: ein Servertest geht über jede Route unter `/api/v1/<modul>/` (aus der App
  gelesen, nicht von Hand gelistet, auch künftige) und bekommt bei abgeschaltetem Modul `403
  modul_aus`; ein Betrieb nur mit Projektzeit (Inhaber allein) bekommt nirgends einen Befund der
  Arbeitszeitprüfung und keine Erinnerung; nimmt die erste beschäftigte Person eine Einladung an,
  ist Arbeitszeit an, der Inhaber sieht einen Hinweis mit dem Grund (BAG 1 ABR 22/21, § 3 Abs. 2
  Nr. 1 ArbSchG), bis er ihn bestätigt, und Arbeitszeit lässt sich nicht mehr abschalten; ein
  Playwright-Test (Desktop und `@phone`) zeigt Navigation und Umleitung im Solo-Betrieb und diesen
  Wechsel.
- [x] **S-604 Auslastung** – anwesend gegen gebucht je Team; je Person nur eingeschaltet, sichtbar
  für die Beschäftigten, Einstellung im Audit-Log.
  Fertig, wenn: reine Funktionen in `packages/arbeitszeit` die Auslastung eines Monats in ganzen
  Minuten rechnen (anwesend als gestempelte Arbeitszeit nach § 2 Abs. 1 ArbZG wie `tagesstand()`
  sie zählt, gebucht nach abrechenbar und intern, anwesend ohne Buchung, Anteil abrechenbar in
  ganzen Prozent ohne Brüche), mit Vitest auch für eine Nachtschicht über Mitternacht, die zum Tag
  ihres Beginns gehört, und die Nächte der Zeitumstellung; was „Team“ heißt und die Mindestgröße
  einer Gruppe im Projektplan entschieden sind (mit Grund, § 87 Abs. 1 Nr. 6 BetrVG und Art. 5
  Abs. 1 lit. c DSGVO) und der Server eine kleinere Gruppe ohne Zahlen beantwortet (Test); Inhaber
  und Planer die Auslastung je Team sehen, andere Rollen nicht (403); die Auswertung je Person aus
  ist, bis der Inhaber sie einschaltet, die Einstellung über die Audit-Kette mit Akteur und
  Zeitpunkt geschrieben wird (Test) und eine neue Migration sie am Betrieb speichert; der Server
  Zahlen je Person ablehnt, solange sie aus ist (`403 auswertung_aus`, Test), auch die eigenen;
  ist sie an, sehen Inhaber und Planer die Zahlen je Person und jede Person ihre eigenen, und alle
  Beschäftigten sehen in der App „Auswertung je Person ist eingeschaltet seit …“ mit der Norm;
  der Server lehnt jede Route ab, solange das Modul Projektzeit aus ist; ein Test je Endpunkt zeigt,
  dass kein Betrieb die Auslastung eines anderen sieht oder dessen Einstellung ändert; Playwright
  zeigt die Auslastung je Team, das Einschalten und den Hinweis bei einer Mitarbeiterin (desktop und
  `@phone`); axe grün in hell und dunkel; Texte in allen sechs Sprachen; Doku in
  `docs/projektzeit.md`.
- [x] **S-605 Stundennachweis** – Regiebericht mit Unterschrift des Kunden auf dem Handy, als PDF.
  Fertig, wenn: ein Stundennachweis für einen Auftrag und eine Spanne von Arbeitstagen aus den
  beendeten Buchungen entsteht, die noch in keinem unterschriebenen Nachweis stehen (je Zeile Tag,
  Person, Beginn und Ende, Tätigkeit, ganze Minuten und Notiz, dazu die Summe und eine freie
  Bemerkung für Material und Hinweise; kein Geld); Mitarbeiter nur aus ihren eigenen Buchungen,
  Inhaber und Planer aus denen aller oder einer Person; der Kunde auf dem Handy mit seinem Namen und
  einer Unterschrift unterschreibt, die er mit dem Finger auf eine Fläche zeichnet (Pointer Events),
  gespeichert als Linienzug in ganzen Zahlen ohne Zeit, Druck oder Tempo (keine weiteren
  biometrischen Merkmale), die Zeit der Unterschrift vom Server; der Nachweis nur unterschrieben
  existiert, seinen Inhalt eingefroren hält und seine Buchungen sperrt (ändern und löschen `409
  unterschrieben`, abrechnen weiter möglich), eine Buchung in höchstens einem Nachweis steht, vom
  Server erzwungen (auch bei zwei Anfragen zugleich), und eine Buchung, die sich seit der Vorschau
  geändert hat, das Unterschreiben ablehnt (`409 abweichung`); das PDF mit `pdf-lib` in
  `packages/export` die Unterschrift als Zeichnung und den SHA-256 seines Inhalts trägt, aus
  demselben Inhalt dieselbe Datei wird (Test) und der Hash im Glied der Audit-Kette steht; das
  Modul eine Funktion für das PDF eines Nachweises bietet, die S-606 als Anlage an Haben schickt;
  der Nachweis je Betrieb fortlaufend nummeriert ist; Herunterladen und Teilen vom Gerät aus gehen
  (Web Share API mit der Datei, sonst Herunterladen), ohne öffentlichen Link, im Projektplan
  begründet. Dazu: Schreiben über die Audit-Kette und eine neue Migration; die Auskunft entscheidet
  über die neuen Tabellen; der Server lehnt jede Route ab, solange das Modul Projektzeit aus ist; ein
  Test je Endpunkt zeigt, dass kein Betrieb die Nachweise oder Buchungen eines anderen sieht oder
  unterschreibt; Playwright zeichnet die Unterschrift mit Pointer Events, unterschreibt und lädt das
  PDF (desktop und `@phone`); axe grün in hell und dunkel; Texte in allen sechs Sprachen; Doku in
  `docs/projektzeit.md`.
- [x] **S-606 Haben** – Kunden lesen, Projektzeit an `POST /api/v1/leistungen` mit `source` und
  `externalId` (wiederholbar), Stundennachweis als Anlage.
  Fertig, wenn: Tests gegen einen Ersatz nach `docs/api.md` von Haben bestehen, auch für Wiederholung
  und Fehler.
- [x] **S-607 REST-API und MCP** – Token je Zugang mit den Rechten seiner Rolle,
  OpenAPI-Beschreibung, MCP-Server.
  Fertig, wenn: jede Person eines Betriebs (nicht das Gerät des Terminals) unter Einstellungen
  persönliche Zugänge anlegt, mit Namen und wahlweise einem Ablauf (30, 90 oder 365 Tage oder
  keiner); das Token zeigt die App einmal, gespeichert sind nur sein SHA-256 und ein kurzer Anfang
  zum Wiedererkennen; die Liste zeigt Name, Anfang, angelegt, Ablauf und den Tag der letzten Nutzung,
  jeder Zugang lässt sich widerrufen; Anlegen, Widerrufen und die letzte Nutzung (höchstens ein Glied
  je Zugang und Tag) stehen in der Audit-Kette über eine neue Migration. Ein Token gilt als
  `Authorization: Bearer` an jeder Route unter `/api/v1` neben der Sitzung und trägt genau die
  Rechte der Rolle seiner Person in seinem Betrieb, nie mehr: eine geänderte Rolle gilt beim
  nächsten Aufruf, wer den Betrieb verlässt, dessen Zugänge sind ab sofort tot und leben auch nach
  einem Wiedereintritt nicht auf; widerrufen oder abgelaufen heißt 401; Zugänge verwaltet nur die
  Sitzung, nie ein Token; was über ein Token gestempelt wird, trägt die Quelle `api`; je Token
  höchstens 120 Aufrufe in der Minute, darüber 429 mit `Retry-After`. Eine OpenAPI-3.1-Beschreibung
  liegt öffentlich unter `/api/v1/openapi.json`, erzeugt aus den Zod-Schemas der Routen, und ein
  Test liest die Routen aus der App und verlangt für jede eine Beschreibung und umgekehrt. Ein
  MCP-Server unter `/mcp` (Streamable HTTP, zustandslos, Fassungen 2026-07-28 mit `server/discover`
  und 2025-03-26 bis 2025-11-25 mit `initialize`) bietet Werkzeuge zum Lesen (Betrieb, Tag, Monat,
  Kunden, Aufträge, Tätigkeiten, Standorte, Woche im Dienstplan) und zum Stempeln, die über dieselbe
  API mit demselben Token gehen, also mit denselben Rechten und Modulschaltern; er prüft `Origin`,
  Kopfzeilen und Fassung nach der Spezifikation. Ein Test je Endpunkt zeigt, dass kein Betrieb die
  Zugänge eines anderen sieht oder widerruft, und ein Test, dass ein Token nie die Daten eines
  anderen Betriebs erreicht, auch nicht bei einer Person in zwei Betrieben; Playwright legt einen
  Zugang an, nutzt und widerruft ihn (desktop und `@phone`), axe grün in hell und dunkel; Texte in
  allen sechs Sprachen; Doku `docs/api.md`.

## Phase 7 – Umzug aus anderen Tools

Wer wechselt, bringt Mitarbeiter, Zeiten, Abwesenheiten, Salden und Projekte mit. Jeder Import ist
eine reine Funktion in `packages/import`; Datei oder API, Vorschau, Übernahme. S-702 bis S-708 nach
S-701 und unabhängig voneinander.

- [x] **S-701 Import-Grundlage** – Ablauf: Tool wählen, Anleitung zum Export, Datei hochladen oder
  API-Zugang eingeben, Zuordnung von Personen, Spalten, Projekten und Abwesenheitsarten, Vorschau
  mit Befunden der Prüfregeln, Probelauf, Übernahme. Die Originaldatei wird unter ihrem SHA-256
  aufbewahrt; jeder Eintrag trägt „übernommen aus …“ und die Kennung im alten Tool (`externalId`),
  ein zweiter Import legt nichts doppelt an. Übernommene, abgeschlossene Monate werden als
  übernommen gesperrt.
  nach: S-306, S-401, S-501, S-601. Fertig, wenn: Fuzzing mit fast-check keine Datei findet, die den
  Parser abstürzen oder hängen lässt, ein Fehler die Zeile nennt und ein wiederholter Import nichts
  verdoppelt. Genauer, für die Grundlage (die Formate der Anbieter kommen mit S-702 bis S-707):
  - **Rahmen in `packages/import`**: ein gemeinsames Modell der übernommenen Daten (Zeiten mit Tag,
    Beginn, Ende und Pause in ganzen Minuten; Abwesenheiten mit Art, von, bis; Kunden; Aufträge),
    jeder Datensatz mit seiner Kennung im alten Tool (`externalId`) und seiner Zeile in der Datei; eine
    Liste der Werkzeuge (Name, Weg „Datei“ oder „API“, Anleitung zum Export, Leser) und ein
    Referenzformat „Soll-CSV“ (RFC 4180, Trennzeichen erkannt, Kopf auf Deutsch oder Englisch, Daten
    `2026-09-01` oder `01.09.2026`, Uhrzeiten `7:00`, Pause in Minuten oder `0:30`), mit dem der Ablauf
    von Anfang bis Ende getestet wird. Fuzzing mit fast-check (beliebiger Text und Zeilen aus gültigen
    und kaputten Feldern) findet keine Eingabe, bei der der Leser wirft oder länger als 1 s braucht;
    jeder Fehler nennt Zeile und Grund (unbekannter Typ, Kennung fehlt oder doppelt, Datum, Uhrzeit,
    Pause, Person fehlt, Anführung nicht geschlossen, zu viele Zeilen); Vorschläge der Zuordnung
    (Person nach Namen, Abwesenheitsart nach Wort, Spalten nach Kopf) als reine Funktionen mit
    Vitest.
  - **Ablauf und Server**: Werkzeug wählen, Anleitung, Datei hochladen, Zuordnung von Spalten,
    Personen (zu Mitgliedern des Betriebs oder „nicht übernehmen“; Personen legt der Import nicht an),
    Abwesenheitsarten, Kunden und Aufträgen (neu anlegen, einem vorhandenen zuordnen oder nicht
    übernehmen), Vorschau mit den Befunden der Prüfregeln je Person (Verstöße der Vergangenheit
    zeigen, nicht ändern), Probelauf (was neu wäre, was schon da ist und was abgelehnt würde, mit
    Zeile und Grund, ohne zu schreiben), Übernahme. Der Server liest die Datei selbst mit demselben
    Leser und prüft die Zuordnung mit Zod; Datei höchstens 5 MiB und 20.000 Datensätze. Nur der
    Inhaber (`403` für jede andere Rolle); die Routen hängen an keinem Modul, aber Zeiten und
    Abwesenheiten werden nur bei eingeschalteter Arbeitszeit, Kunden und Aufträge nur bei
    eingeschalteter Projektzeit übernommen, sonst je Datensatz `modul_aus`.
  - **Ablage**: die Originaldatei liegt im inhaltsadressierten Speicher (aus `dateispeicher.ts` von
    gobd-kern kopiert, Quelle im Code) unter ihrem SHA-256 und lässt sich vom Inhaber wieder
    herunterladen, eine veränderte Datei fällt beim Lesen auf; jede Übernahme ist eine Zeile in
    `importe` (Werkzeug, SHA-256, Name und Größe der Datei, Zuordnung, Zahlen, wer, wann), nur
    angefügt. Übernommene Stempelungen (Kommen, Gehen, Pause in der Mitte wie in S-502, Quelle
    `import`), Abwesenheiten (genehmigt), Kunden und Aufträge tragen den Import, das Werkzeug und die
    Kennung (`extern_quelle`, `extern_id`, eindeutig je Betrieb); alles über die Audit-Kette und
    eine neue Migration. Die Liste der Stempelungen zeigt „übernommen aus …“ (Texte in allen sechs
    Sprachen).
  - **Wiederholbar**: ein zweiter Import derselben Datei legt nichts an (Probelauf und Übernahme
    nennen alles „schon da“); auch eine geänderte, entfernte oder schon abgeschlossene übernommene
    Stempelung kommt nicht wieder. Zeiten, die sich mit vorhandenen oder untereinander
    überschneiden, eine Uhrzeit, die es wegen der Zeitumstellung nicht gibt, und Abwesenheiten, die
    sich mit vorhandenen überschneiden, werden mit Zeile und Grund abgelehnt (Test).
  - **Abgeschlossene Monate**: ein in Soll abgeschlossener Monat nimmt nichts an
    (`monat_abgeschlossen`, die Sperre aus S-306); was im alten Tool bis zu einem Monat abgeschlossen
    war („abgeschlossen bis“ in der Zuordnung, vor dem laufenden Monat), schließt Soll nach der
    Übernahme je Person und Monat mit übernommenen Einträgen ab: eine Zeile in `monatsabschluesse`
    mit dem Grund „übernommen aus …“ und dem Import, ohne Bestätigung der Person, mit Prüfwert wie
    jeder Abschluss; danach sperrt der Monat wie jeder andere (Test). Ein abgebrochener Lauf wird
    durch die Wiederholung vollständig.
  - **Mandanten und Auskunft**: ein Test je Endpunkt, dass kein Betrieb Importe, Dateien oder
    Personen eines anderen sieht oder zuordnet; die Auskunft entscheidet über `importe`. Ein
    API-Zugang wird nicht gespeichert (Entscheidung im Projektplan; der Weg über eine API kommt mit
    dem ersten Werkzeug, das ihn braucht).
  - **Oberfläche und Doku**: Seite `/umzug` unter Einstellungen (nur Inhaber) mit den Schritten als
    Pillen wie in der Einrichtung; Playwright (desktop) geht den Ablauf mit einer Soll-CSV bis zur
    Übernahme und zeigt, dass der zweite Lauf nichts anlegt; axe grün in hell und dunkel; Texte in
    `de` und `en` (Inhaberansicht); Doku `docs/umzug.md`, Zeile im README, Entscheidungen im
    Projektplan.
- [x] **S-702 Excel und CSV** – freie Spaltenzuordnung (Person, Datum, Beginn, Ende, Pause, Projekt,
  Tätigkeit), Datums- und Zahlenformate aus Deutschland, Vorlage zum Herunterladen.
  Fertig, wenn: eine beliebige Tabelle mit einer Kopfzeile als CSV oder als Excel-Datei (`.xlsx`,
  erstes Blatt) Zeiten liefert, deren Spalten der Inhaber in der Oberfläche frei zuordnet und die der
  Server selbst liest und prüft. Genauer:
  - **Werkzeug „Excel und CSV“** in `packages/import`, eine reine Funktion über die Bytes der Datei:
    eine CSV (Trennzeichen erkannt, UTF-8 oder Windows-1252) oder eine `.xlsx` (am Anfang `PK`);
    Felder Kennung (freiwillig), Person, Datum, Beginn, Ende, Dauer, Pause, Projekt, Tätigkeit;
    Soll schlägt die Spalten nach dem Kopf vor (Deutsch und Englisch), der Inhaber wählt jede Spalte
    selbst (auch dieselbe Spalte für Datum und Beginn, wenn sie Datum und Uhrzeit hält). Der Server
    lehnt ein unbekanntes Feld in der Spaltenwahl mit `422` ab; fehlt eine nötige Spalte (Person,
    Datum, Beginn, Ende oder Dauer), nennt der Leser sie (`spalte_fehlt`).
  - **Formate aus Deutschland** (Vitest mit Tabellen von Fällen): Datum `01.09.2026`, `1.9.2026`,
    `1.9.26` (20xx), `2026-09-01`, mit angehängter Uhrzeit, und Excel-Seriennummern (1900er System
    mit dem erfundenen 29.02.1900, Nummer 60 ist kein Tag; 1904er System, wenn die Mappe es sagt);
    Uhrzeit `7:00`, `07:00`, `7:00:00`, `700`, `0700`, `7` und der Tagesbruchteil aus Excel (`0,3125`);
    Sekunden werden zugunsten der Person gerundet (Beginn ab-, Ende aufgerundet); Pause als Minuten
    (`30`), `0:30` oder Dezimalstunden (`0,5`), Dauer als Stunden (`8`), `7,5`, `7.5` oder `7:30`,
    alles in ganzen Minuten ohne Fließkomma; Ende leer und Dauer da: Ende = Beginn + Dauer + Pause;
    beides da und verschieden: `dauer_abweichend` mit Zeile.
  - **Excel-Leser** ohne große Bibliothek: ZIP über `fflate` (schon im Lockfile, ohne Abhängigkeiten),
    XML mit einem eigenen kleinen Leser nur für Blatt, geteilte Texte, Formate und Mappe. Schutz und
    Test: entpackt höchstens 50 MiB insgesamt und je Eintrag (Zip-Bombe: abgebrochen, bevor mehr
    entsteht), höchstens 20.000 Zeilen und 200 Spalten wie in S-701, eine DTD oder Entität
    (`<!DOCTYPE`, `<!ENTITY`) macht die Datei unlesbar (keine Expansion, kein XXE), nur die fünf
    vordefinierten und numerische Entitäten werden aufgelöst; Formeln zählen mit ihrem gespeicherten
    Wert.
  - **Projekt und Tätigkeit**: jeder Wert der Spalten Projekt und Tätigkeit wird einem vorhandenen,
    nicht archivierten Auftrag (mit Kunde) beziehungsweise einer Tätigkeit zugeordnet oder nicht
    übernommen, Vorschlag nach Name oder Nummer; Zeiten ohne Tätigkeit bekommen die Tätigkeit, die
    der Inhaber für „ohne Angabe“ wählt. Aus einer Zeit mit Projekt oder Tätigkeit werden zusätzlich
    Buchungen der Projektzeit für ihre Arbeitsstücke (vor und nach der Pause in der Mitte), mit
    Import, Werkzeug und Kennung (neue Migration); ohne Projektzeit-Modul `modul_aus`, bei
    Überschneidung mit vorhandenen Buchungen `ueberschneidung`, die Zeit selbst wird trotzdem
    übernommen. Der Server lehnt eine Zuordnung zu Auftrag oder Tätigkeit eines anderen Betriebs mit
    `422` ab (Test).
  - **Wiederholbar**: Kennung ist die zugeordnete Kennungsspalte, sonst ein SHA-256 über den
    normalisierten Inhalt der Zeile (Person, Tag, Beginn, Ende, Pause; nicht Datei und nicht
    Zeilennummer), so dass dieselbe Zeile in einer längeren Datei wieder „schon da“ ist; eine
    gleiche Zeile zweimal in der Datei ist `zeile_doppelt` (Test über die API: zweiter Lauf legt
    nichts an, auch mit umsortierten und ergänzten Zeilen).
  - **Robust**: Fuzzing mit fast-check für CSV, Excel (zufällige Bytes, kaputte und echte ZIPs,
    veränderte Blätter) und die Wertleser: nie ein Wurf, nie länger als 1 s; jeder Lesefehler nennt
    Zeile und Spalte (Kopf, wie er in der Datei steht).
  - **Vorlage**: CSV und `.xlsx` mit Kopf und Beispielzeile, aus einer reinen Funktion, Byte für Byte
    gleich bei jedem Aufruf (Test), zum Herunterladen im ersten Schritt; die `.xlsx`-Vorlage liest
    der eigene Leser wieder (Test).
  - **Vorschau** mit den Befunden der Prüfregeln wie in S-701, Probelauf, Übernahme; Playwright
    (desktop) lädt eine `.xlsx` hoch, ordnet die Spalten zu, übernimmt und zeigt, dass der zweite Lauf
    nichts anlegt; axe grün; Texte in allen Sprachen der Umzugsseite; Doku `docs/umzug.md`, README,
    Entscheidungen im Projektplan.
- [x] **S-703 Clockodo** – Export-Dateien und REST-API: Mitarbeiter, Zeiten, Abwesenheiten, Kunden,
  Projekte, Leistungen.
  Fertig, wenn: Fixtures nach Clockodos Beschreibung bestehen (Quelle im Test) und ein Playwright-Test
  den ganzen Ablauf zeigt. Genauer:
  - **Quellen**: docs.clockodo.com und my.clockodo.com sind über den Proxy nicht erreichbar; gebaut
    wird nach dem öffentlichen SDK `clockodo` (npm, github.com/peerigon/clockodo, Modelle,
    Endpunkte, Kopfzeilen und die CSV-Datensicherung der Einträge in `src/models/entry.csv.ts`), die
    Quelle steht in Code und Tests; die Fixtures folgen diesen Modellen.
  - **Ein Werkzeug, zwei Wege**: `clockodo` in `packages/import` liest die CSV-Datensicherung der
    Einträge (27 Spalten, Kopf auf Englisch nach dem SDK) und den Abruf über die API; beide tragen
    dieselbe Kennung (`extern_quelle` `clockodo`, die Kennungen von Clockodo), ein Lauf über die
    Datei findet, was ein Lauf über die API übernommen hat, und umgekehrt.
  - **Abruf**: `POST /api/v1/importe/abruf` (nur Inhaber) holt mit E-Mail und API-Schlüssel
    (`X-ClockodoApiUser`, `X-ClockodoApiKey`, `X-Clockodo-External-Application`,
    `X-ClockodoEnableIsoUtcDateTimes`) für einen Zeitraum (höchstens ein Jahr, nicht in der Zukunft)
    `/v3/users`, `/v3/customers`, `/v4/projects`, `/v4/services`, `/v2/entries` (Seite für Seite
    nach `paging.count_pages`, nacheinander) und `/v4/absences` (je Jahr) und gibt eine Datei zurück:
    JSON Lines mit genau den Feldern, die Soll liest (keine Notizen, keine E-Mail, kein
    Stundensatz, keine Krankmeldung), sortiert, sodass derselbe Stand dieselbe Datei und denselben
    SHA-256 ergibt. Danach läuft alles wie bei einer Datei (Vorschau, Probelauf, Übernahme, Ablage).
    Der Schlüssel wird nicht gespeichert, nicht geloggt und steht in keiner Antwort und keiner Datei
    (Test). Fehler als Werte mit eigenem Status: Zugang abgelehnt (401/403), zu viele Anfragen (429
    mit `Retry-After`), nicht erreichbar (Netz, Zeitüberschreitung, 5xx), Antwort ungültig, zu viele
    Datensätze (über 20.000); kein automatischer Neuversuch. Getestet gegen einen Ersatz der API nach
    dem SDK (Kopfzeilen, Seiten, Fehler), in Vitest und für Playwright als eigener Dienst.
  - **Mitarbeiter**: Personen der Zuordnung mit ihrem Namen aus Clockodo (zwei gleiche Namen mit
    Kennung); der Import legt weiter keine Personen an.
  - **Zeiten**: Zeiteinträge (`type` 1) werden je Person zu Blöcken zusammengefasst, die sich
    berühren oder überschneiden; jeder Block wird Kommen und Gehen, die Lücke zwischen zwei Blöcken
    ist die Pause, wie sie gestempelt war. Beginn auf die Minute abgerundet, Ende aufgerundet (nie zum
    Nachteil der Person). Abgelehnt mit Zeile: ein laufender Eintrag (`laeuft_noch`), ein Eintrag
    mit Korrektur der Dauer (`offset`, `korrektur`), ein Block von 24 Stunden oder mehr, eine Uhrzeit
    in der doppelten Stunde, die Soll nicht eindeutig nennen kann. Pauschalen (`type` 2 und 3) sind
    keine Arbeitszeit und werden nicht gelesen.
  - **Abwesenheiten**: nur genehmigte (`status` 1); beantragte mit Zeile als `nicht_genehmigt`,
    abgelehnte und zurückgezogene nicht; halbe Tage und Stunden (Überstundenabbau nach Stunden) mit
    Zeile als `teil_tag`; die 15 Arten von Clockodo mit Namen, Vorschlag für Urlaub, Sonderurlaub,
    Überstundenabbau, Krankheit und Krankheit Kind, die übrigen wählt der Inhaber.
  - **Kunden, Projekte, Leistungen**: Kunden und Projekte wie in S-701, Leistungen als Tätigkeiten
    (neu, einer vorhandenen zuordnen oder nicht übernehmen), mit Import und Kennung (neue Spalte
    `import_id` an `taetigkeiten`, neue Migration). Aus der Datei kommen sie aus den Spalten der
    Einträge (Kennung und Name). Projektzeit-Buchungen aus den Einträgen übernimmt S-703 nicht
    (Entscheidung im Projektplan).
  - **Robust**: Fuzzing mit fast-check über beide Formate (beliebiger Text, Zeilen aus gültigen und
    kaputten Feldern, JSON mit falschen Typen) findet keine Eingabe, bei der der Leser wirft oder
    länger als 1 s braucht; jeder Fehler nennt Zeile und Grund; ein zweiter Lauf legt nichts doppelt
    an (Test über Datei und API).
  - **Oberfläche und Doku**: Clockodo in der Liste der Werkzeuge mit Anleitung; Weg „Datei“ oder
    „API-Zugang“ (E-Mail, Schlüssel als Passwortfeld, Zeitraum), Leistungen in der Zuordnung;
    Playwright (desktop) geht den Abruf gegen den Ersatz bis zur Übernahme und zeigt, dass der
    zweite Lauf nichts anlegt; axe grün in hell und dunkel; Texte in allen sechs Sprachen; Doku in
    `docs/umzug.md`, Entscheidungen im Projektplan.
- [x] **S-704 Personio** – Export und API: Mitarbeiter, Anwesenheiten, Abwesenheiten, Salden.
  Fertig, wenn: Fixtures nach Personios API bestehen (Quelle im Test) und ein Playwright-Test den
  ganzen Ablauf zeigt. Genauer:
  - **Quellen**: developer.personio.de und api.personio.de sind über den Proxy nicht erreichbar;
    gebaut wird nach Personios eigenem Repository github.com/personio/api-docs (v1-Spezifikation
    `personio-personnel-data-api-oa3.yaml`: `GET /company/attendances` ist veraltet, Nachfolger
    `/v2/attendance-periods`, Abschaltung 2027-01-31), nach den v2-Spezifikationen für Zugang und
    Personen, wie sie github.com/Hochfrequenz/personio_client.py aus developer.personio.de/openapi
    spiegelt (`credentials-service-api-v2`, `persons-service-api-v2`, Stand 2026-09-30), und für
    Anwesenheiten, Abwesenheiten und Abwesenheitsarten nach veröffentlichten Clients der v2
    (github.com/PK-Consulting/n8n-nodes-personio-hr, github.com/ninjaneers-team/pysonio); die Quelle
    steht in Code und Tests, die Fixtures folgen diesen Beschreibungen.
  - **API v2, Adresse fest**: Werkzeug `personio` mit dem Weg „API-Zugang“: Client-ID und
    Client-Secret einer eigenen Integration (Passwortfeld) und Zeitraum (höchstens ein Jahr, nicht in
    der Zukunft). `POST /api/v1/importe/abruf` (nur Inhaber) holt mit
    `POST https://api.personio.de/v2/auth/token` (`application/x-www-form-urlencoded`,
    `grant_type=client_credentials`) ein Token und damit nacheinander `GET /v2/persons` (`limit` 50),
    `/v2/absence-types` (50), `/v2/attendance-periods` (`start.date_time.gte`/`.lte`, 100) und
    `/v2/absence-periods` (`starts_from.date_time.lte`, `ends_at.date_time.gte`, 100), Seite für Seite
    nach `_meta.links.next.href`; danach widerruft er das Token (`POST /v2/auth/revoke`). Die
    Adresse ist fest (für die Tests ein Ersatz, den nur der Betreiber setzt), der Inhaber gibt keine
    ein; ein `next`-Link auf einen anderen Ursprung oder Pfad und einer, der auf seine eigene Seite
    zeigt, sind eine ungültige Antwort (das Token geht nie woandershin, kein Abruf hängt); keine
    Weiterleitung, 30 s und 10 MiB je Antwort, 20.000 Datensätze. Die Antwort ist eine Datei: JSON
    Lines mit genau den Feldern, die Soll liest, flach (keine E-Mail, kein Geschlecht, kein Bild,
    keine eigenen Attribute, kein Kommentar, kein Projekt), sortiert, sodass derselbe Stand dieselbe
    Datei und denselben SHA-256 ergibt; danach Vorschau, Probelauf und Übernahme wie bei einer Datei.
  - **Zugang**: Client-ID, Secret und Token werden nicht gespeichert, nicht geloggt und stehen in
    keiner Antwort und keiner Datei (Test). Fehler als Werte mit eigenem Grund: Zugang abgelehnt
    (Token-Endpunkt 400/401, Liste 401), Rechte fehlen (403: die Integration braucht Lesen von
    Personen, Anwesenheiten und Abwesenheiten), zu viele Anfragen (429 mit `Retry-After`), nicht
    erreichbar, Antwort ungültig oder zu groß, zu viele Datensätze; kein automatischer Neuversuch.
  - **Mitarbeiter**: Personen der Zuordnung mit Vor- und Nachnamen aus Personio (zwei gleiche Namen
    mit Kennung); der Import legt weiter keine Personen an.
  - **Anwesenheiten**: Zeiträume `WORK` sind Arbeit, `BREAK` Pause; Personio schreibt Ortszeit ohne
    Versatz, gelesen in Europe/Berlin. Arbeit wird auf die Minute nach außen, Pause nach innen
    gerundet, die Pausen werden aus der Arbeit herausgenommen, die Stücke einer Person, die sich
    berühren oder überschneiden, werden ein Block mit Kommen und Gehen, die Lücke zwischen zwei
    Blöcken ist die Pause (wie S-703, S-705); nie zum Nachteil der Person. Nur bestätigte
    (`approval.status` `CONFIRMED` oder ohne Freigabe); `PENDING` mit Zeile als `nicht_genehmigt`,
    `REJECTED` gar nicht. Abgelehnt mit Zeile: ein offener Zeitraum (`laeuft_noch`), eine Uhrzeit,
    die es wegen der Zeitumstellung nicht oder zweimal gibt, ein Block ab 24 Stunden.
  - **Abwesenheiten**: nur genehmigte (`APPROVED` oder ohne Freigabe); `PENDING`,
    `SUBSTITUTE_REQUESTED` und `DELETION_PENDING` mit Zeile als `nicht_genehmigt`. Halbe Tage in
    halben Tagen: beginnt eine Abwesenheit mit der zweiten Hälfte (`starts_from.type`
    `SECOND_HALF`), ist der erste Tag halb, endet sie mit der ersten (`ends_at.type` `FIRST_HALF`),
    der letzte (neue Spalten gibt es nicht: `erster_halb`, `letzter_halb` aus S-401). Abwesenheiten
    nach Stunden (Art mit `unit` `HOUR` oder eine Uhrzeit außer Mitternacht) mit Zeile als
    `teil_tag`, eine offene ohne Ende als `laeuft_noch`. Die Art heißt wie in Personio, vorgeschlagen
    nach dem Wort; Krankheit wird nur „krank“, ohne Grund, ohne Kommentar, ohne Bescheinigung
    (Art. 9 DSGVO).
  - **Salden** (Resturlaub, Überstunden) übernimmt S-708 („aus dem Import“): Personios v2 hat keinen
    Endpunkt dafür, und Soll hat noch keinen Startsaldo (Entscheidung im Projektplan).
  - **Export**: Personios Berichte als CSV oder Excel haben Spalten, die der Betrieb wählt; sie gehen
    über „Excel und CSV“ (S-702) mit freier Zuordnung, die Anleitung von Personio sagt das.
  - **Wiederholbar**: Kennungen sind Personios ids (UUIDs der Zeiträume; ein Block nach seinem
    ersten Stück); ein zweiter Abruf desselben Zeitraums legt nichts an, abgeschlossene Monate nehmen
    nichts an (`monat_abgeschlossen`, Test über die API).
  - **Robust**: Fuzzing mit fast-check über die Datei (beliebiger Text, Zeilen mit falschen Typen,
    kaputte Zeitpunkte) und über den Abruf (zufällige Antworten des Ersatzes): nie ein Wurf, nie
    länger als 1 s; jeder Fehler nennt Zeile und Grund.
  - **Ersatz** der API nach den Quellen (Token, Widerruf, Seiten mit `cursor`, Fehler), in Vitest
    und für Playwright als eigener Dienst. **Oberfläche und Doku**: Personio in der Liste der
    Werkzeuge mit Anleitung; Playwright (desktop) geht den Abruf gegen den Ersatz bis zur Übernahme
    und zeigt, dass der zweite Lauf nichts anlegt; axe grün in hell und dunkel; Texte in allen
    Sprachen der Umzugsseite; Doku `docs/umzug.md`, Entscheidungen im Projektplan.
- [x] **S-705 Kimai** – REST-API: Kunden, Projekte, Tätigkeiten, Zeitbuchungen.
  Fertig, wenn: Fixtures nach Kimais API bestehen (Quelle im Test) und ein Playwright-Test den
  ganzen Ablauf zeigt. Genauer:
  - **Quellen**: kimai.org ist über den Proxy nicht erreichbar; gebaut wird nach dem Quelltext von
    Kimai (github.com/kimai/kimai, 2.73.0): `src/API/*Controller.php` (Endpunkte, Filter, Seiten
    mit `page` und `size` bis 500), `src/API/ViewHandler.php` (`X-Page`, `X-Total-Count`,
    `X-Total-Pages`, `X-Per-Page`), `src/API/Authentication/` (`Authorization: Bearer <API-Token>`;
    das alte `X-AUTH-USER`/`X-AUTH-TOKEN` lehnt 2.73 ab, ältere Instanzen nehmen es),
    `config/packages/jms_serializer.yaml` (Zeitpunkte `Y-m-d\TH:i:sO`, Ortszeit mit Versatz),
    `src/Entity/Timesheet.php` (`break` in Sekunden seit Migration `Version20240926111739`,
    `duration` = Ende − Beginn − Pause); die Quelle steht in Code und Tests, die Fixtures folgen
    diesen Klassen.
  - **Nur über die API**: Werkzeug `kimai` mit dem Weg „API-Zugang“: Adresse der Instanz, API-Token
    (Passwortfeld), freiwillig ein Benutzername für das alte Verfahren, Zeitraum (höchstens ein Jahr,
    nicht in der Zukunft). `POST /api/v1/importe/abruf` (nur Inhaber) holt nacheinander
    `/api/users`, `/api/customers`, `/api/projects` (`ignoreDates=1`), `/api/activities` (alle mit
    `visible=3`, auch verborgene) und `/api/timesheets` (`user=all`, `begin`/`end` mit einem Tag Rand
    wegen der Zeitzone des Tokens, `size=500`, `orderBy=begin`, `order=ASC`, Seite für Seite nach
    `X-Total-Pages`) und antwortet mit einer Datei: JSON Lines mit genau den Feldern, die Soll liest
    (keine Beschreibung, keine Sätze, keine Schlagworte, keine E-Mail; `full=true` nicht, weil die
    Kennungen reichen und weniger Personendaten fließen), sortiert, sodass derselbe Stand dieselbe
    Datei und denselben SHA-256 ergibt; danach Vorschau, Probelauf und Übernahme wie bei einer Datei.
  - **Adresse vom Nutzer, also Schutz vor SSRF** (Test je Fall): nur `https`, ohne Nutzer und
    Passwort in der Adresse; jede Adresse, die der Name im DNS ergibt, muss öffentlich sein (nicht
    Loopback, privat, link-local, CGNAT, Unique-Local, Multicast, unspezifiziert, reserviert, auch
    nicht als IPv4 in IPv6), geprüft beim Verbinden, sodass ein zweites DNS-Ergebnis (Rebinding)
    nicht vorbeikommt; keine Weiterleitung (3xx ist ein Fehler, der Token geht nie an einen anderen
    Ort); 30 s je Anfrage, höchstens 10 MiB je Antwort und 20.000 Datensätze. Ausnahme nur für
    Ursprünge, die der Betreiber der Instanz ausdrücklich freigibt (`SOLL_IMPORT_ALLOWED_ORIGINS`,
    z. B. eine Kimai-Instanz im eigenen Netz und der Ersatz in den Tests).
  - **Zugang**: das Token wird nicht gespeichert, nicht geloggt und steht in keiner Antwort und
    keiner Datei (Test). Fehler als Werte mit eigenem Grund: Adresse nicht erlaubt, Zugang abgelehnt
    (401), Rechte fehlen (403: das Token braucht die Rechte, alle Zeiten und Personen zu sehen), zu
    viele Anfragen (429), nicht erreichbar (Netz, Zeit, 5xx, Weiterleitung), Antwort ungültig oder zu
    groß, zu viele Datensätze; kein automatischer Neuversuch.
  - **Zeiten**: aus jeder beendeten Zeitbuchung (`end` gesetzt) Arbeitsstücke; eine Pause (`break`)
    liegt in der Mitte der Buchung (wie S-701), zugunsten der Person gerundet. Die Stücke einer
    Person, die sich berühren oder überschneiden, werden ein Block mit Kommen und Gehen; die Lücke
    zwischen zwei Blöcken ist die Pause, wie gebucht (wie S-703). Beginn auf die Minute abgerundet,
    Ende aufgerundet. Abgelehnt mit Zeile: eine laufende Buchung (`laeuft_noch`), ein Block ab 24
    Stunden, eine Uhrzeit in der doppelten Stunde im Oktober, ein Zeitpunkt ohne Versatz.
    Kimais gerundete `duration` zählt nicht: die Arbeitszeit sind die gebuchten Zeitpunkte.
  - **Kunden, Projekte, Tätigkeiten**: Kunden und Projekte wie in S-701, Tätigkeiten neu, einer
    vorhandenen zugeordnet oder nicht übernommen (mit Import und Kennung). Aus jeder übernommenen
    Zeitbuchung mit Projekt wird eine Buchung der Projektzeit je Arbeitsstück auf das Projekt und die
    Tätigkeit, die der Import dafür anlegt oder zuordnet, mit Import, Werkzeug und Kennung; ist
    Projekt oder Tätigkeit nicht übernommen, keine Buchung (`ausgelassen`); bei Überschneidung mit
    vorhandenen oder anderen Buchungen `ueberschneidung`. Sätze und Beträge aus Kimai werden nicht
    übernommen (Entscheidung im Projektplan).
  - **Wiederholbar**: Kennungen sind Kimais ids (Blöcke nach der ersten Zeitbuchung, Buchungen nach
    Zeitbuchung und Stück); ein zweiter Abruf desselben Zeitraums legt nichts an (Test über die API).
  - **Robust**: Fuzzing mit fast-check über die Datei (beliebiger Text, Zeilen mit falschen Typen,
    kaputte Zeitpunkte) und über den Abruf (zufällige Antworten des Ersatzes): nie ein Wurf, nie
    länger als 1 s; jeder Fehler nennt Zeile und Grund.
  - **Ersatz** der API nach dem Quelltext (Token, Seiten, Kopfzeilen, Fehler), in Vitest und für
    Playwright als eigener Dienst. **Oberfläche und Doku**: Kimai in der Liste der Werkzeuge mit
    Anleitung; Playwright (desktop) geht den Abruf gegen den Ersatz bis zur Übernahme und zeigt, dass
    der zweite Lauf nichts anlegt; axe grün; Texte in allen Sprachen der Umzugsseite; Doku
    `docs/umzug.md`, Entscheidungen im Projektplan.
- [ ] **S-706 Papershift, Planday, Crewmeister** – Exporte: Mitarbeiter, Schichten, Zeiten,
  Abwesenheiten.
- [ ] **S-707 Toggl und Clockify** – Export und API für den Solo-Modus: Kunden, Projekte, Zeiten.
- [ ] **S-708 Salden zum Stichtag** – Überstunden und Resturlaub je Person als Startsaldo, von Hand
  oder aus dem Import, im Audit-Log.

Für S-703 bis S-707 gilt: Fertig, wenn Fixtures nach der Exportbeschreibung des Anbieters bestehen
(Quelle im Test) und ein Playwright-Test den ganzen Ablauf zeigt. Echte, anonymisierte Dateien
ergänzen Menschen (siehe unten).

## Phase 8 – Tablet-Terminal

Alle Punkte: nach S-305.

- [x] **S-801 Terminal** – Gerät per Code koppeln, Kiosk-Ansicht in 1280 × 800, PIN und QR-Code,
  Wake Lock, Neuladen nach Fehler.
  Fertig, wenn: Playwright im Projekt `terminal` (1280 × 800, `e2e/terminal/`, `@terminal`) ein
  Tablet mit einem Code des Inhabers koppelt, eine Person per PIN und eine per QR-Code erkennt, beide
  Kommen stempeln und die Ansicht danach von selbst zur Uhr zurückkehrt, und axe in hell und dunkel
  nichts findet. Dazu: der Inhaber erzeugt einen Kopplungscode, der kurz gilt, einmal eingelöst wird
  und nur als Hash gespeichert ist; das Tablet tauscht ihn gegen ein Geräte-Token, das nur als Hash
  gespeichert, vom Inhaber widerrufbar und an seinen Betrieb gebunden ist und nichts darf außer
  Personen per PIN oder QR-Code zu erkennen und für sie zu stempeln; eine PIN erkennt die Person
  allein, ist im Betrieb eindeutig und nie im Klartext gespeichert, falsche Versuche sperren das
  Gerät mit wachsender Wartezeit (Zahlen in `docs/plan.md`), jeder Versuch steht in der Audit-Kette;
  der QR-Code je Person ist ein Zufallswert, nur als Hash gespeichert, neu ausstellbar und
  entziehbar, druckbar aus der App; die Kamera liest ihn mit `BarcodeDetector`, kein Bild wird
  gespeichert oder gesendet, nur der gelesene Wert (im Test ersetzt); nach dem Erkennen sieht die
  Person ihren Stand und die passenden Knöpfe Kommen, Pause, Gehen, nach wenigen Sekunden ohne
  Eingabe geht die Ansicht zurück; Wake Lock hält den Bildschirm an (im Test ersetzt); nach einem
  Fehler und wenn das Netz zurückkommt, lädt die Ansicht neu; ein widerrufenes Gerät landet wieder
  bei der Kopplung; jede Stempelung trägt die Quelle „terminal“ und das Gerät; ein abgeschaltetes
  Modul Terminal wird abgelehnt; ein Test je neuem Endpunkt, dass kein Betrieb Daten eines anderen
  sieht oder ändert; keine Fotos, Fingerabdrücke oder Standorte; Texte in allen sechs Sprachen.
- [x] **S-802 NFC-Karten** – Web NFC; Karten-UID nur mit PIN, NTAG 424 DNA mit Prüfung der
  SUN-Nachricht.
  Fertig, wenn: Playwright mit einem Ersatz für `NDEFReader` Karte mit PIN, Karte ohne PIN und eine
  gefälschte SUN-Nachricht prüft.
  Dazu: der Inhaber trägt unter Einstellungen je Person Karten ein, als einfache Karte mit ihrer UID
  oder als NTAG 424 DNA mit UID, SDMMetaReadKey und SDMFileReadKey; die Schlüssel stehen nur
  verschlüsselt in der Datenbank, die UID nur als Kennung mit geheimem Schlüssel (wie die PIN), und
  eine UID gibt es im Betrieb einmal; eine einfache Karte erkennt die Person nur zusammen mit deren
  PIN, denn eine UID lässt sich kopieren, und eine Karte allein lehnt der Server ab; eine NTAG 424 DNA
  erkennt die Person allein, wenn die SUN-Nachricht stimmt: PICCData mit dem SDMMetaReadKey
  entschlüsselt, der CMAC mit dem aus dem SDMFileReadKey abgeleiteten Sitzungsschlüssel geprüft, ein
  Lesezähler, der nicht größer ist als der zuletzt gesehene, abgelehnt (Wiederholung); AES-CMAC mit
  `node:crypto`, geprüft mit den Beispielwerten aus AN12196 und RFC 4493; jede unbekannte Karte,
  falsche PIN zur Karte und gefälschte oder wiederholte SUN-Nachricht zählt zur Sperre des Terminals
  und steht in der Audit-Kette; der Inhaber entzieht eine Karte, ihre Schlüssel werden gelöscht, der
  Zähler bleibt; Web NFC nur, wo der Browser `NDEFReader` hat (Chrome auf Android), sonst bleibt das
  Terminal bei PIN und QR-Code; Playwright `@terminal` mit einem Ersatz für `NDEFReader`: eine Karte
  mit PIN stempelt, eine Karte ohne PIN wird abgelehnt, eine gefälschte und eine wiederholte
  SUN-Nachricht werden abgelehnt, eine echte erkennt die Person; ein Test je neuem Endpunkt, dass kein
  Betrieb Karten eines anderen sieht oder ändert; die Auskunft nennt die Karten der Person ohne UID
  und Schlüssel; ein abgeschaltetes Modul Terminal wird abgelehnt; axe in hell und dunkel; Texte in
  allen sechs Sprachen.
- [x] **S-803 Terminal offline** – Warteschlange aus S-305 auf dem Gerät, Anzeige des Stands.
  Fertig, wenn: ein Tablet ohne Netz weiter Stempelungen per PIN, QR-Code und NFC-Karte annimmt,
  sie in einer Warteschlange auf dem Gerät hält und nach der Rückkehr des Netzes überträgt
  (Playwright `@terminal` mit `context.setOffline`), und die Ansicht den Stand zeigt (online oder
  ohne Netz, Zahl der wartenden Einträge, zuletzt übertragen). Dazu: das Tablet erzeugt beim Koppeln
  einen nicht exportierbaren ECDSA-P-256-Schlüssel (WebCrypto, IndexedDB) und meldet den
  öffentlichen beim Server an (neue Migration, Audit-Kette); jeder Eintrag trägt eine fortlaufende
  Nummer je Terminal, Art, Zeit des Geräts und das Erkennungsmerkmal (PIN, QR-Wert, Karte mit PIN
  oder SUN-Nachricht) nur verschlüsselt mit einem öffentlichen Schlüssel des Servers, so dass auf dem
  Tablet keine PIN im Klartext liegt; der Server prüft beim Übertragen Signatur, Terminal, Nummer und
  erkennt die Person wie online (Sperre und Audit-Kette für Fehlversuche, Wiederholung der
  SUN-Nachricht abgelehnt), derselbe Eintrag zweimal ergibt eine Stempelung, eine schon vergebene
  Nummer mit anderem Inhalt wird abgelehnt, eine Lücke in den Nummern sieht der Inhaber beim
  Terminal; die Stempelung trägt Quelle `terminal`, das Terminal, die Zeit des Geräts (verschoben um
  die Abweichung seiner Uhr wie in S-305) und `offline`; ohne Netz sieht die Person „gespeichert,
  wird übertragen“ statt ihres Stands und die Knöpfe Kommen, Pause, Gehen; ein abgelehnter Eintrag
  steht beim Inhaber mit Grund; ein widerrufenes Terminal überträgt nichts mehr; Warteschlange und
  Verschlüsselung als reine Funktionen mit Vitest (IndexedDB und WebCrypto im Speicher ersetzt); ein
  Test je neuem Endpunkt, dass kein Betrieb Daten eines anderen sieht oder ändert; abgeschaltetes
  Modul Terminal abgelehnt; axe in hell und dunkel; Texte in allen sechs Sprachen; Doku.

## Phase 9 – Härtung und Betrieb

- [x] **S-901 Aussonderung** – Frist je Monatsabschluss (2 Jahre, 6 oder 8 Jahre bei Lohnbezug),
  Inhalte nach Ablauf entfernen, die Kettenglieder bleiben, die Aussonderung steht selbst in der
  Kette.
  Fertig, wenn: ein Test mit gestellter Uhr aussondert und die Kette danach fehlerfrei prüft.
- [x] **S-902 Verfahrensdokumentation** – aus dem Stand erzeugt; Gliederung und Texte aus
  `verfahrensdoku/` von gobd-kern in `firsttris/haben` kopiert und auf Soll angepasst (Quelle
  nennen).
  Fertig, wenn: der Inhaber eines Betriebs die Verfahrensdokumentation nach GoBD (BMF-Schreiben vom
  28.11.2019, Rz. 151 bis 155) in der App ansieht und als PDF und als Markdown herunterlädt, bei
  jedem Aufruf aus dem Stand seines Betriebs erzeugt. Gliederung nach Rz. 153 und Rz. 100 ff.:
  allgemeine Beschreibung, Anwenderdokumentation, technische Systemdokumentation,
  Betriebsdokumentation, internes Kontrollsystem. Aus dem Stand kommen: Name und Land des Betriebs,
  die eingeschalteten Module (ein abgeschaltetes heißt so, seine Abläufe fehlen), Standorte, die
  Rollen mit der Zahl ihrer Mitglieder und was jede darf (aus `auth/rollen.ts`, ohne Namen und
  E-Mail-Adressen), API-Zugänge (Zahl gültiger), die Fristen der Aufbewahrung je Monatsabschluss und
  die Zahl abgeschlossener und ausgesonderter Monate (S-901), Audit-Kette mit aktuellem Prüfwert und
  dem Ergebnis der Kettenprüfung beim Erzeugen, Stundenzettel und Prüfseite, Sicherung und
  Wiederherstellung (S-905), Terminal mit Kopplung, PIN, QR-Code, NFC-Karten und Warteschlange ohne
  Netz (S-801 bis S-803, nur bei eingeschaltetem Modul, mit Zahl der Terminals und Karten), DATEV
  (eingerichtet oder nicht, ohne Personalnummern), Haben (nur die Adresse, nie das Token), Importe
  (wie der Umzug aus S-701 arbeitet, Zahl der Importe und ihre Werkzeuge, wo die Originaldateien liegen). Was nur der Betrieb wissen kann (Rechtsform, Anschrift,
  Verantwortliche, Datensicherung, Ort der Aufbewahrung, Betrieb des Servers, Ablage der Schlüssel)
  speichert der Inhaber über die Audit-Kette; ein leeres Feld steht als „Fehlt“ im Dokument, und das
  Dokument heißt dann unvollständig. Dazu kann er bis zu 20 eigene Abschnitte mit Titel und Text
  anlegen. Jede Fassung trägt Tag, Version von Soll und Prüfwert (Rz. 154), und das Dokument nennt
  jede gespeicherte Änderung der Angaben mit Tag und Kettenglied. Dasselbe Stand-Objekt und derselbe
  Tag ergeben byte-gleich dasselbe Markdown und dasselbe PDF (Golden-Tests für „Weber Haustechnik“
  und „Café Elbblick“). Markdown maskiert Text aus Angaben (kein HTML, keine Formatierung). Nur der
  Inhaber liest, speichert und lädt herunter (Recht `verfahrensdoku:verwalten`); jede andere Rolle
  bekommt 403, ungültige Angaben 400. Ein Test je Endpunkt zeigt, dass kein Betrieb Angaben oder
  Stand eines anderen sieht oder ändert. Texte des Dokuments Deutsch (für die deutsche
  Finanzverwaltung), Gliederung, Datenmodell, Lücken und Markdown aus
  `packages/gobd-kern/src/verfahrensdoku/` in `firsttris/haben` kopiert mit Quelle im Kommentar;
  keine Abhängigkeit von Haben. Oberfläche auf Deutsch und Englisch, axe hell und dunkel,
  Playwright am Desktop (Angaben speichern, Markdown und PDF herunterladen), Doku-Seite, README,
  Entscheidungen im Projektplan.
- [x] **S-903 Datenschutz** – Infoblatt für Beschäftigte, Vorlage für eine Betriebsvereinbarung,
  Löschkonzept als Doku-Seite.
  Fertig, wenn: drei Seiten auf Deutsch unter `docs/` stehen, in `mkdocs.yml` verlinkt und jede als
  Vorlage gekennzeichnet, die juristisch zu prüfen ist (Schritte für Menschen). Das **Infoblatt**
  enthält die Angaben nach Art. 13 Abs. 1 und 2 DSGVO mit Platzhaltern für das, was nur der Betrieb
  weiß (Name, Anschrift, Datenschutzbeauftragter, Lohnbüro, Aufsichtsbehörde): was Soll aufzeichnet
  und wozu (§ 3 Abs. 2 Nr. 1 ArbSchG nach BAG 1 ABR 22/21, § 16 Abs. 2 ArbZG, § 17 MiLoG, Lohn),
  die Rechtsgrundlagen (Art. 6 Abs. 1 lit. b und c, Art. 9 Abs. 2 lit. b, Art. 88 DSGVO, § 26 BDSG),
  Empfänger (Lohnbüro und DATEV, Haben, Kunden bei Stundennachweisen), die Fristen aus S-901 (2 und
  8 Jahre), die Rechte nach Art. 15 bis 21 und 77 DSGVO mit der Auskunft als Download (S-309) und
  was Soll nie tut (Standort, Fotos, Fingerabdrücke, Diagnose, Auswertung je Person ohne Schalter,
  automatisches Ausstempeln, Entscheidungen nach Art. 22). Die **Betriebsvereinbarung** nach § 87
  Abs. 1 Nr. 6 BetrVG regelt genau die Funktionen und Schalter, die Soll auf `main` hat: Module,
  Rollen, Auswertung je Person (S-604), Terminal mit PIN, QR-Code und NFC-Karte (S-801, S-802),
  Erinnerungen per Web Push und Mail (S-307), Zugänge zur API und MCP (S-607), Kalender-Feed
  (S-503), Haben (S-606), DATEV (S-308), Auskunft und Prüfexport (S-309); Importe (S-701) erst, wenn
  es sie gibt. Das **Löschkonzept** folgt DIN 66398 (Datenarten, Löschklassen mit Frist und
  Startereignis, Umsetzung, Verantwortung, Sicherungen, Löschsperren) und nennt **jede Tabelle** der
  Datenbank mit Löschklasse und dem, was der Code heute tut; wo Soll nichts löscht, steht das als
  offener Punkt da. Ein Test vergleicht die Tabellen des Löschkonzepts mit allen Tabellen von
  `db/schema.ts` und `db/auth-schema.ts`, so dass keine neue Tabelle ohne Löschregel bleibt. Ob das
  Infoblatt als PDF aus der App kommt, entscheidet `docs/plan.md`.
- [x] **S-904 Lasttest** – 50 Betriebe mit je 50 Personen stempeln zur selben Minute.
  Fertig, wenn: `bun run lasttest` den Server auf einer leeren Datenbank in einem temporären
  Verzeichnis auf Port 28300 startet, 50 Betriebe mit je 50 Personen über die HTTP-API anlegt (echte
  Konten und Sitzungen), alle 2.500 gleichzeitig „Kommen“ stempeln lässt, p50, p95, p99, Maximum und
  Fehler ausgibt, danach genau eine Stempelung je Person und jede Kette ohne Befund prüft und nur bei
  bestandener Schwelle mit 0 endet (Schwelle, Dauerhaftigkeit und CI in `docs/plan.md`); eine kleine
  Fassung läuft in `bun run test`, der volle Lauf im Workflow `Lasttest`.
- [x] **S-905 Installation** – Docker-Image (amd64, arm64), Compose, Quadlet, Backups mit
  Wiederherstellung (`VACUUM INTO`), Release-Workflow aus firsttris/workflows.
  Fertig, wenn: die CI das Image baut und ein Container mit leerem Datenverzeichnis startet und
  `/health` antwortet; veröffentlicht wird es erst mit den Zugangsdaten (Schritte für Menschen).
  Dazu: ein mehrstufiges `Containerfile` baut ein kleines Laufzeit-Image nur mit dem kompilierten
  Binary und dem statischen Build der App, ohne Bun, Quellen oder `node_modules`; es läuft als
  Benutzer ohne Root-Rechte, die Daten liegen im Volume `/data`, ein `HEALTHCHECK` fragt `/health`
  ohne curl im Image; kein Geheimnis steckt im Image, in `compose.yaml` oder in der Quadlet-Datei
  (`SOLL_SECRET_KEY` kommt aus einer Datei neben der Compose-Datei bzw. aus einem Podman-Secret).
  Der Server liefert die App aus (`SOLL_WEB_DIR`): eine Datei des Builds mit ihrem Typ, jeder Pfad
  ohne Dateiendung außerhalb von `/api` die `index.html`, `/assets/*` unveränderlich gecacht,
  `sw.js` und `index.html` nie; ein Pfad mit `..` liefert nichts außerhalb des Verzeichnisses, ein
  unbekannter Pfad unter `/api` nie die App (Tests). `deploy/compose.yaml` und Quadlet-Dateien unter
  `deploy/quadlet/` (Container, Volume, Sicherung als Timer). `soll backup [ziel]` schreibt mit
  SQLite `VACUUM INTO` eine in sich stimmige Kopie, auch während der Server im WAL-Modus schreibt,
  prüft sie mit `PRAGMA integrity_check` und überschreibt nie eine vorhandene Datei;
  `soll restore <quelle>` legt sie in ein leeres Datenverzeichnis, verweigert ein vorhandenes
  `soll.db` und meldet je Betrieb das Ergebnis der Kettenprüfung (Tests: Daten schreiben → Sicherung
  bei offenem Schreiber → neues leeres Verzeichnis → Wiederherstellung → dieselben Zeilen, dieselben
  Prüfwerte, die Kette prüft ohne Befund; ein vorhandenes Ziel, eine fremde oder kaputte Datei werden
  als Wert abgelehnt). Ein CI-Job baut das Image für amd64 mit `actions/docker-build` aus
  firsttris/workflows, startet es mit leerem Volume und erzeugtem Testschlüssel, fragt `/health`,
  prüft, dass es ohne `SOLL_SECRET_KEY` nicht startet, und macht im Container eine Sicherung; arm64
  baut erst der Release (Entscheidung im Projektplan). `.github/workflows/release.yml` ruft
  `docker-release.yml` aus firsttris/workflows erst nach der CI und nur, wenn das Secret
  `DOCKER_PAT` gesetzt ist; ohne veröffentlicht er nichts und sagt das in der Zusammenfassung.
  `docs/installation.md` (Docker Compose, Podman Quadlet, Binary, Umgebung, Sicherung und
  Wiederherstellung, Update), README mit Abschnitt Installation.
- [x] **S-906 Gesetzeswächter** – Workflow wie in Haben: Normen mit SHA-256, Jahreswerte; ein Issue,
  wenn sich etwas ändert.
  Fertig, wenn: `scripts/gesetze/normen.json` jede beobachtete Norm mit ihrer Adresse auf
  gesetze-im-internet.de und dem SHA-256 ihres normalisierten Textes führt (Überschrift, Text und
  Fußnoten ohne Tags, Navigation und Fußzeile, Entities aufgelöst, Leerraum zusammengefasst; nach
  `scripts/jahreswerte/normen.ts` aus `firsttris/haben`, kopiert mit Quelle); der Normalisierer an
  Fixtures zeigt, dass Navigation, Zeichensatz (ISO-8859-1 nur im meta-Element) und Leerraum den Hash
  nicht ändern, ein geändertes Wort aber schon (Tests). Ein Test liest jede Fundstelle mit Paragraf
  und Gesetz aus `docs/regeln.md` und verlangt sie in der Liste: ArbZG, ArbSchG, MiLoG,
  SchwarzArbG, JArbSchG, MuSchG, TzBfG, BUrlG, EntgFG, SGB IV (§§ 8, 8a, 109), SGB V § 45,
  SGB IX § 208, BEEG § 17, EStG § 3b, BetrVG § 87, BGB, SvEV § 1, dazu die Grundlagen der Jahreswerte
  (§ 1 MiLoG, § 1 MiLoV5, § 8 SGB IV, § 45 SGB V); Recht, das gesetze-im-internet.de nicht führt
  (Landesrecht wie die Feiertagsgesetze, DSGVO, Urteile, Richtlinien wie die LStR), steht mit Grund
  in einer Ausnahmeliste, ein unbekanntes Gesetz lässt den Test scheitern. `bun run gesetze` ruft
  die Normen ab, vergleicht und schreibt einen Bericht (`--bericht`), `--schreiben` übernimmt die
  aktuellen Hashes; eine Norm ohne Hash ist „noch kein Stand“ und kein Befund, eine nicht
  erreichbare Seite eine Warnung, 404 ein Befund. Fehlende Jahreswerte sind Befunde: das laufende
  Jahr immer, das nächste ab dem 1. Oktober (Mindestlohn, Minijob-Grenze, Kinderkrankentage), dazu
  eine neue Mindestlohnanpassungsverordnung auf gesetze-im-internet.de. Der Workflow
  `.github/workflows/gesetze.yml` läuft wöchentlich und auf Knopfdruck mit `issues: write` über
  `GITHUB_TOKEN` und öffnet genau ein Issue mit dem Label `gesetzeswaechter`, das alle Befunde
  auflistet; ein offenes bekommt bei geänderten Befunden einen Kommentar und neuen Text, bei gleichen
  nichts; ohne Befund entsteht keins (Tests mit nachgestellter API). Alle Abrufe in Tests laufen
  gegen Fixtures, ohne Netz. Doku `docs/gesetzeswaechter.md` und `docs/entwicklung.md`.
- [ ] **S-907 Doku und Website** – alle Seiten aus dem Projektplan, Startseite als Produktseite,
  README aktuell.
- [x] **S-908 Screenshots** – Workflow „Update screenshots“, hell und dunkel, Desktop, Handy,
  Terminal.
  Fertig, wenn: `bun run screenshots [--heute <JJJJ-MM-TT>] [--ziel <verzeichnis>] [--nur <name>]`
  die Demo-Daten (S-909) in ein frisches temporäres Verzeichnis schreibt, nie in eines mit
  vorhandenem `soll.db`, und den Server im selben Prozess auf dieser Datenbank startet, mit fester
  Uhr (`--heute`, Vorgabe ein fester Tag im Skript, 10:45 Uhr in Europe/Berlin) und dem statischen
  Build der App (`SOLL_WEB_DIR`-Weg, kein Vite), auf einem eigenen Port abseits der Dev- und
  e2e-Ports; Playwright meldet sich je Bild über die API als die passende Person an (Inhaber, Planerin,
  Mitarbeiterin; das Terminal gekoppelt mit einem Code der Inhaberin) und legt für eine feste Liste
  von Bildschirmen (Heute, Zeiten, Monat, Abwesenheiten, Dienstplan, Projekte, Einstellungen, Prüfseite mit einem echten Prüfwert, Terminal) je hell und dunkel PNGs unter
  `docs/assets/screenshots/<name>-<light|dark>-<desktop|phone|terminal>.png` ab: Desktop
  1280 × 800, Handy 412 × 915, Terminal 1280 × 800 nur für das Terminal, alle mit
  `deviceScaleFactor` 2. Die Bilder sind bei gleichem `--heute` gleich bis auf Kennungen: feste Uhr
  im Browser (`page.clock`) und auf dem Server, Zeitzone Europe/Berlin, Sprache `de`, Geist aus dem
  Build, keine Animationen und Übergänge, das Thema über die Einstellung der App (`soll-thema`) und
  `prefers-color-scheme`; ein Bildschirm, der seine erwartete Überschrift nicht zeigt, lässt den Lauf
  scheitern, statt ein falsches Bild zu schreiben. Ein Vitest prüft die Liste: eindeutige Namen,
  Dateinamen nach dem Schema, jeder Pfad eine Route der App (`apps/web/src/routes/`), und
  dass jedes Bild, auf das README oder `docs/` verweisen, in der Liste steht und umgekehrt jede
  Datei unter `docs/assets/screenshots/` aus der Liste kommt. Der Workflow
  `.github/workflows/screenshots.yml` („Update screenshots“, nur `workflow_dispatch`) baut die App,
  erzeugt die Bilder, lädt sie als Artefakt hoch und öffnet mit `GITHUB_TOKEN` (`contents: write`,
  `pull-requests: write`) einen Pull Request mit den geänderten Bildern, wenn sich etwas geändert
  hat; ohne Änderung keinen. README (Startseite mit Bildern) und die Seiten in `docs/` zu Stempeln,
  Monat, Abwesenheiten, Dienstplan, Projektzeit, Terminal und Prüfseite zeigen die Bilder;
  `docs/entwicklung.md` beschreibt Skript und Workflow; Entscheidungen im Projektplan. Die
  Bilder im Repository sind erzeugt, nicht von Hand, und klein gehalten (nur der sichtbare Bereich,
  kein ganzseitiges Bild).
- [x] **S-909 Testdaten** – `bun run demo` legt „Weber Haustechnik“ und „Café Elbblick“ mit drei
  Monaten Daten an.
  Fertig, wenn: `bun run demo [--ziel <verzeichnis>] [--heute <JJJJ-MM-TT>]` ein frisches
  Datenverzeichnis anlegt und ein vorhandenes `soll.db` verweigert (nie echte Daten, CLAUDE.md); die
  zwei Betriebe und ihre Personen genau wie in CLAUDE.md, „Test data“, stehen (Weber Haustechnik,
  Hamburg: Jonas Weber, Inhaber; Anna, Büro; Sandra und Max, Monteure; Leon, Auszubildender, 17;
  Café Elbblick, Hamburg: Mia, Inhaberin; Tom, Lea und Yusuf in Schichten; Olena und Piotr auf
  Minijob; Adressen unter `.test`); die drei vollen Monate vor dem Monat von `--heute` und dieser
  Monat bis `--heute` über die echten Routen und damit über die Audit-Kette geschrieben sind, nicht
  mit SQL an ihr vorbei: Stempelungen mit Pausen (Weber im Browser, das Café am gekoppelten Terminal
  mit PIN), einige Korrekturen mit Grund (Nachtrag, Änderung), Abwesenheiten (Urlaub beantragt und
  freigegeben, krank mit eAU, Kind krank), jeder volle Monat von der Person bestätigt und vom Betrieb
  abgeschlossen mit Prüfwert, Wochenpläne des Cafés vorab geplant und veröffentlicht, Projektzeit
  bei Weber mit Kunden, Aufträgen, Tätigkeiten, Buchungen und einem unterschriebenen
  Stundennachweis; der Ablauf ist deterministisch (Zufall mit Startwert aus `--heute`: gleiche
  Zeiten, Abwesenheiten und Buchungen bei gleichem `--heute`; Kennungen und Hashes vergibt Soll
  selbst); Befunde sind absichtlich dabei, damit die Prüfansichten etwas zeigen (Höchstarbeitszeit
  und Pause bei einem Notdienst, eine kurze Ruhezeit im Café, im Plan der kommenden Woche eine
  Schicht über acht Stunden für Leon nach § 8 JArbSchG), eine Spätschicht über die Zeitumstellung
  im Oktober zählt in echten Minuten; danach prüft jede Kette ohne Befund, und der Lauf gibt die
  Anmeldedaten einmal aus, als nur für die Demo gekennzeichnet; ohne `SOLL_SECRET_KEY` erzeugt er
  einen Schlüssel und gibt ihn einmal aus, schreibt ihn aber nirgends hin. Ein Vitest lässt die Demo
  in ein temporäres Verzeichnis laufen und prüft Anzahlen, Ketten, einen Prüfwert auf der Prüfseite,
  die Befunde, die Zeitumstellung, die Ablehnung eines vorhandenen `soll.db` und dieselben Zeiten
  bei zweimal demselben `--heute`. Doku `docs/demo.md`, Abschnitt im README.

## Übergabe

Stand für den nächsten Agenten, der den Loop aufnimmt. Erledigtes hier streichen.

**Angefangene Punkte (Entwurf, ungetestet):** Weiterbauen auf dem Branch des Pull Requests, nicht
neu anfangen. Die Migrationen kollidieren mit `main` und werden neu erzeugt (siehe CLAUDE.md, „Pull
requests“).

- keine

**Offene Nacharbeiten** (beim Bauen aufgefallen, noch ohne Pull Request):

- [ ] SvEV § 1: Aufteilung bei 25 €/h auf drei Teile (nur ein Test liegt vor)
- [ ] Dienstplan zeigt „nicht hinterlegt“, wenn ein Jahreswert fehlt
- [ ] Doppeltes Antippen beim Stempeln: kurze Sperre (Vorschlag 1,5 s), Entscheidung fehlt
- [ ] Abgeschlossener Monat sperrt die Projektzeit nicht; entscheiden und eintragen
- [ ] Löschen nach dem Austritt (Löschkonzept, Klasse P): Angaben für die Prüfung, Zuordnungen,
  Konten, Hinweise, Einstellungen der Erinnerungen, PIN, Geräte, Konto, wenn der letzte Monat der
  Person ausgesondert ist
- [ ] Fristen für Schichten und gesendete Erinnerungen (Klasse V) und für abgerechnete
  Projektzeit, Stundennachweise und Übergaben an Haben (Klasse L)
- [ ] Inhalte gelöschter Zeilen bleiben in `audit_inhalte`; abgelaufene Einladungen, Zugänge zur
  API und Sitzungen bleiben als Zeile (`docs/loeschkonzept.md`, „Offene Punkte“)
- [ ] Importe: Originaldateien unter `dateien/` und Zeilen in `importe` entfernen, wenn der letzte
  Monat ausgesondert ist, in den ihre Zeiten fallen (der Dateispeicher kann heute nichts entfernen);
  ebenso Fristen für `schichttausche`
- [ ] Solo-Betrieb: Oberfläche für „später einladen“ fehlt
- [ ] Projektzeit über MCP buchen
- [ ] Inhaber kann API-Zugänge anderer nicht widerrufen
- [ ] OpenAPI-Dokument durch einen externen Validator prüfen
- [ ] Quadlet und arm64-Image nicht geprüft
- [ ] S-605: Storno eines unterschriebenen Stundennachweises fehlt
- [ ] Konten über ausgesonderte Monate: Saldo und genommenen Urlaub eines Monats bei der
  Aussonderung festhalten, bis dahin ist das Konto „nicht hinterlegt“ (S-402, fällig frühestens 2029)
- [ ] Standort je Person (Teamkalender filtern, Feiertage im Soll vom Standort der Person) (S-402)
- [ ] Hinweis auf Verfall zusätzlich per Mail an die Person (S-402)
- [ ] Gesetzeswächter: Workflow einmal von Hand starten und die Prüfsummen in
  `scripts/gesetze/normen.json` übernehmen

## Zurückgestellt

Punkte, die dreimal gescheitert sind, mit Grund; der Loop kommt am Ende auf sie zurück.

## Schritte für Menschen

Nicht auf dem Weg des Loops; alles erst nach der letzten Phase.

- [ ] GitHub Pages mit Domain soll.work, DNS
- [ ] Zugangsdaten für Docker Hub als Secrets im Repo, dann das erste Release: Repository
  `tristanteu/soll` auf Docker Hub anlegen, ein Access Token als Secret `DOCKER_PAT` (ein anderes
  Image über die Variablen `DOCKERHUB_IMAGE` und `DOCKERHUB_USER`), dann die Version in
  `package.json` setzen und Tag `v0.1.0` pushen (`.github/workflows/release.yml`,
  [Installation](https://soll.work/installation.html))
- [ ] Marke „Soll“ bei DPMA und EUIPO prüfen (Klassen 9 und 42)
- [ ] Übersetzungen Türkisch, Polnisch, Ukrainisch und Arabisch von Muttersprachlern prüfen lassen
- [ ] Regelwerk von einer Fachanwältin oder einem Fachanwalt für Arbeitsrecht gegenlesen lassen
- [ ] DATEV-Export bei einer Steuerberatung testweise importieren
- [ ] Echte, anonymisierte Exporte aus Clockodo, Personio, Kimai, Papershift, Planday, Crewmeister,
  Toggl und Clockify als Fixtures beisteuern
- [ ] Vorlagen zum Datenschutz juristisch prüfen lassen: Betriebsvereinbarung, Infoblatt für
  Beschäftigte und Löschkonzept (`docs/betriebsvereinbarung.md`, `docs/infoblatt.md`,
  `docs/loeschkonzept.md`)
- [ ] Pilot in einem Schichtbetrieb und einem SHK-Betrieb, je ein Monat
- [ ] Gehostete Variante und Partner (Steuerberatungen, IT-Dienstleister) aufsetzen
