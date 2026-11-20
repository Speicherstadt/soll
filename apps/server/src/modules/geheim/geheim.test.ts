import { describe, expect, it } from "vitest";
import { entschluesseln, verschluesseln } from "./index.ts";

const schluessel = new Uint8Array(32).fill(7);

describe("encrypted columns", () => {
  it("returns the plain text with the same key and purpose", () => {
    const geheim = verschluesseln(schluessel, "vapid", "streng geheim");
    expect(geheim).not.toContain("streng geheim");
    expect(geheim.startsWith("v1.")).toBe(true);
    expect(entschluesseln(schluessel, "vapid", geheim)).toEqual({
      ok: true,
      wert: "streng geheim",
    });
  });

  it("encrypts the same text differently each time (random nonce)", () => {
    expect(verschluesseln(schluessel, "x", "a")).not.toBe(verschluesseln(schluessel, "x", "a"));
  });

  it("refuses another key, another purpose and a changed text", () => {
    const geheim = verschluesseln(schluessel, "vapid", "streng geheim");
    expect(entschluesseln(new Uint8Array(32).fill(8), "vapid", geheim).ok).toBe(false);
    expect(entschluesseln(schluessel, "push_abo", geheim).ok).toBe(false);
    const geaendert = `${geheim.slice(0, -2)}${geheim.endsWith("A") ? "B" : "A"}A`;
    expect(entschluesseln(schluessel, "vapid", geaendert).ok).toBe(false);
    expect(entschluesseln(schluessel, "vapid", "kein geheimnis").ok).toBe(false);
  });
});
