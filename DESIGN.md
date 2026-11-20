# Design

Wie Soll aussieht und sich bedient, für Menschen und Agenten. Vorbild ist das Mockup in
[`design/mockup/`](design/mockup/README.md) (Heute, Abwesenheit, Terminal, Dienstplan,
Monatsabschluss, Einrichtung) und der Look von Kennwort und Kontext: ruhig, kompakt, Zinc-Grautöne,
Geist. `packages/ui` übernimmt die Komponenten von Kennwort. Bei Widerspruch gilt diese Datei.
Eine neue Regel kommt im selben Pull Request hierher wie die Änderung, die sie braucht.

## Grundsätze

- **Ein Tipp zum Stempeln**: Kommen, Pause und Gehen sind der größte Knopf der Ansicht, am Handy
  und am Terminal mit dem Daumen erreichbar.
- **Befund mit Norm**: Ein Hinweis nennt, was fehlt, und die Norm dazu („Pause fehlt noch 15 min ·
  § 4 ArbZG“). Grün heißt geprüft und in Ordnung, sonst nichts.
- **Kontrolle sichtbar machen**: Was der Betrieb sieht, sieht auch die Person selbst: Änderungen an
  ihren Zeiten mit Grund, eine eingeschaltete Auswertung, der Stand des Monatsabschlusses.
- **Ruhig und dicht**: viel Information auf wenig Platz; keine Verläufe, keine Schatten außer bei
  schwebenden Elementen (Menüs, Dialoge).
- **Eine Hauptaktion je Ansicht**, dunkel gefüllt; alles andere umrandet oder als Icon-Knopf.

## Farben

Tailwind 4 mit Zinc als Grundpalette; alle Werte als CSS-Variablen, hell und dunkel, wie in
Kennwort.

| Token | Hell | Dunkel | Wofür |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#09090b` | Fläche |
| `--muted` | `#fafafa` | `#18181b` | Seitenleiste, Fußzeilen, freie Tage im Plan |
| `--accent` | `#f4f4f5` | `#27272a` | gewählte Zeile, Wochenende im Plan |
| `--border` | `#e4e4e7` | `#27272a` | Linien, Rahmen |
| `--foreground` | `#09090b` | `#fafafa` | Text |
| `--muted-foreground` | `#71717a` | `#a1a1aa` | Nebentext (mindestens 4,5:1) |
| `--primary` | `#18181b` | `#fafafa` | Hauptknopf |
| `--primary-foreground` | `#fafafa` | `#18181b` | Text auf `--primary` |
| `--success` | `#15803d` | `#4ade80` | eingestempelt, Tag ohne Befund, Monat abgeschlossen |
| `--warning` | `#b45309` | `#fbbf24` | Hinweis (etwa 8 h überschritten) |
| `--warning-surface` | `#fef3c7` | `#422006` | Badge „Hinweis“ |
| `--danger` | `#b91c1c` | `#f87171` | Verstoß, Löschen, Fehler |

Kein Rot/Grün als einziges Merkmal: dazu immer Text oder Icon. Text auf `--warning-surface` steht in `--foreground`, auch der Nebentext: `--muted-foreground` erreicht dort keine 4,5:1.

## Schrift und Maße

- **Geist** für Text, **Geist Mono** für Uhrzeiten und Dauern in Tabellen und am Terminal;
  selbst ausgeliefert. Ziffern immer gleich breit (`tabular-nums`).
- Dauern als `7:30`, nie als Dezimalzahl in der Oberfläche; Exporte schreiben, was das Zielformat
  verlangt.
- Größen: 12 px Nebentext, 13 px Text am Desktop, 15 px am Handy, 28 px Titel am Handy; die laufende
  Zeit beim Stempeln 40 px, am Terminal 64 px.
- Abstände im 4-px-Raster; Radien 6 px Knöpfe, 8 px Felder, 12 px Karten.
- Icons: aus `lucide` über `Icon` in `packages/ui` (`lucide-solid` trägt kein Solid 2), 16 px am
  Desktop, 20–24 px am Handy und Terminal.

## Aufbau

**Desktop (ab `md`)**: Seitenleiste mit Betrieb und Standort, Bereichen (Heute, Zeiten, Abwesenheiten,
Dienstplan, Projekte, Auswertungen, Einstellungen) · Inhalt mit Kopf (Titel, Zeitraum, Hauptaktion).

Seitenleiste und Tab-Leiste zeigen nur die Bereiche der Module des Betriebs; das Terminal hat keinen
Bereich.

**Handy (unter `md`)**: ein Screen zur Zeit; Tab-Leiste mit Heute, Plan, Abwesenheit, Mehr. Fehlt
ein Modul, rücken die nächsten Bereiche nach (Projekte, Zeiten): Heute, höchstens zwei Bereiche,
Mehr.
„Heute“ zeigt den Stempelknopf, die laufende Zeit, Soll und Ist des Tages und den nächsten Befund.
Berührungsziele mindestens 44 px.

