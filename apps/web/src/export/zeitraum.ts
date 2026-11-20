import { ersterTag, letzterTag, plusTage, type Tag } from "@soll/arbeitszeit";
import { vormonat } from "../monat/zeilen.ts";

/** Two years, as long as the records are kept; the server refuses a longer period the same way */
export const LAENGSTENS_TAGE = 731;

/** The value of the person list that means everyone in it */
export const ALLE = "*";

/** The period the page starts with: the month before this one */
export const startZeitraum = (jetzt: number): { anfang: Tag; ende: Tag } => {
  const monat = vormonat(jetzt);
  return { anfang: ersterTag(monat), ende: letzterTag(monat) };
};

/** From the first day to the last, at most two years */
export const zeitraumGueltig = (anfang: Tag, ende: Tag): boolean =>
  anfang !== "" && ende !== "" && anfang <= ende && ende < plusTage(anfang, LAENGSTENS_TAGE);

/**
 * The address of a download of the Prüfexport: oneself without a person, everyone in the list for
 * ALLE, else the person chosen
 */
export const pruefexportPfad = (angaben: {
  anfang: Tag;
  ende: Tag;
  format: "csv" | "pdf";
  wahl: string;
  personen: readonly string[];
}): string => {
  const abfrage = new URLSearchParams({
    von: angaben.anfang,
    bis: angaben.ende,
    format: angaben.format,
  });
  const ids = angaben.wahl === ALLE ? angaben.personen : angaben.wahl ? [angaben.wahl] : [];
  for (const id of ids) abfrage.append("nutzerId", id);
  return `/api/v1/arbeitszeit/pruefexport?${abfrage}`;
};
