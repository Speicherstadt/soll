import { describe, expect, it } from "vitest";
import { textAusBytes as textVon } from "./text.ts";

describe("the text of an uploaded file", () => {
  it("reads UTF-8, and Windows-1252 as Excel saves a CSV in a German locale", () => {
    expect(textVon(new TextEncoder().encode("Sandra Kühn;Straße"))).toBe("Sandra Kühn;Straße");
    // "Kühn" in Windows-1252: ü is 0xFC, no valid UTF-8
    expect(textVon(new Uint8Array([0x4b, 0xfc, 0x68, 0x6e]))).toBe("Kühn");
  });
});
