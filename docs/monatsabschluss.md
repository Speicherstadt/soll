---
title: Monatsabschluss und Prüfwert
description: >-
  Wie die Person ihren Monat bestätigt, der Betrieb ihn abschließt und sperrt, was auf dem
  Stundenzettel steht und wie die Prüfseite eine spätere Änderung zeigt.
---

# Monatsabschluss und Prüfwert

Am Ende jedes Monats bestätigt jede Person ihre Zeiten, danach schließt der Betrieb den Monat ab.
Ab dann ist der Monat gesperrt, und die Person bekommt ihren **Stundenzettel** mit einem
**Prüfwert**. An ihm fällt jede spätere Änderung auf, auch eine, die der Betreiber des Servers an
der Datenbank vorbei macht.

## Ablauf

Unter **Zeiten → Monatsabschluss** steht der Vormonat: jeder Tag mit Beginn, Ende, Pause, Dauer und
Befund mit Norm, darunter Soll, Ist und Saldo. Tage mit einer Änderung von Hand tragen die Marke
„Geändert“; wer was wann und warum geändert hat, steht wie bisher am Tag unter **Zeiten**.

1. **Die Person bestätigt** ihren Monat mit **Monat bestätigen**. Ändert sich danach noch etwas an
   ihren Aufzeichnungen, gilt die Bestätigung nicht mehr („Bestätigung gilt nicht mehr: seitdem
   geändert“), und sie bestätigt den neuen Stand.
2. **Der Inhaber schließt ab** mit **Monat abschließen**. Hat die Person den Stand nicht bestätigt,
   etwa weil sie ausgeschieden ist, geht das nur mit einem Grund; er steht auf dem Stundenzettel.

Abgeschlossen wird nur ein Monat, der vorbei ist, und nur, wenn keine Schicht mehr offen ist: Fehlt
ein Gehen, wird es zuerst nachgetragen. Soll stempelt nie selbst aus. Ein Gehen ohne Kommen öffnet
keine Schicht und hält den Abschluss nicht auf; es steht als Befund (R-01) auf dem Stundenzettel.

Abgeschlossen wird außerdem erst **9 Stunden nach der letzten Stempelung** des Monats. So lange kann
die letzte Schicht noch weiterlaufen: Ein Kommen am Ersten, keine 9 Stunden nach einem Gehen spät am
letzten Tag, gehört noch zu dieser Schicht. Wäre der Monat schon gesperrt, lehnte Soll dieses Kommen
ab, und die Arbeitszeit bliebe unaufgezeichnet. Bis dahin steht unter dem Stand „Abschließen geht ab
…“ mit Datum und Uhrzeit. Eine Stempelung ohne Netz aus diesen 9 Stunden, die erst nach dem Abschluss
ankommt, lehnt der Server ab; sie wird als Gegeneintrag erfasst.

## Danach ist der Monat gesperrt

Der Server lehnt jede Schreiboperation ab, die den abgeschlossenen Monat der Person ändern würde:

- Stempeln, Nachtragen, Ändern und Entfernen einer Stempelung mit einem Zeitpunkt im Monat, auch das
  Verschieben einer Stempelung aus einem offenen Monat hinein. Ausgenommen ist das Gehen am Ersten,
  das zur Nachtschicht des noch offenen letzten Tags davor gehört: Es zählt zu diesem Tag, nicht zum
  abgeschlossenen Monat, und bleibt änderbar,
- am Ersten des Folgemonats jede Änderung, die eine Nachtschicht des letzten Tags ändern würde: Eine
  Schicht gehört zu dem Tag, an dem sie beginnt. Ein Kommen am Ersten, das mehr als 9 Stunden nach
  dem Gehen eine neue Schicht beginnt, bleibt erlaubt,
- am letzten Tag des Vormonats, auch wenn er noch offen ist, jede Änderung, die eine Stempelung des
  abgeschlossenen Monats in eine Schicht dieses Tags zöge oder aus ihr löste: etwa eine Schicht am
  Abend, der sich die erste Schicht des Monats weniger als 9 Stunden später anschlösse, oder das
  Entfernen des Kommens einer Nachtschicht, deren Gehen im Monat liegt,
- früher im Vormonat jede Änderung, die über eine Kette von Schichten mit weniger als 9 Stunden
  Abstand die Schichten des Monats anders schnitte (eine Schicht reicht höchstens 24 Stunden über
  ihren Beginn hinaus, gezählt ab dem Beginn der Kette),
