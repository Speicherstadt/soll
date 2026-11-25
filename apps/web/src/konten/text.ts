import type { HinweisPosten, Tag, Urlaubstopf } from "@soll/arbeitszeit";
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
};

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

const NORM = "§ 7 Abs. 3 BUrlG";

/**
 * The leave left of a year and where it stands (R-23): expiring at the end of a day once the notice
 * was given, expired, the notice still due (a warning), or not expiring without one. Null for a
 * year with nothing left and nothing expired.
 */
export const topfZeile = (
  topf: Urlaubstopf,
  heute: Tag,
): { text: string; warnung: boolean } | null => {
  const jahr = String(topf.jahr);
  if (topf.verfallenHalbtage > 0)
    return {
      text: m.konten_topf_verfallen({
        jahr,
        tage: tageText(topf.verfallenHalbtage),
        datum: tagText(topf.verfaelltAm ?? topf.verfallstag, true),
        norm: NORM,
      }),
      warnung: false,
    };
  if (topf.restHalbtage <= 0) return null;
  const tage = tageText(topf.restHalbtage);
  if (topf.verfaelltAm !== null)
    return {
      text: m.konten_topf_verfaellt({
        jahr,
        tage,
        datum: tagText(topf.verfaelltAm, true),
        norm: NORM,
      }),
      warnung: false,
    };
  if (heute <= topf.hinweisBis)
    return {
      text: m.konten_topf_hinweis_faellig({
        jahr,
        tage,
        datum: tagText(topf.hinweisBis, true),
        norm: NORM,
      }),
      warnung: true,
    };
  return { text: m.konten_topf_kein_verfall({ jahr, tage, norm: NORM }), warnung: false };
};

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
  const wann = a.monat ?? String(a.jahr ?? "");
  const wert =
    a.minuten !== null
      ? saldoText(a.art === "auszahlung" ? -a.minuten : a.minuten)
      : tageText(a.halbtage ?? 0);
  return m.konten_anpassung_zeile({ art: ART[a.art](), wann, wert, grund: a.grund });
};
