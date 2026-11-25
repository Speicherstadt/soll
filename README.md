<div align="center">

<h1>Soll: Zeiterfassung und Dienstplan für dein Team, selbst gehostet</h1>

**Arbeitszeit erfassen, wie es das Gesetz verlangt – mit Prüfung nach Paragraph, ohne Kosten pro Kopf.**<br>
Stempeln im Browser, am Handy und am Tablet, Dienstplan, Urlaub und Lohndaten für DATEV.<br>
Open Source, auf deinem eigenen Server.

![Status: in Entwicklung](https://img.shields.io/badge/Status-in%20Entwicklung-orange)
[![Lizenz: AGPL-3.0](https://img.shields.io/badge/Lizenz-AGPL--3.0-blue)](LICENSE)
[![Doku](https://img.shields.io/badge/Doku-soll.work-4f46e5?logo=zensical&logoColor=white)](https://soll.work/)

[Warum?](#warum-soll) •
[Funktionen](#funktionen) •
[Alternativen](#soll-und-die-alternativen) •
[FAQ](#faq) •
[Dokumentation](https://soll.work/)

</div>

> [!WARNING]
> **In Entwicklung:** Soll ist noch nicht veröffentlicht.

## Warum Soll?

Seit dem Beschluss des Bundesarbeitsgerichts von 2022 muss jeder Betrieb die Arbeitszeit erfassen.
Viele kleine Betriebe nutzen dafür Excel oder ein Abo-Tool, das pro Kopf kostet. Soll ist die
Open-Source-Alternative, die du auf deinem eigenen Server betreibst.

- **Prüfung nach Paragraph**: Pausen, Ruhezeit, Höchstarbeitszeit, Jugendliche, Mutterschutz,
  Minijobs; jeder Hinweis nennt seine Norm, schon beim Stempeln und beim Einplanen.
- **Nachweislich unverändert**: Jede Änderung steht mit Grund im Protokoll; zum Monatsabschluss
  bekommt jede Person einen Prüfwert, an dem eine spätere Änderung auffällt.
- **Lohn ohne Abtippen**: Export für DATEV mit Nacht-, Sonntags- und Feiertagszuschlägen.
- **Für Schichtbetriebe und Handwerk**: Dienstplan, Tablet am Eingang, Aufträge, Stundennachweis mit
  Unterschrift.
- **Keine Kosten pro Kopf**: zehn Mitarbeiter kosten so viel wie einer; bezahlt wird nur der Server.

## Funktionen

| Bereich | Was Soll kann |
|---|---|
| 🧭 Einrichtung | Assistent mit vier Fragen, der nur die Module zeigt, die dein Betrieb braucht (allein nur Projektzeit; mit der ersten beschäftigten Person schaltet Soll die Arbeitszeit ein und sagt warum); Standorte, Arbeitszeitmodelle aus Vorlagen, Mitarbeiter per CSV, Einladung per Link ohne E-Mail |
| ⏱️ Stempeln | Ein Tipp für Kommen, Pause und Gehen; der laufende Tag mit Soll, Ist und dem nächsten Befund; Nachtragen und Ändern mit Grund, für die Person sichtbar; Browser, Handy (auch offline: jede Stempelung nummeriert und signiert, eine Lücke fällt auf) und Tablet-Terminal im Kiosk-Modus, gekoppelt per Code, mit PIN, gedrucktem QR-Code oder NFC-Karte (einfache Karte mit PIN, NTAG 424 DNA allein mit geprüfter SUN-Nachricht), auch ohne Netz (der Ausweis liegt nur verschlüsselt auf dem Tablet) |
| ⚖️ Prüfung | Arbeitszeitgesetz, Mindestlohn, Jugendarbeitsschutz, Mutterschutz, Bereitschaft; mit Norm im Hinweis |
| 📅 Dienstplan | Woche je Standort aus Schichtvorlagen planen, per Ziehen und Ablegen auch mit der Tastatur; Bedarf je Rolle mit dem, was fehlt; Entwurf nur für Planer, am Handy ein Tag zur Zeit; jede Schicht beim Einplanen geprüft nach Arbeitszeitgesetz, Jugend- und Mutterschutz, Mindestlohn, Minijob-Grenze und § 12 TzBfG, mit der Norm am Block; eine Woche veröffentlichen mit Benachrichtigung per Push oder Mail, die eigenen Schichten als Kalender abonnieren (ICS-Link, jederzeit neu oder widerrufen); Schichten tauschen: anbieten, übernehmen, freigeben mit der Prüfung für die Person, die übernimmt |
| 🌴 Abwesenheiten | Urlaub beantragen, freigeben, ablehnen und stornieren, ganze und halbe Tage; Resturlaub mit Übertrag und Verfall, Überstundenkonto und Tag des Hinweises auf Verfall in der App; Krankmeldung ohne Diagnose mit Erinnerung an die Bescheinigung und die eAU; Kinderkrankentage; Teamkalender je Standort mit Feiertagen, in dem nur „abwesend“ steht |
| 🔔 Erinnerungen | Ausstempeln vergessen, Pause fällig, Monat bestätigen; per Web Push aufs Handy oder per Mail, je Art abschaltbar; Soll stempelt nie selbst aus |
| 🗓️ Monatsabschluss | Person bestätigt, Betrieb schließt ab, danach gesperrt; Korrektur nur als Gegeneintrag mit Grund; Stundenzettel als PDF per Mail und zum Herunterladen, mit Prüfwert; Prüfseite ohne Anmeldung zeigt jede spätere Änderung; nach Ablauf der Aufbewahrungsfrist (2 oder 8 Jahre) entfernt Soll den Inhalt, Kette und Prüfwert bleiben gültig |
| 🧾 Lohn und Prüfung | [DATEV-Lohnexport](https://soll.work/datev.html) für LODAS und Lohn und Gehalt aus abgeschlossenen Monaten: Stunden, Feiertagsstunden und Zuschläge nach § 3b EStG getrennt nach steuerfrei und steuerpflichtig, mit den Lohnarten des Betriebs; Prüfexport für Zoll und Arbeitsschutz als CSV und PDF mit Erfassungszeit, Änderungen mit Grund, Befunden und Prüfwert je Monat; Auskunft nach Art. 15 DSGVO als Datei für jede Person; [Verfahrensdokumentation](https://soll.work/verfahrensdokumentation.html) nach den GoBD, bei jedem Abruf aus dem Stand des Betriebs erzeugt, mit eigenen Angaben und Abschnitten, als PDF und Markdown |
| 🛠️ Projekte | Kunden und Aufträge mit Budget in Stunden und Euro und Warnung, feste interne Tätigkeiten (Fahrt, Werkstatt, Lager, Schulung), Stundensätze nach Kunde, Auftrag, Tätigkeit und Person; Stoppuhr unter Heute mit Wechsel per Tipp, Verweis auf die Stempelung und Hinweis bei mehr Projektzeit als Arbeitszeit, änderbar bis „abgerechnet“; Auslastung des Teams (anwesend gegen gebucht, abrechenbar und intern, ab drei Personen), je Person nur eingeschaltet und für alle sichtbar; Stundennachweis (Regiebericht), den der Kunde auf dem Handy unterschreibt, als PDF mit Prüfsumme, das die Buchungen darin sperrt; Übergabe an [Haben](https://haben.app/): Kunden aus Haben verbinden, abgerechnete Buchungen als Leistungen, wiederholbar ohne Doppel |
| 🔌 Anbindung | [REST-API und MCP-Server](https://soll.work/api.html) für andere Programme und KI-Assistenten: persönliche Zugänge mit den Rechten der eigenen Rolle, einmal angezeigt und jederzeit widerrufbar; OpenAPI-Beschreibung; Werkzeuge zum Lesen von Tag, Monat, Aufträgen und Dienstplan und zum Stempeln |
| 🔒 Datenschutz | Vorlagen zum Anpassen: [Infoblatt für Beschäftigte](https://soll.work/infoblatt.html) nach Art. 13 DSGVO, [Betriebsvereinbarung](https://soll.work/betriebsvereinbarung.html) nach § 87 Abs. 1 Nr. 6 BetrVG mit jedem Schalter von Soll, [Löschkonzept](https://soll.work/loeschkonzept.html) mit jeder Tabelle und ihrer Frist; kein Standort, keine Fotos, keine Fingerabdrücke, keine Diagnose |
| 🔁 Umzug | [Import](https://soll.work/umzug.html) in einem Assistenten: Werkzeug wählen, Datei hochladen, Personen, Spalten, Abwesenheitsarten, Kunden und Aufträge zuordnen, Vorschau mit den Befunden der Prüfregeln, Probelauf, Übernahme; die Originaldatei bleibt unter ihrem SHA-256 aufbewahrt, jeder Eintrag trägt „übernommen aus …“, ein zweiter Lauf legt nichts doppelt an, im alten Tool abgeschlossene Monate werden als übernommen abgeschlossen. Heute aus einer Soll-CSV (Vorlage zum Herunterladen) und aus Clockodo, über die API mit einem Schlüssel, der nur für den Abruf gilt, oder als CSV-Datensicherung (mit Leistungen als Tätigkeiten); Personio, Kimai, Papershift, Planday, Crewmeister, Toggl, Clockify und Excel folgen |
| 🌍 Sprachen | Deutsch und Englisch; für Beschäftigte auch Türkisch, Polnisch, Ukrainisch und Arabisch |

## Soll und die Alternativen

| | Was es ist | Wo Soll anders ist |
|---|---|---|
| [Clockodo](https://www.clockodo.com/) | Zeiterfassung für Agenturen und KMU | Dienstplan, Prüfung nach Paragraph, DATEV-Export mit Zuschlägen, selbst gehostet |
| [Kimai](https://www.kimai.org/) | Open-Source-Projektzeiterfassung | Arbeitszeit nach Gesetz, Dienstplan, Terminal |
| [Papershift](https://www.papershift.com/), [Planday](https://www.planday.com/) | Dienstplan und Zeiterfassung als Abo | Open Source, selbst gehostet, ohne Kosten pro Kopf |

## FAQ

### Muss ich die Arbeitszeit meiner Mitarbeiter erfassen?
Ja. Seit dem Beschluss des Bundesarbeitsgerichts vom 13.09.2022 (1 ABR 22/21) gilt die Pflicht für
jeden Betrieb, für Minijobs schon länger nach § 17 MiLoG.

### Kann ich von Clockodo, Personio oder Kimai umziehen?
Der Umzug steht: Soll übernimmt Zeiten, Abwesenheiten, Kunden und Aufträge, prüft sie vorher und
bewahrt die Originaldatei nachvollziehbar auf. Aus Clockodo holt Soll Mitarbeiter, Zeiten,
Abwesenheiten, Kunden, Projekte und Leistungen direkt über die API (der Schlüssel wird nicht
gespeichert) oder liest die CSV-Datensicherung; sonst kommen die Daten als Soll-CSV. Die Exporte von
Personio, Kimai und den anderen Tools liest Soll mit den nächsten Versionen direkt.

### Brauche ich eine Stempeluhr?
Nein. Ein Android-Tablet an der Wand reicht; gestempelt wird mit PIN, QR-Code oder NFC-Karte.

## Installation

Soll läuft als ein Container mit SQLite, ohne Datenbankserver, für amd64 und arm64:

```sh
curl -fsSLO https://raw.githubusercontent.com/Speicherstadt/soll/main/deploy/compose.yaml
curl -fsSL -o soll.env https://raw.githubusercontent.com/Speicherstadt/soll/main/deploy/soll.env.example
# in soll.env: SOLL_SECRET_KEY (openssl rand -base64 32) und SOLL_URL eintragen
docker compose up -d
docker compose exec soll soll backup   # Sicherung im laufenden Betrieb
```

Podman Quadlet, Sicherung und Wiederherstellung, Update und alle Einstellungen stehen unter
[Installation](https://soll.work/installation.html). Das Image erscheint mit dem ersten Release; bis
dahin `docker build -f Containerfile -t soll .`

## Entwicklung

Bun, Hono, Drizzle und SQLite auf dem Server; Solid und Tailwind im Client. Hinweise für
Mitwirkende und Agenten stehen in [CLAUDE.md](CLAUDE.md), der Plan in der
[Dokumentation](https://soll.work/plan.html), Aufbau und Befehle unter
[Entwicklung](https://soll.work/entwicklung.html).

```sh
bun install
bun run check        # Typen, Lint, Tests, Build
bun run e2e          # Playwright: desktop, phone, terminal
```

---

<div align="center">

<sub>Lizenz: <a href="LICENSE">AGPL-3.0</a> · © Tristan Teufel und Mitwirkende<br>
Veränderte Versionen, die du weitergibst oder für andere betreibst, müssen ihren Quellcode unter der AGPL anbieten; eine kommerzielle Lizenz ohne diese Pflichten gibt es über <a href="https://teufel-it.de">teufel-it.de</a>.<br>
Soll steht in keiner Verbindung zu Clockodo, Kimai, Papershift, Planday oder den anderen genannten Produkten.</sub>

</div>
