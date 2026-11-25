import { join } from "node:path";
import { nachDemTest, temporaerOrdner } from "../test-ordner.ts";
import { oeffneDatenbank } from "./oeffnen.ts";

/**
 * A fresh, migrated database in a temporary file for one test (CLAUDE.md: SQLite in a temporary file,
 * never a database with real data); closed and removed with its directory after the test.
 */
export const testDatenbank = () => {
  const ordner = temporaerOrdner("soll-test-");
  const pfad = join(ordner, "soll.db");
  const offen = oeffneDatenbank(pfad, 0);
  nachDemTest(() => offen.schliessen());
  return { ...offen, pfad };
};