**Terminal (Tablet quer, 1280 × 800)**: links die Uhr und „Karte auflegen oder PIN eingeben“, rechts
das Ziffernfeld; nach dem Erkennen Name, Kommen oder Gehen, Saldo des Tages und der nächste Befund,
nach 5 Sekunden zurück. Keine Navigation, kein Zugriff auf andere Daten. Berührungsziele mindestens
64 px.

**Einrichtung** (ohne Seitenleiste, auf `--muted`): Kopf „Soll einrichten“, die Schritte als
nummerierte Pillen (`aria-current="step"`), der Schritt in einer Karte, daneben „Gut zu wissen“ mit
den Hinweisen zu den Modulen, unten „Schritt n von N“, Zurück und Weiter. Bewusst anders als im
Mockup: kein Feld „Branche“ (nichts in Soll hängt daran), der erste Standort kommt im Schritt
Standorte statt im ersten Schritt (ein Freelancer hat keinen), und ohne Beschäftigte entfallen die
drei übrigen Fragen und alle weiteren Schritte. Anmelden, Konto anlegen und Einladung annehmen
stehen in derselben Art als eine Karte.

**Dienstplan**: Wochenraster, Personen als Zeilen, Tage als Spalten; Schichten als Blöcke mit
Uhrzeit und Rolle; ein Befund erscheint am Block als Icon mit Text im Tooltip und in einer Liste
unter dem Plan.

**Monatsabschluss**: Kopf mit dem Stand (bestätigt, abgeschlossen), „Stundenzettel (PDF)“ und der
Hauptaktion, für die Person „Monat bestätigen“, für den Inhaber „Monat abschließen“; darunter die
Summen, die Tabelle der Tage mit Beginn, Ende, Pause, Dauer, Befund, Änderungen von Hand markiert,
und der Prüfwert. Bewusst anders als im Mockup: die Tabelle zeigt nur Tage mit Arbeit, Befund oder
Änderung statt einer zugeklappten Zeile, und am Handy fehlt die Spalte Pause. Die **Prüfseite**
steht wie Anmelden als eine Karte ohne Seitenleiste.

**Projekte** (kein Screen im Mockup): Reiter Aufträge, Kunden, Tätigkeiten und Sätze; Kunden und
Sätze nur für Inhaber und Planer. Je Reiter oben ein umrandetes Formular zum Anlegen (am Desktop die
Felder nebeneinander, am Handy untereinander), darunter die Tabelle; Archivieren, Zurückholen und
Entfernen als Icon-Knöpfe am Ende der Zeile, „archiviert“ als Badge. Die festen internen Tätigkeiten
tragen das Badge „intern“ und haben keine Knöpfe.

## Komponenten

Eigene Komponenten in `packages/ui`, ohne Bibliothek, auf nativen Elementen, wie in Kennwort:

| Komponente | Grundlage | Hinweise |
| --- | --- | --- |
| Button | `<button>` | Varianten `primary`, `outline`, `ghost`, `icon`; Icon-Knöpfe immer mit `aria-label` |
| Stempelknopf | `<button>` | groß, zeigt den nächsten Schritt („Kommen“, „Pause beenden“), Zustand per `aria-pressed` |
| Eingabe | `<input>` mit `<label>` | Uhrzeit und Dauer mit eigener Eingabe (`7:30`, `90 min`) |
| Dialog | `<dialog>` mit `showModal()` | Fokusfalle und Esc vom Browser |
| Menü, Popover, Tooltip | Popover-API, CSS Anchor Positioning | Tastatur selbst: Pfeile, Home/End, Esc |
| Combobox | `<input>` + Popover | Rolle `combobox`, `aria-activedescendant` |
| Toast | eigener Bereich mit `aria-live="polite"` | |
| Befund | Icon + Text + Norm | Schwere als Farbe und Wort („Hinweis“, „Verstoß“) |
| Ziffernfeld | Raster aus Buttons | für PIN am Terminal, mit Tastatur bedienbar |

## Texte

- Du-Form, kurz, ohne Fachwörter: „Kommen“, „Gehen“, „Pause“, „Monat bestätigen“, „Urlaub
  beantragen“.
- Normen stehen hinter dem Befund, in jeder Sprache auf Deutsch („§ 4 ArbZG“).
- Jeder Text in jeder Datei unter `messages/`; Datum, Uhrzeit und Zahlen über `Intl`; Arabisch von
  rechts nach links, das Layout spiegelt sich, Uhrzeiten und Zahlen nicht.

## Testdaten

„Weber Haustechnik“ (SHK, Hamburg: Jonas Weber, Inhaber; Anna, Büro; Sandra und Max, Monteure;
Leon, Azubi, 17) und „Café Elbblick“ (Hamburg: Mia, Inhaberin; Tom, Lea und Yusuf im Schichtdienst;
Olena und Piotr im Minijob). Adressen unter `.test`.
