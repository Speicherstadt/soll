---
title: Stempeln
description: >-
  Kommen, Pause und Gehen mit einem Tipp, auch ohne Netz, der laufende Tag mit Soll, Ist und dem
  nächsten Befund, Nachtragen und Ändern mit Grund, und wie jede Änderung für die Person sichtbar
  bleibt.
---

# Stempeln

Unter **Heute** stempelt jede Person, die für den Betrieb arbeitet, ihre Arbeitszeit: am Handy, am
Tablet oder im Browser. Externe und Geräte stempeln hier nicht; das Terminal kommt später.

## Der Knopf

Der große Knopf zeigt immer den nächsten Schritt:

| Zustand | Großer Knopf | Darunter |
| --- | --- | --- |
| nicht eingestempelt | Kommen | – |
| eingestempelt | Pause starten | Gehen |
| in Pause | Pause beenden | Gehen |

Es zählt die Uhr des Servers, nicht die des Geräts: Wer um 7:58 Uhr auf „Kommen“ tippt, ist um 7:58
Uhr eingestempelt, auch wenn das Handy falsch geht. Die Zeit des Geräts speichert Soll daneben, für
das [Stempeln ohne Netz](#ohne-netz).

Soll stempelt **nie selbst aus**. Wer das Gehen vergisst, bleibt eingestempelt; ab Mitternacht (bei
einer Nachtschicht 16 Stunden nach Beginn) zeigt Heute den Hinweis „Gehen fehlt“ mit
§ 3 Abs. 2 Nr. 1 ArbSchG, bis die Zeit nachgetragen ist. Vorher erinnert Soll per Benachrichtigung
oder Mail an das Gehen und an eine fällige Pause, siehe [Erinnerungen](erinnerungen.md). Wie Soll aus den Stempelungen den Tag
bildet, steht unter [Arbeitstag aus Stempelungen](arbeitstag.md).

## Der laufende Tag

Über dem Knopf stehen:

- der **Zustand** mit Uhrzeit („Eingestempelt seit 07:58“, „In Pause seit 12:00“),
- die **gearbeitete Zeit** des Tages, groß, in Stunden und Minuten,
- **Soll**, **Ist** und **Pause**. Das Soll kommt aus dem Arbeitszeitmodell der Person für den
  Wochentag. Ist ihr keins zugeordnet, steht dort „nicht hinterlegt“, nie ein geschätzter Wert.
- der **nächste Befund** mit seiner Norm:

| Was als Nächstes kommt | Beispiel | Norm |
| --- | --- | --- |
| Pause nach 6 Stunden (30 min) oder nach 9 Stunden (45 min), oder nach 6 Stunden am Stück | „Pause fällig in 1:48 · Mindestens 30 Minuten, spätestens ab 13:58“ | § 4 ArbZG |
| 8 Stunden am Tag | „8 Stunden erreicht in 1:30 · Ab 16:30 nur mit Ausgleich an anderen Tagen“ | § 3 ArbZG |
| 10 Stunden am Tag | „10 Stunden erreicht in 0:30 · Nach 18:30 ist Arbeit nicht erlaubt“ | § 3 ArbZG |
| nach dem Gehen: Ende der Ruhezeit | „Ruhezeit bis Sa., 21. Nov., 03:30“ | § 5 Abs. 1 ArbZG |

Gezählt wird, als ginge die Person jetzt: die angefangene Minute zählt mit, nie zu ihrem Nachteil.
Ist eine Grenze schon überschritten, steht der Befund selbst darunter, etwa „Pause fehlt noch
30 min · Verstoß · § 4 Satz 1 ArbZG“. Die Prüfung ist dieselbe wie für den ganzen Tag
([Prüfung nach §§ 3 bis 5 ArbZG](pruefung.md)): Höchstarbeitszeit, Ruhepausen und Ruhezeit. Den
Ausgleichszeitraum über sechs Monate prüft Soll mit dem [Monatsabschluss](monatsabschluss.md), weil
er alle Tage des Zeitraums und die Feiertage am Standort braucht.

## Ohne Netz

Im Keller, auf der Baustelle oder im Funkloch stempelt Soll trotzdem. Jeder Tipp landet zuerst auf
dem Gerät und geht von dort zum Server, sofort, wenn das Netz da ist, sonst später:

- Heute öffnet auch ohne Netz, mit dem Tag, wie er zuletzt geladen war; der Knopf rechnet mit den
  wartenden Stempelungen weiter („Eingestempelt seit 07:58“).
- Tag, Warteschlange und Schlüssel gehören der Person, die angemeldet ist. Teilen sich mehrere einen
  Browser, sieht die nächste nach dem Abmelden nichts davon, auch ohne Netz; wartende Stempelungen
  bleiben auf dem Gerät und gehen hinaus, sobald sich ihre Person dort wieder anmeldet.
- Eine Karte zeigt, wie viele Stempelungen **noch nicht übertragen** sind; in der Liste tragen sie
  die Marke „wartet“ und lassen sich erst ändern, wenn sie beim Server sind.
- Sobald das Netz zurück ist, überträgt Soll sie von selbst, in der Reihenfolge, in der gestempelt
  wurde: beim Öffnen von Heute, wenn der Browser wieder online ist, und alle 30 Sekunden.
- Die Zeit eines Tipps nimmt das Gerät im Moment des Tippens, auch wenn gerade noch eine ältere
  Stempelung über ein langsames Netz unterwegs ist. Kommt die neue Stempelung deshalb erst mehr als
  zehn Sekunden nach dem Tippen an die Reihe, geht sie wie eine Stempelung ohne Netz hinaus, mit der
  Zeit des Geräts, damit die späte Ankunft keine Arbeitszeit verschiebt.
- Beim Server tragen sie die Marke **„offline“**. Es zählt die Zeit des Geräts, verschoben um so
  viel, wie die Uhr des Geräts beim Senden von der des Servers abweicht; ein Handy, das zehn Minuten
  vorgeht, verschiebt also keine Arbeitszeit. Der Server speichert daneben die Zeit des Geräts und
  wann die Stempelung bei ihm ankam.
- Lehnt der Server eine Stempelung ab (etwa weil der Monat schon abgeschlossen ist), bleibt sie unter
  **Nicht angenommen** sichtbar; sie wird nicht noch einmal gesendet und lässt sich mit Grund
  nachtragen.

Soll stempelt auch ohne Netz **nie selbst aus**: In der Warteschlange steht nur, was die Person
getippt hat.

### Nummer und Signatur

Jedes Gerät nummeriert die Stempelungen einer Person fortlaufend (1, 2, 3 …) und signiert jede mit
einem eigenen Schlüssel. Den Schlüssel erzeugt der Browser beim ersten Stempeln so, dass er sich
nicht auslesen oder kopieren lässt (WebCrypto, ECDSA P-256, nicht exportierbar); den öffentlichen
Teil meldet das Gerät beim Server an. Der Server prüft bei jeder Stempelung Signatur, Gerät und
Person:

- eine geänderte Zeit, Art oder Nummer passt nicht mehr zur Signatur und wird abgelehnt;
- ein Gerät einer anderen Person oder eines anderen Betriebs gilt als unbekannt; sendet ein noch
  offener Tab die wartenden Stempelungen der vorigen Person, während auf dem geteilten Browser
  schon jemand anderes angemeldet ist, bleiben sie deshalb wartend und gehen hinaus, sobald sie sich
  dort wieder anmeldet; ein Gerät meldet die App nur unter der Sitzung seiner eigenen Person an;
- kennt der Server ein Gerät nicht mehr (etwa nach dem Zurückspielen einer älteren Sicherung), meldet
  die App es unter der Sitzung seiner Person neu an und sendet die wartenden Stempelungen danach;
- dieselbe Stempelung zweimal (etwa weil die Antwort unterwegs verloren ging) ergibt eine
  Stempelung; eine andere Stempelung unter einer schon vergebenen Nummer lehnt der Server ab;
- auch eine Stempelung mit Netz trägt Nummer und Signatur, damit die Nummern eines Geräts lückenlos
  bleiben.

### Lücke in der Nummer

Fehlt eine Nummer, ist eine Stempelung unterwegs verloren gegangen oder auf dem Gerät gelöscht
worden. Soll zeigt das der Person auf Heute und dem Inhaber, Planer und Lohnbüro unter **Zeiten**
bei der Person, als Hinweis mit § 3 Abs. 2 Nr. 1 ArbSchG:

> Lücke in den Stempelungen eines Geräts
> Gerät 6f1c2a1e: Nr. 2 fehlt

Kommt die fehlende Stempelung später doch noch an, nimmt der Server sie an und die Lücke
verschwindet. Was nach der letzten Nummer fehlt, die beim Server ankam, zeigt sich erst mit der
nächsten Stempelung des Geräts. Wer die Daten des Browsers löscht, löscht auch den Schlüssel; das
Gerät bekommt dann einen neuen und zählt wieder ab 1.

## Nachtragen und Ändern

Unter dem Knopf stehen die Stempelungen des Tages. Jede lässt sich **ändern** (Art, Tag, Uhrzeit)
oder **entfernen**; mit **Nachtragen** kommt eine vergessene dazu. Jede dieser Änderungen braucht
einen **Grund**, ohne Grund speichert Soll nichts.

- Jede Person ändert ihre eigenen Zeiten.
- **Inhaber** und **Planer** ändern die Zeiten aller unter **Zeiten**: Person wählen, Tag wählen,
  ändern. Das **Lohnbüro** sieht die Zeiten aller, ändert sie aber nicht.
- Eine Stempelung kann nicht in der Zukunft liegen. Für die Stunde, die im Oktober zweimal kommt,
  nimmt Soll die erste (Sommerzeit); eine Uhrzeit, die es im März nicht gibt, lehnt es ab.
- Geändert wird bis zum **Monatsabschluss**. Danach ist der Monat gesperrt, eine Korrektur geht nur
  noch als Gegeneintrag ([Monatsabschluss und Prüfwert](monatsabschluss.md)).

### Jede Änderung bleibt sichtbar

Soll überschreibt keine Stempelung. Eine Änderung ist eine neue Zeile, die auf die alte verweist;
die alte bleibt, wie sie war, und beide stehen in der [Audit-Kette](audit-kette.md). Unter
**Änderungen** sieht die Person zu jedem Tag, wer was wann und warum geändert hat:

> Jonas Weber hat Gehen 14:30 auf Gehen 13:30 geändert
> Fr., 20. Nov., 09:01 · Grund: Arzttermin, früher gegangen

Eine Änderung steht an dem Arbeitstag, zu dem die Stempelung gehört: Wird das Gehen einer
Nachtschicht nach Mitternacht entfernt, steht das am Tag, an dem die Schicht begann. Eine korrigierte
Stempelung trägt in der Liste die Marke „korrigiert“.

## Arbeitszeitmodell zuordnen

Der Inhaber ordnet unter **Zeiten** jeder Person ein Arbeitszeitmodell zu; es gilt ab dem Tag der
Zuordnung. Ein Modell, das einer Person zugeordnet ist, lässt sich nicht löschen.

## Für Entwickler

Die Endpunkte liegen unter `/api/v1/arbeitszeit` und sind gesperrt, solange das Modul Arbeitszeit
aus ist:

| Endpunkt | Was | Wer |
| --- | --- | --- |
| `GET /tag?datum=&nutzerId=` | ein Tag: Soll, Stand (`tagesstand`), Stempelungen, Änderungen, Lücken in den Nummern der Geräte der Person; ohne Datum der laufende Tag | selbst, auch wer nicht mehr stempelt (etwa jetzt Extern), solange Stempelungen da sind, nur lesend (Art. 15 DSGVO); andere: Inhaber, Planer, Lohnbüro, auch für wen nicht mehr stempelt oder ausgeschieden ist (§ 16 Abs. 2 ArbZG) |
| `POST /stempelungen` | `{ art, geraetZeitpunkt?, geraet? }`, Zeitpunkt vom Server; `geraet` ist `{ geraetId, nummer, signatur }` und braucht `geraetZeitpunkt` | selbst |
| `POST /stempelungen/offline` | `{ art, geraetZeitpunkt, gesendetAm, geraet }`, ein Eintrag der Warteschlange; 201 neu, 200 derselbe Eintrag noch einmal, 409 `doppelt`, 422 `signatur` oder `zukunft`, 404 `geraet_unbekannt` | selbst |
| `PUT /geraete/:geraetId` | `{ schluessel }` (JWK, P-256), meldet den öffentlichen Schlüssel eines Geräts an; 201 neu, 200 derselbe, 409 `vergeben` | selbst |
| `POST /stempelungen/nachtrag` | `{ nutzerId?, art, zeitpunkt, grund }` | selbst; andere: Inhaber, Planer |
| `PATCH /stempelungen/:id` | `{ art, zeitpunkt, grund }`, hängt eine neue Zeile an | selbst; andere: Inhaber, Planer |
| `POST /stempelungen/:id/entfernen` | `{ grund }`, hängt eine Entfernung an | selbst; andere: Inhaber, Planer |
| `GET /personen` | wer stempelt, mit dem Modell von heute | Inhaber, Planer, Lohnbüro |
| `PUT /personen/:nutzerId/modell` | `{ modellId, gueltigAb? }` | Inhaber |

Die Tabelle `stempelungen` hat `betrieb_id`, die Person, Art, Zeitpunkt (Server) und Zeitpunkt des
Geräts, Quelle, `ersetzt` (die Zeile, die diese ersetzt), `entfernt`, Grund, wer und wann. In Kraft
ist eine Zeile, die keine andere ersetzt und die nichts entfernt. Vor jeder Änderung fragt der
Server `aenderungGesperrt()`, ob sie einen abgeschlossenen Monat der Person ändern würde
([Monatsabschluss](monatsabschluss.md)). Den laufenden Tag
rechnet `tagesstand()` aus `packages/arbeitszeit`, auf dem Server und in der App mit derselben
Funktion; die App zählt mit der Uhr des Servers weiter.

Zum Stempeln ohne Netz trägt eine Zeile das Gerät (`geraet_id`), seine Nummer (`nummer`, eindeutig
je Betrieb und Gerät), die Signatur und `offline`; `erstellt_am` ist der Empfang beim Server. Die
Tabelle `geraete` hält je Betrieb und Gerät die Person und den öffentlichen Schlüssel, in der
Audit-Kette. Signiert wird der Text aus `stempelNachricht()` in `packages/arbeitszeit`, ein
JSON-Array `["soll/stempel/1", geraetId, nummer, art, geraetZeitpunkt]`; die Signatur ist ECDSA mit
SHA-256 in der Form von WebCrypto (r und s, je 32 Bytes, base64url). `nummernLuecken()` und
`offlineZeitpunkt()` liegen daneben. In der App liegen Schlüssel, Warteschlange und der zuletzt
geladene Tag in IndexedDB (`soll-offline`); Web Locks sorgen dafür, dass zwei Tabs keine Nummer
doppelt vergeben. Der Service Worker hält die ganze App offline, nie die API.
