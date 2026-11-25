import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { betriebe } from "../db/schema.ts";
import { testDatenbank } from "../db/test-db.ts";
import { temporaerOrdner } from "../test-ordner.ts";

// The ways tests call testDatenbank() and temporaerOrdner(), none of which may leave a directory
// behind; run by test-ordner.test.ts in a child vitest, never by the normal suite (two cases fail on
// purpose)

/** Reads through the connection, which throws once the database is closed */
const betriebeIn = (offen: ReturnType<typeof testDatenbank>) =>
  offen.db.select().from(betriebe).all();

describe("inside a test", () => {
  it("passes", () => {
    expect(betriebeIn(testDatenbank())).toEqual([]);
    expect(existsSync(temporaerOrdner("soll-ordner-"))).toBe(true);
  });

  it("opens two", () => {
    testDatenbank();
    expect(betriebeIn(testDatenbank())).toEqual([]);
  });

  it("fails on purpose", () => {
    testDatenbank();
    temporaerOrdner("soll-ordner-");
    expect.fail("fails on purpose");
  });

  it("runs into its timeout on purpose", { timeout: 50 }, async () => {
    testDatenbank();
    temporaerOrdner("soll-ordner-");
    await new Promise(() => undefined);
  });
});

describe("in beforeEach", () => {
  let offen: ReturnType<typeof testDatenbank>;
  beforeEach(() => {
    offen = testDatenbank();
  });

  it("first", () => {
    expect(betriebeIn(offen)).toEqual([]);
  });

  it("second", () => {
    expect(betriebeIn(offen)).toEqual([]);
  });
});

describe("while the file is collected", () => {
  const offen = testDatenbank();
  const ordner = temporaerOrdner("soll-ordner-");

  it("first", () => {
    expect(betriebeIn(offen)).toEqual([]);
  });

  it("second", () => {
    expect(betriebeIn(offen)).toEqual([]);
    expect(existsSync(ordner)).toBe(true);
  });
});
