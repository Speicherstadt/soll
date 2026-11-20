import { describe, expect, it } from "vitest";
import { GENESIS, gliedHash, kanonisch, sha256 } from "./hash.ts";

const glied = {
  betriebId: "b1",
  seq: 1,
  zeitpunkt: 1_700_000_000_000,
  akteur: "u1",
  tabelle: "betriebe",
  zeile: "b1",
  aktion: "einfuegen" as const,
  inhaltHash: sha256("{}"),
};

describe("kanonisch", () => {
  it("sorts keys at every depth", () => {
    expect(kanonisch({ b: 1, a: { d: 2, c: [{ f: 1, e: 2 }] } })).toBe(
      '{"a":{"c":[{"e":2,"f":1}],"d":2},"b":1}',
    );
  });

  it("refuses floats, as time and money are whole minutes and cents", () => {
    expect(() => kanonisch({ dauer: 7.5 })).toThrow();
  });
});

describe("gliedHash", () => {
  it("is the SHA-256 of a known value", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("changes with every field and with the predecessor", () => {
    const base = gliedHash(GENESIS, glied);
    for (const [key, value] of Object.entries({
      seq: 2,
      akteur: "u2",
      zeile: "b2",
      zeitpunkt: 1,
    })) {
      expect(gliedHash(GENESIS, { ...glied, [key]: value })).not.toBe(base);
    }
    expect(gliedHash("1".repeat(64), glied)).not.toBe(base);
  });
});
