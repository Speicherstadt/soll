import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Gueltigkeit } from "./typen.ts";

/** A day in Berlin, with Latin digits in every language (DESIGN.md, "Texte") */
const tagFormat = (zone: string) =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: zone,
    dateStyle: "medium",
    numberingSystem: "latn",
  });

/** The day of an instant in Berlin */
export const tagVon = (ms: number): string => tagFormat("Europe/Berlin").format(ms);

/** A calendar day `YYYY-MM-DD`, read at noon in UTC so no time zone moves it */
export const kalendertag = (tag: string): string =>
  tagFormat("UTC").format(Date.parse(`${tag}T12:00:00Z`));

export const gueltigkeitText = (tage: Gueltigkeit): string =>
  tage === null ? m.zugang_unbegrenzt() : m.zugang_tage({ tage: String(tage) });
