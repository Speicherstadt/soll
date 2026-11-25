import type { Abwesenheitsart } from "../soll/typen.ts";

/**
 * Sickness and a child's sickness are health data (Art. 9 DSGVO): whoever may not see them reads
 * only „abwesend“, and so does everyone in the team calendar and the shift plan (BAULISTE.md S-401)
 */
export const GESUNDHEIT: ReadonlySet<Abwesenheitsart> = new Set(["krank", "kind_krank"]);

export type SichtbareArt = Abwesenheitsart | "abwesend";

/**
 * The kind of an absence as a reader sees it: as it is with the right to see sickness, otherwise
 * every kind „abwesend“; were leave named, „abwesend“ would mean sickness (docs/plan.md, "Wer
 * krank sieht")
 */
export const sichtbareArt = (art: Abwesenheitsart, gesundheitSehen: boolean): SichtbareArt =>
  gesundheitSehen ? art : "abwesend";
