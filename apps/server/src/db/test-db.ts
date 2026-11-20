import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { oeffneDatenbank } from "./oeffnen.ts";

/**
 * A fresh, migrated database in a temporary file for one test (CLAUDE.md: SQLite in a temporary file,
 * never a database with real data); removed after the test.
 */
export const testDatenbank = () => {
  const ordner = mkdtempSync(join(tmpdir(), "soll-test-"));
  const pfad = join(ordner, "soll.db");
  const offen = oeffneDatenbank(pfad, 0);
  afterEach(() => {
    offen.schliessen();
    rmSync(ordner, { recursive: true, force: true });
  });
  return { ...offen, pfad };
};
