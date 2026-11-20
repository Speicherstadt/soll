import { describe, expect, it } from "vitest";
import { ABWESENHEITSARTEN } from "../soll/typen.ts";
import { sichtbareArt } from "./sichtbarkeit.ts";

describe("sichtbareArt (Art. 9 DSGVO)", () => {
  it("shows every kind only as „abwesend“ without the right, so none tells sickness", () => {
    expect(ABWESENHEITSARTEN.map((art) => sichtbareArt(art, false))).toEqual([
      "abwesend",
      "abwesend",
      "abwesend",
      "abwesend",
      "abwesend",
    ]);
  });

  it("shows every kind with the right", () => {
    expect(ABWESENHEITSARTEN.map((art) => sichtbareArt(art, true))).toEqual([...ABWESENHEITSARTEN]);
  });
});
