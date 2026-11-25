import { beforeAll, expect, it } from "vitest";
import { betriebe } from "../db/schema.ts";
import { testDatenbank } from "../db/test-db.ts";

// A second file: what a file opens in beforeAll is removed when that file is done, in every file

let offen: ReturnType<typeof testDatenbank>;
beforeAll(() => {
  offen = testDatenbank();
});

it("reads the database opened in beforeAll", () => {
  expect(offen.db.select().from(betriebe).all()).toEqual([]);
});
