import { describe, expect, it } from "vitest";
import { qrPfad } from "./qrPfad.ts";

describe("the QR code of a card", () => {
  it("has a quiet zone of four modules and the three finder patterns", () => {
    const { groesse, pfad } = qrPfad("soll-ausweis:abc");
    // version 2 is 25 modules wide, plus 4 on each side
    expect(groesse).toBe(33);
    expect(pfad.startsWith("M4 4h1v1h-1z")).toBe(true);
    expect(pfad).not.toContain("M3 ");
    expect(pfad).toContain(`M${groesse - 5} 4h1v1h-1z`);
    expect(pfad).toContain(`M4 ${groesse - 5}h1v1h-1z`);
  });
});
