import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { stundennachweisBuchungen } from "../../db/schema.ts";

/** Whether a booking stands in a signed Stundennachweis, which locks it (S-605) */
export const imNachweis = (db: Db, betriebId: string, buchungId: string): boolean =>
  db
    .select({ buchungId: stundennachweisBuchungen.buchungId })
    .from(stundennachweisBuchungen)
    .where(
      and(
        eq(stundennachweisBuchungen.betriebId, betriebId),
        eq(stundennachweisBuchungen.buchungId, buchungId),
      ),
    )
    .get() !== undefined;
