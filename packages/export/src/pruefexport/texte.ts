import { befundText } from "../befunde.ts";
import { datumText, dauerText, uhrzeitText, zeitpunktText } from "../stundenzettel/format.ts";
import type { PruefAenderung, PruefGegeneintrag, PruefTag, Stempelart } from "./typen.ts";

/*
 * The words of the Prüfexport, the same in CSV and PDF; German, as it is a record for German
 * authorities (docs/plan.md, "Sprache des Stundenzettels")
 */

const ARTEN: Record<Stempelart, string> = {
  kommen: "Kommen",
  gehen: "Gehen",
  pause_beginn: "Pause-Beginn",
  pause_ende: "Pause-Ende",
};

const AKTIONEN: Record<PruefAenderung["aktion"], string> = {
  nachgetragen: "nachgetragen",
  geaendert: "geändert",
  entfernt: "entfernt",
};

const tagInBerlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A stamp of a change: its time, with the date when it lies on another day than the row's */
const stempelText = (stempel: { art: Stempelart; zeitpunkt: number }, tag: string) => {
  const amTag = tagInBerlin.format(stempel.zeitpunkt);
  const datum = amTag === tag ? "" : `${datumText(amTag)} `;
  return `${ARTEN[stempel.art]} ${datum}${uhrzeitText(stempel.zeitpunkt)}`;
};

/**
 * "geändert am 07.10.2026 09:12 von Mia: vorher Gehen 17:00, jetzt Gehen 18:15, Grund: …" for the
 * working day `tag`; a stamp on another day (a night shift's Gehen, a stamp moved to another day or
 * month) carries its date, else "vorher Kommen 08:00, jetzt Kommen 08:00" hides a move by a day
 */
export const aenderungText = (aenderung: PruefAenderung, tag: string): string => {
  const einzeln = aenderung.nachher ?? aenderung.vorher;
  const was =
    aenderung.vorher && aenderung.nachher
      ? `vorher ${stempelText(aenderung.vorher, tag)}, jetzt ${stempelText(aenderung.nachher, tag)}`
      : einzeln
        ? stempelText(einzeln, tag)
        : "";
  return `${AKTIONEN[aenderung.aktion]} am ${zeitpunktText(aenderung.am)} von ${aenderung.von}: ${was}, Grund: ${aenderung.grund}`;
};

/** "Gegeneintrag -0:15 am 04.11.2026 11:00 von Mia, Grund: …" */
export const gegeneintragText = (eintrag: PruefGegeneintrag): string =>
  `Gegeneintrag ${dauerText(eintrag.minuten, true)} am ${zeitpunktText(eintrag.am)} von ${eintrag.von}, Grund: ${eintrag.grund}`;

export { befundText };

/**
 * The end of a working day: the time, with the date when the shift ended on a later day; "offen"
 * while a shift has a beginning and no end (R-01: Soll never adds what is missing)
 */
export const endeText = (tag: PruefTag, kurz: boolean): string => {
  if (tag.ende === null) return tag.beginn === null ? "" : "offen";
  const amTag = tagInBerlin.format(tag.ende);
  if (amTag === tag.tag) return uhrzeitText(tag.ende);
  return kurz
    ? `${uhrzeitText(tag.ende)} (${datumText(amTag).slice(0, 6)})`
    : `${datumText(amTag)} ${uhrzeitText(tag.ende)}`;
};

export const beginnText = (tag: PruefTag): string =>
  tag.beginn === null ? "" : uhrzeitText(tag.beginn);

export const erfasstText = (tag: PruefTag): string =>
  tag.erfasstAm === null ? "" : zeitpunktText(tag.erfasstAm);

/** A month's line: closed with its Prüfwert, or open */
export const monatStand = (monat: { pruefwert: string | null; abgeschlossenAm: number | null }) =>
  monat.abgeschlossenAm === null
    ? "nicht abgeschlossen"
    : `abgeschlossen am ${zeitpunktText(monat.abgeschlossenAm)}, Prüfwert ${monat.pruefwert ?? "nicht verfügbar"}`;
