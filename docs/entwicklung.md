---
title: Entwicklung
description: >-
  So ist Soll aufgebaut und so startest du es zum Entwickeln: Workspaces, Befehle, Ports, Tests und
  Sprachen.
---

# Entwicklung

Soll ist ein Monorepo mit Bun-Workspaces. Was ein Agent oder Mitwirkender beachten muss, steht in
[CLAUDE.md](https://github.com/Speicherstadt/soll/blob/main/CLAUDE.md), was als Nächstes gebaut
wird, in der [Bauliste](https://github.com/Speicherstadt/soll/blob/main/BAULISTE.md).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `packages/arbeitszeit` | Prüfregeln, Feiertage, Soll und Ist, Konten, Zuschläge; reine Funktionen |
| `packages/import` | Parser für die Exporte anderer Tools und die Mitarbeiterliste als CSV (Einrichtung) |
| `packages/export` | DATEV, CSV, PDF |
| `packages/ui` | Komponenten und Farben nach DESIGN.md, `cn()` und `variants()`; Musterseite unter `/muster.html` im Entwicklungsserver |
| `apps/server` | Hono-Server mit `/health`; wird mit `bun build --compile` zu einer Datei |
| `deploy/` | Docker Compose, Podman Quadlet und die Vorlage der Einstellungen ([Installation](installation.md)) |
| `apps/web` | Solid-2-App als statische SPA/PWA mit Service Worker, Routen mit TanStack Router |
| `e2e/` | Playwright mit den Projekten `desktop`, `phone` und `terminal` |
| `messages/` | Texte der App in `de`, `en`, `tr`, `pl`, `uk` und `ar` (Paraglide) |
| `scripts/gesetze/` | Gesetzeswächter: beobachtete Normen mit Hash (`normen.json`), Abruf, Bericht und Issue ([Gesetzeswächter](gesetzeswaechter.md)) |

## Befehle

```sh
bun install
SOLL_SECRET_KEY=$(openssl rand -base64 32) bun run dev:server   # Server auf Port 18200
bun run dev:web      # App auf Port 5177, leitet /api an den Server auf 18200 weiter
bun run check        # Typen, Lint, Solid-2-Prüfung, Tests, Build
bun run solid2       # nur die Prüfung auf Formen aus Solid 1.x
bun run e2e          # Playwright (App auf Port 5178, gebaute App mit Service Worker auf 5179)
bun run gesetze      # Gesetzeswächter: Normen abrufen und vergleichen, Bericht auf der Konsole
bun run lasttest     # Lasttest: 50 Betriebe mit je 50 Personen stempeln gleichzeitig (Port 28300)
bun run demo         # Demo-Daten: Weber Haustechnik und Café Elbblick mit drei Monaten (demo.md)
bun run screenshots  # die Bilder für README und Doku unter docs/assets/screenshots/
```

Die App ruft die API unter ihrer eigenen Adresse auf; Vite leitet `/api` an den Server weiter
(`SOLL_API_PORT`, Standard 18200), so sehen Sitzungs-Cookie und die Herkunftsprüfung von Better Auth
eine einzige Adresse. Für Playwright startet `scripts/e2e-server.ts` den Server auf Port 28200 mit
einer leeren Datenbank in einem temporären Verzeichnis und einem Schlüssel nur für diesen Lauf;
`e2e/betrieb.ts` legt je Test ein eigenes Konto mit Betrieb an.

In der CI laufen die Ende-zu-Ende-Tests in vier Teilen parallel (`--shard`, Job `e2e-teil`), jeder
mit eigenen Servern und vier Workern; der Job `e2e` fasst sie zu einem Ergebnis zusammen. Chromium
kommt aus dem Cache. Einen Teil lokal nachstellen: `bun run e2e --shard=2/4`.

`bun run check` muss vor jedem Push grün sein. Die gemeinsamen Checks aus `firsttris/workflows`
(Dateigröße, Funktionslänge, Importringe, Übersetzungen, Seiten im Barrierefreiheitstest) laufen in
der CI.

## Lasttest

`bun run lasttest` startet den Server auf Port 28300 mit einer leeren Datenbank in einem temporären
Verzeichnis und einem Schlüssel nur für diesen Lauf, nie gegen echte Daten. Über die HTTP-API legt
er 50 Betriebe an, je mit Inhaber, Einladungsliste und 50 Beschäftigten, die ihre Einladung annehmen
und sich mit Benutzername und Passwort anmelden, so wie im Browser. Dann stempeln alle 2.500 im
selben Augenblick „Kommen“. Der Lauf misst je Anfrage die Zeit bis zur ganzen Antwort und zählt jede
Antwort ohne 201 als Fehler. Danach prüft er in der Datenbank, dass jede Person genau eine Stempelung
hat und die Audit-Kette jedes Betriebs ohne Befund prüft. Er endet mit Code 0 nur, wenn kein Fehler
auftrat, p95 höchstens 15 s und die langsamste Anfrage höchstens 30 s brauchte; die Gründe stehen im
[Projektplan](plan.md#entscheidungen). Mit `--betriebe`, `--personen` und `--port` läuft er kleiner
oder auf einem anderen Port; ist der Port belegt, bricht er ab, statt einen fremden Server zu messen.

Eine kleine Fassung mit 5 Betrieben zu je 10 Personen läuft mit jedem `bun run test`, mit demselben
Code, aber gegen die App im selben Prozess und ohne Zeitgrenze
(`apps/server/src/lasttest/lasttest.test.ts`). Den vollen Lauf startet der Workflow `Lasttest` für
Pull Requests, die den Server ändern, jeden Montag und von Hand; er ist keine Pflichtprüfung, weil
Zeiten auf einem geteilten Runner schwanken.

Gemessen am 21.11.2026 in zwei Läufen auf 4 Kernen: 2.500 Stempelungen in 8,7 bis 8,9 s (rund 280
je Sekunde), kein Fehler, p50 3,6 bis 5,2 s, p95 6,5 bis 8,6 s, die langsamste 8,7 bis 8,9 s; jede
Stempelung genau einmal, alle 50 Ketten ohne Befund. Das Anlegen der Personen dauert zwei bis fünf
Minuten, vor allem wegen scrypt für die Passwörter.

## Screenshots

Die Bilder in der README und in dieser Dokumentation erzeugt `bun run screenshots`, nie eine Hand.
Das Skript baut die App, schreibt die [Demo-Daten](demo.md) in ein frisches temporäres Verzeichnis
und startet darauf den Server (`apps/server/src/screenshots/`), mit dem statischen Build der App und
einer Uhr, die auf 10:45 Uhr (Europe/Berlin) des Tags `--heute` steht, auf einem freien Port. Dann
meldet sich Playwright für jedes Bild über die API als die passende Person an (Sandra, Anna und
Jonas bei Weber Haustechnik, Lea im Café, das Terminal mit einem neuen Kopplungscode von Mia), öffnet
die Seite und legt das Bild hell und dunkel ab:

```sh
bun run screenshots                           # alle Bilder, Tag 2026-11-25
bun run screenshots --nur dienstplan --nur terminal
bun run screenshots --heute 2027-03-10 --ohne-build
```

Welche Seiten, als wer, auf welchen Geräten und worauf vor dem Bild gewartet wird, steht in
`scripts/screenshots/bildschirme.ts`; die Dateien heißen
`docs/assets/screenshots/<name>-<light|dark>-<desktop|phone|terminal>.png`. Desktop und Terminal
haben 1280 × 800, das Handy 412 × 915, alle mit doppelter Pixeldichte. Die Uhr steht auch im Browser
(`clock.setFixedTime`), Zeitzone, Sprache (auch für Datumsfelder) und Thema sind fest, Animationen
aus; zeigt eine Seite ihre Überschrift oder den erwarteten Text nicht, bricht der Lauf ab, statt ein
falsches Bild zu schreiben. Bei gleichem `--heute` entstehen dieselben Bilder bis auf Kennungen und
Prüfwerte, die Soll bei jedem Lauf neu vergibt (Monatsabschluss und Prüfseite).

Ein Test (`scripts/screenshots/bildschirme.test.ts`) prüft die Liste: eindeutige Namen, das Schema
der Dateinamen, jede Seite eine Route der App, jede Überschrift ein Text aus `messages/de.json`;
jedes Bild, auf das README oder `docs/` verweisen, liegt vor und steht in der Liste, und unter
`docs/assets/screenshots/` liegt nichts anderes. In der Doku stehen die Bilder paarweise mit
`#only-light` und `#only-dark`, in der README in `<picture>`.

Nach einer Änderung am Aussehen: **Actions → Update screenshots → Run workflow**
(`.github/workflows/screenshots.yml`). Der Workflow erzeugt alle Bilder, lädt sie als Artefakt
`screenshots` hoch und öffnet, wenn sich ein Bild geändert hat, einen Pull Request
`docs: update screenshots` auf einem Zweig `screenshots/<lauf>`; ohne Änderung keinen. Bilder
ansehen, dann mergen. Einen mit `GITHUB_TOKEN` geöffneten Pull Request startet GitHub keine CI;
schließen und wieder öffnen startet sie. In den Einstellungen des Repositorys muss „Allow GitHub
Actions to create and approve pull requests“ an sein, sonst bleibt es beim Artefakt.

## Komponenten

`packages/ui` baut auf nativen Elementen: Button, Badge, Input, Dialog (`<dialog>`), Popover, Menü
und Tooltip (Popover-API mit CSS Anchor Positioning), Combobox, Tabs, Toast, Tabelle und Icon. Jede
Komponente nimmt ihre Texte über Props; die Tastaturbedienung folgt den ARIA Authoring Practices,
Pfeile spiegeln sich bei Arabisch. Die Musterseite `apps/web/muster.html` zeigt alle, nur im
Entwicklungsserver (`?theme=dark`, `?dir=rtl`); Playwright prüft dort Tastatur und axe.

## App

Die App fragt beim Start den Server, wer angemeldet ist (`GET /api/v1/betrieb`), und führt ohne
Sitzung zur Anmeldung, ein Konto ohne Betrieb und einen Inhaber vor dem Abschluss in die
[Einrichtung](einrichtung.md) und von einem abgeschalteten Modul zurück zu Heute
(`apps/web/src/sitzung/ziel.ts`). Ist der Server nicht erreichbar, öffnet sie sich mit dem zuletzt
gesehenen Betrieb, damit sie offline startet. Sie hat am Desktop eine Seitenleiste mit den
Bereichen Heute, Zeiten, Abwesenheiten, Dienstplan, Projekte, Auswertungen und Einstellungen, am
Handy eine Tab-Leiste mit Heute, Plan, Abwesenheit und Mehr; beide zeigen nur die Bereiche der
Module des Betriebs. Unter „Mehr“ und in den Einstellungen stehen Farben (hell, dunkel, wie das
Gerät) und Sprache; beides merkt sich der Browser. Die Routen liegen in `apps/web/src/routes/`, der
Routenbaum `routeTree.gen.ts` entsteht beim Build oder im Entwicklungsserver neu und ist
eingecheckt, damit der Typcheck ihn kennt. Jede Seite steht in `e2e/accessibility.spec.ts`.

Der Client ist Solid 2.0, dessen API sich stark von 1.x unterscheidet; die Referenz liegt in
`docs/solid-2.0/` (vor allem `MIGRATION.md` und `CHEATSHEET.md`). `bun run solid2`
(`scripts/solid2.ts`, Teil von `bun run check` und der CI) schlägt bei Formen aus 1.x fehl, etwa
`createResource`, `Suspense`, `onMount`, `createEffect` mit einer Funktion oder `classList`.

### Daten laden

Daten vom Server lädt die App mit `@tanstack/solid-query` (v6, für Solid 2), nicht mit eigenen
Ladern aus Effekt und Signal:

- Jede Ressource steht mit Schlüssel und Pfad in `apps/web/src/abfragen/schluessel.ts`. Der
  Schlüssel beginnt mit dem API-Pfad, die Parameter folgen als Objekt
  (`["/api/v1/arbeitszeit/monat", { monat, nutzerId }]`), so trifft `alle(PFAD.monat)` jeden Monat.
- `abfrage()` (`abfragen/abfrage.ts`) liest eine Ressource. Ihre Daten sind die Antwort von `api()`
  als Wert (`ok`, `daten` oder `fehler`): Eine Ablehnung oder fehlendes Netz zeigt dieselben Texte wie
  zuvor und erreicht nie eine Fehlergrenze. Gelesen wird unter `<Loading>`; das erste Laden zeigt den
  Platzhalter der Grenze, ein späteres Neuladen behält den alten Stand, bis der neue da ist.
  Schlägt ein späteres Neuladen fehl, bleibt der zuletzt geladene Stand zu sehen (`daten()` liest
  ihn als `letzte`), und die Seite nennt den Fehler daneben.
- `aenderung()` und `schreiben()` schreiben über eine Mutation und machen danach die Schlüssel
  ungültig, die sich ändern. Das Neuladen läuft in der Aktion der Mutation, das Ende des Schreibens
  und die neuen Daten erscheinen zusammen; `isPending` der Mutation sperrt den Knopf solange.
- Ein Client für die ganze App (`abfragen/client.ts`, in `main.tsx` bereitgestellt): kein
  Wiederholen, Abfragen auch offline (sie kommen als „kein Netz“ zurück), kein Neuladen bei Fokus
  oder Netzwechsel, weil ein Terminal den Fokus ständig wechselt. Der Cache gehört einer Person in
  einem Betrieb; beim Abmelden oder Wechsel leert ihn `sitzung.ts`.
- Die Offline-Warteschlange von Heute (S-305, `apps/web/src/offline/`) bleibt eigen; nach dem
  Senden macht sie den Tag ungültig.
- Das Terminal fragt seinen Stand mit dem Token des Geräts statt einer Sitzung ab, als Abfrage je
  Terminal; gesperrt fragt es alle 15 Sekunden nach (`refetchInterval`), und jede Antwort zählt,
  auch eine wie die vorige (`terminal/ablauf.ts`).
- Eigen bleiben auch die Sitzung (`sitzung/sitzung.ts`: sie entscheidet, wem der Cache gehört, und
  leert ihn, gilt offline aus dem Gerät und wird vor jeder Route geprüft) und die einmaligen Schritte
  ohne Daten im Cache: Anmelden, Registrieren, Abmelden, eine Einladung annehmen, die Prüfseite und
  die Schritte der Einrichtung. Was sie ändern, steht in der Sitzung; danach fragen sie sie neu
  (`sitzungNeu()`).

## Server

Der Server liest seine Einstellungen aus der Umgebung:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `SOLL_PORT` | `8200` | Port |
| `SOLL_HOST` | `0.0.0.0` | Adresse |
| `SOLL_VERSION` | `0.0.0` | Version, die `/health` meldet |
| `SOLL_DATA_DIR` | `data` | Datenverzeichnis mit der Datenbank `soll.db` |
| `SOLL_WEB_DIR` | – | Build der App (`apps/web/dist`); gesetzt liefert der Server die App neben der API aus, sonst nur die API (in der Entwicklung liefert Vite die App) |
| `SOLL_SECRET_KEY` | – (Pflicht) | 32 Bytes in Base64; ohne startet der Server nicht. Er verschlüsselt den VAPID-Schlüssel für Web Push, den die Instanz beim ersten Start erzeugt, und die Abos der Geräte: Ein anderer Schlüssel für eine bestehende Datenbank verhindert den Start ([Erinnerungen](erinnerungen.md)) |
| `SOLL_URL` | `http://localhost:8200` | Adresse der Instanz, für Einladungslinks und die Prüfseite auf dem Stundenzettel |
| `SOLL_SMTP_URL` | – | SMTP für Mail, etwa `smtps://soll:geheim@mail.example.de:465`; nur zusammen mit `SOLL_MAIL_VON` |
| `SOLL_MAIL_VON` | – | Absender der Mails, etwa `Soll <soll@example.de>`; seine Adresse ist auch der Kontakt für die Push-Dienste ([Erinnerungen](erinnerungen.md)) |

Neben dem Server kennt das Binary drei Befehle für den Betrieb, die ohne `SOLL_SECRET_KEY`
auskommen: `soll backup [ziel]`, `soll restore <quelle>` und `soll health`
([Installation](installation.md)). Das Container-Image entsteht aus `Containerfile`;
`scripts/image-test.sh <image>` prüft es wie die CI (leeres Volume, `/health`, Sicherung und
Wiederherstellung).

Jede Anfrage schreibt eine Zeile JSON ins Log, mit Methode, Pfad, Status und Dauer. Die Query der
Adresse (etwa der Token eines Kalender-Feeds) steht nur als `?…` darin, Header und Inhalte nie.

## Datenbank

Das Schema steht in `apps/server/src/db/schema.ts`, größere Bereiche in Dateien unter
`apps/server/src/db/schema/`, die `schema.ts` weitergibt. Nach einer Änderung erzeugt
`bun run db:generate` die Migration und die Datei, die sie ins Programm einbettet; eine schon
eingecheckte Migration wird nie geändert. Tests laufen gegen SQLite in einer temporären Datei:
`testDatenbank()` legt sie in einem eigenen Verzeichnis unter dem temporären Verzeichnis des
Systems an und löscht es nach dem Test wieder, auch wenn der Test scheitert oder in seine Zeitgrenze
läuft. Andere Tests holen sich ein temporäres Verzeichnis ebenso mit `temporaerOrdner()` aus
`apps/server/src/test-ordner.ts`.

## Sprachen

Jeder Text steht in jeder Datei unter `messages/`; die App wählt die Sprache des Browsers, Arabisch
von rechts nach links (`dir="rtl"`). Normen bleiben in jeder Sprache auf Deutsch.
