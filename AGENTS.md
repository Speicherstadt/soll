# Hinweise für Coding-Agenten

Soll: selbst gehostete Zeiterfassung und Dienstplanung für kleine Betriebe (2 bis 50 Beschäftigte), gebaut um die
Pflicht zur Arbeitszeiterfassung (BAG, 13.09.2022, 1 ABR 22/21). Stempeln im Web, als PWA und am Tablet-Terminal;
jeder Tag wird gegen das Arbeitszeitgesetz geprüft, mit dem Paragrafen in jedem Befund; der Monat wird abgeschlossen,
und jede Person behält einen Prüfwert, der jede spätere Änderung zeigt; Lohndaten gehen an DATEV, Projektzeit an
Haben. Teil der Speicherstadt, kennt aber keine andere App: Jede Verbindung läuft über einen offenen Standard oder
eine dokumentierte API (OpenID Connect, REST, ICS). Monorepo mit Bun-Workspaces: Regeln ohne Datenbank in
`packages/arbeitszeit`, Hono-Server in `apps/server`, Solid-2-SPA/PWA mit Terminal in `apps/web`.

Die Regeln stehen einmal, in [`docs/mitwirken.md`](docs/mitwirken.md) (Beitragen) und
[`docs/entwicklung.md`](docs/entwicklung.md) (Bauen: Konventionen, Quellen, Solid 2.0, Datenbank), auf Deutsch, für
Menschen und Agenten. Diese Datei sagt, wo was steht und was nie passieren darf. Vor dem Start die Abschnitte lesen,
die die Änderung berühren.

## Wo was steht

| Was | Wo |
| --- | --- |
| Was als Nächstes gebaut wird, Kriterien, wie der Loop arbeitet | `BAULISTE.md` |
| Aufbau, Befehle, Datenbank, Konventionen, Quellen | `docs/entwicklung.md` |
| Aussehen und Verhalten der Oberfläche | `DESIGN.md`, das Mockup in `design/mockup/` (den Bildschirm lesen, bevor er gebaut wird) |
| Solid 2.0 (vor jedem Solid-Code; das Gedächtnis kennt meist 1.x) | `docs/solid-2.0/MIGRATION.md`, `docs/solid-2.0/CHEATSHEET.md`, die verbotenen Formen in `docs/entwicklung.md`, „Solid 2.0“ |
| Jede Regel, die die App prüft, mit Norm und Testfällen (vor allem in `packages/arbeitszeit`) | `docs/regeln.md` |

