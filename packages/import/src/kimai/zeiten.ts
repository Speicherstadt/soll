import { plusTage } from "@soll/arbeitszeit";
import type { ImportBuchung, ImportZeit, LeseFehler } from "../modell.ts";
import { type BerlinerUhr, berlinerUhr } from "../uhr.ts";
import type { Zeitbuchung } from "./bestand.ts";
import { type Block, MINUTE, type Stueck, stueckeVon, zusammenfassen } from "./stuecke.ts";

/*
 * Kimai's timesheets as spans of work and bookings of project time (BAULISTE.md S-705). The pieces
 * of a person that touch or overlap become one block, each block one span with Kommen and Gehen and
 * no break of its own; the gaps between blocks are the breaks as booked (as Clockodo's entries in
 * S-703). Each piece with a project and an activity is also a booking on them.
 */

const TAG = 24 * 60 * MINUTE;

/**
 * A block as a span on Berlin's clock, or why a day and two times cannot name it: 24 hours or more,
 * an instant in the hour that comes twice in October, an end on another day than the planner would
 * rebuild (as in S-703, review: across the change to summer time a span would shrink)
 */
const alsZeit = (block: Block, person: string, uhr: BerlinerUhr): ImportZeit | LeseFehler => {
  const { zeile } = block;
  if (block.ende - block.beginn >= TAG) return { zeile, grund: "zeit_ungueltig", feld: "end" };
  if (uhr.doppelt(block.beginn)) return { zeile, grund: "zeit_ungueltig", feld: "begin" };
  if (uhr.doppelt(block.ende)) return { zeile, grund: "zeit_ungueltig", feld: "end" };
  const beginn = uhr.uhr(block.beginn);
  const ende = uhr.uhr(block.ende);
  const endeTag = ende.minute > beginn.minute ? beginn.tag : plusTage(beginn.tag, 1);
  if (ende.tag !== endeTag) return { zeile, grund: "zeit_ungueltig", feld: "end" };
  return {
    externalId: block.id,
    zeile,
    person,
    tag: beginn.tag,
    beginn: beginn.minute,
    ende: ende.minute,
    pauseMinuten: 0,
  };
};

/** What a booking may name: the projects and activities of the file */
export type Bezuege = { projekte: ReadonlySet<string>; taetigkeiten: ReadonlySet<string> };

/** The booking of a piece, or why it has none (no project, or one the file does not hold) */
const alsBuchung = (
  stueck: Stueck,
  zeit: ImportZeit,
  bezuege: Bezuege,
): ImportBuchung | LeseFehler | null => {
  const { projekt, taetigkeit } = stueck.buchung;
  if (projekt === null || taetigkeit === null) return null;
  if (!bezuege.projekte.has(projekt))
    return { zeile: stueck.zeile, grund: "projekt_unbekannt", feld: "project", wert: projekt };
  if (!bezuege.taetigkeiten.has(taetigkeit))
    return {
      zeile: stueck.zeile,
      grund: "taetigkeit_unbekannt",
      feld: "activity",
      wert: taetigkeit,
    };
  return {
    externalId: `${stueck.buchung.id}/${stueck.nummer}`,
    zeile: stueck.zeile,
    zeit: zeit.externalId,
    person: zeit.person,
    tag: zeit.tag,
    beginn: stueck.beginn,
    ende: stueck.ende,
    projekt,
    taetigkeit,
  };
};

/**
 * One person's bookings in time order. Two timesheets that met on a second may overlap by less than
 * a minute once rounded; the later one then starts where the earlier ended. A real overlap stays
 * and the plan refuses it (`ueberschneidung`).
 */
const nebeneinander = (buchungen: ImportBuchung[]): ImportBuchung[] => {
  let bisher = Number.NEGATIVE_INFINITY;
  const ergebnis: ImportBuchung[] = [];
  for (const buchung of buchungen) {
    const ueberlappung = bisher - buchung.beginn;
    const beginn = ueberlappung > 0 && ueberlappung <= MINUTE ? bisher : buchung.beginn;
    if (beginn < buchung.ende) ergebnis.push({ ...buchung, beginn });
    bisher = Math.max(bisher, buchung.ende);
  }
  return ergebnis;
};

type Ergebnis = { zeiten: ImportZeit[]; buchungen: ImportBuchung[]; fehler: LeseFehler[] };

const blockAufnehmen = (
  ergebnis: Ergebnis,
  block: Block,
  kontext: { person: string; uhr: BerlinerUhr; bezuege: Bezuege },
): ImportBuchung[] => {
  const zeit = alsZeit(block, kontext.person, kontext.uhr);
  // only a span taken over is booked: a refused one gives no project time either (S-705 "Zeiten")
  if ("grund" in zeit) {
    ergebnis.fehler.push(zeit);
    return [];
  }
  ergebnis.zeiten.push(zeit);
  return block.stuecke.flatMap((stueck) => {
    const buchung = alsBuchung(stueck, zeit, kontext.bezuege);
    if (buchung === null) return [];
    if ("grund" in buchung) {
      // a timesheet of two pieces names its project once
      if (stueck.nummer === 1) ergebnis.fehler.push(buchung);
      return [];
    }
    return [buchung];
  });
};

/** The spans and bookings of all timesheets; `person` names a user by Kimai's id */
export const zeitenAus = (
  zeitbuchungen: readonly Zeitbuchung[],
  person: (nutzer: string) => string,
  bezuege: Bezuege,
): Ergebnis => {
  const ergebnis: Ergebnis = { zeiten: [], buchungen: [], fehler: [] };
  const jeNutzer = new Map<string, Stueck[]>();
  for (const buchung of zeitbuchungen) {
    const stuecke = stueckeVon(buchung);
    if ("grund" in stuecke) ergebnis.fehler.push(stuecke);
    else {
      const liste = jeNutzer.get(buchung.nutzer) ?? [];
      liste.push(...stuecke);
      jeNutzer.set(buchung.nutzer, liste);
    }
  }
  const uhr = berlinerUhr();
  for (const [nutzer, stuecke] of jeNutzer) {
    const kontext = { person: person(nutzer), uhr, bezuege };
    const buchungen = zusammenfassen(stuecke).flatMap((block) =>
      blockAufnehmen(ergebnis, block, kontext),
    );
    ergebnis.buchungen.push(...nebeneinander(buchungen));
  }
  const nachZeile = (a: { zeile: number }, b: { zeile: number }) => a.zeile - b.zeile;
  return {
    zeiten: ergebnis.zeiten.sort(nachZeile),
    buchungen: ergebnis.buchungen.sort(nachZeile),
    fehler: ergebnis.fehler,
  };
};
