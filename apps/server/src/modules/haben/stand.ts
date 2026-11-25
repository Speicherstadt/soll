import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { habenUebergaben } from "../../db/schema.ts";
import type { BuchungMitBezug } from "../projektzeit/index.ts";

export type Uebergabe = typeof habenUebergaben.$inferSelect;

/**
 * Where a booking stands towards Haben: `offen` (not billed yet), `abgerechnet` (billed by hand,
 * outside Haben), `wartet` (billed for Haben, not confirmed by it yet: `fehler` says why) or
 * `gesendet` (Haben answered with its entry)
 */
export type Stand = "offen" | "abgerechnet" | "wartet" | "gesendet";

export type UebergabeStand = {
  buchungId: string;
  stand: Stand;
  leistungId: string | null;
  gesendetAm: number | null;
  fehler: string | null;
  meldung: string | null;
};

export const uebergabenVon = (
  db: Db,
  betriebId: string,
  ids: readonly string[],
): Map<string, Uebergabe> =>
  new Map(
    (ids.length === 0
      ? []
      : db
          .select()
          .from(habenUebergaben)
          .where(
            and(
              eq(habenUebergaben.betriebId, betriebId),
              inArray(habenUebergaben.buchungId, [...ids]),
            ),
          )
          .all()
    ).map((zeile) => [zeile.buchungId, zeile]),
  );

const standAus = (b: BuchungMitBezug, u: Uebergabe | undefined): Stand => {
  if (u?.gesendetAm != null) return "gesendet";
  if (u) return "wartet";
  return b.zeile.abgerechnetAm === null ? "offen" : "abgerechnet";
};

/** The state of each booking towards Haben, in the order given */
export const staendeVon = (
  db: Db,
  betriebId: string,
  buchungen: readonly BuchungMitBezug[],
): UebergabeStand[] => {
  const uebergaben = uebergabenVon(
    db,
    betriebId,
    buchungen.map((b) => b.zeile.buchungId),
  );
  return buchungen.map((b) => {
    const u = uebergaben.get(b.zeile.buchungId);
    return {
      buchungId: b.zeile.buchungId,
      stand: standAus(b, u),
      leistungId: u?.leistungId ?? null,
      gesendetAm: u?.gesendetAm ?? null,
      fehler: u?.fehler ?? null,
      meldung: u?.meldung ?? null,
    };
  });
};
