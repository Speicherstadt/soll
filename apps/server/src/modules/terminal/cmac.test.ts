import { describe, expect, it } from "vitest";
import { aesCmac } from "./cmac.ts";

/** The examples of RFC 4493, section 4 (AES-128) */
const SCHLUESSEL = Buffer.from("2b7e151628aed2a6abf7158809cf4f3c", "hex");
const NACHRICHT = Buffer.from(
  "6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710",
  "hex",
);

describe("AES-128 CMAC (RFC 4493)", () => {
  it.each([
    [0, "bb1d6929e95937287fa37d129b756746"],
    [16, "070a16b46b4d4144f79bdd9dd04a287c"],
    [40, "dfa66747de9ae63030ca32611497c827"],
    [64, "51f0bebf7e3b9d92fc49741779363cfe"],
  ])("gives the example's MAC for %i bytes", (laenge, mac) => {
    expect(Buffer.from(aesCmac(SCHLUESSEL, NACHRICHT.subarray(0, laenge))).toString("hex")).toBe(
      mac,
    );
  });
});
