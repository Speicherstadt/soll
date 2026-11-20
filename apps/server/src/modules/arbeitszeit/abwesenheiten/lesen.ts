import {
  type Abwesenheit,
  type Abwesenheitszeitraum,
  type Tag,
  tageDesZeitraums,
} from "@soll/arbeitszeit";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { Db } from "../../../db/oeffnen.ts";
import { abwesenheiten } from "../../../db/schema.ts";

/*
 * Reading absences (S-401). Only approved ones count for Soll, Ist and leave; a request counts once
 * it is approved, a sickness from its report.
 */

export type AbwesenheitZeile = typeof abwesenheiten.$inferSelect;
export type Status = AbwesenheitZeile["status"];

/** Requests still open and absences in force: what a new entry may not overlap */
export const AKTIV: readonly Status[] = ["beantragt", "genehmigt"];

export const abwesenheitLesen = (
  db: Db,
  betriebId: string,
  abwesenheitId: string,
): AbwesenheitZeile | undefined =>
  db
    .select()
    .from(abwesenheiten)
    .where(
      and(eq(abwesenheiten.betriebId, betriebId), eq(abwesenheiten.abwesenheitId, abwesenheitId)),
    )
    .get();

/**
 * The absences of a business that reach into the days from `von` to `bis` (an open end reaches on),
 * of one person or all, in the states asked for, in the order they begin
 */
export const abwesenheitenIn = (
  db: Db,
  betriebId: string,
  wo: { nutzerId?: string; von: Tag; bis: Tag; status?: readonly Status[] },
): AbwesenheitZeile[] =>
  db
    .select()
    .from(abwesenheiten)
    .where(
      and(
        eq(abwesenheiten.betriebId, betriebId),
        ...(wo.nutzerId === undefined ? [] : [eq(abwesenheiten.nutzerId, wo.nutzerId)]),
        ...(wo.status === undefined ? [] : [inArray(abwesenheiten.status, [...wo.status])]),
        lte(abwesenheiten.von, wo.bis),
        or(isNull(abwesenheiten.bis), gte(abwesenheiten.bis, wo.von)),
      ),
    )
    .orderBy(asc(abwesenheiten.von), asc(abwesenheiten.erstelltAm))
    .all();

/** A row as the span the pure functions of packages/arbeitszeit take */
export const alsZeitraum = (zeile: AbwesenheitZeile): Abwesenheitszeitraum => ({
  art: zeile.art,
  von: zeile.von,
  bis: zeile.bis,
  ersterHalb: zeile.ersterHalb,
  letzterHalb: zeile.letzterHalb,
  bescheinigung: zeile.bescheinigung !== null,
  kind: zeile.kind,
});

/** Whether a row counts for Soll and leave: it is approved (a sickness from its report) */
export const zaehlt = (zeile: Pick<AbwesenheitZeile, "status">): boolean =>
  zeile.status === "genehmigt";

/**
 * The days of the rows that count, as `tagesSoll` takes them; an open sickness counts up to
 * `offenBis` (today, or the last day of a month that is over)
 */
export const tageDerAbwesenheiten = (
  zeilen: readonly AbwesenheitZeile[],
  offenBis: Tag,
): Abwesenheit[] =>
  zeilen.filter(zaehlt).flatMap((z) => tageDesZeitraums(alsZeitraum(z), offenBis));

/** The approved absences of a person on the days from `von` to `bis` */
export const abwesenheitstage = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: Tag,
  bis: Tag,
  offenBis: Tag,
): Abwesenheit[] =>
  tageDerAbwesenheiten(
    abwesenheitenIn(db, betriebId, { nutzerId, von, bis, status: ["genehmigt"] }),
    offenBis,
  ).filter((a) => a.tag >= von && a.tag <= bis);