Die Doku liegt in `docs/` (<https://soll.work/>), nur auf Deutsch. Links in README und Doku zeigen auf die Website,
nicht auf `docs/*.md`.

## Skills

Die Schritte für wiederkehrende Aufgaben stehen in [`.agents/skills`](.agents/skills); jeder Agent folgt denselben
Dateien. Aus der [Werkbank](https://github.com/Speicherstadt/werkbank) (gleich in allen Projekten, Änderungen dort):
`beitrag` (Branch, Commits, Pull Request als Entwurf, dann Selbstprüfung und Review), `beitrag-pruefen` (gewollt,
Quellen, einfachste Lösung, Regeln), `tdd-review` (unabhängiges Review, ein Befund braucht einen fehlschlagenden
Test), `doku-pruefen` (Review des Markdowns), `fork-pushen` (Push auf den Fork einer anderen Person),
`prs-abarbeiten` (alle offenen Pull Requests, vom einfachsten Merge an), `issue-schreiben`, `board-pflegen` (das
Board auf GitHub), `release`, `fehler-eingrenzen` (Ursache eines Fehlers über eine rote Prüfung finden) und
`vorhaben-klaeren` (einen Plan vor dem Bauen mit der Person durchfragen). Aus diesem Projekt: `checks` (alle
Prüfungen, auch die gemeinsamen Checks, Doku und Image).

## Der Loop

Die Bauliste abarbeiten, wie `BAULISTE.md` unter „So arbeitet der Loop“ beschreibt: ein Punkt je Pull Request, Tests
zuerst, unabhängiges Review (`tdd-review`), dann selbst mergen ([Wer mergt was](docs/mitwirken.md#wer-mergt-was)).
Angefangene Arbeit und Merges ohne Review stehen dort unter „Übergabe“; zuerst lesen.

## Nie

- Floats für Geld oder Zeit: Dauern in ganzen Minuten, Geld in Cent, Urlaub in halben Tagen.
- Einen abgeschlossenen Monat oder ein Glied der Audit-Kette ändern, an der Kette vorbei in die Datenbank schreiben,
  eine bestehende Migration ändern, `drizzle/meta/` von Hand schreiben.
- Arbeitszeit zulasten der Beschäftigten runden oder automatisch ausstempeln.
- Den Standort fortlaufend erfassen, beim Stempeln Fotos oder Fingerabdrücke nehmen, eine Diagnose oder eine
  hochgeladene Krankmeldung speichern (Art. 9 DSGVO).
- Eine Auslastung je Person zeigen, solange der Betrieb sie nicht eingeschaltet hat (BetrVG § 87).
- Mit Werten eines anderen Jahres rechnen, wenn ein Jahreswert (Mindestlohn, Minijob-Grenze) fehlt: stattdessen
  „nicht hinterlegt“.
- Tests auf eine Datenbank mit echten Daten richten; einen Test oder eine Prüfung überspringen, abschwächen oder
  löschen, um grün zu werden; einen übersprungenen Test als bestanden melden.
- Auf `main` pushen (Ausnahme: Reparatur eines roten `main` durch oder auf Anweisung des Maintainers), Commits von
  Beitragenden umschreiben, ohne unabhängiges Review mergen, eigenen Code reviewen. Gemergt wird nach
  [Wer mergt was](docs/mitwirken.md#wer-mergt-was).
- Issues und Pull Requests ohne Auftrag anlegen oder kommentieren.
- Eine Abhängigkeit hinzufügen, ohne zuerst eigenen Code zu versuchen und den Grund je Paket unter
  „## Neue Abhängigkeiten“ im Pull Request zu nennen.
- `firsttris/haben` aus dem Loop dieses Repositorys ändern; Haben ist eine Quelle zum Lesen und Abschreiben.
- Ein Geheimnis außerhalb einer verschlüsselten Spalte speichern.
- Befehle als root (`sudo`, `pkexec`) ausführen oder umgehen; die führt die Nutzerin oder der Nutzer aus. Ihre
  laufenden Prozesse stoppen.

## Bei jeder Änderung

Mitziehen, was die Änderung berührt, im selben Pull Request, und nur das:

- die Tests: Vitest neben dem Code, Datenbanktests neben dem Modul, Playwright für das, was ein Mensch tut (Desktop
  und `@phone`, das Terminal in Kiosk-Größe); ein Bugfix beginnt mit einem fehlschlagenden Test; eine Regel in
  `packages/arbeitszeit` kommt mit den Fällen aus `docs/regeln.md`;
- die Seiten in `docs/`, die es beschreiben (nur Deutsch), kurz und für Menschen;
- `README.md` (nur Deutsch), wenn eine Funktion, die Nutzer sehen, dazukommt, sich ändert oder wegfällt;
- die Texte in jeder Datei unter `messages/`;
- nach einer Änderung am Aussehen die Screenshots: **Actions → Update screenshots → Run workflow**, dann die neuen
  Bilder ansehen.

Dazu: jede berührte Datei sauberer hinterlassen, ohne das Verhalten zu ändern, und unter „Aufgeräumt“ nennen; Issues
mit `Umgesetzt #…` oder `Refs #…`, nie `Closes`/`Fixes`; Prüfungen grün vor jedem Push (Skill `checks`),
übersprungene nennen, danach die CI prüfen; die Beschreibung des Pull Requests wird die Squash-Nachricht und wird bei
jedem Push nachgezogen, der etwas daran ändert; vor dem Merge ein unabhängiges Review durch einen eigenen Agenten
(`tdd-review` für Code, `doku-pruefen` für Markdown).

## Arbeitsweise

- Sprache: Code, Kommentare und Commits auf Englisch; `README.md`, die Doku und Pull Requests auf Deutsch. Die App
  über Paraglide mit `messages/de.json` und `messages/en.json` für jeden Text, für die Bildschirme der Beschäftigten
  auch `tr`, `pl`, `uk` und `ar` (von rechts nach links). Befunde nennen ihre Norm in jeder Sprache auf Deutsch.
- Für Tests andere Ports als die laufenden (Entwicklung: Server 18200, Vite 5177; E2E: Server 28200, Vite 5178).
- Funktional, keine Klassen, Fehler als Werte; eine Datei über ~400 Zeilen und eine Funktion über ~80 werden geteilt.
  Technik, Aufbau des Servers, Zeit und Geheimnisse, Testdaten: `docs/entwicklung.md`, „Konventionen“.
- Details stützen sich auf die Quellen, nicht auf das Gedächtnis: welche und wie, in `docs/entwicklung.md`, „Quellen“.
- Fremde, nicht committete Änderungen gehören jemand anderem (oft einem anderen Agenten): beim eigenen Umfang bleiben.
