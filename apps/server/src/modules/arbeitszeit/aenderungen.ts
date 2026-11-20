import type { Stempelart } from "@soll/arbeitszeit";
import { and, eq, gte, isNotNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "../../db/oeffnen.ts";
import { stempelungen } from "../../db/schema.ts";

type Zeile = typeof stempelungen.$inferSelect;

/** What a person sees of a change to their times: who, when, what before and after, and why */
export type Aenderung = {
  stempelId: string;
  aktion: "nachgetragen" | "geaendert" | "entfernt";
  vorher: { art: Stempelart; zeitpunkt: number } | null;
  nachher: { art: Stempelart; zeitpunkt: number } | null;
  grund: string;
  von: string;
  am: number;
};

const vorgaenger = alias(stempelungen, "vorgaenger");

const alsAenderung = (zeile: Zeile, vorher: Zeile | null): Aenderung => ({
  stempelId: zeile.stempelId,
  aktion: vorher === null ? "nachgetragen" : zeile.entfernt ? "entfernt" : "geaendert",
  vorher: vorher === null ? null : { art: vorher.art, zeitpunkt: vorher.zeitpunkt },
  nachher: zeile.entfernt ? null : { art: zeile.art, zeitpunkt: zeile.zeitpunkt },
  grund: zeile.grund ?? "",
  von: zeile.erstelltVon,
  am: zeile.erstelltAm,
});

/**
 * Every change by hand to a person's stamps whose instant before or after lies from `von` to before
 * `bis`, in the order they were made
 */
export const aenderungenIn = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  von: number,
  bis: number,
): Aenderung[] =>
  db
    .select({ zeile: stempelungen, vorher: vorgaenger })
    .from(stempelungen)
    .leftJoin(
      vorgaenger,
      and(
        eq(vorgaenger.betriebId, stempelungen.betriebId),
        eq(vorgaenger.stempelId, stempelungen.ersetzt),
      ),
    )
    .where(
      and(
        eq(stempelungen.betriebId, betriebId),
        eq(stempelungen.nutzerId, nutzerId),
        isNotNull(stempelungen.grund),
        or(
          and(gte(stempelungen.zeitpunkt, von), lt(stempelungen.zeitpunkt, bis)),
          and(gte(vorgaenger.zeitpunkt, von), lt(vorgaenger.zeitpunkt, bis)),
        ),
      ),
    )
    .orderBy(stempelungen.erstelltAm)
    .all()
    .map(({ zeile, vorher }) => alsAenderung(zeile, vorher));
