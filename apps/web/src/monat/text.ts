import type { Monat } from "@soll/arbeitszeit";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Blattbefund } from "./typen.ts";

/** "Oktober 2026" in the language of the app, digits Latin (DESIGN.md, "Texte") */
export const monatText = (monat: Monat): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  }).format(Date.parse(`${monat}-15T12:00:00Z`));

/** "Di 6.10." for a row of the table */
export const kurzerTag = (tag: string): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "numeric",
    numberingSystem: "latn",
  }).format(Date.parse(`${tag}T12:00:00Z`));

/** "6.10.2026" for when a step was taken and the days of a finding */
export const datumText = (ms: number): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    numberingSystem: "latn",
  }).format(ms);

export const tageText = (tage: readonly string[]): string =>
  tage.map((tag) => kurzerTag(tag)).join(", ");

const REGEL: Record<string, () => string> = {
  "R-01": () => m.monat_regel_r01(),
  "R-02": () => m.monat_regel_r02(),
  "R-04": () => m.monat_regel_r04(),
  "R-05": () => m.monat_regel_r05(),
  "R-24": () => m.monat_regel_r24(),
};

/** A finding of the month: what, severity in words, norm in German (DESIGN.md, "Befund mit Norm") */
export const befundZeile = (befund: Blattbefund): string =>
  [
    befund.schwere === "verstoss" ? m.befund_verstoss() : m.befund_hinweis(),
    (REGEL[befund.regel] ?? (() => befund.regel))(),
    befund.norm,
  ].join(" · ");

export const FEHLER: Record<string, () => string> = {
  monat_laeuft: () => m.monat_laeuft(),
  offene_schicht: () => m.monat_fehler_offen(),
  abgeschlossen: () => m.monat_fehler_abgeschlossen(),
  bestaetigung_fehlt: () => m.monat_fehler_bestaetigung(),
  offen: () => m.monat_fehler_gegeneintrag_offen(),
};
