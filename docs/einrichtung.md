---
title: Einrichtung
description: >-
  So richtest du Soll für deinen Betrieb ein: Konto, Betrieb und Bundesland, vier Fragen zu den
  Modulen, Standorte, Arbeitszeitmodelle aus Vorlagen, Mitarbeiter per CSV und Einladungslinks.
---

# Einrichtung

Wer Soll zum ersten Mal öffnet, legt ein Konto an und kommt in den Assistenten. Er fragt nur, was
dein Betrieb braucht: Ein Freelancer ist nach einem Schritt fertig, ein Betrieb mit Beschäftigten
nach fünf. Jeder Schritt speichert beim Klick auf „Weiter“; wer zwischendurch geht, macht beim
nächsten Mal dort weiter. Bis die Einrichtung abgeschlossen ist, führt Soll den Inhaber immer
wieder hierher.

## Konto

Unter „Konto anlegen“ gibst du deinen Namen, deine E-Mail-Adresse und ein Passwort mit mindestens
10 Zeichen an. Damit wirst du der **Inhaber** des Betriebs, den du im ersten Schritt anlegst.
Später meldest du dich mit E-Mail oder Benutzernamen an.

## 1. Betrieb und vier Fragen

Name des Betriebs und Bundesland; das Bundesland bestimmt die Feiertage und ist die Vorgabe für die
Standorte. Dann vier Fragen, die die [Module](anmeldung.md#module) schalten:

| Frage | Ja | Nein |
| --- | --- | --- |
| Hast du Beschäftigte? | Arbeitszeit mit Abwesenheiten, fest an | nur Projektzeit; die anderen Fragen entfallen |
| Arbeitet ihr in Schichten oder nach Plan? | Dienstplan | kein Dienstplan |
| Rechnet ihr Stunden mit Kunden ab? | Projektzeit | keine Projektzeit |
| Stempelt ihr an einem festen Ort, etwa am Eingang? | Terminal | kein Terminal |

Mit Beschäftigten ist Arbeitszeit Pflicht, denn dann muss die Arbeitszeit erfasst werden (BAG,
13.09.2022, 1 ABR 22/21); der Assistent bietet sie nicht zum Abschalten an. Unter den Fragen siehst
du, welche Module dein Betrieb bekommt.

Ohne Beschäftigte endet die Einrichtung hier: Es gibt keine Standorte zum Stempeln, keine
Arbeitszeitmodelle und niemanden einzuladen.

## 2. Standorte

Wo gearbeitet wird: Name, Adresse und Bundesland. Ein Standort in Bayern, Sachsen oder Thüringen
kann die Feiertage seiner Gemeinde bekommen, etwa das Friedensfest in Augsburg oder Fronleichnam in
einer Gemeinde in Sachsen; welche das sind, steht unter [Feiertage](feiertage.md). Mindestens ein
Standort ist nötig. Mit Terminal steht das Tablet an einem dieser Standorte.

## 3. Arbeitszeit

Drei Vorlagen, aus denen du übernimmst, was passt:

| Vorlage | Stunden | Lohn |
| --- | --- | --- |
| Vollzeit | 40 je Woche, Montag bis Freitag gleich verteilt | Gehalt im Monat |
| Teilzeit | 20 je Woche, Montag bis Freitag gleich verteilt | Stundenlohn |
| Minijob | nach Plan | Stundenlohn |

Die Wochenstunden gibst du als `40`, `38,5` oder `19:30` ein (Dezimalstunden nur, wenn sie ganze Minuten ergeben); Soll verteilt sie in ganzen Minuten auf die
Tage, ein Rest geht an die ersten Tage. Den Lohn gibst du in Euro an (`3.200,00`, `13,90`); er kann
leer bleiben und heißt dann „nicht hinterlegt“. Soll braucht ihn später für den Mindestlohn, die
Minijob-Grenze und den steuerfreien Teil der Zuschläge. Die Minijob-Grenze selbst ist ein Jahreswert
und kommt mit den Jahreswerten; der Assistent nennt keinen Betrag. Mindestens ein Modell ist
nötig. Die Löhne der Modelle sehen nur der Inhaber und das Lohnbüro.

## 4. Mitarbeiter

Eine Liste aus deiner Tabelle, als CSV-Datei oder eingefügt, oder Leute einzeln mit Name und Rolle.
Die erste Zeile nennt die Spalten:

```text
Name;Rolle
Tom Berger;Mitarbeiter
Lea Hansen;Mitarbeiterin
Yusuf Yılmaz;
```

- Trennzeichen sind Semikolon (wie Excel auf Deutsch), Komma oder Tabulator; Felder in
  Anführungszeichen dürfen das Trennzeichen enthalten (RFC 4180).
- Statt `Name` gehen auch `Vorname` und `Nachname`; Spalten auf Englisch (`First name`, `Role`)
  kennt Soll auch, weitere Spalten überliest es.
- Rollen auf Deutsch oder Englisch: Inhaber, Planer, Mitarbeiter, Lohnbüro, Betriebsrat, Extern,
  auch in der weiblichen Form. Ohne Rolle gilt Mitarbeiter. Ein Gerät (Terminal) wird nicht
  importiert.
- Hat die Datei nur eine Spalte, bleibt ein Komma im Namen stehen (`Weber, Jonas`).
- Höchstens 200 Personen auf einmal. Eine Zeile, die Soll nicht lesen kann, nennt es mit ihrer
  Nummer und dem Grund; die übrigen übernimmt es. Schließt ein Anführungszeichen nicht, nennt Soll
  die Zeile, in der es steht, und übernimmt nichts ab dort.

## 5. Einladungen

Für jede Person der Liste erstellt Soll einen [Einladungslink](anmeldung.md#einladung-ohne-e-mail),
alle mit einem Klick (eine längere Liste als 200 Personen geht in Teilen an den Server; was schon geklappt hat, bleibt). Den Link gibst du weiter, etwa im Chat; eine E-Mail-Adresse braucht es nicht. Wer
ihn öffnet, wählt Benutzernamen und Passwort und ist danach im Betrieb. Die Links siehst du nur in
diesem Moment, denn Soll speichert nur ihren Hash; jeder gilt sieben Tage und einmal. Die Liste
aus Schritt 4 und die Links hält nur diese Seite: Wer sie neu lädt oder schließt, solange Leute auf
der Liste stehen oder Links zu sehen sind, wird vom Browser vorher gefragt. Kommt die
erste beschäftigte Person dazu, bleibt Arbeitszeit an.

## Danach

Die Navigation zeigt nur die Bereiche deiner Module:

| Betrieb | Module | Seitenleiste | Tab-Leiste am Handy |
| --- | --- | --- | --- |
| Freelancer | Projektzeit | Heute, Projekte, Auswertungen, Einstellungen | Heute, Projekte, Mehr |
| Café | Arbeitszeit, Dienstplan | Heute, Zeiten, Abwesenheiten, Dienstplan, Auswertungen, Einstellungen | Heute, Plan, Abwesenheit, Mehr |
| SHK-Betrieb | Arbeitszeit, Projektzeit, Terminal | Heute, Zeiten, Abwesenheiten, Projekte, Auswertungen, Einstellungen | Heute, Abwesenheit, Projekte, Mehr |
| alle Module | alle | alle sieben Bereiche | Heute, Plan, Abwesenheit, Mehr |

Das Terminal hat keinen eigenen Bereich, es ist eine Ansicht auf dem Tablet. Die Tab-Leiste zeigt
Heute, die ersten beiden Bereiche deiner Module aus Dienstplan, Abwesenheiten, Projekte und Zeiten,
und „Mehr“ mit dem Rest. Wer eine Adresse eines abgeschalteten Moduls öffnet, landet bei Heute; der
Server lehnt die Aufrufe dieses Moduls ohnehin ab.

Unter **Einstellungen → Module** schaltet der Inhaber die Module später um; die Navigation folgt
sofort. Ein abgeschaltetes Modul behält seine Daten. Arbeitszeit lässt sich nicht abschalten,
solange der Betrieb Beschäftigte hat.

## Betrieb ohne Beschäftigte

Wer die erste Frage mit Nein beantwortet, arbeitet allein: Soll hat dann nur das Modul Projektzeit.
Es gibt kein Stempeln, keine Prüfung nach dem Arbeitszeitgesetz, keine Abwesenheiten, keinen
Dienstplan und keine Erinnerungen; als Inhaber bist du kein Arbeitnehmer, für dich gilt das
Arbeitszeitgesetz nicht (§ 2 Abs. 2 ArbZG). Heute sagt das und schickt dich zu Projekte, wo du deine
Stunden buchst. Die Adressen der anderen Bereiche führen zu Heute, der Server lehnt ihre Aufrufe ab.

Lädst du später die erste beschäftigte Person ein (Mitarbeiter, Planer, Lohnbüro oder
Betriebsrat), schaltet Soll die Arbeitszeit ein, sobald sie die Einladung annimmt; ebenso, wenn eine
externe Person eine dieser Rollen bekommt. Die Einladung allein ändert nichts, denn die Pflicht
beginnt mit der Beschäftigung. Ab dann siehst du als Inhaber auf jeder Seite einen Hinweis mit dem
Grund: Die Arbeitszeit von Beschäftigten muss erfasst werden (BAG, 13.09.2022, 1 ABR 22/21; § 3
Abs. 2 Nr. 1 ArbSchG). Er bleibt, bis du ihn mit „Verstanden“ bestätigst; die Bestätigung steht in
der Audit-Kette. Arbeitszeit lässt sich danach nicht mehr abschalten, solange Beschäftigte im
Betrieb sind. Projektzeit bleibt, wie sie war. Eine externe Person, etwa die Steuerberaterin, zählt
nicht als beschäftigt.
