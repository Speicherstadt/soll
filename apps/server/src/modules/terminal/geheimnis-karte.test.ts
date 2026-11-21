import { describe, expect, it } from "vitest";
import { kartenKennung, terminalSchluesselAus, uidNormalisieren } from "./geheimnis.ts";

describe("the keys and the UID of a card (S-802)", () => {
  it("reads a UID as Web NFC gives it and as typed", () => {
    expect(uidNormalisieren("04:de:5f:1e:ac:c0:40")).toBe("04DE5F1EACC040");
    expect(uidNormalisieren(" 04 DE 5F 1E AC C0 40 ")).toBe("04DE5F1EACC040");
    expect(uidNormalisieren("a1-b2-c3-d4")).toBe("A1B2C3D4");
  });

  it("refuses a UID that is not 4, 7 or 10 bytes of hex", () => {
    expect(uidNormalisieren("04de5f1eacc0")).toBeNull();
    expect(uidNormalisieren("04de5f1eacc0zz")).toBeNull();
    expect(uidNormalisieren("")).toBeNull();
  });

  it("derives a key of its own for each purpose", () => {
    const schluessel = terminalSchluesselAus(new Uint8Array(32).fill(7));
    const werte = [schluessel.pin, schluessel.karte, schluessel.beleg, schluessel.spalten].map(
      (wert) => Buffer.from(wert).toString("hex"),
    );
    expect(new Set(werte).size).toBe(4);
  });

  it("gives a UID another lookup value in each business", () => {
    const { karte } = terminalSchluesselAus(new Uint8Array(32).fill(7));
    expect(kartenKennung(karte, "a", "04DE5F1EACC040")).not.toBe(
      kartenKennung(karte, "b", "04DE5F1EACC040"),
    );
    expect(kartenKennung(karte, "a", "04DE5F1EACC040")).toMatch(/^[0-9a-f]{64}$/);
  });
});
