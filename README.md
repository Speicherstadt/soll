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
| ⏱️ Stempeln | Browser, Handy (auch offline) und Tablet-Terminal mit PIN, QR-Code oder NFC-Karte |
| ⚖️ Prüfung | Arbeitszeitgesetz, Mindestlohn, Jugendarbeitsschutz, Mutterschutz, Bereitschaft; mit Norm im Hinweis |
| 📅 Dienstplan | Schichten planen und prüfen, veröffentlichen, tauschen, im eigenen Kalender sehen |
| 🌴 Abwesenheiten | Urlaub beantragen und freigeben, Krankheit, Überstunden- und Urlaubskonto |
| 🧾 Lohn und Prüfung | Export für DATEV mit Zuschlägen, Stundenzettel, Export für Zoll und Arbeitsschutz |
| 🛠️ Projekte | Aufträge, Stoppuhr, Auslastung, Stundennachweis, Übergabe an [Haben](https://haben.app/) |
| 🔁 Umzug | Import aus Clockodo, Personio, Kimai, Papershift, Planday, Crewmeister, Toggl, Clockify und Excel |
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
Ja. Soll übernimmt Mitarbeiter, Zeiten, Abwesenheiten, Salden und Projekte; die Originaldatei bleibt
nachvollziehbar aufbewahrt.

### Brauche ich eine Stempeluhr?
Nein. Ein Android-Tablet an der Wand reicht; gestempelt wird mit PIN, QR-Code oder NFC-Karte.

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
