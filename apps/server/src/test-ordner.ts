import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, onTestFinished } from "vitest";

/**
 * Runs `aufraeumen` once the test that called it has finished, passed, failed or timed out (called in a
 * test or a beforeEach), or once the file's tests are done (called while the file is collected or in
 * beforeAll). An `afterEach` registered inside a running test never runs, which once left every test
 * database under /tmp until the disk was full (SQLITE_FULL). Vitest runs both kinds of hook as a
 * stack, so what was registered last is cleaned up first.
 */
export const nachDemTest = (aufraeumen: () => void) => {
  try {
    onTestFinished(aufraeumen);
  } catch {
    afterAll(aufraeumen);
  }
};

/** A fresh directory under the system's temporary directory, removed after the test */
export const temporaerOrdner = (praefix: string) => {
  const ordner = mkdtempSync(join(tmpdir(), praefix));
  nachDemTest(() => rmSync(ordner, { recursive: true, force: true }));
  return ordner;
};
