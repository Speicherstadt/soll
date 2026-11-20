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
- [ ] **S-205 Jugendliche und Mutterschutz** – §§ 8, 11 bis 14 JArbSchG; §§ 4 bis 6 MuSchG.
- [ ] **S-206 Bereitschaft** – Bereitschaftsdienst als Arbeitszeit, Rufbereitschaft mit Einsätzen,
  Unterbrechung der Ruhezeit.
- [ ] **S-207 Zuschläge** – steuerfreie Anteile nach § 3b EStG getrennt von steuerpflichtigen.
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
- [ ] **S-208 Soll, Ist, Konten** – Soll aus dem Arbeitszeitmodell, Überstundenkonto aus den
  Abschlüssen, Urlaub anteilig, Zusatzurlaub (§ 208 SGB IX), Kürzung bei Elternzeit (§ 17 BEEG),
  Hinweis auf Verfall.

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
- [ ] **S-305 Offline-Stempeln** – Warteschlange in IndexedDB mit fortlaufender Nummer, signiert mit
  einem nicht exportierbaren Schlüssel (WebCrypto); Server- und Gerätezeit.
  Fertig, wenn: offline gestempelt, wieder online übertragen und markiert wird und eine Lücke in der
  Nummer auffällt.
- [ ] **S-306 Monatsabschluss** – Bestätigung durch Mitarbeiter und Betrieb, danach gesperrt;
  Korrektur nur als Gegeneintrag mit Grund; Stundenzettel als PDF mit dem Prüfwert der Kette, den
  jede Person per Mail und zum Herunterladen bekommt; Prüfseite, auf der eine Person ihren Prüfwert
  gegen den Stand prüft.
  Fertig, wenn: eine nachträgliche Änderung an einem abgeschlossenen Monat auf der Prüfseite als
  Abweichung erscheint (Test).
- [ ] **S-307 Erinnerungen** – Ausstempeln vergessen, Pause fällig, Monat bestätigen; Web Push mit
  VAPID-Schlüsseln, die die Instanz beim ersten Start erzeugt, und Mail über SMTP aus der
  Konfiguration; nie automatisch ausstempeln.
  Fertig, wenn: Tests mit einem Ersatz für den Push-Dienst und einem SMTP-Testserver jede Erinnerung
  zeigen.
- [ ] **S-308 DATEV-Lohn-Export** – Bewegungsdaten für LODAS und Lohn und Gehalt mit Zuordnung der
  Lohnarten je Betrieb, Zuschläge nach § 3b EStG getrennt.
  nach: S-306, S-207. Fertig, wenn: Golden-File-Tests für Stundenlohn, Minijob und Zuschläge bestehen
  und jede Feldregel ihre Quelle im Code nennt.
- [ ] **S-309 Prüfexport und Auskunft** – Zeiten je Person und Zeitraum als CSV und PDF für Zoll und
  Arbeitsschutz; Auskunft nach Art. 15 DSGVO als Export.

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

- [ ] **S-501 Planung** – Schichtvorlagen, Wochenansicht, Ziehen und Ablegen, Bedarf je Rolle und
  Standort.
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

- [ ] **S-601 Kunden, Aufträge, Tätigkeiten** – feste interne Tätigkeiten (Fahrt, Werkstatt, Lager,
  Schulung), Stundensätze nach Kunde, Projekt, Tätigkeit und Person, Budgets mit Warnung.
- [ ] **S-602 Stoppuhr** – eine laufende je Person, Wechsel mit einem Tipp, Verweis auf die
  Stempelung, Hinweis bei mehr Projektzeit als Arbeitszeit; änderbar bis „abgerechnet“.
- [ ] **S-603 Betrieb ohne Beschäftigte (Solo-Modus)** – nur das Modul Projektzeit, ohne
  Arbeitszeitprüfung, Abwesenheiten und Dienstplan. Lädt der Betrieb später die erste beschäftigte
  Person ein, schaltet Soll die Arbeitszeit ein und sagt warum (Pflicht zur Erfassung).
  Fertig, wenn: ein Test diesen Wechsel zeigt und ein abgeschaltetes Modul in Navigation, Routen und
  API fehlt.
- [ ] **S-604 Auslastung** – anwesend gegen gebucht je Team; je Person nur eingeschaltet, sichtbar
  für die Beschäftigten, Einstellung im Audit-Log.
- [ ] **S-605 Stundennachweis** – Regiebericht mit Unterschrift des Kunden auf dem Handy, als PDF.
- [ ] **S-606 Haben** – Kunden lesen, Projektzeit an `POST /api/v1/leistungen` mit `source` und
  `externalId` (wiederholbar), Stundennachweis als Anlage.
  Fertig, wenn: Tests gegen einen Ersatz nach `docs/api.md` von Haben bestehen, auch für Wiederholung
  und Fehler.
- [ ] **S-607 REST-API und MCP** – Token je Zugang mit den Rechten seiner Rolle,
  OpenAPI-Beschreibung, MCP-Server.

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

- [ ] **S-801 Terminal** – Gerät per Code koppeln, Kiosk-Ansicht in 1280 × 800, PIN und QR-Code,
  Wake Lock, Neuladen nach Fehler.
- [ ] **S-802 NFC-Karten** – Web NFC; Karten-UID nur mit PIN, NTAG 424 DNA mit Prüfung der
  SUN-Nachricht.
  Fertig, wenn: Playwright mit einem Ersatz für `NDEFReader` Karte mit PIN, Karte ohne PIN und eine
  gefälschte SUN-Nachricht prüft.
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
- [ ] **S-905 Installation** – Docker-Image (amd64, arm64), Compose, Quadlet, Backups mit
  Wiederherstellung (`VACUUM INTO`), Release-Workflow aus firsttris/workflows.
  Fertig, wenn: die CI das Image baut und ein Container mit leerem Datenverzeichnis startet und
  `/health` antwortet; veröffentlicht wird es erst mit den Zugangsdaten (Schritte für Menschen).
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
- [ ] Zugangsdaten für Docker Hub als Secrets im Repo, dann das erste Release
- [ ] Marke „Soll“ bei DPMA und EUIPO prüfen (Klassen 9 und 42)
- [ ] Übersetzungen Türkisch, Polnisch, Ukrainisch und Arabisch von Muttersprachlern prüfen lassen
- [ ] Regelwerk von einer Fachanwältin oder einem Fachanwalt für Arbeitsrecht gegenlesen lassen
- [ ] DATEV-Export bei einer Steuerberatung testweise importieren
- [ ] Echte, anonymisierte Exporte aus Clockodo, Personio, Kimai, Papershift, Planday, Crewmeister,
  Toggl und Clockify als Fixtures beisteuern
- [ ] Vorlage der Betriebsvereinbarung juristisch prüfen lassen
- [ ] Pilot in einem Schichtbetrieb und einem SHK-Betrieb, je ein Monat
- [ ] Gehostete Variante und Partner (Steuerberatungen, IT-Dienstleister) aufsetzen
