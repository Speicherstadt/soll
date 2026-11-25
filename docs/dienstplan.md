---
title: Dienstplan
description: >-
  Die Woche je Standort planen: Schichtvorlagen, Ziehen und Ablegen mit Maus und Tastatur, Bedarf je
  Rolle und wo er nicht gedeckt ist, Entwürfe bis zur Veröffentlichung mit Benachrichtigung, die
  eigenen Schichten als Kalender, Schichten tauschen und was die Zeitumstellung mit einer
  Nachtschicht macht.
---

# Dienstplan

Mit dem Modul **Dienstplan** plant der Betrieb die Schichten einer Woche, je Standort. Das Modul
schaltet der Inhaber in der Einrichtung („Schichten oder Plan“) oder später unter Einstellungen.
Ist es aus, lehnt der Server jede Anfrage an den Dienstplan ab, nicht nur die App blendet ihn aus;
die geplanten Schichten bleiben erhalten.

## Wer was sieht

| Rolle | Dienstplan |
| --- | --- |
| Inhaber, Planer | planen: Vorlagen, Schichten, Bedarf; sehen den Entwurf; geben einen Tausch frei |
| Mitarbeiter, Lohnbüro, Betriebsrat | sehen nur veröffentlichte Schichten; bieten eigene zum Tausch an und übernehmen angebotene |
| Externe, Geräte | nichts |

