import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { GENESIS } from "./hash.ts";
import { pruefwertPruefen } from "./index.ts";

/**
 * Links are numbered from 1 (docs/audit-kette.md), so no Prüfwert ever names number 0. Calling it a
 * deviation would report a change to a chain that has none, even to a business without any link.
 */
describe("a Prüfwert with number 0", () => {
  it("is unknown, not a deviation, for a business without a chain", () => {
    const { db } = testDatenbank();
    expect(pruefwertPruefen(db, "elbblick", `Nr. 0 · ${GENESIS}`)).toBe("unbekannt");
  });
});
