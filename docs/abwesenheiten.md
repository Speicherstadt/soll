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
| Stornieren | Inhaber oder Planer, nur mit Grund, nur genehmigter Urlaub | „storniert“; die Person sieht den Grund und bekommt eine Mail |

Ein Antrag für Tage, an denen schon ein Antrag oder eine Abwesenheit steht, wird abgelehnt
(„Für diese Tage gibt es schon eine Abwesenheit“). Die einzige Ausnahme ist Krankheit im Urlaub.
Eine Krankheit mit offenem Ende zählt dabei bis heute: Sie verhindert keinen später geplanten freien
Tag, und ein genehmigter freier Tag später verhindert die Krankmeldung nicht. Bis das Ende feststeht,
zählt an einem solchen Tag der freie Tag; ein Ende darüber hinaus nimmt Soll erst an, wenn der
Betrieb den freien Tag storniert hat.

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

## Wer sieht „krank“

„Krank“ und „Kind krank“ sind Gesundheitsdaten (Art. 9 DSGVO).

| Wer | sieht |
| --- | --- |
| die Person selbst | ihre Abwesenheiten mit Art, Bescheinigung und Kind |
| Inhaber, Lohnbüro | die Art, die Bescheinigung und die Erinnerung an die eAU, weil sie die Entgeltfortzahlung abrechnen |
| Planer | „abwesend“, ohne Bescheinigung, Kind und Grund; Urlaub, Sonderurlaub und Überstundenabbau mit Art, weil er sie freigibt |
| alle im Teamkalender und im Dienstplan | jede Abwesenheit nur als „abwesend“, auch Urlaub und auch für den Inhaber; ein offenes Ende steht als letzter gezeigter Tag, in einem Zeitraum, der erst nach heute beginnt, fehlt es; wer Urlaub freigibt, kann ihn dort stornieren |

Dasselbe gilt im [Monatsabschluss](monatsabschluss.md): Wer „krank“ nicht sehen darf, liest dort
„abwesend“, und der Hinweis „Krank im Urlaub“ fehlt.

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
| `GET /team?von&bis` | genehmigte Abwesenheiten aller, höchstens 62 Tage, jede als „abwesend“, `bis` höchstens bis zum Ende des Zeitraums, `stornierbar` nur für Inhaber und Planer |
| `POST /antrag` | Antrag: `art`, `von`, `bis`, `ersterHalb`, `letzterHalb` |
| `POST /krank` | Krankmeldung ab heute: `art` (`krank`, `kind_krank`), `bis` (oder `null`), `kind` |
| `POST /:id/freigeben`, `/ablehnen`, `/zurueckziehen`, `/stornieren` | Entscheidungen, Ablehnen und Stornieren mit `grund` |
| `POST /:id/bescheinigung` | `bescheinigung`: `eau`, `papier` oder `null` |
| `POST /:id/beenden` | `bis`: der letzte Krankheitstag |
| `PUT /einstellungen` | `bescheinigungAbTag`: 1 bis 4 (nur Inhaber) |

| Funktion in `packages/arbeitszeit` | Was |
| --- | --- |
| `tageDesZeitraums(zeitraum, offenBis)` | ein Zeitraum als Tage für `tagesSoll`, halbe Tage am Anfang und Ende |
| `ueberschneiden`, `ueberschneidungErlaubt` | Überschneidung zweier Zeiträume; erlaubt ist nur Krankheit im Urlaub |
| `bescheinigungFaellig`, `bescheinigungPruefen` | R-27: Fälligkeit, Stand, Erinnerung an die eAU, Befund |
| `sichtbareArt(art, gesundheitSehen)` | „abwesend“ statt „krank“ und „Kind krank“ ohne Recht |

Der Dienstplan (S-501) liefert über sein `index.ts` eine `Schichtquelle`
(`schichtquelle` in `apps/server/src/modules/dienstplan/abwesenheit.ts`, der Typ in
`apps/server/src/modules/arbeitszeit/abwesenheiten/plan.ts`): Sie gibt die Schichten einer Person
in einem Zeitraum, auf Wunsch mit Entwurf, für den Antrag und die offenen Schichten einer
Krankmeldung; bei abgeschaltetem Modul keine.
Umgekehrt liest der Plan mit `abwesenheitenIn` die genehmigten Abwesenheiten eines Tags und zeigt
jede nur als „abwesend“, wie der Teamkalender.
