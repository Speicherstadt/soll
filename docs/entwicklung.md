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
| `packages/import` | Parser für die Exporte anderer Tools |
| `packages/export` | DATEV, CSV, PDF |
| `packages/ui` | Komponenten und Farben nach DESIGN.md, `cn()` |
| `apps/server` | Hono-Server mit `/health`; wird mit `bun build --compile` zu einer Datei |
| `apps/web` | Solid-2-App als statische SPA/PWA mit Service Worker, Routen mit TanStack Router |
| `e2e/` | Playwright mit den Projekten `desktop`, `phone` und `terminal` |
| `messages/` | Texte der App in `de`, `en`, `tr`, `pl`, `uk` und `ar` (Paraglide) |

## Befehle

```sh
bun install
bun run dev:server   # Server auf Port 18200
bun run dev:web      # App auf Port 5177
bun run check        # Typen, Lint, Tests, Build
bun run e2e          # Playwright (App auf Port 5178)
```

`bun run check` muss vor jedem Push grün sein. Die gemeinsamen Checks aus `firsttris/workflows`
(Dateigröße, Funktionslänge, Importringe, Übersetzungen, Seiten im Barrierefreiheitstest) laufen in
der CI.

## Server

Der Server liest seine Einstellungen aus der Umgebung:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `SOLL_PORT` | `8200` | Port |
| `SOLL_HOST` | `0.0.0.0` | Adresse |
| `SOLL_VERSION` | `0.0.0` | Version, die `/health` meldet |

Jede Anfrage schreibt eine Zeile JSON ins Log, mit Methode, Pfad, Status und Dauer. Werte aus der
Adresse (etwa der Token eines Kalender-Feeds), Header und Inhalte stehen nie darin.

## Sprachen

Jeder Text steht in jeder Datei unter `messages/`; die App wählt die Sprache des Browsers, Arabisch
von rechts nach links (`dir="rtl"`). Normen bleiben in jeder Sprache auf Deutsch.
