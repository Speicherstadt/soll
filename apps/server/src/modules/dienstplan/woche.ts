import {
  bedarfsDeckung,
  type Deckung,
  type Kalenderwoche,
  planWoche,
  plusTage,
  type Tag,
} from "@soll/arbeitszeit";
import { darf } from "../../auth/rollen.ts";
import type { Db } from "../../db/oeffnen.ts";
import { mitgliederMitNamen, namenVon } from "../mitglieder/index.ts";
import { bedarfeLesen } from "./bedarf.ts";
import { type Schicht, schichtenZwischen } from "./schichten.ts";

export type Planperson = { nutzerId: string; name: string };

export type Wochenansicht = {
  standortId: string;
  tage: Tag[];
  kw: Kalenderwoche;
  /** the people of the rows; for whoever plans every plannable member */
  personen: Planperson[];
  schichten: Schicht[];
  /** the need per role and its coverage; only for whoever plans */
  deckung: Deckung[] | null;
};

const ohneAlte = (alle: Schicht[], tage: readonly Tag[]) =>
  alle.filter((schicht) => tage.includes(schicht.tag));

/**
 * The week of a site for whoever plans: drafts included, every member who can be planned as a row
 * (names of colleagues are what a plan shows, docs/plan.md "Wer die Mitgliederliste sieht"), and the
 * coverage of the need. A night shift of the Sunday before reaches into Monday's need, so it is read
 * for the coverage, not shown. No sums per person (BetrVG § 87, CLAUDE.md).
 */
export const planerWoche = (db: Db, betriebId: string, standortId: string, tag: Tag) => {
  const { tage, kw } = planWoche(tag);
  const alle = schichtenZwischen(
    db,
    betriebId,
    standortId,
    plusTage(tage[0] ?? tag, -1),
    tage[6] ?? tag,
  );
  const personen = mitgliederMitNamen(db, betriebId)
    .filter(({ rolle }) => darf(rolle, "stempeln"))
    .map(({ nutzerId, name }) => ({ nutzerId, name }));
  const namen = namenVon(
    db,
    alle.flatMap((schicht) => (schicht.nutzerId ? [schicht.nutzerId] : [])),
  );
  const fehlende = [...namen]
    .filter(([nutzerId]) => !personen.some((person) => person.nutzerId === nutzerId))
    .map(([nutzerId, name]) => ({ nutzerId, name }));
  return {
    standortId,
    tage,
    kw,
    personen: [...personen, ...fehlende],
    schichten: ohneAlte(alle, tage),
    deckung: bedarfsDeckung(tage, bedarfeLesen(db, betriebId, standortId), alle),
  } satisfies Wochenansicht;
};

/**
 * The week of a site for everyone else: published shifts only (S-503), the draft stays with owner
 * and planner; the rows are the people of those shifts, no member list and no need
 */
export const veroeffentlichteWoche = (
  db: Db,
  betriebId: string,
  standortId: string,
  tag: Tag,
): Wochenansicht => {
  const { tage, kw } = planWoche(tag);
  const schichten = schichtenZwischen(
    db,
    betriebId,
    standortId,
    tage[0] ?? tag,
    tage[6] ?? tag,
  ).filter((schicht) => schicht.veroeffentlichtAm !== null);
  const namen = namenVon(
    db,
    schichten.flatMap((schicht) => (schicht.nutzerId ? [schicht.nutzerId] : [])),
  );
  return {
    standortId,
    tage,
    kw,
    personen: [...namen].map(([nutzerId, name]) => ({ nutzerId, name })),
    schichten,
    deckung: null,
  };
};
