import type { Ausblick, Stempelart, TagesBefund } from "@soll/arbeitszeit";
import { dauerText } from "../einrichtung/werte.ts";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Aenderung } from "./typen.ts";

/**
 * What a person reads for the stamps, findings and changes of a day, in the language of the app.
 * Times are Berlin's (CLAUDE.md, "Time"), digits stay Latin in every language (DESIGN.md, "Texte"),
 * and a norm stays German, as the server names it.
 */

const format = (optionen: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "Europe/Berlin",
    numberingSystem: "latn",
    ...optionen,
  });

export const uhrzeitText = (ms: number): string =>
  format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);

/** A day and time, for when a change was made and when a rest ends */
export const zeitpunktText = (ms: number): string =>
  format({
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ms);

/** A calendar day as "Freitag, 20. November", read at noon so no time zone moves it */
export const tagText = (tag: string): string =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(Date.parse(`${tag}T12:00:00Z`));

export const ART_NAMEN: Record<Stempelart, () => string> = {
  kommen: m.art_kommen,
  gehen: m.art_gehen,
  pause_beginn: m.art_pause_beginn,
  pause_ende: m.art_pause_ende,
};

export type BefundText = { titel: string; schwere: "hinweis" | "verstoss"; norm: string };

const minuten = (befund: TagesBefund, feld: string): number =>
  Number((befund as unknown as Record<string, unknown>)[feld] ?? 0);

const BEFUND_TITEL: Record<string, (befund: TagesBefund) => string> = {
  gehen_fehlt: () => m.befund_gehen_fehlt(),
  kommen_fehlt: () => m.befund_kommen_fehlt(),
  pause_beginn_fehlt: () => m.befund_pause_beginn_fehlt(),
  pause_ende_fehlt: () => m.befund_pause_ende_fehlt(),
  doppelt: () => m.befund_doppelt(),
  ueber_8h: (b) => m.befund_ueber_8h({ dauer: dauerText(minuten(b, "ueber")) }),
  ueber_10h: (b) => m.befund_ueber_10h({ dauer: dauerText(minuten(b, "ueber")) }),
  pause_fehlt: (b) => m.befund_pause_fehlt({ minuten: String(minuten(b, "fehlt")) }),
  ohne_pause: (b) => m.befund_ohne_pause({ dauer: dauerText(minuten(b, "ueber")) }),
  ruhezeit_zu_kurz: (b) => m.befund_ruhezeit_zu_kurz({ minuten: String(minuten(b, "fehlt")) }),
  ruhezeit_verkuerzt: () => m.befund_ruhezeit_verkuerzt(),
  ruhezeit_ausgleich_fehlt: () => m.befund_ruhezeit_ausgleich_fehlt(),
};

/** A finding: what is wrong, its severity and its norm (DESIGN.md, "Befund mit Norm") */
export const befundText = (befund: TagesBefund): BefundText => ({
  titel: (BEFUND_TITEL[befund.art] ?? (() => m.befund_sonst()))(befund),
  schwere: befund.schwere,
  norm: befund.norm,
});

/** The next finding ahead: when it comes, what it asks, and its norm */
export const ausblickText = (ausblick: Ausblick): { titel: string; text: string } => {
  const dauer = dauerText(ausblick.inMinuten);
  const um = uhrzeitText(ausblick.um);
  switch (ausblick.art) {
    case "pause":
      return {
        titel: m.ausblick_pause({ dauer }),
        text: m.ausblick_pause_text({ minuten: String(ausblick.minuten), uhrzeit: um }),
      };
    case "acht_stunden":
      return { titel: m.ausblick_acht({ dauer }), text: m.ausblick_acht_text({ uhrzeit: um }) };
    case "zehn_stunden":
      return { titel: m.ausblick_zehn({ dauer }), text: m.ausblick_zehn_text({ uhrzeit: um }) };
    case "ruhezeit":
      return {
        titel: m.ausblick_ruhezeit({ zeit: zeitpunktText(ausblick.um) }),
        text: m.ausblick_ruhezeit_text(),
      };
  }
};

const stempelText = (stempel: { art: Stempelart; zeitpunkt: number }) =>
  `${ART_NAMEN[stempel.art]()} ${uhrzeitText(stempel.zeitpunkt)}`;

/** A change as a sentence: who did what, on which stamp */
export const aenderungText = (aenderung: Aenderung): string => {
  const wer = aenderung.vonName;
  if (aenderung.aktion === "nachgetragen" && aenderung.nachher)
    return m.aenderung_nachgetragen({ wer, stempel: stempelText(aenderung.nachher) });
  if (aenderung.aktion === "entfernt" && aenderung.vorher)
    return m.aenderung_entfernt({ wer, stempel: stempelText(aenderung.vorher) });
  return m.aenderung_geaendert({
    wer,
    vorher: aenderung.vorher ? stempelText(aenderung.vorher) : "",
    nachher: aenderung.nachher ? stempelText(aenderung.nachher) : "",
  });
};
