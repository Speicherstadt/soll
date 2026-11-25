---
title: Terminal
description: >-
  Ein Tablet am Eingang wird zum Terminal: koppeln mit einem Code, stempeln mit PIN, QR-Code oder
  NFC-Karte, Sperre nach falschen Versuchen, Wake Lock und Neuladen von selbst.
---

# Terminal

Ein Tablet im Querformat (1280 × 800) am Eingang wird zum Terminal. Wer dort stempelt, braucht kein
eigenes Handy und keine Anmeldung: Die PIN, ein QR-Code oder eine NFC-Karte erkennt die Person, ein
Tipp stempelt.
Das Terminal ist ein Modul; der Inhaber schaltet es unter Einstellungen ein. Ist es aus, lehnt der
Server jeden Aufruf des Terminals ab.

## Koppeln

1. Unter **Einstellungen → Terminal** gibt der Inhaber dem Terminal einen Namen (etwa „Eingang“)
   und erzeugt einen Code aus acht Zeichen, etwa `K7QM-4WZD`.
2. Auf dem Tablet öffnet er `/terminal` der eigenen Instanz und gibt den Code ein.

Der Code gilt **10 Minuten und einmal**; die Zeichen 0, O, 1 und I kommen nicht vor, Groß- und
Kleinschreibung und der Strich zählen nicht. Das Tablet tauscht ihn gegen ein Geräte-Token und
behält es im Browser. Soll speichert Code und Token nur als Hash. Mit dem Token darf das Tablet
Personen erkennen und für sie stempeln, sonst nichts: keine Zeiten lesen, keine Mitglieder, keine
Einstellungen.

Unter Einstellungen steht jedes Terminal mit seinem Stand. **Entkoppeln** sperrt es sofort; das
Tablet zeigt beim nächsten Aufruf wieder die Kopplung.

## PIN und QR-Code

Die Tabelle **PIN und QR-Code** unter Einstellungen zeigt alle, die stempeln.

- **PIN**: 6 bis 8 Ziffern, gesetzt vom Inhaber. Am Terminal erkennt die PIN die Person allein,
  deshalb gibt es jede PIN im Betrieb nur einmal; eine schon vergebene lehnt Soll ab. Gespeichert
  wird sie nur als Hash, nie im Klartext.
- **QR-Code**: ein Zufallswert, den der Inhaber ausstellt und gleich ausdruckt. Soll speichert nur
  seinen Hash und zeigt ihn nicht noch einmal; für eine verlorene Karte stellt der Inhaber einen
  neuen aus, der den alten ungültig macht, oder er entzieht ihn.

Am Terminal hält die Person ihren QR-Code vor die Frontkamera. Das Bild bleibt auf dem Tablet und
wird weder gespeichert noch gesendet; weiter geht nur der gelesene Text, und die Kamera geht aus,
sobald er gelesen ist. Fotos, Fingerabdrücke oder Standorte nimmt Soll beim Stempeln nie. Ein
Browser ohne `BarcodeDetector` zeigt nur das Ziffernfeld.

## NFC-Karten

Unter **Einstellungen → NFC-Karten** trägt der Inhaber mit **Karte eintragen** eine Karte für eine
Person ein. Es gibt zwei Arten:

- **Einfache Karte** (etwa MIFARE Classic, NTAG 213/215/216 oder ein Mitarbeiterausweis): Soll kennt
  nur ihre UID, die Seriennummer des Chips. Eine UID lässt sich mit jedem Handy auslesen und auf eine
  andere Karte kopieren, deshalb erkennt eine einfache Karte die Person **nur zusammen mit ihrer
  PIN**: Karte auflegen, dann die PIN der Person eingeben. Die PIN einer anderen Person zur Karte ist
  ein falscher Versuch. Die Karte allein lehnt der Server ab, auch wenn ein Gerät sie ohne PIN
  schickt.
