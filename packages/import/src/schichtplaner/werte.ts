import { zeitpunktLesen } from "../kimai/werte.ts";
import type { Zeitpunkt } from "./abzug.ts";

/*
 * What the three tools' answers share once read (BAULISTE.md S-706): any value of an answer may be
 * missing or of the wrong type, and none makes the turning into records throw. A value Soll cannot
 * read passes on as written (or empty), so the reader of the file refuses it with its line rather
 * than the record vanishing.
 */

export type Roh = Record<string, unknown>;

/** The records of an answer that are objects; anything else in a list is no record */
export const objekte = (liste: unknown): Roh[] =>
  Array.isArray(liste)
    ? liste.filter((s): s is Roh => typeof s === "object" && s !== null && !Array.isArray(s))
    : [];

/** An id as text: a whole number or a short text as given, else empty (the reader refuses it) */
export const idText = (wert: unknown): string => {
  if (typeof wert === "number" && Number.isSafeInteger(wert)) return String(wert);
  return typeof wert === "string" && wert.length <= 64 ? wert : "";
};

/** A text as given, or empty */
export const text = (wert: unknown): string => (typeof wert === "string" ? wert.slice(0, 200) : "");

/** An instant written with an offset (ISO 8601) as milliseconds; else as written, missing null */
export const zeitpunkt = (wert: unknown): Zeitpunkt => {
  if (wert === null || wert === undefined) return null;
  return zeitpunktLesen(wert) ?? (typeof wert === "string" ? wert.slice(0, 40) : "");
};

/** The names of records by their id, from a list of the tool */
export const namenNachId = (liste: readonly Roh[], id: string, name: string) =>
  new Map(liste.map((s) => [idText(s[id]), text(s[name])] as const));

/** First and last name joined, or the one there is */
export const vollerName = (vorname: unknown, nachname: unknown): string =>
  [text(vorname), text(nachname)].filter((teil) => teil.trim() !== "").join(" ");
