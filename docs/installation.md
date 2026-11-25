---
title: Installation
description: >-
  Soll selbst betreiben: mit Docker Compose, Podman Quadlet oder als einzelne Datei; Einstellungen,
  Sicherung und Wiederherstellung, Update.
---

# Installation

Soll ist ein Container, der alles mitbringt: den Server, die Datenbank (SQLite in einer Datei) und
die App für Browser, Handy und Terminal. Ein Datenbankserver ist nicht nötig. Das Image gibt es für
amd64 (PC, Server) und arm64 (Raspberry Pi 4 und 5, viele NAS).

!!! note "Noch nicht veröffentlicht"
    Das Image erscheint auf Docker Hub (`tristanteu/soll`) und unter `ghcr.io/speicherstadt/soll`
    mit dem ersten Release. Bis dahin baust du es selbst aus dem Repository:
    `docker build -f Containerfile -t soll .` und trägst `soll` statt des Images von Docker Hub ein.

## Was du brauchst

- einen Rechner mit Docker (mit Compose) oder Podman ab Version 4.4,
- eine Adresse mit HTTPS davor, etwa über Caddy, Traefik oder den Reverse Proxy deines NAS:
  Passkeys und die Offline-App (Service Worker) funktionieren nur über HTTPS,
- einen Schlüssel: 32 Zufallsbytes in Base64.

```sh
openssl rand -base64 32
```

Den Schlüssel bewahrst du getrennt von der Datenbank auf, etwa im Passwortmanager. Ohne ihn startet
Soll nicht, und eine Sicherung startet nur mit demselben Schlüssel wieder: Er verschlüsselt die
Schlüssel für Web Push und die Abos der Geräte.

## Docker Compose

