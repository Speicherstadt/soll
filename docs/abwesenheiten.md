---
description: >-
  Urlaub beantragen, freigeben, ablehnen und stornieren; Krankmeldung ohne Diagnose mit der Frist für
  die Bescheinigung und der Erinnerung an die eAU; Kinderkrankentage; wer „krank“ sieht.
---

# Abwesenheiten

Unter **Abwesenheiten** beantragt jede Person Urlaub, meldet sich krank und sieht ihren Resturlaub.
Inhaber und Planer geben Anträge frei, Inhaber und Lohnbüro sehen, wann eine Bescheinigung fällig
ist. Abwesenheiten gehören zum Modul Arbeitszeit; jede Änderung steht in der
[Audit-Kette](audit-kette.md).

| Art | Wie sie entsteht | Gutschrift im Ist |
| --- | --- | --- |
| Urlaub | Antrag, Freigabe durch den Betrieb | das Soll des Tags; zählt als Urlaubstag nur an einem Tag mit Soll |
| Sonderurlaub | Antrag, Freigabe durch den Betrieb | das Soll des Tags |
| Überstundenabbau | Antrag, Freigabe durch den Betrieb | nichts: das Überstundenkonto bezahlt den Tag |
| Krank | Krankmeldung, gilt sofort | das Soll des Tags |
| Kind krank | Krankmeldung, gilt sofort | das Soll des Tags (unbezahlt, aber entschuldigt) |

