# Demo-Daten

`bun run demo` legt die beiden Testbetriebe „Weber Haustechnik“ und „Café Elbblick“ mit drei Monaten
Daten an: zum Ausprobieren, für Vorführungen und für die Screenshots der Dokumentation. Die Daten
sind erfunden; jede Adresse und jede E-Mail-Adresse endet auf `.test` und erreicht niemanden.

!!! warning "Nur für die Demo"
    Alle Konten haben dasselbe, hier veröffentlichte Passwort. Ein Datenverzeichnis aus
    `bun run demo` gehört nie in den Betrieb und nie neben echte Daten.

## Aufruf

```sh
bun run demo                                    # nach ./demo-daten, bis heute
bun run demo --ziel /tmp/soll-demo --heute 2026-11-25
```

| Option | Bedeutung | Vorgabe |
| --- | --- | --- |
| `--ziel` | Datenverzeichnis, in das die Demo schreibt | `demo-daten` |
| `--heute` | der Tag, bis zu dem die Geschichte läuft (`JJJJ-MM-TT`) | heute in Europe/Berlin |

Die Demo schreibt nur in ein frisches Verzeichnis: liegt dort schon ein `soll.db`, bricht sie ab,
ohne etwas zu ändern. So kann sie nie eine Datenbank mit echten Daten berühren.

Ist `SOLL_SECRET_KEY` gesetzt, verschlüsselt die Demo mit diesem Schlüssel; sonst erzeugt sie einen
und gibt ihn einmal am Ende aus. Er steht nirgends sonst, auch nicht im Verzeichnis. `SOLL_URL` ist
die Adresse, unter der der Server später läuft (Vorgabe `http://localhost:8200`). Am Ende gibt die
Demo die Anmeldedaten und den Befehl zum Starten aus:

```sh
SOLL_DATA_DIR=/pfad/zu/demo-daten SOLL_SECRET_KEY=… SOLL_URL=http://localhost:5177 bun run dev:server
bun run dev:web    # App auf Port 5177
```

## Anmeldung

Passwort für alle Konten: `soll-demo-2026`.

| Betrieb | Person | Rolle | Anmeldung |
| --- | --- | --- | --- |
| Weber Haustechnik | Jonas Weber | Inhaber | `jonas@weber-haustechnik.test` |
| Weber Haustechnik | Anna Brandt (Büro) | Planer | `anna` |
| Weber Haustechnik | Sandra Kowalski (Monteurin) | Mitarbeiter | `sandra` |
| Weber Haustechnik | Max Petersen (Monteur) | Mitarbeiter | `max` |
| Weber Haustechnik | Leon Schulz (Auszubildender, 17) | Mitarbeiter | `leon` |
| Café Elbblick | Mia Hansen | Inhaberin | `mia@cafe-elbblick.test` |
| Café Elbblick | Tom Becker | Mitarbeiter | `tom` |
| Café Elbblick | Lea Vogel (Schichtleitung) | Planer | `lea` |
| Café Elbblick | Yusuf Demir | Mitarbeiter | `yusuf` |
| Café Elbblick | Olena Kovalenko (Minijob) | Mitarbeiter | `olena` |
| Café Elbblick | Piotr Nowak (Minijob) | Mitarbeiter | `piotr` |

Am Terminal des Cafés stempeln Tom, Lea, Yusuf, Olena und Piotr mit den PINs `418203`, `529314`,
`630425`, `741536` und `852647`.

## Was entsteht

Die Geschichte reicht über die drei vollen Monate vor dem Monat von `--heute` und diesen Monat bis
`--heute` um 10:30 Uhr; wer Frühdienst hat, ist dann eingestempelt. Die Demo legt nichts mit SQL an:
sie startet die App im selben Prozess auf der neuen Datenbank, stellt deren Uhr auf den Zeitpunkt
jedes Schritts und ruft die HTTP-API auf, wie es der Browser oder das Tablet täten. Jede Änderung
steht deshalb in der [Audit-Kette](audit-kette.md), mit dem Zeitpunkt, zu dem sie in der Geschichte
geschieht. Am Ende prüft die Demo beide Ketten.

