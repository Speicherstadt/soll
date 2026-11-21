---
title: REST-API und MCP-Server
description: >-
  Wie andere Programme und KI-Assistenten mit Soll sprechen – persönliche Zugänge mit den Rechten
  der eigenen Rolle, die OpenAPI-Beschreibung und der MCP-Server.
---

# REST-API und MCP-Server

Die App, das Terminal und die Warteschlange am Handy sprechen mit derselben API wie jedes andere
Programm. Ein Programm, eine Tabelle oder ein KI-Assistent ruft sie mit einem **persönlichen
Zugang** auf: einem Token, das eine Person für sich anlegt.

## Zugänge

Unter **Einstellungen → Zugänge zur API** legt jede Person eines Betriebs einen Zugang an, mit einem
Namen und wahlweise einem Ablauf nach 30, 90 oder 365 Tagen. Das Gerät des Terminals hat keine
Zugänge.

- **Einmal sichtbar**: Das Token (`soll_…`) steht nur in der Antwort auf das Anlegen. Soll speichert
  seinen SHA-256 und die ersten neun Zeichen, an denen man es in der Liste wiedererkennt; wer es
  verliert, legt einen neuen Zugang an.
- **Die Rechte der eigenen Rolle, nie mehr**: Ein Token trägt keine Rechte. Bei jedem Aufruf gilt
  die Rolle, die seine Person in diesem Moment im Betrieb hat. Wird aus der Mitarbeiterin eine
  Planerin, darf ihr Token beim nächsten Aufruf, was eine Planerin darf; wer den Betrieb verlässt,
  dessen Zugänge enden sofort und leben auch nach einem Wiedereintritt nicht auf.
- **Ein Betrieb**: Ein Token gehört zu dem Betrieb, in dem es angelegt wurde. Wer in zwei Betrieben
  arbeitet, legt in jedem einen eigenen Zugang an.
- **Widerrufen**: Jeder Zugang lässt sich in der Liste widerrufen; danach antwortet die API mit 401.
- **Protokoll**: Anlegen, Widerrufen und der Tag der letzten Nutzung stehen in der
  [Audit-Kette](audit-kette.md), die Nutzung höchstens einmal am Tag. In der
  [Auskunft](pruefexport.md) stehen Name und Daten jedes eigenen Zugangs, nie das Token.
- **Verwalten nur angemeldet**: Zugänge legt man mit der Sitzung in der App an und widerruft sie
  dort; ein Token kann keinen weiteren Zugang anlegen (403 `nur_sitzung`).

## REST-API

Jede Route unter `/api/v1` nimmt das Token als Kopfzeile, neben der Sitzung der App:

```sh
curl -H "Authorization: Bearer soll_…" https://soll.example/api/v1/arbeitszeit/tag
```

| Antwort | Bedeutung |
| --- | --- |
| 401 `zugang_ungueltig` | Token unbekannt, widerrufen oder älter als die Mitgliedschaft |
| 401 `zugang_abgelaufen` | der Ablauf des Zugangs ist erreicht |
| 403 `kein_mitglied` | die Person gehört nicht mehr zum Betrieb |
| 403 `keine_berechtigung` | die Rolle darf das nicht |
| 403 `modul_aus` | das Modul der Route ist im Betrieb abgeschaltet |
| 429 `zu_viele_anfragen` | mehr als 120 Aufrufe in der Minute mit diesem Token; `Retry-After` nennt die Sekunden |

Ein falsches Token wird abgelehnt, auch wenn daneben eine Sitzung mitkommt. Was über ein Token
gestempelt wird, trägt die Quelle `api` statt `app`.

### OpenAPI

Die Beschreibung aller Routen steht ohne Anmeldung unter **`/api/v1/openapi.json`** (OpenAPI 3.1).
Soll erzeugt sie aus denselben Zod-Schemas, mit denen die Routen ihre Eingaben prüfen; ein Test
liest die Routen aus der App und schlägt fehl, wenn eine ohne Beschreibung bleibt.

## MCP-Server

Unter **`/mcp`** spricht Soll das [Model Context Protocol](https://modelcontextprotocol.io/) über
Streamable HTTP, ohne Sitzung: Fassung 2026-07-28 mit `server/discover` und die Fassungen
2025-03-26 bis 2025-11-25 mit `initialize`. Ein KI-Assistent bekommt die Adresse und das Token als
Kopfzeile `Authorization: Bearer soll_…`; eine Sitzung der App gilt hier nicht.

| Werkzeug | Was es tut | Route |
| --- | --- | --- |
| `betrieb_lesen` | Betrieb, eigene Rolle, Module | `GET /api/v1/betrieb` |
| `tag_lesen` | ein Arbeitstag mit Stempelungen, Ist und Befunden | `GET /api/v1/arbeitszeit/tag` |
| `monat_lesen` | ein Monat mit Konto, Befunden und Abschluss | `GET /api/v1/arbeitszeit/monat` |
| `stempeln` | jetzt kommen, gehen oder Pause | `POST /api/v1/arbeitszeit/stempelungen` |
| `kunden_lesen`, `auftraege_lesen`, `taetigkeiten_lesen` | Kunden, Aufträge, Tätigkeiten | `/api/v1/projektzeit/…` |
| `standorte_lesen` | die Standorte | `GET /api/v1/standorte` |
| `dienstplan_woche` | eine Woche im Dienstplan | `GET /api/v1/dienstplan/woche` |

Jedes Werkzeug ruft die REST-API mit demselben Token auf. Es darf also genau, was die Rolle darf,
ein abgeschaltetes Modul antwortet mit `modul_aus`, und es erreicht keinen anderen Betrieb. Eine
Ablehnung der API kommt als Fehler des Werkzeugs (`isError`) zurück, damit der Assistent sie lesen
kann. Jede Anfrage an `/mcp` zählt einmal gegen die Grenze des Tokens.

Der Server prüft, was die Spezifikation verlangt: eine fremde `Origin` bekommt 403; in der Fassung
2026-07-28 müssen `MCP-Protocol-Version`, `Mcp-Method` und `Mcp-Name` zum Inhalt passen (sonst 400
mit `-32020`), eine unbekannte Fassung bekommt 400 mit `-32022` und der Liste der Fassungen. `GET`
und `DELETE` beantwortet er mit 405: Er hat keinen eigenen Strom und keine Sitzungen.

Projektzeit buchen kommt mit der Stoppuhr (S-602) als Werkzeug dazu.