Im Repository liegen [`deploy/compose.yaml`](https://github.com/Speicherstadt/soll/blob/main/deploy/compose.yaml)
und [`deploy/soll.env.example`](https://github.com/Speicherstadt/soll/blob/main/deploy/soll.env.example).

```sh
mkdir soll && cd soll
curl -fsSLO https://raw.githubusercontent.com/Speicherstadt/soll/main/deploy/compose.yaml
curl -fsSL -o soll.env https://raw.githubusercontent.com/Speicherstadt/soll/main/deploy/soll.env.example
# in soll.env: SOLL_SECRET_KEY und SOLL_URL eintragen
docker compose up -d
```

Soll lauscht dann auf `127.0.0.1:8200`; der Reverse Proxy leitet die Adresse aus `SOLL_URL` dorthin.
Beim ersten Aufruf führt die App durch die [Einrichtung](einrichtung.md). Der Schlüssel steht nur
in `soll.env`, nie in `compose.yaml` und nie im Image.

## Podman Quadlet

Für Podman liegen unter
[`deploy/quadlet/`](https://github.com/Speicherstadt/soll/tree/main/deploy/quadlet) ein Container,
ein Volume und eine tägliche Sicherung als systemd-Timer. Als normaler Benutzer:

```sh
mkdir -p ~/.config/containers/systemd ~/.config/soll
cp deploy/quadlet/* ~/.config/containers/systemd/
# ~/.config/soll/soll.env: SOLL_URL (und SMTP), ohne den Schlüssel
openssl rand -base64 32 | podman secret create soll-secret-key -
systemctl --user daemon-reload
systemctl --user start soll soll-backup.timer
loginctl enable-linger "$USER"   # läuft auch ohne Anmeldung weiter
```

Der Schlüssel liegt hier als Podman-Secret, nicht in einer Datei. `AutoUpdate=registry` erlaubt
`podman auto-update`, neue Images zu ziehen und den Dienst neu zu starten.

## Als einzelne Datei

Wer keinen Container will, baut Soll aus dem Repository mit Bun:

```sh
bun install --frozen-lockfile
bun run --cwd apps/web build && bun run --cwd apps/server build
SOLL_SECRET_KEY=… SOLL_URL=https://soll.example.de SOLL_DATA_DIR=/var/lib/soll \
  SOLL_WEB_DIR=apps/web/dist apps/server/dist/soll
```

`apps/server/dist/soll` ist der ganze Server mit allen Migrationen; `apps/web/dist` ist die App.

## Einstellungen

| Variable | Im Image | Bedeutung |
| --- | --- | --- |
| `SOLL_SECRET_KEY` | – (Pflicht) | 32 Bytes in Base64; ohne startet Soll nicht |
| `SOLL_URL` | `http://localhost:8200` | Adresse, unter der Soll erreichbar ist: Einladungslinks, Passkeys, die Prüfseite auf dem Stundenzettel |
| `SOLL_SMTP_URL` | – | SMTP für Mail, etwa `smtps://soll:passwort@mail.example.de:465`; nur zusammen mit `SOLL_MAIL_VON` |
| `SOLL_MAIL_VON` | – | Absender, etwa `Soll <soll@example.de>` |
| `SOLL_PORT` | `8200` | Port im Container |
| `SOLL_HOST` | `0.0.0.0` | Adresse im Container |
| `SOLL_DATA_DIR` | `/data` | Datenverzeichnis mit `soll.db`, den Sicherungen unter `backups/` und den Originaldateien der Importe unter `dateien/` |
| `SOLL_WEB_DIR` | `/app/web` | der Build der App; ohne liefert der Server nur die API aus |
| `SOLL_VERSION` | Tag des Release | Version, die `/health` meldet |

Das Image läuft als Benutzer ohne Root-Rechte (65532) und kommt mit schreibgeschütztem Dateisystem
aus; nur `/data` wird beschrieben. Die mitgelieferten Dateien für Compose und Quadlet schalten das
ein und nehmen dem Container alle Capabilities.

## Sicherung

`soll backup` schreibt eine Kopie der Datenbank, während Soll weiterläuft. Die Kopie ist in sich
stimmig: SQLite schreibt mit `VACUUM INTO` genau den Stand, der beim Start der Sicherung gespeichert
war, auch was noch im Write-Ahead-Log liegt. Soll prüft die Kopie danach und überschreibt nie eine
vorhandene Datei.

```sh
# Docker Compose
docker compose exec soll soll backup
# Podman: läuft täglich um 3:15 über soll-backup.timer, von Hand
podman exec soll soll backup
# eigenes Ziel im Container
docker compose exec soll soll backup /data/backups/vor-dem-update.db
```

Ohne Ziel landet die Sicherung unter `/data/backups/soll-<Zeitpunkt in UTC>.db` im Volume. Von dort
nimmt sie das Backup des Rechners mit (restic, Borg, das NAS), das sie auch verschlüsselt, auslagert
und alte Stände wegräumt; Soll selbst tut das nicht. Ein täglicher Aufruf für Compose per cron:

```cron
15 3 * * * cd /srv/soll && docker compose exec -T soll soll backup
```

Die Sicherung enthält die Arbeitszeiten mit allen Gliedern der [Audit-Kette](audit-kette.md). Die
Originaldateien der [Importe](umzug.md) liegen daneben unter `/data/dateien/` und kommen mit dem
Backup des Volumes mit; `soll backup` kopiert nur die Datenbank. Für
Aufzeichnungen nach § 16 Abs. 2 ArbZG und § 17 MiLoG gelten zwei Jahre, für lohnrelevante Unterlagen
sechs bis acht Jahre (§ 147 AO); so lange sollten auch Sicherungen erreichbar bleiben.

## Wiederherstellung

`soll restore <datei>` legt eine Sicherung in ein leeres Datenverzeichnis. Liegt dort schon eine
`soll.db`, lehnt Soll ab: Erst wird der Server gestoppt und das alte Verzeichnis beiseitegelegt.
Danach prüft Soll die Audit-Kette jedes Betriebs und nennt das Ergebnis; findet die Prüfung etwas,
ist die Datenbank trotzdem wiederhergestellt, der Befehl endet aber mit Code 1.

Mit Docker Compose, die Sicherung als Datei neben `compose.yaml`:

```sh
# die Sicherung aus dem Volume holen (oder aus dem Backup des Rechners nehmen)
docker compose cp soll:/data/backups/soll-2026-11-20T03-15-07Z.db ./sicherung.db
docker compose down
# erst jetzt, wenn die Sicherung außerhalb des Volumes liegt: die alten Daten entfernen
docker volume rm soll_daten
docker compose run --rm -v ./sicherung.db:/sicherung.db:ro soll restore /sicherung.db
docker compose up -d
```

Mit Podman ebenso: `systemctl --user stop soll`, `podman volume rm soll`, dann
`podman run --rm -v soll:/data -v ./sicherung.db:/sicherung.db:ro docker.io/tristanteu/soll:latest restore /sicherung.db`
und `systemctl --user start soll`.

Die Ausgabe ist eine Zeile JSON:

```json
{"msg":"restored","ziel":"/data/soll.db","betriebe":[{"betriebId":"…","befunde":0}]}
```

Gestartet wird mit demselben `SOLL_SECRET_KEY` wie zur Zeit der Sicherung. Eine Sicherung aus
einer älteren Version bringt der Server beim Start auf den neuesten Stand; eine aus einer neueren
Version startet eine ältere nicht.

## Update

```sh
docker compose exec soll soll backup   # vorher sichern
docker compose pull && docker compose up -d
```

Mit Podman zieht `podman auto-update` das neue Image. Beim Start wendet Soll neue Migrationen an;
ein Zurück auf eine ältere Version geht nur über die Sicherung von vorher.

## Releases

Ein Tag `vX.Y.Z` baut das Image für amd64 und arm64 (jede Architektur auf ihrem eigenen Runner) und
veröffentlicht es als `:x.y.z`, `:x.y` und `:latest`, ein Tag `vX.Y.Z-rc.N` als `:next`; von Hand
auf `main` gestartet entsteht `:edge`. Der Release-Workflow (`.github/workflows/release.yml`) nutzt
den gemeinsamen Docker-Release aus
[firsttris/workflows](https://github.com/firsttris/workflows#docker-release) und veröffentlicht nur,
wenn das Secret `DOCKER_PAT` gesetzt ist. Jeder Pull Request baut das Image für amd64, startet es
mit leerem Datenverzeichnis und prüft `/health`, Sicherung und Wiederherstellung
(`scripts/image-test.sh`).