**Weber Haustechnik** (Arbeitszeit, Projektzeit, Dienstplan): Sandra, Max und Leon stempeln montags
bis freitags auf dem Handy, Leon nicht am Freitag (Berufsschule), Anna im Büro von 8 bis 14:30 Uhr. Die
Monteure buchen jeden Abend Fahrt und Montage oder Wartung auf drei Aufträge (Kunden „Elbhof
Wohnungsbau“, „Familie Petersen“, „Hotel Speicherblick“); für den Auftrag „Bäder Elbhof, 3. OG“
unterschreibt die Kundin den [Stundennachweis](projektzeit.md) des mittleren Monats. Sandra und Anna
nehmen Urlaub, der Inhaber gibt ihn frei; Max ist vier Tage krank, am vierten Tag ist die eAU
abgerufen. Anna trägt ein vergessenes „Gehen“ nach und korrigiert ein zu spät gestempeltes „Kommen“,
jeweils mit Grund.

**Café Elbblick** (Arbeitszeit, Dienstplan, Terminal): montags Ruhetag. Lea plant jede Woche am
Donnerstag davor und veröffentlicht sie; alle stempeln am Tablet am Tresen mit ihrer PIN. Yusuf hat
eine Woche Urlaub, Lea zwei Tage „Kind krank“, Mia trägt ein am Terminal vergessenes „Gehen“ von
Piotr nach. Das Café ist Gaststätte (§ 5 Abs. 2, § 10 Abs. 1 Nr. 4 ArbZG).

Jeder volle Monat ist von jeder Person am Ersten des Folgemonats bestätigt und vom Betrieb
[abgeschlossen](monatsabschluss.md); jede Person hält damit je Monat einen Prüfwert. Fällt
`--heute` auf den Ersten, ist der letzte Monat noch offen.

## Befunde mit Absicht

Damit die Prüfansichten etwas zeigen, sind einige Verstöße eingebaut; ein normaler Tag bleibt unter
acht Stunden und ohne Befund.

| Wo | Was | Regel |
| --- | --- | --- |
| Max, erster Dienstag des mittleren Monats | Notdienst 6:30 bis 18:15 mit 30 Minuten Pause | R-02 (§ 3 ArbZG), R-04 (§ 4 ArbZG) |
| Tom, zweiter Mittwoch des mittleren Monats | Abendveranstaltung bis 22:00, am nächsten Morgen Frühdienst um 7:30 | R-05 (§ 5 ArbZG) |
| Leon, Mittwoch der kommenden Woche (Plan) | 7:00 bis 17:00 mit einer Stunde Pause | R-15 (§ 8 JArbSchG) |

Die Spätschicht „Lange Nacht“ am Samstag vor dem letzten Sonntag im Oktober läuft von 20:00 bis
3:30 Uhr über die Zeitumstellung: auf der Uhr 7,5 Stunden, gezählt werden die 8,5 echten Stunden.

## Gleich bei gleichem Tag

Die Geschichte ist eine reine Funktion von `--heute`: ein Zufallsgenerator mit festem Startwert
verteilt die Minuten, die jemand früher oder später kommt. Derselbe Tag ergibt dieselben Zeiten,
Abwesenheiten und Buchungen. Kennungen, Hashes und Prüfwerte vergibt Soll selbst; sie sind bei jedem
Lauf andere.

## Test

`apps/server/src/demo/demo.test.ts` lässt die Demo bei jedem `bun run test` in ein temporäres
Verzeichnis laufen und prüft die Personen, die Anzahlen, beide Ketten, einen Prüfwert auf der
[Prüfseite](monatsabschluss.md), die Befunde, die Zeitumstellung, die Ablehnung eines vorhandenen
`soll.db` und dass die Stempelungen am Terminal genau zu den geplanten Zeiten stehen.