Wie Soll und Ist mit Abwesenheiten rechnen, steht unter [Soll, Ist und Konten](konten.md#abwesenheiten).

## Urlaub beantragen

Im Antrag stehen Art, erster und letzter Tag; der erste und der letzte Tag können halb sein. Nach dem
Absenden nennt Soll, wie viele Urlaubstage der Antrag kostet: Wochenenden, Feiertage am Standort und
Tage, die das Arbeitszeitmodell frei hat, zählen nicht (§ 3 Abs. 2 BUrlG). Oben auf der Seite steht
der Resturlaub des Jahres: der Urlaub des Jahres (mit Teilurlaub und Zusatzurlaub, siehe
[Urlaub](konten.md#urlaub)) abzüglich des genehmigten Urlaubs. Übertragung und Verfall zeigt Soll in
der App mit S-402.

| Schritt | Wer | Danach |
| --- | --- | --- |
| Beantragen | die Person selbst | „beantragt“; Inhaber und Planer bekommen eine Mail |
| Freigeben | Inhaber oder Planer | „genehmigt“; der Urlaub zählt, die Person bekommt eine Mail |
| Ablehnen | Inhaber oder Planer, nur mit Grund | „abgelehnt“; die Person sieht den Grund und bekommt eine Mail |
| Zurückziehen | die Person, solange nicht entschieden ist | „zurückgezogen“ |
| Stornieren | Inhaber, Planer nur selbst freigegebenen Urlaub; nur mit Grund, nur genehmigter Urlaub | „storniert“; die Person sieht den Grund und bekommt eine Mail |

Ein Antrag für Tage, an denen schon ein Antrag oder eine Abwesenheit steht, wird abgelehnt
(„Für diese Tage gibt es schon eine Abwesenheit“). Die einzige Ausnahme ist Krankheit im Urlaub.
Eine Krankheit mit offenem Ende zählt dabei bis heute: Sie verhindert keinen später geplanten freien
Tag, und ein genehmigter freier Tag später verhindert die Krankmeldung nicht. An einem solchen Tag
zählt der freie Tag (bei einem halben freien Tag die andere Hälfte als krank), auch wenn das Ende
der Krankheit später darüber hinaus eingetragen wird; nur ein
noch offener Antrag steht dem Ende im Weg, bis die Person ihn zurückzieht.

Ist das Modul Dienstplan eingeschaltet, nennt der Antrag die eigenen Schichten im Zeitraum, soweit
sie veröffentlicht sind; einen Entwurf des Plans sehen nur Inhaber und Planer.

## Krank melden

**Ab heute krank melden** speichert eine Krankmeldung ab dem heutigen Tag, für einen selbst oder für
ein Kind. Eine Diagnose fragt Soll nicht ab, und Bescheinigungen lädt niemand hoch: Gesundheitsdaten
speichert Soll nur so weit wie nötig (Art. 9 DSGVO). Das Ende kann offen bleiben; die Person oder
der Betrieb tragen den letzten Krankheitstag ein, sobald er feststeht. Eine Krankmeldung aus
Versehen storniert, wer Krankheit sehen darf (Inhaber, Lohnbüro), mit Grund.

Mit der Krankmeldung bekommen Inhaber und Lohnbüro eine Mail mit Art und Fälligkeit der
Bescheinigung, Planer eine Mail mit „abwesend“. Ist das Modul Dienstplan eingeschaltet, nennen die
Mails die eingeplanten Schichten der Person ab heute als offen: bis zum letzten Krankheitstag, bei
offenem Ende bis zu dem Tag, an dem die Bescheinigung fällig ist. Wer plant (Inhaber, Planer), liest
auch Schichten aus dem Entwurf, mit „(Entwurf)“ markiert, das Lohnbüro nur veröffentlichte. Die
Schichten bleiben im Plan bei der Person; neu besetzt sie, wer plant.

### Bescheinigung ab dem vierten Tag

Dauert eine Krankheit länger als drei Kalendertage, braucht der Betrieb eine ärztliche
Bescheinigung, spätestens am darauffolgenden Arbeitstag (§ 5 Abs. 1 Satz 2 EntgFG). Der Betrieb
kann sie früher verlangen (Satz 3): unter **Einstellungen → Bescheinigung bei Krankheit** ab dem 1.,
2. oder 3. Tag. Die Regel R-27 steht mit ihren Testfällen im [Regelwerk](regeln.md#r-27-bescheinigung-ab-dem-vierten-tag-eau).

| krank ab | Einstellung | Bescheinigung fällig |
| --- | --- | --- |
| Mo bis Mi | Gesetz (4. Tag) | keine |
| Mo bis Do | Gesetz | Do |
| Fr bis Mo | Gesetz | Mo (der erste Arbeitstag ab dem 4. Tag) |
| Mo bis Do, Do ist Feiertag | Gesetz | Fr |
| Mo | ab dem 1. Tag | Mo |

Arbeitstag ist ein Tag mit Soll im Arbeitszeitmodell der Person, also kein Feiertag am Standort und
kein freier Tag; ohne Modell Montag bis Freitag.

Bei gesetzlich Versicherten stellt die Praxis die Arbeitsunfähigkeit nur fest und schickt sie an
die Krankenkasse; der Betrieb ruft die **eAU** über sein Lohnprogramm ab (§ 5 Abs. 1a EntgFG, § 109
SGB IV). Soll erinnert daran:

- Die Person sieht an ihrer Krankmeldung, wann die Bescheinigung fällig ist, am Tag selbst
  „Bescheinigung heute fällig“ und danach den Hinweis „Bescheinigung fällig seit …“.
- Inhaber und Lohnbüro sehen ab dem Tag der Fälligkeit unter **Bescheinigungen abrufen**: „eAU über
  dein Lohnprogramm abrufen“, bis die Bescheinigung als vorliegend markiert ist.

Gespeichert wird nur **Bescheinigung liegt vor**, „als eAU“ oder „auf Papier im Büro“. Markieren
dürfen es die Person selbst, Inhaber und Lohnbüro.

### Krank im Urlaub

Fällt eine Krankheit in genehmigten Urlaub und liegt die Bescheinigung vor, zählen diese Tage nicht
als Urlaub (§ 9 BUrlG); der Resturlaub steigt entsprechend. Ohne Bescheinigung bleiben sie
Urlaubstage, und der Monat nennt den Hinweis „Bescheinigung fehlt“ (R-24). Das gilt nur für die
eigene Krankheit, nicht für „Kind krank“.

## Kinderkrankentage

Soll zählt die Arbeitstage mit „Kind krank“ je Kind und Jahr gegen den Anspruch auf Krankengeld des
Jahres (§ 45 Abs. 2 und 2a SGB V; für 2026 15 Tage je Kind). Vom Kind speichert Soll nur eine
Nummer. Ist der Anspruch erreicht, steht ein Hinweis da; der Betrieb muss nicht ablehnen, aber das
Krankengeld endet. Für ein Jahr ohne hinterlegten Wert steht „nicht hinterlegt“
(siehe [Jahreswerte](jahreswerte.md)). Ob jemand allein erzieht, weiß Soll noch nicht; bis es die
Daten zum Mitarbeiter gibt, zählt der Wert für zwei Eltern.

## Konten

Oben auf der Seite stehen die Konten der Person: der **Resturlaub** und die **Überstunden**. Beide
rechnet Soll bei jedem Aufruf aus, gespeichert werden nur Anpassungen von Hand.

- **Resturlaub**: der Urlaub jedes Jahres ([Urlaubsanspruch](regeln.md)) abzüglich des genommenen
  Urlaubs, mit Übertrag ins Folgejahr und Verfall (R-23). Genehmigter Urlaub, der noch kommt, steht
  als „davon genehmigt“. Je Jahr steht da, ob und wann der Rest verfällt, oder dass der Hinweis
  auf Verfall noch fällig ist.
- **Überstunden**: Ist minus Soll jedes abgeschlossenen Monats, so wie er abgeschlossen wurde, dazu
  die Anpassungen. Monate dazwischen, die noch nicht abgeschlossen sind, nennt Soll, statt sie zu
  schätzen.

Fehlt ein Wert (ein Arbeitszeitmodell, ein abgeschlossener Monat ohne Summen) oder wurde ein Monat
nach Ablauf der Frist [ausgesondert](monatsabschluss.md#aufbewahrung-und-aussonderung), steht „nicht hinterlegt“ statt einer falschen
Zahl.

Wer alle Zeiten sieht (Inhaber, Planer, Lohnbüro), wählt die Person über „Konten von“. Eine Liste
der Konten aller Personen gibt es nicht (keine Auswertung je Person, BetrVG § 87 Abs. 1 Nr. 6). Der
Planer sieht von einer anderen Person nur den Resturlaub und den Saldo der Überstunden: Die
genommenen Tage je Jahr verrieten Krankheit im Urlaub (§ 9 BUrlG), die Monate des Kontos zeigten
Auszahlungen, und die gehören zur Lohnabrechnung.

### Hinweis auf Verfall

Urlaub verfällt nur, wenn der Betrieb die Person rechtzeitig und konkret darauf hingewiesen hat,
wie viel Urlaub offen ist und wann er verfällt (§ 7 Abs. 3 BUrlG; EuGH C-684/16 Max-Planck; BAG,
19.02.2019, 9 AZR 541/15 und 9 AZR 423/16). Soll verlangt den Hinweis drei Monate vor dem Verfall,
also bis 31. Dezember für den Urlaub, der mit dem 31. März des Folgejahres verfällt.

Der Inhaber hält unter „Hinweis auf Verfall festhalten“ den Tag fest, an dem er den Hinweis gegeben
hat: heute oder, für einen Hinweis auf Papier, einen Tag davor, nie in der Zukunft, nicht vor dem
Eintritt der Person und nicht vor dem Beginn des Kontos. Soll speichert dazu, was der Hinweis an diesem Tag nannte (offene Tage je Jahr
und Tag des Verfalls), und zeigt ihn der Person mit Tag und Inhalt.

| Hinweis | Folge |
| --- | --- |
| bis 31. Dezember | der Rest verfällt mit dem 31. März des Folgejahres |
| später | der Rest verfällt erst mit dem 31. März nach dem Jahr des Hinweises |
| keiner | der Rest verfällt nicht |

Teilurlaub nach § 5 Abs. 1 Buchst. a BUrlG überträgt Soll immer ins ganze Folgejahr (§ 7 Abs. 3
Satz 4 BUrlG); der Hinweis ist dann bis 30. September fällig.

### Anpassungen von Hand

Nur der Inhaber passt Konten an, immer mit Grund, den die Person sieht. Eine Anpassung wird nie
geändert; eine falsche wird mit einer weiteren korrigiert. Eine Anpassung der Überstunden gilt
einem Monat vom Eintritt bis zum laufenden Monat, nie einem kommenden.

| Anpassung | Wofür |
| --- | --- |
| Überstunden zu Beginn | der Saldo, mit dem die Person zu Soll kommt; einmal, vor dem ersten abgeschlossenen Monat; er steht für alles davor, ein früherer Monat, der erst danach abgeschlossen wird, zählt nicht |
| Überstunden ausgezahlt | ausbezahlte Stunden, sie gehen vom Konto ab |
| Überstunden korrigiert | eine Korrektur mit Vorzeichen |
| Resturlaub vor Soll | der Urlaub, der zu Beginn eines Jahres noch offen war; das Konto beginnt mit diesem Jahr (vom Jahr des Eintritts bis zum nächsten Jahr, nicht nach dem Jahr des ersten Hinweises auf Verfall) |
| Urlaub korrigiert | eine Korrektur des Urlaubs eines Jahres mit Vorzeichen, in halben Tagen (vom Jahr vor dem Beginn des Kontos bis zum nächsten Jahr) |

## Wer sieht „krank“

„Krank“ und „Kind krank“ sind Gesundheitsdaten (Art. 9 DSGVO).

| Wer | sieht |
| --- | --- |
| die Person selbst | ihre Abwesenheiten mit Art, Bescheinigung und Kind |
| Inhaber, Lohnbüro | die Art, die Bescheinigung und die Erinnerung an die eAU, weil sie die Entgeltfortzahlung abrechnen |
| Planer und alle anderen ohne dieses Recht | jede genehmigte, abgelehnte, zurückgezogene oder stornierte Abwesenheit einer anderen Person nur als „abwesend“, auch Urlaub: ohne Art, Bescheinigung, Kind, Grund, Urlaubstage der Zeile und ohne, wer entschied; ein offenes Ende steht als heute. Die Art sieht der Planer nur bei einem offenen Antrag, über den er entscheidet, und im Augenblick seiner Entscheidung |
| alle im Teamkalender und im Dienstplan | jede Abwesenheit nur als „abwesend“, auch Urlaub und auch für den Inhaber; ein offenes Ende steht als heute, in einem Zeitraum, der erst nach heute beginnt, fehlt es; dort storniert der Inhaber genehmigten Urlaub, der Planer nur den, den er selbst freigegeben hat |

## Teamkalender

Der Teamkalender zeigt vier Wochen ab heute, vor und zurück je vier Wochen, für einen Standort: die
Feiertage des Standorts und, wer abwesend ist, jede Abwesenheit nur als „abwesend“, ganz oder halb.
Am Desktop steht er als Raster (Personen als Zeilen, Tage als Spalten, Wochenenden und Feiertage
hinterlegt), darunter und am Handy als Liste. Soll kennt keinen Standort je Person, alle arbeiten an
jedem Standort; der Standort bestimmt deshalb die Feiertage, nicht die Personen. Zahlen je Person
(Tage abwesend, Anteile) zeigt der Kalender nicht.

Hieße nur Krankheit „abwesend“, verriete das Wort sie. Deshalb verrät auch keine Antwort des
Servers die Art: Er prüft erst das Recht, dann den Status und die Art zuletzt.

Dasselbe gilt im [Monatsabschluss](monatsabschluss.md) und auf dem Stundenzettel: Wer „krank“ nicht
sehen darf, liest dort jede Abwesenheit als „abwesend“, und der Hinweis „Krank im Urlaub“ fehlt.

## Abgeschlossener Monat

Genehmigte Abwesenheiten stehen im Inhalt des Monatsabschlusses und auf dem Stundenzettel. Eine
Abwesenheit, die einen Tag eines abgeschlossenen Monats ändern würde (ein Antrag, eine Freigabe, ein
Storno, eine Bescheinigung für Krankheit im Urlaub, ein neues Ende), lehnt der Server ab; korrigiert
wird mit einem [Gegeneintrag](monatsabschluss.md#korrektur-als-gegeneintrag). Die Bescheinigung
einer Krankheit außerhalb des Urlaubs lässt sich auch nach dem Abschluss markieren: Sie ändert dort
weder Soll noch Ist und steht deshalb nicht im Inhalt.

## Für Entwickler

| API (unter `/api/v1/arbeitszeit/abwesenheiten`) | Was |
| --- | --- |
| `GET /?nutzerId&jahr` | Abwesenheiten eines Jahres, Resturlaub, Kinderkrankentage, Fristen, Rechte des Aufrufers |
| `GET /offen` | Anträge zur Entscheidung (Inhaber, Planer) und Erinnerungen an die eAU (Inhaber, Lohnbüro) |
| `GET /team?von&bis&standortId` | Feiertage des Standorts (ohne `standortId` des ersten Standorts oder des Bundeslands), genehmigte Abwesenheiten aller, höchstens 62 Tage, jede als „abwesend“, ein offenes Ende als heute, `bis` höchstens bis zum Ende des Zeitraums, `stornierbar` nur für Inhaber und Planer (Planer: selbst freigegebener Urlaub) |
| `POST /antrag` | Antrag: `art`, `von`, `bis`, `ersterHalb`, `letzterHalb` |
| `POST /krank` | Krankmeldung ab heute: `art` (`krank`, `kind_krank`), `bis` (oder `null`), `kind` |
| `POST /:id/freigeben`, `/ablehnen`, `/zurueckziehen`, `/stornieren` | Entscheidungen, Ablehnen und Stornieren mit `grund` |
| `POST /:id/bescheinigung` | `bescheinigung`: `eau`, `papier` oder `null` |
| `POST /:id/beenden` | `bis`: der letzte Krankheitstag |
| `PUT /einstellungen` | `bescheinigungAbTag`: 1 bis 4 (nur Inhaber) |

| API (unter `/api/v1/arbeitszeit/konten`) | Was |
| --- | --- |
| `GET /?nutzerId` | Resturlaub (`urlaub`) mit Jahren und Verfall, Überstunden (`ueberstunden`), Hinweise und Anpassungen; die eigenen oder mit `zeiten:alle` die einer Person |
| `POST /:nutzerId/hinweise` | `tag` des Hinweises auf Verfall (nur Inhaber, `konten:pflegen`); 422 in der Zukunft, vor dem Eintritt oder vor dem Beginn des Kontos, 409 zweimal am selben Tag |
| `POST /:nutzerId/anpassungen` | `art` (`startsaldo`, `auszahlung`, `korrektur` mit `monat` und `minuten`; `urlaub_start`, `urlaub_korrektur` mit `jahr` und `halbtage`) und `grund` (nur Inhaber); 409 für einen zweiten Beginn oder einen Startsaldo nach einem abgeschlossenen Monat, 409 für Resturlaub vor Soll aus einem Jahr nach dem ersten Hinweis, 422 für einen Monat oder ein Jahr außerhalb des Kontos |

| Funktion in `packages/arbeitszeit` | Was |
| --- | --- |
| `tageDesZeitraums(zeitraum, offenBis)` | ein Zeitraum als Tage für `tagesSoll`, halbe Tage am Anfang und Ende |
| `ueberschneiden`, `ueberschneidungErlaubt` | Überschneidung zweier Zeiträume; erlaubt ist nur Krankheit im Urlaub |
| `bescheinigungFaellig`, `bescheinigungPruefen` | R-27: Fälligkeit, Stand, Erinnerung an die eAU, Befund |
| `sichtbareArt(art, gesundheitSehen)` | ohne Recht jede Art als „abwesend“ |
| `urlaubskonto`, `verfallHinweis` | R-23: Resturlaub je Jahr mit Verfall; was ein Hinweis an seinem Tag nennt |
| `ueberstundenkonto` | Überstunden aus den Abschlüssen und den Anpassungen |
| `feiertageZwischen(standort, von, bis)` | die Feiertage eines Standorts im Zeitraum |

Der Dienstplan (S-501) liefert über sein `index.ts` eine `Schichtquelle`
(`schichtquelle` in `apps/server/src/modules/dienstplan/abwesenheit.ts`, der Typ in
`apps/server/src/modules/arbeitszeit/abwesenheiten/plan.ts`): Sie gibt die Schichten einer Person
in einem Zeitraum, auf Wunsch mit Entwurf, für den Antrag und die offenen Schichten einer
Krankmeldung; bei abgeschaltetem Modul keine.
Umgekehrt liest der Plan mit `abwesenheitenIn` die genehmigten Abwesenheiten eines Tags und zeigt
jede nur als „abwesend“, wie der Teamkalender.
