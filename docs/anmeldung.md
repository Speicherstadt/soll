---
title: Anmeldung, Rollen und Module
description: >-
  Wie Betriebe, Konten, Einladungen per Link ohne E-Mail, Rollen, PIN und Module in Soll
  zusammenhängen, und welche Einstellung der Server zum Start braucht.
---

# Anmeldung, Rollen und Module

## Betriebe

Eine Instanz von Soll trägt mehrere Betriebe. Ein Betrieb ist eine Organisation in Better Auth; wer
ihn anlegt, ist sein **Inhaber**. Jede Tabelle von Soll trägt die Kennung des Betriebs, und jeder
Aufruf der API gilt dem Betrieb, der in der Sitzung gewählt ist. Wer kein Mitglied eines Betriebs
ist, kann ihn nicht wählen und sieht keine seiner Daten.

## Rollen

| Rolle | Darf |
| --- | --- |
| Inhaber | alles: den Betrieb einrichten, Module schalten, einladen, Rollen ändern, PINs setzen, Terminals koppeln, QR-Codes ausstellen und NFC-Karten eintragen, Arbeitszeitmodelle zuordnen, Zeiten aller mit Grund korrigieren, den Dienstplan planen |
| Planer | lesen, die Mitgliederliste, Mitarbeiter und Externe einladen, stempeln, Zeiten aller sehen und mit Grund korrigieren, den Dienstplan planen |
| Mitarbeiter | die eigenen Daten: stempeln, die eigenen Zeiten sehen und mit Grund korrigieren, den veröffentlichten Dienstplan sehen |
| Lohnbüro | lesen, die Mitgliederliste, die Arbeitszeitmodelle mit ihren Löhnen, stempeln, Zeiten aller sehen, den veröffentlichten Dienstplan sehen |
| Betriebsrat | lesen, die Mitgliederliste (§ 80 Abs. 2 BetrVG), stempeln, den veröffentlichten Dienstplan sehen |
| Extern | die eigenen Daten, ohne Pflicht zur Arbeitszeiterfassung; stempelt nicht, sieht aber die eigenen Zeiten aus der Zeit davor |
| Gerät | nur PINs am Terminal prüfen |

Jede Rolle außer dem Gerät legt [Zugänge zur API](api.md) an; ein Zugang darf genau, was die Rolle seiner Person gerade darf.

Die Löhne in den Arbeitszeitmodellen sehen nur Inhaber und Lohnbüro. Die Rechte prüft der Server bei jedem Aufruf, auch bei den Routen von Better Auth: Die Mitgliederliste mit Namen, E-Mail-Adressen und Rollen sehen nur Inhaber, Planer, Lohnbüro und Betriebsrat; Mitarbeiter, Externe und Geräte sehen ihre eigene Rolle, aber keine anderen Mitglieder. Hat eine Person mehrere Rollen, darf sie, was jede
davon darf; andere als diese sieben Rollen nimmt der Server nicht an. Jede Änderung einer Mitgliedschaft oder Rolle steht in
der [Audit-Kette](audit-kette.md).

## Konto und Anmeldung

Wer einen Betrieb einrichtet, legt ein Konto mit E-Mail-Adresse und einem Passwort von mindestens
10 Zeichen an und wird Inhaber des Betriebs, den er in der [Einrichtung](einrichtung.md) anlegt.
Angemeldet wird mit E-Mail-Adresse oder Benutzernamen. Gehört ein Konto zu einem Betrieb, wählt
die App ihn bei der Anmeldung; ohne Betrieb führt sie in die Einrichtung.

## Einladung ohne E-Mail

Der Inhaber (oder für Mitarbeiter und Externe ein Planer) legt eine Einladung mit Name und Rolle an,
in der Einrichtung auch für eine ganze Liste auf einmal, und bekommt einen Link, den er weitergibt. Wer ihn öffnet, wählt einen
Benutzernamen und ein Passwort (mindestens 10 Zeichen) und meldet sich danach damit an; eine
E-Mail-Adresse braucht es nicht. Ein Link gilt sieben Tage und nur einmal. Gespeichert wird nur der
Hash des Links, nicht der Link selbst. Passkeys lassen sich danach zum Konto hinzufügen.

