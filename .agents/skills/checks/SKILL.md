---
name: checks
description: "Prüfungen von Soll ausführen (Typen, Lint, Solid-2-Formen, gemeinsame Checks, Vitest, Build, Playwright, Doku). Vor jedem Push, im Review und wenn Bun, Chromium oder ein Werkzeug für die Tests fehlt."
---

# Prüfungen

Vor jedem Push grün, danach die CI prüfen. Die volle E2E-Suite läuft in der CI (vier Teile, Job `e2e`); vor dem
Push die Specs, die die Änderung abdecken.

Voraussetzung: Bun in der Version aus `package.json` (`packageManager`). Datenbanktests laufen gegen SQLite in einer
temporären Datei; eine laufende Datenbank braucht nichts.

```sh
bun install --frozen-lockfile
bun run typecheck        # Paraglide erzeugen, dann tsc -b
bun run lint             # Biome, Warnungen sind Fehler
bun run solid2           # Formen aus Solid 1.x (docs/entwicklung.md, „Solid 2.0“)
bun run test             # Vitest auf Bun, auch der kleine Lasttest
bun run build
bun scripts/smoke-binary.ts   # das Binary startet allein und antwortet auf /health
bun audit                # bekannte Lücken in den Abhängigkeiten
bun run e2e e2e/<spec>.ts     # Playwright: die berührten Specs, oder -g "<test>"; einen Teil der CI: --shard=2/4
```

`bun run check` fasst Typen, Lint, `solid2`, Tests und Build zusammen.

Die gemeinsamen Checks aus `firsttris/workflows` (`checks.json`: Dateien über 400 Zeilen, Importringe, jeder Text
übersetzt und benutzt, jede Seite im Barrierefreiheitstest) installiert die CI ohne Speichern:

```sh
bun add --dev --no-save "github:firsttris/workflows#v1" && bunx checks
```

Wird das abgelehnt, `firsttris/workflows` flach ins Scratchpad klonen und `bun <klon>/checks/cli.ts` aus der Wurzel
des Repositorys starten. Die Prüfung der Texte meldet deutsche Wörter auch in Kennungen, Schlüsseln und Strings im
Code (`von`, `bis`); dort englische nehmen.

Wenn sich `docs/` oder `mkdocs.yml` geändert haben (`pip install -r requirements-docs.txt`):

```sh
zensical build --strict
test -z "$(grep -L '^description:' docs/*.md)"   # jede Seite hat eine description
```

Wenn sich `Containerfile` oder der Start des Servers geändert hat und Docker oder Podman da ist:
`bash scripts/image-test.sh <image>` nach dem Bauen des Images, wie der Job `image` der CI.

Den vollen Lasttest (`bun run lasttest`, Port 28300) startet der Workflow „Lasttest“ für Pull Requests, die den
Server ändern; lokal nur, wenn es um seine Zeiten geht.

Ports: Entwicklung Server 18200, Vite 5177; E2E Server 28200, Vite 5178, gebaute App 5179. Für Tests andere Ports
nehmen als ein laufender Dev-Server; laufende Prozesse nicht stoppen.

Die Regeln am Pull Request selbst (Titel, `Umgesetzt`/`Refs`, neue Abhängigkeiten, lange Funktionen) prüft vor dem
Push die Werkbank, siehe Skill `beitrag`. Was übersprungen wurde, gehört mit Grund in die Beschreibung des Pull
Requests, nie als bestanden.