Alles, was geplant wird, ist zunächst ein **Entwurf**. Den sehen nur Inhaber und Planer; im Kopf
der Woche steht dann „Entwurf“. Erst das [Veröffentlichen](#veroffentlichen) macht Schichten für die
Beschäftigten sichtbar, in der App und in ihrem Kalender. Wer nicht plant, sieht auch keine
Mitgliederliste, sondern nur die Personen, die in der Woche eine veröffentlichte Schicht haben.

Soll zeigt im Plan keine Summen je Person, etwa geplante Stunden oder Auslastung: Eine Auswertung
je Person gibt es nur, wenn der Betrieb sie eingeschaltet hat (§ 87 Abs. 1 Nr. 6 BetrVG).

## Die Woche

Die Woche läuft von Montag bis Sonntag, im Kopf steht die Kalenderwoche nach ISO 8601 (die Woche mit
dem ersten Donnerstag des Jahres ist KW 1). Am Desktop ist der Plan ein Raster: Personen als Zeilen,
Tage als Spalten, die Schichten als Blöcke mit Uhrzeit, Vorlage und Rolle. Unten steht eine eigene
Zeile **Offen** für Schichten, für die noch niemand eingeplant ist. Hat der Betrieb mehrere
Standorte, wählt der Kopf den Standort; jede Schicht gehört zu genau einem.

Am Handy zeigt der Plan einen Tag zur Zeit: oben die sieben Tage der Woche zum Antippen, darunter,
wer an dem Tag arbeitet.

## Schichtvorlagen

Unter **Vorlagen** legt der Planer Schichten an, die immer wiederkehren, etwa „Früh“ 7:00 bis 15:00
an der Theke oder „Spät“ 14:00 bis 22:00 im Service: Name, Beginn, Ende, Pause in ganzen Minuten und
Rolle. Eine Vorlage lässt sich ändern und entfernen; Schichten, die schon aus ihr geplant sind,
behalten ihre Zeiten.

## Planen, ziehen und ablegen

- **Aus einer Vorlage**: Am Desktop eine Vorlage aus der Leiste über dem Plan auf einen Tag einer
  Person ziehen (oder auf „Offen“).
- **Von Hand**: Das „+“ in einer Zelle öffnet „Schicht hinzufügen“: Vorlage oder eigene Zeiten,
  Tag, Person oder offen, Pause und Rolle.
- **Verschieben mit der Maus**: Den Block auf einen anderen Tag oder eine andere Person ziehen.
- **Verschieben mit der Tastatur**: Den Griff neben dem Block fokussieren, mit Enter aufnehmen, mit
  den Pfeiltasten Person (hoch, runter) und Tag (links, rechts; Pos1 und Ende für Montag und Sonntag)
  wählen, mit Enter ablegen oder mit Escape abbrechen. Ein Screenreader hört dabei jedes Ziel.
- **Ändern und entfernen**: Ein Klick auf den Block öffnet die Schicht; dort lassen sich alle
  Angaben ändern, auch Tag und Person, und die Schicht entfernen.

Beim Verschieben bleibt die Uhrzeit, nicht die Dauer: Eine Schicht von 22:00 bis 6:00 bleibt 22:00
bis 6:00, auch wenn sie in die Nacht der Zeitumstellung rückt.

## Bedarf je Rolle und Standort

Unter **Bedarf** legt der Planer fest, wie viele Personen einer Rolle an einem Wochentag von wann bis
wann am Standort gebraucht werden, etwa „Montag 14:00 bis 22:00, Service, 2“. Der Bedarf gilt jede
Woche. Unter dem Plan steht, für jeden Tag der Woche, ob er gedeckt ist:

- Gezählt werden die eingeplanten Schichten derselben Rolle am selben Standort. Maßgeblich ist der
  Moment mit den wenigsten Personen: Zwei Schichten nacheinander (7:00 bis 15:00 und 14:00 bis
  22:00) decken einen Bedarf von 10:00 bis 22:00 einmal; eine Lücke dazwischen lässt ihn ungedeckt.
  Wer zur selben Zeit zweimal eingeplant ist, zählt als eine Person.
- Eine Nachtschicht vom Vortag zählt mit, soweit sie in den Bedarf reicht; ebenso zählt für einen
  Bedarf am Sonntag über Mitternacht eine Schicht vom Montag der nächsten Woche.
- Offene Schichten decken nichts, sie werden aber daneben genannt.
- „fehlt 1“ steht als Wort neben der Farbe, nie nur als Farbe.

Die Rolle ist ein kurzer Text wie „Service“ oder „Küche“ und muss in Bedarf und Schicht gleich
geschrieben sein; die App schlägt die Rollen der Vorlagen vor.

## Zeit, Mitternacht und Zeitumstellung

- Eine Schicht speichert Beginn und Ende als Zeitpunkte (UTC-Millisekunden) und den Tag, an dem sie
  beginnt. Dieser Tag ist ihr **Arbeitstag**, auch wenn sie über Mitternacht geht; ein Ende vor dem
  Beginn liegt am nächsten Tag.
- Beginn und Ende werden auf der Uhr in Berlin eingegeben. Eine Nachtschicht von 22:00 bis 6:00 hat
  in der Nacht auf den letzten Sonntag im März 7 Stunden, in der Nacht auf den letzten Sonntag im
  Oktober 9 Stunden.
- Eine Uhrzeit, die es wegen der Zeitumstellung nicht gibt (2:30 am letzten Sonntag im März), lehnt
  der Server ab. Von der doppelten Stunde im Oktober gilt die erste, in Sommerzeit.
- Eine Pause, die so lang ist wie die Schicht, lehnt der Server ab, auch in einer Vorlage; Minuten
  nur ganz.

## Veröffentlichen

„Veröffentlichen“ im Kopf der Woche (nur Inhaber und Planer, nur solange die Woche einen Entwurf
hat) gibt alle Entwürfe der gezeigten Woche am gezeigten Standort frei, in einem Schritt. Entwürfe
anderer Wochen und Standorte bleiben Entwurf. Danach steht unter dem Kopf, wie viele Schichten
veröffentlicht und wie viele Personen benachrichtigt wurden.

- **Benachrichtigung**: Jede Person mit einer neu veröffentlichten Schicht bekommt eine Nachricht,
  einmal je Veröffentlichung: per Web Push auf jedes Gerät, auf dem sie Erinnerungen eingeschaltet
  hat, in der Sprache der App dort; hat sie kein Gerät, per Mail (auf Deutsch, mit Link auf die
  Woche), wenn der Betrieb Mail eingerichtet hat, ihre Adresse Mail empfängt und sie Mail in den
  [Erinnerungen](erinnerungen.md) nicht ausgeschaltet hat. Wer veröffentlicht, bekommt keine
  Nachricht; offene Schichten melden niemandem etwas.
- **Später ändern**: Eine veröffentlichte Schicht bleibt veröffentlicht, auch wenn sie sich ändert;
  die Änderung sehen die Beschäftigten sofort. Die Person bekommt „Schicht geändert“, wird sie einer
  anderen Person gegeben, bekommt die bisherige „Schicht entfällt“ und die neue „Neue Schicht“; eine
  entfernte veröffentlichte Schicht meldet „Schicht entfällt“. Eine Änderung an einem Entwurf meldet
  niemandem etwas, ebenso eine Änderung, die nichts ändert.
- **Mitteilung nach § 12 TzBfG**: Der Zeitpunkt der Veröffentlichung steht an der Schicht. Bei
  Arbeit auf Abruf ist er die Mitteilung, und jede spätere Änderung einer veröffentlichten Schicht
  ist eine neue Mitteilung (siehe [Arbeit auf Abruf](#prufung-beim-einplanen)).

## Schichten im eigenen Kalender

Jeder, der den Plan liest, kann seine veröffentlichten Schichten in seiner Kalender-App sehen
(Apple Kalender, Google Kalender, Outlook, Thunderbird): **Kalender** im Kopf des Plans, dann **Link
erstellen**. Der Link erscheint nur dieses eine Mal; „In Kalender-App öffnen“ legt das Abo an, oder
man kopiert ihn und fügt ihn in der Kalender-App als Kalender-Abo per URL ein.

- **Geheim**: Der Link enthält ein zufälliges Token aus 32 Bytes. Soll speichert davon nur den
  SHA-256, wie bei den [Zugängen zur API](api.md); wer die Datenbank liest, kann den Link nicht
  wiederherstellen. Wer den Link kennt, sieht die Schichten, also nicht weitergeben.
- **Neu und widerrufen**: „Neuer Link“ ersetzt den alten, der sofort nichts mehr zeigt;
  „Link widerrufen“ beendet das Abo. Je Person und Betrieb gibt es einen Link. Ein Link entsteht
  nur in der App mit Anmeldung, nicht über ein API-Token.
- **Was drin steht**: nur die eigenen veröffentlichten Schichten ab sechs Wochen vor heute, an allen
  Standorten des Betriebs, mit Rolle, Standort und Pause; keine Entwürfe, keine Kollegen, keine
  offenen Schichten und keine Abwesenheiten (Urlaub oder Krankheit gehören nicht in den Kalender
  eines fremden Anbieters, Art. 9 DSGVO). Eine entfernte Schicht verschwindet beim nächsten Abruf.
  Die Wörter stehen in der Sprache, die die App beim Erstellen des Links hatte.
- **Gesperrt**: Ist das Modul Dienstplan aus, antwortet der Link mit 403; ist die Person nicht mehr
  Mitglied des Betriebs, mit 404. Das Token steht nie im Log.
- **Format**: iCalendar nach [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545): jede Zeile endet
  mit CRLF und wird nach 75 Bytes gefaltet, ohne ein Zeichen zu teilen; Text wird maskiert; alle
  Zeiten in UTC (`20261123T130000Z`), so behält eine Nachtschicht in der Nacht der Zeitumstellung
  ihre echte Länge von 7 oder 9 Stunden und die Kalender-App zeigt sie in ihrer Zeitzone. Die `UID`
  ist die Kennung der Schicht und bleibt; `CREATED`, `LAST-MODIFIED`, `DTSTAMP` und `SEQUENCE`
  kommen aus der [Audit-Kette](audit-kette.md) (erster und letzter Eintrag der Schicht, Zahl der
  Änderungen). Kalender-Apps fragen etwa stündlich nach (`REFRESH-INTERVAL`).

## Schichten tauschen

Wer eine veröffentlichte Schicht hat und nicht kann, bietet sie unter **Schichttausch** unter dem
Plan an; eine Kollegin übernimmt sie, und Inhaber oder Planer geben den Tausch frei.

- **Anbieten**: „Schicht anbieten“ zeigt die eigenen veröffentlichten Schichten, die noch nicht
  begonnen haben. Angeboten wird an alle, die sie übernehmen können (wer im Betrieb stempelt und den
  Plan liest), oder an eine Kollegin mit Namen; dann sehen das Angebot nur die beiden und wer plant.
  Je Schicht gibt es ein offenes Angebot. Einen Grund fragt Soll nicht ab: Niemand muss sagen,
  warum er nicht kann, und ein Grund lüde dazu ein, von Krankheit zu schreiben (Art. 9 DSGVO).
- **Übernehmen**: Wem das Angebot gilt, tippt „Übernehmen“. Wer zur selben Zeit schon eine
  Schicht hat, kann nicht übernehmen. Bis zur Freigabe bleibt die Schicht bei der bisherigen Person,
  in der App und in ihrem Kalender.
- **Freigeben oder ablehnen**: Inhaber und Planer sehen jede übernommene Schicht mit der
  [Prüfung](#prufung-beim-einplanen) für die Person, die sie übernimmt, als hätte sie die Schicht
  schon: Ruhezeit und Höchstarbeitszeit nach dem Arbeitszeitgesetz, Jugendarbeitsschutz,
  Mutterschutz und die übrigen Regeln des Plans, mit Norm. Ein Befund warnt, er sperrt nicht. Die
  Befunde sehen nur, wer freigibt, nie die beiden Kollegen. „Freigeben“ gibt die Schicht der neuen
  Person, in einem Schritt mit dem Tausch in der [Audit-Kette](audit-kette.md); „Ablehnen“ verlangt
  einen Grund, den beide lesen.
- **Ohne Freigabe**: Der Inhaber kann einstellen, dass eine Übernahme sofort gilt. Das gilt nur,
  solange die Prüfung für die übernehmende Person keinen Verstoß findet und sie zur selben Zeit
  keinen Entwurf hat; sonst wartet auch dann der Tausch auf die Freigabe, und wer plant, sieht den
  Grund.
- **Zurückziehen, Ablauf, Änderung**: Wer anbietet, zieht das Angebot zurück, solange es nicht
  entschieden ist. Ein Angebot läuft ab, wenn die Schicht beginnt, und verschwindet aus der Liste.
  Ändert oder entfernt der Planer die Schicht, ist ein offenes Angebot hinfällig: Wer übernommen
  hat, hat der Schicht zugestimmt, wie sie war.
- **Mitteilung nach § 12 TzBfG**: Die Freigabe ist eine Änderung der veröffentlichten Schicht und
  damit eine neue Mitteilung (wie unter [Veröffentlichen](#veroffentlichen)); vor der Freigabe prüft
  Soll mit dem heutigen Tag.
- **Benachrichtigung**: Über dieselben Wege wie beim Veröffentlichen (Web Push, ohne Gerät Mail):
  ein Angebot an alle, denen es gilt, eine Übernahme an die anbietende Person und an alle, die
  freigeben, Freigabe und Ablehnung an beide, ein Zurückziehen an die Person, die übernommen hatte;
  nie an den, der den Schritt tut. Die Nachricht nennt nur Tag und Uhrzeit der Schicht, keinen
  Namen und keinen Grund, und ersetzt auf dem Gerät die vorige Nachricht zu derselben Schicht.
- **Kalender**: Nach der Freigabe verschwindet die Schicht aus dem Kalender der bisherigen Person
  und steht im Kalender der neuen, mit höherer `SEQUENCE`.
- **Auskunft**: Die [Auskunft](pruefexport.md#auskunft-nach-art-15-dsgvo) nennt jeden Tausch, den jemand angeboten, an ihn
  gerichtet bekommen oder übernommen hat, ohne die andere Person und ohne den, der entschied; auch
  in der Audit-Kette steht bei einem Tausch, was jemand anderes schrieb, nur als „eine andere
  Person“, auch der Wechsel der Person an der Schicht selbst.

## Prüfung beim Einplanen

Soll prüft jede geplante Schicht mit denselben Regeln wie gestempelte Zeiten
([Regelwerk](regeln.md)), sobald sie im Plan steht: nach dem Arbeitszeitgesetz (R-02 bis R-09), dem
Mindestlohn (R-14), dem Jugendarbeitsschutz (R-15 bis R-20), dem Mutterschutz (R-21), § 12 TzBfG für
Arbeit auf Abruf (R-22) und der Minijob-Grenze (R-32). Nicht im Plan geprüft werden die Regeln, die
nur Stempelungen betreffen (R-01, R-10, R-13), und Bereitschaft (R-11, R-12), die mit S-505 in den
Plan kommt.

- **Plan und Ist**: Tage vor heute kommen aus den Stempelungen, heute und später aus dem Plan.
  Geprüft wird, als wäre der Plan bis zum Ende seines letzten Tages gearbeitet; so zählt die
  Ruhezeit nach der gestrigen Spätschicht ebenso wie der Durchschnitt des Ausgleichszeitraums bis
  zum letzten geplanten Tag. Ein Befund steht an den geplanten Schichten der Tage, die er nennt; hat
  jemand an einem vergangenen Sonntag gearbeitet und lässt der Plan in dessen Zeitraum keinen freien
  Werktag mehr (Ersatzruhetag, R-09), steht er an den geplanten Schichten dieses Zeitraums. Schichten an anderen Standorten zählen als Arbeitszeit mit, die
  Feiertage kommen vom Standort der gezeigten Woche.
- **Pause**: Der Plan nennt die Länge der Pause, nicht ihre Lage. Soll legt sie in die Mitte der
  Arbeitszeit, die günstigste Lage: Gemeldet wird „über 6 h ohne Pause“ nur, wenn es keine Lage gibt,
  die das vermeidet. Eine Pause unter 15 Minuten ist Arbeitszeit (§ 4 Satz 2 ArbZG).
- **Geteilter Dienst**: Zwei Schichten einer Person mit weniger als 9 h Abstand sind eine Schicht
  ihres ersten Tages (wie beim Stempeln), die Lücke ist eine Ruhepause.
- **Warnen, nicht sperren**: Ein Befund verhindert das Speichern nicht. Er färbt den Rand des Blocks
  (Verstoß rot, Hinweis gelb), zeigt ein Icon mit dem Text im Tooltip und steht in **Hinweise zum
  Plan** unter dem Plan, mit Schwere, Person, Tag und Norm. Am Handy steht der Text im Eintrag des
  Tages.
- **Wer sie sieht**: Befunde sehen nur Inhaber und Planer, nie die Kollegen; ein Befund zum
  Mutterschutz verrät sonst eine Schwangerschaft.
- **Arbeit auf Abruf**: Mitgeteilt ist eine Schicht mit ihrer Veröffentlichung (S-503); ein Entwurf
  frühestens heute. Liegen zwischen dem Tag der Mitteilung und dem Tag der Schicht keine vier vollen
  Tage, ist das ein Hinweis: Die Person muss dann nicht kommen.

### Angaben zur Prüfung

Was eine Regel von einer Person braucht, trägt der Inhaber im Plan unter **Angaben zur Prüfung**
ein, und nur das: das Geburtsdatum (Jugendliche), Nachtarbeit in Wechselschicht (§ 2 Abs. 5 ArbZG),
Arbeit auf Abruf (§ 12 TzBfG) und den Zeitraum des Mutterschutzes, ohne zu sagen, ob die Frau
schwanger ist oder stillt. Der Planer sieht die Angaben nicht, nur die Befunde. Lohn und vertragliche
Wochenarbeitszeit kommen aus dem Arbeitszeitmodell. Was nicht eingetragen ist, erlaubt nichts:
Schutzfristen, Erklärungen und die Genehmigung nach § 28 MuSchG gelten als nicht gegeben.

### Einstellungen zur Prüfung

Unter **Einstellungen → Prüfung** legt der Inhaber fest, was das Gesetz dem Betrieb erlaubt. Ohne
Eintrag gilt die strenge Vorgabe des Gesetzes.

| Einstellung | Vorgabe | Wirkung |
| --- | --- | --- |
| Branche (§ 5 Abs. 2 ArbZG) | keine | in Krankenhaus und Pflege, Gastronomie und Beherbergung, Verkehr, Rundfunk, Landwirtschaft und Tierhaltung Ruhezeit 10 statt 11 Stunden mit Ausgleich |
| Ausnahme für Sonn- und Feiertage (§ 10 Abs. 1 ArbZG) | keine | mit einer Nummer, etwa Nr. 4 für Gaststätten, ist Arbeit am Sonntag erlaubt; die freien Sonntage und der Ersatzruhetag werden weiter geprüft |
| Ausgleichszeitraum (§ 3 ArbZG) | keine Wahl: beide | sechs Kalendermonate oder 24 Wochen |
| Beginn des Ausgleichszeitraums | 1. Januar 2026 | der erste Tag der Zeiträume |

Ein Link kann eine Woche öffnen: `/dienstplan?tag=JJJJ-MM-TT`.

## Schnittstelle

Alle Pfade unter `/api/v1/dienstplan`, nur bei eingeschaltetem Modul; jeder Aufruf gilt dem Betrieb
der Sitzung, eine `betriebId` im Inhalt lehnt der Server ab.

| Methode und Pfad | Wer | Was |
| --- | --- | --- |
| `GET /woche?standortId=…&tag=JJJJ-MM-TT` | alle, die planen oder lesen | die Woche um den Tag; für Planer mit Entwurf, Personen, Deckung (`deckung`) und Befunden (`befunde`: Regel, Norm, Schwere, Art, Tage, Person, `schichtIds`), sonst nur Veröffentlichtes, `deckung: null` und `befunde: null` |
| `GET`, `POST /vorlagen`; `PUT`, `DELETE /vorlagen/:id` | Inhaber, Planer | Schichtvorlagen |
| `GET /bedarf?standortId=…`, `POST /bedarf`, `DELETE /bedarf/:id` | Inhaber, Planer | Bedarf je Rolle und Wochentag (1 Montag bis 7 Sonntag) |
| `POST /schichten`, `PATCH`, `DELETE /schichten/:id` | Inhaber, Planer | Schichten: `standortId`, `tag`, `beginnMinute`, `endeMinute`, `pauseMinuten`, `rolle`, `nutzerId` (oder `null` für offen), beim Anlegen `vorlageId`; eine Änderung einer veröffentlichten Schicht benachrichtigt die betroffenen Personen |
| `POST /veroeffentlichen` | Inhaber, Planer | `standortId`, `tag`: veröffentlicht die Entwürfe der Woche um den Tag; Antwort `anzahl` (Schichten) und `benachrichtigt` (Personen) |
| `GET`, `POST`, `DELETE /kalender` | alle, die den Plan lesen; `POST` und `DELETE` nur mit Sitzung | der eigene Kalender-Link: `GET` sagt, ob es ihn gibt (`abo` mit `angelegtAm`, `sprache`), `POST` mit `sprache` stellt ihn (neu) aus und antwortet einmal mit `url`, `DELETE` widerruft ihn |
| `GET /tausch` | alle, die den Plan lesen | die Tausche der Schichten, die noch nicht begonnen haben (`tausche`: Status, Schicht, `anbieter`, `an`, `uebernehmer`, `grund`; `befunde` für die übernehmende Person nur für Inhaber und Planer, sonst `null`), die eigenen Schichten, die sich anbieten lassen (`anbietbar`), die Kollegen, die übernehmen können, nur mit Namen (`kollegen`), und `ohneFreigabe`; wer nicht plant, sieht nur eigene Tausche und Angebote, die ihm gelten |
| `POST /tausch` | alle, die den Plan lesen | `schichtId`, `anNutzerId` (oder `null` für alle): bietet eine eigene veröffentlichte Schicht an |
| `POST /tausch/:id/uebernehmen` | wem das Angebot gilt | übernimmt; ohne Freigabe und ohne Verstoß gleich `freigegeben`, sonst `uebernommen` |
| `POST /tausch/:id/freigeben`, `POST /tausch/:id/ablehnen` | Inhaber, Planer | gibt einen übernommenen Tausch frei; lehnt einen offenen mit `grund` ab |
| `DELETE /tausch/:id` | wer angeboten hat | zieht ein Angebot zurück, solange es nicht entschieden ist |
| `PUT /tausch/regel` | Inhaber | `ohneFreigabe`: ob eine Übernahme ohne Freigabe gilt |

Ein Standort, eine Person oder eine Vorlage eines anderen Betriebs ergibt 404
(`standort_unbekannt`, `person_unbekannt`, `vorlage_unbekannt`), eine Uhrzeit, die es nicht gibt,
422 `zeit_gibt_es_nicht`. Beim Tausch ergibt eine Schicht, die nicht veröffentlicht ist oder einem
anderen Betrieb gehört, und ein Angebot an jemand anderen 404 (`unbekannt`), eine fremde Schicht
403 (`nicht_deine`), das eigene Angebot 403 (`nicht_fuer_dich`), eine begonnene Schicht 409
(`abgelaufen`), ein zweites Angebot 409 (`schon_angeboten`), ein entschiedener oder hinfälliger
Tausch 409 (`nicht_offen`, `hinfaellig`) und eine Schicht zur selben Zeit 409 (`ueberschneidung`).

Der Kalender selbst liegt außerhalb der Anmeldung, denn eine Kalender-App hat keine Sitzung:
`GET /api/v1/ics/<token>.ics` antwortet mit `text/calendar`; das Token ist der einzige Schlüssel.

Außerhalb des Moduls, weil auch die Zeiterfassung sie braucht:

| Methode und Pfad | Wer | Was |
| --- | --- | --- |
| `GET`, `PUT /api/v1/betrieb/pruefung` | lesen alle Beschäftigten, ändern der Inhaber | `branche`, `sonntagsausnahme` (1 bis 16), `ausgleichszeitraum` (`sechs_monate`, `24_wochen`), `ausgleichBeginn`; `null` ist die Vorgabe des Gesetzes |
| `GET`, `PUT /api/v1/personen/:id/angaben` | Inhaber | `geburtsdatum`, `wechselschicht`, `abruf`, `mutterschutz` (Liste von `{ von, bis }`, `bis` leer, solange er läuft); eine Person eines anderen Betriebs ergibt 404 |
 Ein Standort mit Schichten oder Bedarf lässt sich nicht entfernen (409
`verplant`). Jede Änderung steht in der [Audit-Kette](audit-kette.md).