- **NTAG 424 DNA**: Diese Karte erzeugt bei jedem Lesen eine neue, signierte Nachricht (SUN, „Secure
  Unique NFC“) in ihrer Adresse, etwa `https://…?e=…&c=…`. Soll prüft sie mit den Schlüsseln der
  Karte und erkennt die Person **allein**, ohne PIN. Der Inhaber gibt dafür UID, SDMMetaReadKey und
  SDMFileReadKey ein, mit denen die Karte eingerichtet wurde.

Die UID speichert Soll nur als Kennung mit einem geheimen Schlüssel (wie die PIN), die beiden
Schlüssel einer NTAG 424 DNA nur verschlüsselt; die Liste zeigt Name, Art und Datum, nie UID oder
Schlüssel. Jede UID gibt es unter den Karten in Gebrauch im Betrieb einmal. Schlüssel aus lauter Nullen, der Zustand ab Werk,
lehnt Soll ab: Sie kennt jeder.

**Entziehen** sperrt eine Karte sofort und löscht ihre Schlüssel. Wird dieselbe Karte später wieder
eingetragen, ist sie eine neue Karte der neuen Person: Die entzogene bleibt mit ihrem Verlauf bei der
Person, die sie vorher hatte, auch in deren Auskunft. Der Lesezähler bleibt: Eine Nachricht, die die
Karte vorher erzeugt hat, gilt auch danach nicht.

### Die SUN-Nachricht prüfen

Soll unterstützt die Einrichtung aus dem Beispiel in NXP AN12196, Abschnitt 3.4: Die Karte spiegelt
die verschlüsselten PICCData (`e`, 16 Bytes, auch `picc_data`) und den CMAC (`c`, 8 Bytes, auch
`cmac`) in die URL, der CMAC läuft über eine leere Eingabe, ohne verschlüsselte Dateidaten. Soll

1. entschlüsselt die PICCData mit dem SDMMetaReadKey (AES-128-CBC, IV aus Nullen) und erwartet das
   Kennzeichen `C7`: UID aus 7 Bytes und Lesezähler gespiegelt;
2. leitet aus dem SDMFileReadKey den Sitzungsschlüssel ab (AES-CMAC über `3C C3 00 01 00 80`, UID
   und Lesezähler) und prüft damit den CMAC;
3. lehnt einen Lesezähler ab, der nicht größer ist als der zuletzt gesehene: So zählt jede
   Nachricht nur einmal, auch wenn jemand sie mit dem Handy von der Karte abliest und später
   abspielt.

Die Nachricht sagt nicht, von welcher Karte sie stammt; Soll versucht die Schlüssel jeder NTAG 424
DNA des Betriebs. Eine Karte im Modus „Random ID“ geht deshalb auch; ihre echte UID kommt dann aus
der Einrichtung der Karte, denn das Handy liest nur die zufällige. Nach dem Erkennen gibt der
Server dem Terminal einen Beleg, der 20 Sekunden und nur an diesem Terminal gilt: Mit ihm stempelt
der Tipp auf Kommen, Pause oder Gehen, denn die Nachricht selbst ist dann schon verbraucht.

