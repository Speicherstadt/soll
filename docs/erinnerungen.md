---
title: Erinnerungen
description: >-
  Wie Soll an ein vergessenes Gehen, eine fällige Pause und den offenen Monat erinnert, per Web Push
  aufs Handy oder per Mail, und warum es nie selbst ausstempelt.
---

# Erinnerungen

Soll erinnert an drei Dinge:

| Erinnerung | Wann | Wohin führt sie |
| --- | --- | --- |
| **Ausstempeln vergessen?** | die Schicht ist eine eingestellte Zeit offen (Vorgabe 10 Stunden ab Kommen) | Heute |
| **Pause fällig** | eine eingestellte Zeit, bevor nach § 4 ArbZG eine Pause zusteht (Vorgabe 15 Minuten): nach 6 Stunden am Stück, 30 Minuten ab 6 und 45 Minuten ab 9 Stunden Arbeit | Heute |
| **Monat bestätigen** | ab 9 Uhr an einem eingestellten Tag des Folgemonats (Vorgabe der 1.), solange die Person den vergangenen Monat mit Stempelungen nicht gültig bestätigt hat und er nicht abgeschlossen ist | Monatsabschluss |

**Soll stempelt nie selbst aus.** Eine Erinnerung ist nur ein Hinweis: Die Schicht bleibt offen,
bis die Person ihr Gehen stempelt oder nachträgt. Ein automatisches Gehen wäre eine erfundene
Aufzeichnung (BAG, 13.09.2022, 1 ABR 22/21).

Jede Erinnerung kommt **höchstens einmal**: für dieselbe Schicht nur ein „Ausstempeln vergessen?“,
für jede Stufe der Pause eine (nach einer Pause kann die nächste Stufe noch einmal kommen), für
jeden Monat ein „Monat bestätigen“.

## Einschalten

Unter **Einstellungen → Erinnerungen**:

- **Auf diesem Gerät einschalten** fragt den Browser nach der Erlaubnis für Benachrichtigungen und
  meldet das Gerät für Web Push an. Jedes Gerät wird einzeln angemeldet und abgemeldet. Auf dem
  iPhone gehen Benachrichtigungen nur, wenn Soll zum Home-Bildschirm hinzugefügt ist.
- Jede Art lässt sich für sich abschalten.
- **Per E-Mail, wenn kein Gerät sie bekommt**: Hat die Person kein Gerät angemeldet oder kommt
  dort keine Benachrichtigung an, geht die Erinnerung an ihre E-Mail-Adresse. Das geht nur, wenn der
  Server Mail versendet (`SOLL_SMTP_URL`, siehe [Aufbau und Befehle](entwicklung.md)) und die Person
  eine Adresse hat; wer per Link ohne E-Mail eingeladen wurde, hat keine.

Der **Inhaber** stellt darunter die Zeiten des Betriebs ein: nach wie vielen Stunden (1 bis 16) an
ein offenes Gehen erinnert wird, wie viele Minuten (0 bis 120) vor der Pause und ab welchem Tag (1
bis 28) des Folgemonats an den Monat.

Erinnerungen bekommt, wer im Betrieb stempelt, und nur in einem Betrieb mit dem Modul Arbeitszeit;
ist es abgeschaltet, lehnt der Server auch diese Einstellungen ab.

## Sprache

Die Benachrichtigung kommt in der Sprache, die die App auf dem Gerät beim Einschalten hatte
(Deutsch, Englisch, Türkisch, Polnisch, Ukrainisch oder Arabisch); die Norm steht in jeder Sprache
auf Deutsch (§ 4 ArbZG). Wer die Sprache wechselt, schaltet das Gerät einmal aus und wieder ein. Die
Mail ist wie der Stundenzettel auf Deutsch.

## Wie es funktioniert

Der Server prüft jede Minute für jeden Betrieb mit dem Modul Arbeitszeit, welche Erinnerung fällig
ist. Das entscheidet eine reine Funktion aus den Stempelungen der letzten Tage, dem Stand des
Vormonats, den Einstellungen und der Uhrzeit (`faelligeErinnerungen` in
`apps/server/src/modules/erinnerungen/faellig.ts`); die Pause kommt aus derselben Rechnung wie der
nächste Befund auf Heute (`tagesstand` in `packages/arbeitszeit`). Bevor eine Erinnerung hinausgeht,
wird sie mit Person, Art und Bezug in der Tabelle `erinnerungen` vermerkt, über die Audit-Kette; ein
eindeutiger Index lässt jede nur einmal zu. Gefragt wird nur, wer erreichbar ist: Wer weder ein
Gerät noch eine Mail hat, bekommt die Erinnerung, sobald er ein Gerät anmeldet, solange sie noch
fällig ist.

