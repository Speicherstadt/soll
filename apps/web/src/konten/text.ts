import type { HinweisPosten, VerfallBefund } from "@soll/arbeitszeit";
import { tageText, tagText } from "../abwesenheiten/text.ts";
import { saldoText } from "../monat/zeilen.ts";
import { m } from "../paraglide/messages.js";
import type { Anpassung, Anpassungsart, Luecke } from "./typen.ts";

/** The words of the accounts in the language of the app; norms stay German (DESIGN.md, "Texte") */

export const ART: Record<Anpassungsart, () => string> = {
  startsaldo: () => m.konten_art_startsaldo(),
  auszahlung: () => m.konten_art_auszahlung(),
  korrektur: () => m.konten_art_korrektur(),
  urlaub_start: () => m.konten_art_urlaub_start(),
  urlaub_korrektur: () => m.konten_art_urlaub_korrektur(),
  urlaub_stichtag: () => m.konten_art_urlaub_stichtag(),
};

/** A start on a cut-off date counts from the first day of its month (S-708) */
const amStichtag = (a: Anpassung): boolean =>
  (a.art === "startsaldo" || a.art === "urlaub_stichtag") && a.monat !== null;

export const FEHLER: Record<string, () => string> = {
  vorhanden: () => m.konten_fehler_vorhanden(),
  widerspruch: () => m.konten_fehler_widerspruch(),
  nicht_hinterlegt: () => m.konten_fehler_nicht_hinterlegt(),
  ungueltig: () => m.konten_fehler_ungueltig(),
};

/** "nicht hinterlegt", or which months were removed after their retention period */
export const lueckeText = (luecke: Luecke): string =>
  luecke.grund === "ausgesondert"
    ? m.konten_ausgesondert({ monate: luecke.monate.join(", ") })
    : m.abw_nicht_hinterlegt();

type TopfWerte = { jahr: string; tage: string; datum: string; norm: string };

const TEXT: Record<VerfallBefund["art"], (werte: TopfWerte) => string> = {
  verfallen: (w) => m.konten_topf_verfallen(w),
  verfall_droht: (w) => m.konten_topf_verfaellt(w),
  hinweis_faellig: (w) => m.konten_topf_hinweis_faellig(w),
  hinweis_fehlt: (w) => m.konten_topf_kein_verfall(w),
};

/**
 * The leave of each year and where it stands, from the server's findings (R-23): expired, the part
 * a notice lets expire next, the part no notice names with the notice still due (a warning) or
 * missing. A notice makes expire only what it named (review S-708), so one year may have two lines.
 */
export const befundZeilen = (
  befunde: readonly VerfallBefund[],
): { text: string; warnung: boolean }[] =>
  [...befunde]
    .sort((a, b) => a.jahr - b.jahr)
    .map((befund) => ({
      text: TEXT[befund.art]({
        jahr: String(befund.jahr),
        tage: tageText(befund.halbtage),
        datum: tagText(befund.tage[0] ?? "", true),
        norm: befund.norm,
      }),
      warnung: befund.art === "hinweis_faellig",
    }));

/** What a notice named: "5 Tage aus 2026 bis 31.12.2027" */
export const hinweisText = (inhalt: readonly HinweisPosten[]): string =>
  inhalt.length === 0
    ? m.konten_hinweis_nichts()
    : inhalt
        .map((p) =>
          m.konten_hinweis_posten({
            tage: tageText(p.halbtage),
            jahr: String(p.jahr),
            datum: tagText(p.verfaelltAm, true),
          }),
        )
        .join(" · ");

/** A change by hand as one line: what, for when, how much */
export const anpassungText = (a: Anpassung): string => {
  const wann = amStichtag(a)
    ? m.konten_stichtag_wann({ datum: tagText(`${a.monat}-01`, true) })
    : (a.monat ?? String(a.jahr ?? ""));
  const wert =
    a.minuten !== null
      ? saldoText(a.art === "auszahlung" ? -a.minuten : a.minuten)
      : tageText(a.halbtage ?? 0);
  return m.konten_anpassung_zeile({ art: ART[a.art](), wann, wert, grund: a.grund });
};