Eine unbekannte Karte, eine falsche PIN zur Karte und eine gefälschte oder wiederholte Nachricht
zählen wie eine falsche PIN zur [Sperre](#sperre) und stehen in der Audit-Kette; das Terminal sagt in
allen Fällen dasselbe, damit niemand am Tablet erfährt, was an seiner Karte nicht stimmte.

### Web NFC

Das Terminal liest Karten mit Web NFC (`NDEFReader`). Das kann heute nur Chrome auf Android, über
HTTPS und solange die Seite sichtbar ist. Beim ersten Mal fragt Chrome nach der Erlaubnis und will
dafür einen Tipp: Dann zeigt das Terminal **Karten lesen einschalten**. Ein Browser ohne Web NFC
bleibt bei PIN und QR-Code. Liest das Tablet Karten, steht links „Karte auflegen oder PIN
eingeben“.

## Stempeln

Nach dem Erkennen sieht die Person ihren Namen, ihren Zustand, Soll und Ist des Tages, den nächsten
Befund mit Norm und dieselben Knöpfe wie unter [Heute](stempeln.md): Kommen, oder Pause starten
beziehungsweise Pause beenden und Gehen. Ohne Tipp geht das Terminal nach 15 Sekunden zurück zur
Uhr, nach dem Stempeln nach 5 Sekunden. Es zählt die Uhr des Servers. Die Stempelung gehört der
Person, trägt die Quelle „Terminal“ und das Terminal und steht in der
[Audit-Kette](audit-kette.md); die Person sieht sie unter Heute und Zeiten wie jede andere.

## Sperre

Falsche PINs, QR-Codes und Karten zählt das Terminal je Kalendertag. Nach je **fünf falschen** wartet es
eine Minute, dann zwei, dann vier; nach dem **zwanzigsten falschen Versuch** eines Tages bleibt es bis
Mitternacht gesperrt. Eine erkannte Person hebt nichts davon auf, sonst könnte jemand am Tablet
zwischen zwei Rateversuchen die eigene PIN tippen. So prüft ein Terminal höchstens 20 falsche PINs am
Tag. Jeder Versuch steht in der Audit-Kette, und der Inhaber sieht unter Einstellungen, bis wann ein
Terminal gesperrt ist, und hebt die Sperre dort mit **Entsperren** auf; auch das steht in der
Audit-Kette. Die Zählung des Tages bleibt dabei: Nach fünf weiteren falschen Versuchen ist das
Terminal wieder bis Mitternacht gesperrt, Entsperren schenkt also keinen neuen Tag zum Raten. Ein
gesperrtes Terminal fragt alle 15 Sekunden beim Server nach, ob es entsperrt oder entkoppelt wurde.

## Wach und von selbst gesund

- **Wake Lock**: Das Terminal hält den Bildschirm an, solange die Seite offen ist.
- **Neuladen**: Nach einem Fehler sagt das Terminal, dass es neu startet, und lädt nach fünf
  Sekunden neu. Fällt das Netz aus, zeigt es das; kommt das Netz zurück, lädt es sofort neu.

Stempeln ohne Netz am Terminal kommt mit S-803.

## Für Entwickler

| Aufruf | Wer | Was |
| --- | --- | --- |
| `GET /api/v1/terminal/geraete` | Inhaber | Terminals mit Stand |
| `POST /api/v1/terminal/geraete` | Inhaber | neues Terminal mit Kopplungscode (`{ name }`) |
| `DELETE /api/v1/terminal/geraete/:id` | Inhaber | Terminal widerrufen |
| `POST /api/v1/terminal/geraete/:id/entsperren` | Inhaber | Sperre aufheben; die Zählung des Tages bleibt |
| `GET /api/v1/terminal/personen` | Inhaber | wer stempelt, mit PIN und QR-Code ja oder nein |
| `POST`, `DELETE /api/v1/terminal/ausweise/:nutzerId` | Inhaber | QR-Code ausstellen oder entziehen |
| `PUT /api/v1/terminal/pins/:nutzerId` | Inhaber | PIN setzen (409 `pin_vergeben`) |
| `GET /api/v1/terminal/karten` | Inhaber | Karten mit Person, Art und Datum, ohne UID und Schlüssel |
| `POST /api/v1/terminal/karten` | Inhaber | Karte eintragen: `{ nutzerId, art: "uid", uid }` oder `{ nutzerId, art: "ntag424", uid, meta, datei }` (409 `karte_vergeben`) |
| `DELETE /api/v1/terminal/karten/:karteId` | Inhaber | Karte entziehen |
| `POST /api/v1/kiosk/koppeln` | Tablet | Code gegen Geräte-Token (`{ code }`) |
| `GET /api/v1/kiosk` | Tablet mit Token | Name, Betrieb, Sperre |
| `POST /api/v1/kiosk/erkennen` | Tablet mit Token | `{ pin }`, `{ qr }`, `{ karte, pin }`, `{ sun: { e, c } }` oder `{ beleg }`: Person und Tag, nach `sun` mit `beleg`; 401 mit den übrigen Versuchen, 423 mit dem Ende der Sperre |
| `POST /api/v1/kiosk/stempeln` | Tablet mit Token | `{ ausweis, art }`: erkennt und stempelt |
