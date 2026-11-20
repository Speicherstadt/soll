# Mockup

Die Vorlage für die Oberfläche von Soll, sechs Screens im Look aus [DESIGN.md](../../DESIGN.md), hell
und dunkel: Heute und Abwesenheit am Handy, das Terminal im Querformat, Dienstplan, Monatsabschluss
und Einrichtung am Desktop. Testdaten: „Café Elbblick“ und „Weber Haustechnik“.

Die Dateien sind im Format eines Design-Canvas (`.dc.html`): HTML mit Inline-Styles und Platzhaltern
wie `{{t.bg}}`, deren Werte im Skript am Ende jeder Datei stehen (`renderVals()`, hell und dunkel).
Sie laufen nicht für sich im Browser; gebaut wird nach ihnen mit `packages/ui` und Tailwind, nicht
aus ihnen kopiert. `canvas.json` ordnet die Screens auf dem Canvas an.

Das Original liegt als Canvas „Soll Mockup“ auf claude.ai. Weicht die App bewusst ab, kommt die Regel
in DESIGN.md; das Mockup wird nicht nachgezogen.
