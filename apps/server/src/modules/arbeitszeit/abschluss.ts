import type { Tag } from "@soll/arbeitszeit";
import type { Db } from "../../db/oeffnen.ts";

/**
 * Whether the month of `tag` is closed for a person, which locks the stamps in it (docs/plan.md,
 * "Änderungen an Stempelungen"). The closing comes with S-306; until then no month is closed, and
 * every change already asks here first, so the lock needs no change elsewhere.
 */
export const monatAbgeschlossen = (
  _db: Db,
  _betriebId: string,
  _nutzerId: string,
  _tag: Tag,
): boolean => false;
