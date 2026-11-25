import { jahrVon, monatVon, type Tag, tagInBerlin, verfallHinweis } from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../../db/oeffnen.ts";
import { type Kontext, type Schreiber, schreiben } from "../../audit/index.ts";
import { beschaeftigungVon } from "../grundlagen.ts";
import { type AnpassungZeile, anpassungenVon, type HinweisZeile, hinweiseVon } from "./lesen.ts";
import { stichtagGesperrt, URLAUBSBEGINN, urlaubsbeginnVon } from "./stichtag.ts";
import { stundenAnpassungPasst } from "./ueberstunden.ts";
import { urlaubsGrundlage } from "./urlaub.ts";

/*
 * Changing the accounts (S-402): only by hand or from an import (S-708) and only appended, each in
 * the audit chain. A change of the overtime account is for a month in whole minutes, one of the
 * leave account for a year in half days, the leave on a cut-off date for its month; a notice on
 * leave expiring keeps its day and what it named.
 */

export type Anpassung =
  | {
      art: "startsaldo" | "korrektur" | "auszahlung";
      monat: string;
      minuten: number;
      grund: string;
    }
  | { art: "urlaub_start" | "urlaub_korrektur"; jahr: number; halbtage: number; grund: string }
  /** the leave open on the first day of `monat`, the leave of its year included (S-708, R-34) */
  | { art: "urlaub_stichtag"; monat: string; halbtage: number; grund: string };

export type KontoFehler =
  /** a second start of an account */
  | "vorhanden"
  /** a start after or in a closed month or after another change, which the account cannot place */
  | "widerspruch"
  /** a notice after today, or before the leave account begins */
  | "ungueltig"
  /** the leave account cannot be computed: a value is "nicht hinterlegt" or months were removed */
  | "nicht_hinterlegt";

export type KontoErgebnis<T> = { ok: true; wert: T } | { ok: false; fehler: KontoFehler };

/** Where a change taken over from another tool comes from (S-708); null for one by hand */
export type Uebernommen = { importId: string; quelle: string; externId: string } | null;

export const alsZeile = (
  kontext: Kontext,
  nutzerId: string,
  a: Anpassung,
  herkunft: Uebernommen = null,
): AnpassungZeile => ({
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
  importId: herkunft?.importId ?? null,
  externQuelle: herkunft?.quelle ?? null,
  externId: herkunft?.externId ?? null,
});

/**
 * Whether the month or year of a change is plausible (reviews of S-402): never before the person
 * joined. A change of the overtime account is for a month up to this one: a month ahead would lower
 * today's balance for what has not happened, and a start balance ahead would drop every month closed
 * before it; so is a cut-off date of leave (S-708). Leave is brought in up to next year, a
 * correction of leave is for the year before the account begins (it holds the leave brought in) up
 * to next year.
 */
const zeitPasst = (
  db: Db,
  kontext: Kontext,
  wer: { nutzerId: string; frueher: Tag | null },
  anpassung: Anpassung,
  bisher: readonly AnpassungZeile[],
): boolean => {
  const bekannt = beschaeftigungVon(db, kontext.betriebId, wer.nutzerId)?.eintritt;
  const eintritt = [bekannt, wer.frueher ?? undefined].filter((t) => t !== undefined).sort()[0];
  if (eintritt === undefined) return false;
  const heute = tagInBerlin(kontext.jetzt);
  if ("monat" in anpassung)
    return anpassung.monat >= monatVon(eintritt) && anpassung.monat <= monatVon(heute);
  const start = urlaubsbeginnVon(bisher)?.jahr ?? jahrVon(eintritt);
  const ab = anpassung.art === "urlaub_start" ? jahrVon(eintritt) : start - 1;
  return anpassung.jahr >= ab && anpassung.jahr <= jahrVon(heute) + 1;
};

/**
 * Leave brought in from a year after a notice already given would move the account's start past
 * that notice, and the notice would name leave the account no longer holds (review S-402). Leave on
 * a cut-off date is refused once any notice was given (review S-708): the notice named other leave
 * than the account would then hold, whatever its day.
 */
const nachHinweis = (db: Db, kontext: Kontext, nutzerId: string, anpassung: Anpassung) => {
  if (anpassung.art !== "urlaub_start" && anpassung.art !== "urlaub_stichtag") return false;
  const [erster] = hinweiseVon(db, kontext.betriebId, nutzerId);
  if (erster === undefined) return false;
  return "jahr" in anpassung ? anpassung.jahr > jahrVon(erster.tag as Tag) : true;
};

/** A second start of the same account: of the overtime, or of the leave in either form */
const zweiterStart = (bisher: readonly AnpassungZeile[], anpassung: Anpassung): boolean => {
  if (anpassung.art === "startsaldo") return bisher.some((a) => a.art === "startsaldo");
  return URLAUBSBEGINN.has(anpassung.art) && bisher.some((a) => URLAUBSBEGINN.has(a.art));
};

/**
 * Whether a change of a person's accounts may be recorded, without writing it: by hand and from an
 * import alike (S-708), so both refuse the same. `frueher` is the first day of the person's times
 * an import takes over with it: the person joined no later (`beschaeftigungVon`).
 */
export const anpassungPruefen = (
  db: Db,
  kontext: Kontext,
  nutzerId: string,
  anpassung: Anpassung,
  frueher: Tag | null = null,
): KontoFehler | null => {
  const bisher = anpassungenVon(db, kontext.betriebId, nutzerId);
  if (zweiterStart(bisher, anpassung)) return "vorhanden";
  if (!zeitPasst(db, kontext, { nutzerId, frueher }, anpassung, bisher)) return "ungueltig";
  if (nachHinweis(db, kontext, nutzerId, anpassung)) return "widerspruch";
  if (stichtagGesperrt(db, kontext.betriebId, nutzerId, anpassung)) return "widerspruch";
  const zeile = alsZeile(kontext, nutzerId, anpassung);
  if ("minuten" in anpassung && !stundenAnpassungPasst(db, kontext.betriebId, nutzerId, zeile))
    return "widerspruch";
  return null;
};

/** Records a change of a person's accounts by hand */
export const anpassungAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  nutzerId: string,
  anpassung: Anpassung,
): KontoErgebnis<AnpassungZeile> => {
  const fehler = anpassungPruefen(db, kontext, nutzerId, anpassung);
  if (fehler !== null) return { ok: false, fehler };
  const zeile = alsZeile(kontext, nutzerId, anpassung);
  return {
    ok: true,
    wert: schreiben(schreibDb, kontext, (s) => s.einfuegen("kontoAnpassungen", zeile)),
  };
};

/** A start balance planned by an import (S-708), checked with `anpassungPruefen` against the same */
export type UebernommeneAnpassung = { nutzerId: string; anpassung: Anpassung; externId: string };

/** Writes the start balances of an import in its one transaction, each with its origin */
export const anpassungenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: { importId: string; quelle: string },
  neue: readonly UebernommeneAnpassung[],
): void => {
  for (const neu of neue)
    s.einfuegen(
      "kontoAnpassungen",
      alsZeile(kontext, neu.nutzerId, neu.anpassung, { ...herkunft, externId: neu.externId }),
    );
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
  if (tag < grundlage.eintritt || tag < grundlage.beginn) return { ok: false, fehler: "ungueltig" };
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
