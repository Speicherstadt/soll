import { jahrVon, type Tag, tagInBerlin, verfallHinweis } from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../../audit/index.ts";
import { beschaeftigungVon } from "../grundlagen.ts";
import { type AnpassungZeile, anpassungenVon, type HinweisZeile, hinweiseVon } from "./lesen.ts";
import { stundenAnpassungPasst } from "./ueberstunden.ts";
import { urlaubsGrundlage } from "./urlaub.ts";

/*
 * Changing the accounts (S-402): only by hand and only appended, each in the audit chain. A change of
 * the overtime account is for a month in whole minutes, one of the leave account for a year in half
 * days; a notice on leave expiring keeps its day and what it named.
 */

export type Anpassung =
  | {
      art: "startsaldo" | "korrektur" | "auszahlung";
      monat: string;
      minuten: number;
      grund: string;
    }
  | { art: "urlaub_start" | "urlaub_korrektur"; jahr: number; halbtage: number; grund: string };

export type KontoFehler =
  /** a second start of an account */
  | "vorhanden"
  /** a start after a closed month or another change, which the account cannot place */
  | "widerspruch"
  /** a notice after today, or before the leave account begins */
  | "ungueltig"
  /** the leave account cannot be computed: a value is "nicht hinterlegt" or months were removed */
  | "nicht_hinterlegt";

export type KontoErgebnis<T> = { ok: true; wert: T } | { ok: false; fehler: KontoFehler };

const alsZeile = (kontext: Kontext, nutzerId: string, a: Anpassung): AnpassungZeile => ({
  betriebId: kontext.betriebId,
  anpassungId: crypto.randomUUID(),
  nutzerId,
  art: a.art,
  monat: "monat" in a ? a.monat : null,
  jahr: "jahr" in a ? a.jahr : null,
  minuten: "minuten" in a ? a.minuten : null,
  halbtage: "halbtage" in a ? a.halbtage : null,
  grund: a.grund,
  erstelltVon: kontext.akteur,
  erstelltAm: kontext.jetzt,
});

/**
 * Whether the year of a change of the leave account is plausible (review S-402): leave brought in
 * from the year of joining to next year, a correction from the year before the account begins (it
 * holds the leave brought in) to next year
 */
const jahrPasst = (
  db: Db,
  kontext: Kontext,
  nutzerId: string,
  anpassung: Anpassung,
  bisher: readonly AnpassungZeile[],
): boolean => {
  if (!("jahr" in anpassung)) return true;
  const eintritt = beschaeftigungVon(db, kontext.betriebId, nutzerId)?.eintritt;
  if (eintritt === undefined) return false;
  const bis = jahrVon(tagInBerlin(kontext.jetzt)) + 1;
  const start = bisher.find((a) => a.art === "urlaub_start")?.jahr ?? jahrVon(eintritt);
  const ab = anpassung.art === "urlaub_start" ? jahrVon(eintritt) : start - 1;
  return anpassung.jahr >= ab && anpassung.jahr <= bis;
};

/** Records a change of a person's accounts by hand */
export const anpassungAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  anpassung: Anpassung,
): KontoErgebnis<AnpassungZeile> => {
  const zeile = alsZeile(kontext, nutzerId, anpassung);
  const bisher = anpassungenVon(db, kontext.betriebId, nutzerId);
  if (anpassung.art === "urlaub_start" || anpassung.art === "startsaldo")
    if (bisher.some((a) => a.art === anpassung.art)) return { ok: false, fehler: "vorhanden" };
  if (!jahrPasst(db, kontext, nutzerId, anpassung, bisher))
    return { ok: false, fehler: "ungueltig" };
  if ("monat" in anpassung && !stundenAnpassungPasst(db, kontext.betriebId, nutzerId, zeile))
    return { ok: false, fehler: "widerspruch" };
  return {
    ok: true,
    wert: schreiben(schreibDb, kontext, (s) => s.einfuegen("kontoAnpassungen", zeile)),
  };
};

/**
 * Records that the business told the person on `tag` which leave is open and when it expires, with
 * what that notice named (`verfallHinweis`). Never after today, never before the person joined or
 * the account begins (review S-402), one per day.
 */
export const hinweisGeben = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  tag: Tag,
  heute: Tag,
): KontoErgebnis<HinweisZeile> => {
  if (tag > heute) return { ok: false, fehler: "ungueltig" };
  const grundlage = urlaubsGrundlage(db, kontext.betriebId, nutzerId, heute);
  if (!grundlage.ok) return { ok: false, fehler: "nicht_hinterlegt" };
  // a notice can be given only to someone employed, and only for the leave the account holds
  if (tag < grundlage.eintritt || tag < `${String(grundlage.startJahr).padStart(4, "0")}-01-01`)
    return { ok: false, fehler: "ungueltig" };
  if (hinweiseVon(db, kontext.betriebId, nutzerId).some((h) => h.tag === tag))
    return { ok: false, fehler: "vorhanden" };
  const inhalt = verfallHinweis(grundlage.eingaben, tag);
  if (!inhalt.ok) return { ok: false, fehler: "ungueltig" };
  const zeile = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("urlaubshinweise", {
      betriebId: kontext.betriebId,
      hinweisId: crypto.randomUUID(),
      nutzerId,
      tag,
      inhalt: JSON.stringify(inhalt.wert),
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );
  return { ok: true, wert: { ...zeile, inhalt: inhalt.wert } };
};
