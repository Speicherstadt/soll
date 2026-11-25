import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, onTestFinished } from "vitest";

/**
 * What was opened outside a test (while the file is collected or in a beforeAll), cleaned up once the
 * file's tests are done. A hook registered while the tests run never runs in Vitest, so this one is
 * registered when a test file imports this module; each test file imports it afresh (isolate).
 */
const nachDerDatei: (() => void)[] = [];
afterAll(() => {
  for (const aufraeumen of nachDerDatei.splice(0).reverse()) aufraeumen();
});

/**
 * Runs `aufraeumen` once the test that called it has finished, passed, failed or timed out (called in a
 * test or a beforeEach), or once the file's tests are done (called while the file is collected or in a
 * beforeAll). An `afterEach` registered inside a running test never runs, which once left every test
 * database under /tmp until the disk was full (SQLITE_FULL). Both run as a stack, so what was
 * registered last is cleaned up first.
 */
export const nachDemTest = (aufraeumen: () => void) => {
  try {
    onTestFinished(aufraeumen);
  } catch {
    nachDerDatei.push(aufraeumen);
  }
};

/** A fresh directory under the system's temporary directory, removed after the test */
export const temporaerOrdner = (praefix: string) => {
  const ordner = mkdtempSync(join(tmpdir(), praefix));
  nachDemTest(() => rmSync(ordner, { recursive: true, force: true }));
  return ordner;
};
