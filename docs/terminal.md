---
title: Terminal
description: >-
  Ein Tablet am Eingang wird zum Terminal: koppeln mit einem Code, stempeln mit PIN oder QR-Code,
  Sperre nach falschen Versuchen, Wake Lock und Neuladen von selbst.
---

# Terminal

Ein Tablet im Querformat (1280 × 800) am Eingang wird zum Terminal. Wer dort stempelt, braucht kein
eigenes Handy und keine Anmeldung: Die PIN oder ein QR-Code erkennt die Person, ein Tipp stempelt.
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

- **PIN**: 4 bis 8 Ziffern, gesetzt vom Inhaber. Am Terminal erkennt die PIN die Person allein,
  deshalb gibt es jede PIN im Betrieb nur einmal; eine schon vergebene lehnt Soll ab. Gespeichert
  wird sie nur als Hash, nie im Klartext.
- **QR-Code**: ein Zufallswert, den der Inhaber ausstellt und gleich ausdruckt. Soll speichert nur
  seinen Hash und zeigt ihn nicht noch einmal; für eine verlorene Karte stellt der Inhaber einen
  neuen aus, der den alten ungültig macht, oder er entzieht ihn.

Am Terminal hält die Person ihren QR-Code vor die Frontkamera. Das Bild bleibt auf dem Tablet und
wird weder gespeichert noch gesendet; weiter geht nur der gelesene Text, und die Kamera geht aus,
sobald er gelesen ist. Fotos, Fingerabdrücke oder Standorte nimmt Soll beim Stempeln nie. Ein
Browser ohne `BarcodeDetector` zeigt nur das Ziffernfeld.

## Stempeln

Nach dem Erkennen sieht die Person ihren Namen, ihren Zustand, Soll und Ist des Tages, den nächsten
Befund mit Norm und dieselben Knöpfe wie unter [Heute](stempeln.md): Kommen, oder Pause starten
beziehungsweise Pause beenden und Gehen. Ohne Tipp geht das Terminal nach 15 Sekunden zurück zur
Uhr, nach dem Stempeln nach 5 Sekunden. Es zählt die Uhr des Servers. Die Stempelung gehört der
Person, trägt die Quelle „Terminal“ und das Terminal und steht in der
[Audit-Kette](audit-kette.md); die Person sieht sie unter Heute und Zeiten wie jede andere.

## Sperre

Nach **fünf falschen** PINs oder QR-Codes in Folge wartet das Terminal eine Minute, jede weitere
Sperre doppelt so lang, höchstens 15 Minuten. Eine erkannte Person setzt die Zählung zurück. Jeder
Versuch steht in der Audit-Kette, und der Inhaber sieht unter Einstellungen, bis wann ein Terminal
gesperrt ist.

## Wach und von selbst gesund

- **Wake Lock**: Das Terminal hält den Bildschirm an, solange die Seite offen ist.
- **Neuladen**: Nach einem Fehler sagt das Terminal, dass es neu startet, und lädt nach fünf
  Sekunden neu. Fällt das Netz aus, zeigt es das; kommt das Netz zurück, lädt es sofort neu.

Stempeln ohne Netz am Terminal kommt mit S-803, NFC-Karten mit S-802.

## Für Entwickler

| Aufruf | Wer | Was |
| --- | --- | --- |
| `GET /api/v1/terminal/geraete` | Inhaber | Terminals mit Stand |
| `POST /api/v1/terminal/geraete` | Inhaber | neues Terminal mit Kopplungscode (`{ name }`) |
| `DELETE /api/v1/terminal/geraete/:id` | Inhaber | Terminal widerrufen |
| `GET /api/v1/terminal/personen` | Inhaber | wer stempelt, mit PIN und QR-Code ja oder nein |
| `POST`, `DELETE /api/v1/terminal/ausweise/:nutzerId` | Inhaber | QR-Code ausstellen oder entziehen |
| `PUT /api/v1/pins/:nutzerId` | Inhaber | PIN setzen (409 `pin_vergeben`) |
| `POST /api/v1/kiosk/koppeln` | Tablet | Code gegen Geräte-Token (`{ code }`) |
| `GET /api/v1/kiosk` | Tablet mit Token | Name, Betrieb, Sperre |
| `POST /api/v1/kiosk/erkennen` | Tablet mit Token | `{ pin }` oder `{ qr }`: Person und Tag; 401 mit den übrigen Versuchen, 423 mit dem Ende der Sperre |
| `POST /api/v1/kiosk/stempeln` | Tablet mit Token | `{ ausweis, art }`: erkennt und stempelt |
