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
| Inhaber | alles: Module schalten, einladen, Rollen ändern, PINs setzen |
| Planer | lesen, Mitarbeiter und Externe einladen |
| Mitarbeiter | die eigenen Daten |
| Lohnbüro | lesen (Lohndaten folgen mit dem DATEV-Export) |
| Betriebsrat | lesen |
| Extern | lesen, ohne Pflicht zur Arbeitszeiterfassung |
| Gerät | nur PINs am Terminal prüfen |

Die Rechte prüft der Server bei jedem Aufruf, auch bei den Routen von Better Auth: Ein Gerät sieht dort keine anderen Mitglieder. Hat eine Person mehrere Rollen, darf sie, was jede
davon darf; andere als diese sieben Rollen nimmt der Server nicht an. Jede Änderung einer Mitgliedschaft oder Rolle steht in
der [Audit-Kette](audit-kette.md).

## Einladung ohne E-Mail

Der Inhaber (oder für Mitarbeiter und Externe ein Planer) legt eine Einladung mit Name und Rolle an
und bekommt einen Link, den er weitergibt oder als QR-Code zeigt. Wer ihn öffnet, wählt einen
Benutzernamen und ein Passwort (mindestens 10 Zeichen) und meldet sich danach damit an; eine
E-Mail-Adresse braucht es nicht. Ein Link gilt sieben Tage und nur einmal. Gespeichert wird nur der
Hash des Links, nicht der Link selbst. Passkeys lassen sich danach zum Konto hinzufügen.

## PIN

Für das Terminal setzt der Inhaber jeder Person eine PIN aus 4 bis 8 Ziffern; gespeichert wird sie
als Hash (Argon2id). Nach **fünf falschen Versuchen in Folge** ist sie gesperrt, bis der Inhaber eine
neue setzt; eine richtige PIN dazwischen setzt den Zähler zurück. Jeder Fehlversuch steht in der
Audit-Kette. Wer den Betrieb verlassen hat, wird am Terminal mit seiner PIN nicht mehr erkannt.

## Module

| Modul | Wofür | Standard |
| --- | --- | --- |
| Arbeitszeit | Stempeln, Prüfung, Monatsabschluss, Abwesenheiten | an |
| Dienstplan | Schichten planen und veröffentlichen | aus |
| Projektzeit | Kunden, Aufträge, Stoppuhr | aus |
| Terminal | Tablet am Eingang | aus |

Der Inhaber schaltet die Module. Ein ausgeschaltetes Modul lehnt der Server ab, nicht nur die
Oberfläche; seine Daten bleiben erhalten und sind beim Einschalten wieder da. Arbeitszeit lässt sich
nicht abschalten, solange der Betrieb Beschäftigte hat, denn dann gilt die Pflicht zur Erfassung
(BAG, 13.09.2022, 1 ABR 22/21). Kommt eine beschäftigte Person hinzu, durch Einladung oder
Rollenwechsel, schaltet Soll die Arbeitszeit wieder ein.

## Start des Servers

Der Server braucht `SOLL_SECRET_KEY`: 32 zufällige Bytes in Base64, etwa aus
`openssl rand -base64 32`. Ohne gültigen Schlüssel startet er nicht. Mit dem Schlüssel signiert
Better Auth seine Sitzungen, später verschlüsselt Soll damit geheime Spalten. `SOLL_URL` ist die
Adresse, unter der die Instanz erreichbar ist; sie steht in den Einladungslinks.