- eine Zuordnung eines Arbeitszeitmodells, die das Soll eines Tags im Monat ändern würde,
- eine [Abwesenheit](abwesenheiten.md#abgeschlossener-monat), die einen Tag im Monat ändern würde:
  ein Antrag, eine Freigabe, ein Storno, eine Bescheinigung oder ein neues Ende einer Krankheit.

Erlaubt bleibt jede Änderung, die an den Stempelungen des Monats je Arbeitstag nichts ändert.
Abschluss, Prüfseite und Sperre lesen einen Monat dafür aus denselben Stempelungen: von sechs
Monaten und zwei Tagen vor ihm bis zwei Tage nach ihm.

### Korrektur als Gegeneintrag

Fällt nach dem Abschluss ein Fehler auf, tragen Inhaber oder Planer einen **Gegeneintrag** ein: den
Tag, die Minuten (mit Minus zieht er ab) und einen Grund. Der abgeschlossene Monat und sein
Prüfwert bleiben, wie sie sind. Der Gegeneintrag zählt im laufenden Monat: Seine Minuten gehen in
Ist und Saldo dieses Monats ein. Er steht auf dessen Stundenzettel und auf der Prüfseite des
abgeschlossenen Monats als Korrektur, nicht als Abweichung.

## Stundenzettel

Der Stundenzettel ist ein PDF (A4, Deutsch) mit den Tagen und ihren genehmigten Abwesenheiten
(Urlaub, krank, halber Tag), Soll, Ist und Saldo, den Befunden mit Norm, den Gegeneinträgen, wer bestätigt und wer abgeschlossen hat, und dem Prüfwert. Jede Person
lädt ihn jederzeit unter **Stundenzettel (PDF)** herunter; vor dem Abschluss ist er als Entwurf
gekennzeichnet und trägt noch keinen Prüfwert.

Beim Abschluss schickt Soll den Stundenzettel per Mail an die Person, wenn die Instanz Mail
eingerichtet hat und die Person eine E-Mail-Adresse hat (wer per Link ohne E-Mail eingeladen
wurde, hat keine). Die App sagt dem Inhaber, ob die Mail rausging.

Soll und Ist sind „nicht hinterlegt“, wenn an einem Tag der Beschäftigung kein Arbeitszeitmodell
gilt oder der Betrieb weder Standort noch Bundesland hat; eine Summe mit Lücke wäre geschätzt. Den
Monat abschließen kann der Betrieb trotzdem, denn die Aufzeichnung der Zeiten verlangt das Gesetz
(§ 16 Abs. 2 ArbZG, § 17 MiLoG) unabhängig vom Soll.

## Prüfwert und Prüfseite

Der Prüfwert sieht so aus: `Nr. 1234 · 3f98…` (Nummer und 64 Zeichen). Er ist das Kettenglied, mit
dem der Abschluss in der [Audit-Kette](audit-kette.md) steht, und jede Person hat für jeden Monat
ihren eigenen.

Auf der **Prüfseite** (`/pruefen`, der Link steht auf dem Stundenzettel) gibt man den Prüfwert ein.
Sie braucht keine Anmeldung: Auch wer ausgeschieden ist, oder eine Prüferin von Zoll oder
Arbeitsschutz, prüft einen Stundenzettel. Die Antwort ist

- **Übereinstimmend**: der Monat ist so, wie er abgeschlossen wurde, oder
- **Abweichung**, mit dem Grund:
    - die Tage, deren Stempelungen, Soll oder Abwesenheiten seit dem Abschluss anders sind,
    - die Audit-Kette bis zu diesem Prüfwert ist nicht mehr dieselbe (etwa neu berechnet),
    - der Abschluss selbst wurde geändert.

Monat, Name und geänderte Tage zeigt die Prüfseite nur zu einem Prüfwert, dessen Kettenglied noch
stimmt: Wer ihn hat, hat den Stundenzettel bekommen.

## Verfahrensdokumentation

Für die Verfahrensdokumentation nach den GoBD (BMF-Schreiben vom 28.11.2019, Rz. 107 ff. und
151 ff.) beschreibt dieser Abschnitt, wie der Monatsabschluss Unveränderbarkeit herstellt. Der Text
zum Prüfwert folgt dem Baustein `pruefwert` aus `packages/gobd-kern/src/verfahrensdoku/kern.ts` in
[Haben](https://github.com/firsttris/haben), erweitert um den Bezug auf den Monat.

**Prüfwert.** Der Prüfwert ist Nummer und Hash des Eintrags im Protokoll, mit dem der Monat einer
Person abgeschlossen wurde. Außerhalb des Servers aufbewahrt, auf dem Stundenzettel der Person,
zeigt er später, ob das Protokoll bis zu diesem Eintrag nachträglich verändert wurde.

**Inhalt des Abschlusses.** Der Eintrag schreibt eine Zeile mit dem Inhalt des Monats als
kanonischem JSON (Stempelungen je Arbeitstag, Minuten des Arbeitszeitmodells je Tag, Soll und Ist,
Befunde mit Norm, Gegeneinträge) und dessen SHA-256. Der Hash der Zeile steht im Eintrag, der Hash
des Eintrags im Prüfwert; damit deckt der Prüfwert genau diesen Monat dieser Person.

**Prüfung.** Die Prüfseite rechnet die Kette bis zum Eintrag nach, vergleicht die Zeile des
Abschlusses mit dem Hash im Eintrag und die Aufzeichnungen des Monats, wie sie die Datenbank heute
hält, mit denen im Abschluss. Eine Änderung an der Datenbank vorbei verhindert das nicht; es macht
sie sichtbar (Rz. 60). Gegen den, der den Server betreibt, schützt der Prüfwert in der Hand der
Beschäftigten, den er nicht mehr ändern kann.

**Sperre und Korrektur.** Nach dem Abschluss lehnt der Server jede Schreiboperation ab, die den
Monat ändern würde; eine Korrektur ist ein Gegeneintrag mit Grund in einer eigenen Tabelle, der
ebenfalls im Protokoll steht (Rz. 58 f.: Änderungen bleiben nachvollziehbar, der ursprüngliche
Inhalt bleibt erhalten).

## Für Entwickler

Die Endpunkte liegen unter `/api/v1/arbeitszeit/monat` und sind gesperrt, solange das Modul
Arbeitszeit aus ist; die Prüfseite liegt außerhalb davon.

| Endpunkt | Was | Wer |
| --- | --- | --- |
| `GET /monat?monat=JJJJ-MM&nutzerId=` | der Monat: Inhalt (abgeschlossen oder heute), offene Tage, Bestätigung, Abschluss mit Prüfwert, geänderte Tage, `abschliessbarAb` (vor diesem Zeitpunkt kein Abschluss, sonst `null`) | selbst; andere: Inhaber, Planer, Lohnbüro |
| `GET /monat/stundenzettel?monat=&nutzerId=` | der Stundenzettel als PDF | wie oben |
| `POST /monat/bestaetigen` | `{ monat }`: der eigene Monat, wie er heute steht | selbst |
| `POST /monat/abschliessen` | `{ monat, nutzerId, grund? }`, schickt den Stundenzettel per Mail; Antwort mit `mail`; vor `abschliessbarAb` 409 `{ fehler: "schicht_kann_weiterlaufen", ab }` | Inhaber |
| `POST /monat/gegeneintrag` | `{ nutzerId, tag, minuten, grund }` zu einem Tag eines abgeschlossenen Monats | Inhaber, Planer |
| `POST /api/v1/pruefen` | `{ betriebId, pruefwert }` → `uebereinstimmend`, `abweichung` (mit `grund` und `tage`), `unlesbar`, `unbekannt` | alle, ohne Anmeldung |

Die Tabelle `monatsabschluesse` hat je Schritt eine Zeile (`bestaetigt`, `abgeschlossen`) mit dem
Inhalt als kanonischem JSON und seinem SHA-256; ein eindeutiger Index auf `sperrt` lässt je Person
und Monat einen Abschluss zu. `korrekturen` hält die Gegeneinträge. Beide stehen in der
Audit-Kette und werden nur angefügt. Den Inhalt baut `monatsinhalt.ts` als reine Funktion, mit
Testvektoren, das Fenster, aus dem ein Monat gelesen wird, `lesefenster()`; die Sperre prüft
`aenderungGesperrt()` vor jeder Schreibfunktion für Stempelungen, `abwesenheitGesperrt()` vor jeder
für Abwesenheiten. Ein Tag mit Abwesenheit trägt im Inhalt `abwesenheiten` (Art, halber Tag,
Bescheinigung liegt vor, Kind); ein Tag ohne hat den Schlüssel nicht, so behält ein Monat ohne
Abwesenheit den Inhalt und den Prüfwert, die er vor S-401 hatte.

Mail kommt über SMTP aus `SOLL_SMTP_URL` (etwa `smtps://soll:geheim@mail.example.de:465`) mit dem
Absender aus `SOLL_MAIL_VON`; beide zusammen oder keins. Die Tests schicken an einen SMTP-Testserver.
