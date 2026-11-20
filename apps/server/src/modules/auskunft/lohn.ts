import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { datevPersonalnummern } from "../../db/schema.ts";

/*
 * The person's personnel number in the payroll program (S-308), or null; the business's DATEV
 * settings (consultant and client number, wage types) are no data about the person.
 */
export const lohnteil = (db: Db, betriebId: string, nutzerId: string) => ({
  personalnummer:
    db
      .select({ personalnummer: datevPersonalnummern.personalnummer })
      .from(datevPersonalnummern)
      .where(
        and(
          eq(datevPersonalnummern.betriebId, betriebId),
          eq(datevPersonalnummern.nutzerId, nutzerId),
        ),
      )
      .get()?.personalnummer ?? null,
});

export type Lohnteil = ReturnType<typeof lohnteil>;
