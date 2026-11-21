import { describe, expect, it } from "vitest";
import { BELEG_GILT_MS, belegAusstellen, belegPruefen } from "./beleg.ts";

const SCHLUESSEL = new Uint8Array(32).fill(3);
const JETZT = Date.parse("2026-11-20T07:58:00+01:00");

describe("the receipt of a card recognised by its SUN message", () => {
  const beleg = belegAusstellen(SCHLUESSEL, { terminalId: "t1", nutzerId: "sandra" }, JETZT);

  it("names the person at the same terminal while it holds", () => {
    expect(belegPruefen(SCHLUESSEL, beleg, "t1", JETZT + BELEG_GILT_MS - 1)).toBe("sandra");
  });

  it("is nothing at another terminal, once expired or under another key", () => {
    expect(belegPruefen(SCHLUESSEL, beleg, "t2", JETZT)).toBeUndefined();
    expect(belegPruefen(SCHLUESSEL, beleg, "t1", JETZT + BELEG_GILT_MS)).toBeUndefined();
    expect(belegPruefen(new Uint8Array(32), beleg, "t1", JETZT)).toBeUndefined();
  });

  it("is nothing when changed", () => {
    const [inhalt, mac] = beleg.split(".");
    const anders = Buffer.from(JSON.stringify(["t1", "max", JETZT + 1000])).toString("base64url");
    expect(belegPruefen(SCHLUESSEL, `${anders}.${mac}`, "t1", JETZT)).toBeUndefined();
    expect(belegPruefen(SCHLUESSEL, `${inhalt}`, "t1", JETZT)).toBeUndefined();
    expect(belegPruefen(SCHLUESSEL, "kaputt.kaputt", "t1", JETZT)).toBeUndefined();
  });
});
