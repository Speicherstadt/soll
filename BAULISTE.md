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

- [ ] **S-401 Abwesenheiten** – Arten Urlaub, Krank, Kind krank, Sonderurlaub, Überstundenabbau;
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
  abdecken.
- [ ] **S-402 Teamkalender und Konten** – Kalender je Standort, Konten in der App, Datum des
  Hinweises auf Verfall.

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
- [ ] **S-502 Prüfung beim Einplanen** – alle Regeln aus Phase 2 auf geplante Schichten, dazu § 12
  TzBfG (4 Tage Vorlauf bei Arbeit auf Abruf).
  Fertig, wenn: jede Regel aus Phase 2 im Plan einen Playwright-Fall hat.
- [ ] **S-503 Veröffentlichen** – Benachrichtigung, ICS-Feed je Mitarbeiter mit geheimem Token (RFC
  5545).
- [ ] **S-504 Schichttausch** – anbieten, übernehmen, freigeben.
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
- [ ] **S-605 Stundennachweis** – Regiebericht mit Unterschrift des Kunden auf dem Handy, als PDF.
- [ ] **S-606 Haben** – Kunden lesen, Projektzeit an `POST /api/v1/leistungen` mit `source` und
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

- [ ] **S-701 Import-Grundlage** – Ablauf: Tool wählen, Anleitung zum Export, Datei hochladen oder
  API-Zugang eingeben, Zuordnung von Personen, Spalten, Projekten und Abwesenheitsarten, Vorschau
  mit Befunden der Prüfregeln, Probelauf, Übernahme. Die Originaldatei wird unter ihrem SHA-256
  aufbewahrt; jeder Eintrag trägt „übernommen aus …“ und die Kennung im alten Tool (`externalId`),
  ein zweiter Import legt nichts doppelt an. Übernommene, abgeschlossene Monate werden als
  übernommen gesperrt.
  nach: S-306, S-401, S-501, S-601. Fertig, wenn: Fuzzing mit fast-check keine Datei findet, die den
  Parser abstürzen oder hängen lässt, ein Fehler die Zeile nennt und ein wiederholter Import nichts
  verdoppelt.
- [ ] **S-702 Excel und CSV** – freie Spaltenzuordnung (Person, Datum, Beginn, Ende, Pause, Projekt,
  Tätigkeit), Datums- und Zahlenformate aus Deutschland, Vorlage zum Herunterladen.
- [ ] **S-703 Clockodo** – Export-Dateien und REST-API: Mitarbeiter, Zeiten, Abwesenheiten, Kunden,
  Projekte, Leistungen.
- [ ] **S-704 Personio** – Export und API: Mitarbeiter, Anwesenheiten, Abwesenheiten, Salden.
- [ ] **S-705 Kimai** – REST-API: Kunden, Projekte, Tätigkeiten, Zeitbuchungen.
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
- [ ] **S-802 NFC-Karten** – Web NFC; Karten-UID nur mit PIN, NTAG 424 DNA mit Prüfung der
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
- [ ] **S-803 Terminal offline** – Warteschlange aus S-305 auf dem Gerät, Anzeige des Stands.

## Phase 9 – Härtung und Betrieb

- [ ] **S-901 Aussonderung** – Frist je Monatsabschluss (2 Jahre, 6 oder 8 Jahre bei Lohnbezug),
  Inhalte nach Ablauf entfernen, die Kettenglieder bleiben, die Aussonderung steht selbst in der
  Kette.
  Fertig, wenn: ein Test mit gestellter Uhr aussondert und die Kette danach fehlerfrei prüft.
- [ ] **S-902 Verfahrensdokumentation** – aus dem Stand erzeugt; Gliederung und Texte aus
  `verfahrensdoku/` von gobd-kern in `firsttris/haben` kopiert und auf Soll angepasst (Quelle
  nennen).
- [ ] **S-903 Datenschutz** – Infoblatt für Beschäftigte, Vorlage für eine Betriebsvereinbarung,
  Löschkonzept als Doku-Seite.
- [ ] **S-904 Lasttest** – 50 Betriebe mit je 50 Personen stempeln zur selben Minute.
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
- [ ] **S-906 Gesetzeswächter** – Workflow wie in Haben: Normen mit SHA-256, Jahreswerte; ein Issue,
  wenn sich etwas ändert.
- [ ] **S-907 Doku und Website** – alle Seiten aus dem Projektplan, Startseite als Produktseite,
  README aktuell.
- [ ] **S-908 Screenshots** – Workflow „Update screenshots“, hell und dunkel, Desktop, Handy,
  Terminal.
- [ ] **S-909 Testdaten** – `bun run demo` legt „Weber Haustechnik“ und „Café Elbblick“ mit drei
  Monaten Daten an.

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
- [ ] Vorlage der Betriebsvereinbarung juristisch prüfen lassen
- [ ] Pilot in einem Schichtbetrieb und einem SHK-Betrieb, je ein Monat
- [ ] Gehostete Variante und Partner (Steuerberatungen, IT-Dienstleister) aufsetzen
