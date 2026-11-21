---
title: Gesetzeswächter
description: >-
  Wie Soll die Normen beobachtet, auf die seine Regeln sich stützen, und meldet, wenn sich ein
  Gesetzestext ändert oder ein Jahreswert für das nächste Jahr fehlt.
---

# Gesetzeswächter

Jede Regel in Soll nennt ihre Norm ([Regelwerk](regeln.md)), und manche Grenzen sind
[Jahreswerte](jahreswerte.md). Ändert der Gesetzgeber eine Norm oder kommt ein neuer Mindestlohn,
muss Soll nachziehen. Das soll nicht davon abhängen, dass es jemand in der Zeitung liest: Der
Workflow **Gesetzeswächter** (`.github/workflows/gesetze.yml`) prüft jeden Montag und auf Knopfdruck,
ob sich etwas geändert hat, und öffnet dann ein Issue. Er folgt dem Workflow „Jahreswerte prüfen“
in [Haben](https://github.com/firsttris/haben).

## Was beobachtet wird

`scripts/gesetze/normen.json` führt jede beobachtete Norm mit ihrer Adresse auf
gesetze-im-internet.de, wofür Soll sie braucht, und dem SHA-256 ihres Textes:

- jeden Paragrafen, den `docs/regeln.md` mit seinem Gesetz zitiert (ArbZG, ArbSchG, MiLoG,
  MiLoDokV, SchwarzArbG, JArbSchG, MuSchG, TzBfG, BUrlG, SGB IX, BEEG, EntgFG, SGB IV, SGB V, EStG,
  BetrVG, BGB, SvEV); ein Test liest die Fundstellen aus dem Regelwerk und verlangt jede in der
  Liste, ein neu zitiertes Gesetz lässt ihn scheitern, bis es beobachtet oder mit Grund
  ausgenommen ist;
- die Grundlagen der Jahreswerte: § 1 MiLoG mit § 1 MiLoV4 und § 1 MiLoV5 (Mindestlohn), § 8
  SGB IV (Minijob-Grenze), § 45 SGB V (Kinderkrankentage); ein Test verlangt jede Quelle aus
  `packages/arbeitszeit/src/jahreswerte/werte.ts` in der Liste.

Nicht beobachtet wird, was gesetze-im-internet.de nicht führt: Landesrecht wie die
Feiertagsgesetze (die Feiertage rechnet Soll selbst, [Feiertage](feiertage.md)), die DSGVO als
Recht der EU, Urteile (BAG, EuGH) und Verwaltungsvorschriften wie die Lohnsteuer-Richtlinien.

## Wie verglichen wird

Gehasht wird nicht die Seite, sondern ihr Normtext: Überschrift, Text und Fußnoten, ohne Tags, mit
aufgelösten Entities und zusammengefasstem Leerraum. Navigation, Logos, Anker und die Fußzeile mit
ihrem Datum bleiben außen vor, so ändert sich der Hash nur mit dem Wortlaut. Die Seiten kommen in
ISO-8859-1, der Zeichensatz steht nur im meta-Element. Der Normalisierer ist aus Haben kopiert,
damit ein Hash in beiden Projekten derselbe ist.

## Befunde

| Befund | Wann |
| --- | --- |
| `<Norm> geändert` | der Hash des Textes ist ein anderer als in `normen.json` |
| `<Norm> ist nicht mehr abrufbar` | die Seite antwortet mit 404: aufgehoben, umnummeriert oder neue Adresse |
| `<Wert> <Jahr> nicht hinterlegt` | Mindestlohn, Minijob-Grenze oder Kinderkrankentage fehlen für das laufende Jahr, ab dem 1. Oktober auch für das nächste |
| `Neue Mindestlohnanpassungsverordnung` | gesetze-im-internet.de führt die nächste MiLoV (heute MiLoV6) |

Der 1. Oktober lässt Zeit: Die Mindestlohnkommission beschließt bis zum 30. Juni (§ 9 MiLoG), die
Verordnung folgt im Herbst. Bis ein Wert eingetragen ist, zeigt Soll „nicht hinterlegt“ und rechnet
nie mit dem Wert eines anderen Jahres.

Keine Befunde sind eine Seite, die nicht antwortet oder keine Einzelnorm zeigt (eine Warnung im
Lauf), und eine Norm ohne Hash: Sie hat **noch keinen Stand**. Das gilt für jede neu aufgenommene
Norm und für die erste Liste, die ohne Zugang zu gesetze-im-internet.de entstand.

## Das Issue

Alle Befunde eines Laufs stehen in **einem** Issue mit dem Label `gesetzeswaechter`. Ist es schon
offen und die Befunde sind dieselben, passiert nichts; haben sie sich geändert, bekommt es einen
Kommentar und den neuen Text. Ohne Befund entsteht kein Issue. Der Workflow braucht dafür nur den
`GITHUB_TOKEN` mit `issues: write`.

## Was dann zu tun ist

1. **Norm geändert**: die Änderung lesen (Fußnoten und Textnachweis nennen das ändernde Gesetz und
   ab wann es gilt). Betrifft sie eine Regel, die das Issue nennt, `docs/regeln.md` und
   `packages/arbeitszeit` anpassen; ändert sich eine Grenze, wird daraus eine neue Regelversion
   mit eigenem Beginn ([Jahreswerte](jahreswerte.md)). Danach – auch wenn Soll unverändert bleibt –
   den Hash übernehmen.
2. **Jahreswert fehlt**: den Wert mit Gültigkeit und Fundstelle in `werte.ts` eintragen, Tests
   ergänzen.
3. **Neue MiLoV**: Mindestlohn und Minijob-Grenze eintragen und § 1 der neuen Verordnung in
   `normen.json` aufnehmen.
4. Das Issue schließen. Besteht ein Befund beim nächsten Lauf noch, öffnet der Workflow ein neues.

Hashes übernehmen: lokal mit `bun run gesetze --schreiben`, oder aus dem Artefakt
`gesetze-stand` des letzten Laufs, das `normen.json` mit den Hashes dieses Laufs enthält. So
bekommt auch die erste Liste ihren Stand: das Artefakt des ersten Laufs in einem Pull Request
übernehmen.

## Lokal

```sh
bun run gesetze                      # Bericht auf der Konsole, sonst nichts
bun run gesetze --bericht bericht.md # den Bericht auch in eine Datei
bun run gesetze --schreiben          # die aktuellen Hashes nach normen.json
```

`--issue` öffnet oder aktualisiert das Issue und braucht `GITHUB_TOKEN` und `GITHUB_REPOSITORY`;
das tut nur der Workflow. Die Tests laufen ohne Netz gegen nachgestellte Seiten und eine
nachgestellte GitHub-API.
