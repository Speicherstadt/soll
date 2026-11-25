import { jahrVon, type Monat, type Tag } from "@soll/arbeitszeit";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../../db/oeffnen.ts";
import { kontoAnpassungen } from "../../../db/schema.ts";
import { abgeschlosseneMonate } from "../abschluss.ts";
import type { Startsaldo } from "../monatsinhalt.ts";
import { type AnpassungZeile, anpassungenVon } from "./lesen.ts";

/*
 * The balances on a cut-off date (S-708, docs/regeln.md R-34): the start balance of the overtime
 * and the leave open on the first day of a month, by hand or from an import. A start lies in a month
 * not closed for the person and after none that is, so the content of its month carries it when
 * that month is closed and the person's Prüfwert covers it.
 */

/** A start of the leave account: the leave brought in before Soll, or the leave on a cut-off date */
export const URLAUBSBEGINN: ReadonlySet<string> = new Set(["urlaub_start", "urlaub_stichtag"]);

/** Where the leave account begins: its first year, and the cut-off date if there is one */
export type Urlaubsbeginn = { jahr: number; stichtag: { tag: Tag; halbtage: number } | null };

export const urlaubsbeginnVon = (zeilen: readonly AnpassungZeile[]): Urlaubsbeginn | undefined => {
  const zeile = zeilen.find((z) => URLAUBSBEGINN.has(z.art));
  if (zeile === undefined) return undefined;
  if (zeile.art === "urlaub_start" && zeile.jahr !== null)
    return { jahr: zeile.jahr, stichtag: null };
  if (zeile.monat === null || zeile.halbtage === null) return undefined;
  const tag: Tag = `${zeile.monat}-01`;
  return { jahr: jahrVon(tag), stichtag: { tag, halbtage: zeile.halbtage } };
};

/**
 * Whether a start on a cut-off date would fall in or after a closed month of the person (a removed
 * month counts as closed): it would change what that closing recorded, which its Prüfwert covers
 */
export const stichtagGesperrt = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  anpassung: { art: string; monat?: string },
): boolean => {
  if (anpassung.art !== "startsaldo" && anpassung.art !== "urlaub_stichtag") return false;
  const monat = anpassung.monat;
  if (monat === undefined) return false;
  return [...abgeschlosseneMonate(db, betriebId, nutzerId)].some((m) => m <= monat);
};

/** The start balances whose cut-off date is the first day of `monat`, overtime first */
export const startsaldenIm = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  monat: Monat,
): Startsaldo[] =>
  anpassungenVon(db, betriebId, nutzerId)
    .filter((z) => z.monat === monat)
    .flatMap((z): Startsaldo[] => {
      if (z.art === "startsaldo" && z.minuten !== null)
        return [{ art: "ueberstunden", minuten: z.minuten, grund: z.grund }];
      if (z.art === "urlaub_stichtag" && z.halbtage !== null)
        return [{ art: "urlaub", halbtage: z.halbtage, grund: z.grund }];
      return [];
    })
    .sort((a, b) => a.art.localeCompare(b.art));

/** A start balance an earlier import wrote, by its id in the old tool */
export type UebernommenerSaldo = {
  nutzerId: string;
  monat: string | null;
  minuten: number | null;
  halbtage: number | null;
};

/** The start balances of the tool `quelle` the business already holds, by their id there */
export const uebernommeneSalden = (
  db: Db,
  betriebId: string,
  quelle: string,
): Map<string, UebernommenerSaldo> =>
  new Map(
    db
      .select()
      .from(kontoAnpassungen)
      .where(
        and(eq(kontoAnpassungen.betriebId, betriebId), eq(kontoAnpassungen.externQuelle, quelle)),
      )
      .orderBy(asc(kontoAnpassungen.erstelltAm))
      .all()
      .map((z) => [
        z.externId as string,
        { nutzerId: z.nutzerId, monat: z.monat, minuten: z.minuten, halbtage: z.halbtage },
      ]),
  );
