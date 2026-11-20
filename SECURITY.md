# Sicherheit

## Unterstützte Versionen

Sicherheitsfixes gibt es nur für das neueste Release. Bitte vor einer Meldung auf die neueste Version aktualisieren.

| Version | Unterstützt |
| --- | --- |
| [neuestes Release](https://github.com/Speicherstadt/soll/releases/latest) | ja |
| ältere Releases | nein |

## Eine Lücke melden

Bitte **kein öffentliches Issue** für ein Sicherheitsproblem. Melde es privat über GitHub:
[Security › Report a vulnerability](https://github.com/Speicherstadt/soll/security/advisories/new).

Eine gute Meldung nennt die Version, den betroffenen Teil (Server, Web-App, Terminal, API), wie sich das
Problem nachstellen lässt und was ein Angreifer damit erreicht. Keine echten Arbeitszeiten oder Exporte
mitschicken. Wir bestätigen die Meldung, arbeiten den Fix in einem privaten Security Advisory aus und
veröffentlichen es mit dem Release, das ihn behebt.

Besonders wichtig sind:

- Wege, Zeiten oder einen abgeschlossenen Monat zu ändern, ohne dass es im Protokoll steht oder die
  Prüfung der Kette es bemerkt;
- Zugriff auf die Daten eines anderen Betriebs oder einer anderen Person ohne passende Rolle;
- Stempeln im Namen eines anderen, am Terminal oder über die API;
- Lücken in Anmeldung, Einladungen, PIN-Sperre und Tokens;
- Exporte und Importe, die fremde Daten preisgeben oder einschleusen.

Probleme in Bun, SQLite oder anderen eingebundenen Programmen gehören zu diesen Projekten; macht
erst die Art, wie Soll sie einsetzt, sie ausnutzbar, bitte hier melden.

## Abhängigkeiten aktuell halten

Die Abhängigkeiten hält [Renovate](https://github.com/apps/renovate) aktuell, mit den gemeinsamen Einstellungen aus
[firsttris/workflows](https://github.com/firsttris/workflows/blob/main/renovate/default.json5). Jedes Update kommt
als Pull Request und läuft durch die ganze CI. Ein neues Release übernimmt Renovate erst nach einigen Tagen; CI und
Images installieren mit `bun install --frozen-lockfile` genau die Versionen aus `bun.lock`.
