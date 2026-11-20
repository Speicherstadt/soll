---
description: >-
  Wie Soll das Soll aus dem Arbeitszeitmodell, das Ist, das Überstundenkonto, den Urlaub mit
  Teilurlaub, Zusatzurlaub, Elternzeit und Verfall und die Kinderkrankentage rechnet – in ganzen
  Minuten und halben Tagen.
---

# Soll, Ist und Konten

Soll rechnet aus dem Arbeitszeitmodell, den Stempelungen und den Abwesenheiten, was eine Person
schuldet, was sie geleistet hat und was ihr zusteht. Gerechnet wird nur mit ganzen Zahlen: Zeit in
Minuten, Urlaub in halben Tagen. Gespeichert werden die Konten nicht; sie entstehen jedes Mal neu
aus den Monatsabschlüssen und den Anpassungen von Hand (Projektplan, „Konten“). Die Regeln mit ihren
Testfällen stehen im [Regelwerk](regeln.md#r-33-soll-ist-und-uberstundenkonto) unter R-23 bis R-28
und R-33.

## Soll eines Tages

Das Soll eines Tages sind die Minuten, die das Arbeitszeitmodell für diesen Wochentag vorsieht. Es
gilt das Modell, das der Person an diesem Tag zugeordnet ist; wechselt das Modell mitten im Monat
(Teilzeit ab dem 16.), zählt jeder Tag mit seinem Modell.

| Tag | Soll |
| --- | --- |
| Arbeitstag im Modell | die Minuten des Modells |
| gesetzlicher Feiertag am Standort | 0; die ausgefallenen Minuten werden genannt (§ 2 Abs. 1 EntgFG) |
| Feiertag an einem Tag, den das Modell frei hat | 0, nichts fällt aus |
| vor dem Eintritt, nach dem Austritt, während das Arbeitsverhältnis ruht (volle Elternzeit) | 0 |
| Tag der Beschäftigung ohne zugeordnetes Modell | „nicht hinterlegt“ |

Die Feiertage kommen aus dem [Feiertagskalender](feiertage.md) des Standorts der Person. In einem
Jahr ohne Feiertagskalender ist ein Tag mit Minuten im Modell „nicht hinterlegt“.

## Abwesenheiten

Eine Abwesenheit lässt das Soll stehen und schreibt dem Ist eine Gutschrift gut. So zeigt der Monat
getrennt, was gearbeitet und was gutgeschrieben wurde.

| Abwesenheit | Gutschrift | Grundlage |
| --- | --- | --- |
| Urlaub | das Soll des Tages; zählt als Urlaubstag nur an einem Tag mit Soll | §§ 1, 3 Abs. 2 BUrlG |
| Krankheit | das Soll des Tages | §§ 3, 4 Abs. 1 EntgFG |
| Kind krank | das Soll des Tages (unbezahlt, aber entschuldigt) | § 45 Abs. 3 SGB V |
| Sonderurlaub | das Soll des Tages | § 616 BGB |
| Überstundenabbau | nichts: das Konto bezahlt den Tag | Projektplan, „Abwesenheiten im Soll“ |

Ein halber Tag bekommt die Hälfte des Solls, auf die Minute aufgerundet (7:15 Soll, halber Tag:
3:38). Zwei halbe Tage zusammen bekommen nie mehr als das Soll.

**Krank im Urlaub** (R-24, § 9 BUrlG): Mit „Bescheinigung liegt vor“ zählt der Tag als
Krankheitstag und nicht als Urlaub. Ohne Bescheinigung bleibt er Urlaubstag, und der Monat nennt den
Hinweis „Bescheinigung fehlt“ mit allen Tagen.

## Soll und Ist eines Monats

Das Ist sind die Minuten der geschlossenen Schichten aller Arbeitstage, die im Monat beginnen
(siehe [Arbeitstag](arbeitstag.md)), plus die Gutschriften. Der Saldo ist Ist minus Soll; mit dem
Monatsabschluss geht er ins Überstundenkonto.

| Beispiel (Hamburg, Mo–Fr 8:00) | Soll | Ist | Saldo |
| --- | --- | --- | --- |
| November 2026, jeden Arbeitstag 8:00 | 168:00 | 168:00 | 0:00 |
| November 2026, jeden Arbeitstag 9:00 | 168:00 | 189:00 | +21:00 |
| Mai 2026 (1.5., 14.5., 25.5. Feiertage), jeden Arbeitstag 8:00 | 144:00 | 144:00 | 0:00 |
| November 2026, Urlaub 9. bis 13.11., sonst 8:00 | 168:00 | 128:00 + 40:00 | 0:00 |
| November 2026, Überstundenabbau am 6.11., sonst 8:00 | 168:00 | 160:00 | −8:00 |

Ein Tag mit noch offener Schicht zählt nicht mit und wird genannt: seine Zeit steht erst mit dem
„Gehen“ fest (R-01). Fehlt an einem Tag das Modell oder der Feiertagskalender, ist der ganze Monat
„nicht hinterlegt“, mit den fehlenden Tagen; eine Summe mit Lücke wäre geschätzt.

## Überstundenkonto

Das Überstundenkonto ist die Summe der Salden aller abgeschlossenen Monate und der Anpassungen von
Hand:

- **Startsaldo**: der Stand zu Beginn eines Monats, wenn die Person mit Soll beginnt (höchstens
  einer; davor gibt es weder Abschlüsse noch Anpassungen),
- **Auszahlung**: ausgezahlte Stunden, die abgezogen werden,
- **Korrektur**: mit Vorzeichen.

Beispiel: Startsaldo 10:00 zum 1.10.2026, Oktober +2:00, November −1:30 und 5:00 ausgezahlt ergibt
5:30. Fehlt zwischen zwei abgeschlossenen Monaten einer, nennt Soll ihn als Lücke.

## Urlaub

Soll führt Urlaub in halben Tagen und rechnet den Anspruch eines Jahres so:

1. **Jahresurlaub**: der Urlaub des Arbeitszeitmodells, mindestens der gesetzliche Mindesturlaub von
   24 Werktagen bei sechs Arbeitstagen, umgerechnet `24 × Arbeitstage je Woche ÷ 6` (§ 3 Abs. 1
   BUrlG): 20 Tage bei fünf, 16 bei vier Arbeitstagen. Liegt das Modell darunter, gilt der
   Mindesturlaub, und Soll weist am Modell darauf hin (R-23). Ein Modell ohne feste Minuten
   (Minijob nach Plan) braucht die Arbeitstage je Woche als Angabe, sonst ist der Urlaub „nicht
   hinterlegt“.
2. **Teilurlaub** (§ 5 Abs. 1 BUrlG): ein Zwölftel je vollem Monat, wenn die Wartezeit von sechs
   Monaten (§ 4) im Jahr nicht erfüllt wird (Eintritt nach dem 1.7.), wenn die Person vor ihr
   ausscheidet oder wenn sie in der ersten Hälfte des Jahres ausscheidet. Volle Monate zählen vom Tag
   des Eintritts an: Eintritt 15.8. ergibt vier volle Monate bis 14.12. Wer am 1.7. eintritt, hat die
   Wartezeit am 31.12. erfüllt und bekommt den vollen Urlaub; wer nach erfüllter Wartezeit im zweiten
   Halbjahr ausscheidet, auch.
3. **Rundung** (§ 5 Abs. 2 BUrlG): Ein Bruchteil ab einem halben Tag wird auf einen vollen Tag
   aufgerundet (6,67 → 7, 2,5 → 3). Ein kleinerer Bruchteil wird nicht abgerundet, sondern bleibt
   geschuldet (BAG, 26.01.1989, 8 AZR 730/87); Soll macht daraus einen halben Tag (8,33 → 8,5).
4. **Modellwechsel im Jahr**: Wechseln die Arbeitstage je Woche, zählt jedes Modell mit seinen Tagen
   im Jahr (EuGH C-415/12, Brandes): fünf Tage bis 30.6.2026, drei ab 1.7. ergibt
   20 × 181 ÷ 365 + 12 × 184 ÷ 365 = 15,97, also 16 Tage.
5. **Zusatzurlaub** (§ 208 SGB IX, R-25): eine Arbeitswoche, also fünf Tage bei fünf Arbeitstagen,
   vier bei vier. Besteht die Schwerbehinderung nicht die ganze Beschäftigung im Jahr, ein Zwölftel
   je vollem Monat, für sich gerundet. Trägt der Betrieb weniger ein, gilt das Gesetz, mit Hinweis.
6. **Elternzeit** (§ 17 Abs. 1 BEEG, R-26): Der Betrieb kann den Jahresurlaub um ein Zwölftel je
   vollem Kalendermonat Elternzeit kürzen, nicht bei Teilzeit beim selben Betrieb. Soll schlägt die
   Kürzung vor; gekürzt wird erst, wenn der Betrieb sie erklärt, und höchstens um ein Zwölftel je
   vollem Monat. Eine Elternzeit über den Jahreswechsel zählt in jedem Jahr dessen volle Monate. Der
   Zusatzurlaub wird nicht gekürzt.

## Übertragung und Verfall

Urlaub soll im Kalenderjahr genommen werden; Soll überträgt den Rest bis 31. März des Folgejahres
(§ 7 Abs. 3 BUrlG), Teilurlaub nach § 5 Abs. 1 Buchst. a auf Verlangen der Person bis 31. Dezember
des Folgejahres (§ 7 Abs. 3 Satz 4). Genommener Urlaub zählt zuerst gegen den ältesten offenen
Urlaub.

Urlaub verfällt nur, wenn der Betrieb die Person **rechtzeitig** auf den offenen Urlaub und den
Verfall hingewiesen hat (EuGH C-684/16, Max-Planck; BAG, 19.02.2019, 9 AZR 423/16). Soll verlangt
den Hinweis drei Monate vor dem Verfall:

| Lage (3 Tage offen aus 2026) | Ergebnis |
| --- | --- |
| noch kein Hinweis, bis 31.12.2026 | Hinweis „Hinweis auf Verfall fällig bis 31.12.2026“ |
| Hinweis am 1.10.2026 | Hinweis „Verfall droht“ bis 31.3.2027, danach verfallen die 3 Tage |
| Hinweis erst am 15.1.2027 | kein Verfall zum 31.3.2027; der Urlaub verfällt mit Ablauf des 31.3.2028 |
| kein Hinweis | ab 1.1.2027 Hinweis „Hinweis auf Verfall fehlt“; der Urlaub verfällt nicht und verjährt nicht (BAG, 20.12.2022, 9 AZR 266/20) |

Ein Hinweis nennt allen Urlaub, der an seinem Tag offen ist; er gilt für jedes Jahr ab seinem
eigenen. Das Datum, bis zu dem der Hinweis fällig ist, zeigt die App bei den Konten (S-402).

## Kinderkrankentage

Soll zählt die Arbeitstage mit „Kind krank“ je Kind und Jahr gegen den Anspruch auf Krankengeld
(§ 45 SGB V, R-28), der als [Jahreswert](jahreswerte.md) hinterlegt ist: 2026 je Kind 15 Tage
(alleinerziehend 30), zusammen höchstens 35 (70); 2027 je Kind 10 (20), höchstens 25 (50). Jeder Tag
zählt einmal, auch ein halber. Am letzten Tag des Anspruchs kommt der Hinweis „Anspruch erreicht“,
danach „über dem Anspruch auf Krankengeld“: Der Betrieb muss nicht ablehnen, aber das Krankengeld
endet. Vom Kind speichert Soll nur eine Kennung. Ein Jahr ohne Jahreswert ist „nicht hinterlegt“.

## Für Entwickler

Alle Funktionen sind rein und liegen in `packages/arbeitszeit`:

| Funktion | Gibt |
| --- | --- |
| `tagesSoll(tag, grundlagen, abwesenheiten)` | Soll, Feiertag, Ausfall, Gutschrift, Urlaub und R-24 eines Tages |
| `monatsstand(monat, eingaben)` | Soll, Ist, Saldo, Urlaubstage und offene Tage eines Monats |
| `ueberstundenkonto(abschluesse, anpassungen, bis)` | Saldo, Verlauf je Monat und Lücken |
| `urlaubsanspruch(eingaben)` | Jahresurlaub mit Art (voll, Teilurlaub a, b, c), Zwölfteln, Zusatzurlaub, Kürzung und Befunden |
| `urlaubskonto(eingaben)` | Urlaub je Jahr mit genommen, verfallen, Rest, Verfallstag und Befunden zum Verfall |
| `kinderkrankZaehlen(jahr, tage, alleinerziehend)` | Tage je Kind und zusammen mit Befunden |
| `urlaubGenommen(tage)`, `kindKrankTage(tage)` | die Eingaben der Konten aus den Tagen eines Monats |

Jede Funktion gibt einen Fehler als Wert zurück (`ungueltig`, `nicht_hinterlegt`), nie eine
Ausnahme.