### Web Push

Soll spricht Web Push selbst, ohne Bibliothek und ohne Dienst eines Dritten außer dem Push-Dienst
des Browsers:

- **VAPID** (RFC 8292): Beim ersten Start erzeugt die Instanz ein Schlüsselpaar auf P-256. Der
  öffentliche Schlüssel geht an den Browser, der private liegt mit `SOLL_SECRET_KEY` verschlüsselt
  (AES-256-GCM) in der Tabelle `instanzschluessel`, unter der Kennung `instanz` mit einer eigenen
  Audit-Kette. Startet der Server mit einem anderen `SOLL_SECRET_KEY`, verweigert er den Start,
  statt still ein neues Paar zu erzeugen, das alle angemeldeten Geräte abschneiden würde. Als
  Kontakt (`sub`) nennt Soll dem Push-Dienst eine `mailto:`- oder `https:`-Adresse, wie RFC 8292
  sie verlangt; Apple und Mozilla lehnen andere ab: die Adresse aus `SOLL_MAIL_VON`, sonst
  der Ursprung von `SOLL_URL` (ohne Pfad, Benutzer und Passwort), wenn sie mit `https://`
  beginnt, sonst den Platzhalter `mailto:push@soll.invalid`. Eine Domain mit Umlauten steht im
  `mailto:` in ihrer ASCII-Form (`xn--…`).
  Wer möchte, dass ein Push-Dienst ihn bei Problemen erreicht, richtet Mail ein.
- **Inhalt** (RFC 8291, `aes128gcm` nach RFC 8188): Titel, Text und Ziel der Benachrichtigung sind
  für das Gerät verschlüsselt; der Push-Dienst liest sie nicht. Die Tests prüfen die Verschlüsselung
  mit den Werten aus Anhang A von RFC 8291.
- **Abo**: Endpunkt und Schlüssel des Geräts liegen verschlüsselt in `push_abos`; wer sie hätte,
  könnte dem Gerät schreiben. Ein Schlüssel, der kein Punkt auf P-256 ist, wird abgelehnt, ein
  Endpunkt muss `https` sein und bei einem Push-Dienst der Browser liegen: Google (`fcm.googleapis.com`,
  Chrome und die Browser auf seiner Grundlage), Mozilla (`push.services.mozilla.com`, Firefox), Apple
  (`push.apple.com`, Safari) oder Microsoft (`notify.windows.com`, Edge). Soll schickt an den
  Endpunkt; jede andere Adresse könnte auf das eigene Netz zielen, auch über einen Namen, der dorthin
  auflöst. Auch vor dem Senden prüft Soll den gespeicherten Endpunkt noch einmal. Ein Browser mit
  einem anderen Push-Dienst bekommt die Erinnerung per Mail. Antwortet der
  Push-Dienst mit 404 oder 410, gibt es das Abo nicht mehr, und Soll entfernt es; bei anderen Fehlern
  bleibt es, und die Erinnerung geht per Mail.
- Der **Service Worker** zeigt die Benachrichtigung und öffnet beim Tippen die passende Seite der
  App, nie eine fremde.

### Was getestet wird

Ein Ersatz für den Push-Dienst prüft den VAPID-Schlüssel jeder Nachricht und entschlüsselt sie mit
dem Schlüssel des Geräts; ein SMTP-Testserver nimmt die Mails an. Damit zeigen die Tests jede
Erinnerung über beide Wege, auch über die Zeitumstellung, und dass nach jedem Lauf dieselben
Stempelungen in der Datenbank stehen. Playwright meldet ein Gerät mit einem Ersatz für den
Push-Dienst des Browsers an und ab.

## Schnittstelle

Alle Pfade unter `/api/v1/arbeitszeit/erinnerungen`, für jede angemeldete Person, die stempelt:

| Methode und Pfad | Was |
| --- | --- |
| `GET /` | öffentlicher VAPID-Schlüssel, eigene Wünsche, Zeiten des Betriebs, ob Mail möglich ist, Zahl der eigenen Geräte |
| `PUT /wuensche` | `{ ausstempeln, pause, monat, mail }` der eigenen Person |
| `PUT /regeln` | `{ gehenMinuten, pauseVorlauf, monatTag }` des Betriebs, nur der Inhaber |
| `POST /abos` | Abo eines Geräts aus `PushSubscription.toJSON()` mit `sprache`; 201 neu, 200 schon bekannt |
| `DELETE /abos` | `{ endpoint }`, nur ein eigenes Gerät; 204 oder 404 |
