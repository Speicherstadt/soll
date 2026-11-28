import { describe, expect, it } from "vitest";
import { hinweisArt } from "./hinweisArt.ts";

describe("terminal prompt icon selection (#118)", () => {
  it("picks NFC when card reader is present", () => {
    expect(hinweisArt(true, false)).toBe("nfc");
    expect(hinweisArt(true, true)).toBe("nfc");
  });

  it("picks QR when QR camera is active without NFC", () => {
    expect(hinweisArt(false, true)).toBe("qr");
  });

  it("picks PIN icon instead of QR when neither NFC nor QR is available", () => {
    expect(hinweisArt(false, false)).toBe("pin");
  });
});