## PIN

Für das Terminal setzt der Inhaber jeder Person eine PIN aus 6 bis 8 Ziffern; gespeichert wird sie
als Hash (Argon2id). Nach **fünf falschen Versuchen in Folge** ist sie gesperrt, bis der Inhaber eine
neue setzt; eine richtige PIN dazwischen setzt den Zähler zurück. Jeder Fehlversuch steht in der
Audit-Kette. Wer den Betrieb verlassen hat, wird am Terminal mit seiner PIN nicht mehr erkannt.
PINs gehören zum Modul Terminal: Ist es aus, lehnt der Server Setzen und Prüfen ab; gesetzte PINs
bleiben und gelten wieder, sobald es an ist.

Am [Terminal](terminal.md) erkennt die PIN die Person allein. Deshalb gibt es jede PIN im Betrieb
nur einmal, und Soll speichert daneben eine Kennung (HMAC-SHA-256 mit einem Schlüssel aus
`SOLL_SECRET_KEY`), über die es die Person findet; eine gesperrte PIN gilt dort nicht. Falsche
Versuche am Terminal sperren das Terminal, nicht die Person. Eine PIN mit 4 oder 5 Ziffern von vor
S-801 wird weiter geprüft, neu setzen lässt sich nur eine mit 6 bis 8.

## Module

| Modul | Wofür | Standard |
| --- | --- | --- |
| Arbeitszeit | Stempeln, Prüfung, Monatsabschluss, Abwesenheiten | an |
| Dienstplan | Schichten planen und veröffentlichen | aus |
| Projektzeit | Kunden, Aufträge, Stoppuhr | aus |
| Terminal | Tablet am Eingang | aus |

Der Inhaber schaltet die Module, zuerst über die vier Fragen der [Einrichtung](einrichtung.md),
später unter Einstellungen. Die Navigation zeigt nur die Bereiche der eingeschalteten Module. Ein ausgeschaltetes Modul lehnt der Server ab, nicht nur die
Oberfläche; seine Daten bleiben erhalten und sind beim Einschalten wieder da. Arbeitszeit lässt sich
nicht abschalten, solange der Betrieb Beschäftigte hat, denn dann gilt die Pflicht zur Erfassung
(BAG, 13.09.2022, 1 ABR 22/21). Kommt eine beschäftigte Person hinzu, durch Einladung oder
Rollenwechsel, schaltet Soll die Arbeitszeit wieder ein und sagt dem Inhaber warum; mehr dazu unter
[Betrieb ohne Beschäftigte](einrichtung.md#betrieb-ohne-beschaftigte).

Abgelehnt wird jede Adresse unter `/api/v1/<modul>/` (`arbeitszeit`, `dienstplan`, `projektzeit`,
`terminal`) mit `403` und `{"fehler": "modul_aus", "modul": "…"}`. Ein Test liest alle Routen aus
dem Server selbst und prüft jede, auch eine später hinzugekommene. Für jeden Betrieb offen bleiben
nur der Betrieb mit seinen Modulen, die Einrichtung, Standorte, Einladungen, die Auskunft nach
Art. 15 DSGVO und die [Prüfseite](monatsabschluss.md).

## Start des Servers

Der Server braucht `SOLL_SECRET_KEY`: 32 zufällige Bytes in Base64, etwa aus
`openssl rand -base64 32`. Ohne gültigen Schlüssel startet er nicht. Mit dem Schlüssel signiert
Better Auth seine Sitzungen, später verschlüsselt Soll damit geheime Spalten. `SOLL_URL` ist die
Adresse, unter der die Instanz erreichbar ist; sie steht in den Einladungslinks.
