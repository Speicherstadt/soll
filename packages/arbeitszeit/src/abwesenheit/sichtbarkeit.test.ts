import { describe, expect, it } from "vitest";
import { ABWESENHEITSARTEN } from "../soll/typen.ts";
import { sichtbareArt } from "./sichtbarkeit.ts";

describe("sichtbareArt (Art. 9 DSGVO)", () => {
  it("shows sickness and a child's sickness only as „abwesend“ without the right", () => {
    expect(ABWESENHEITSARTEN.map((art) => sichtbareArt(art, false))).toEqual([
      "urlaub",
      "abwesend",
      "abwesend",
      "sonderurlaub",
      "ueberstundenabbau",
    ]);
  });

  it("shows every kind with the right", () => {
    expect(ABWESENHEITSARTEN.map((art) => sichtbareArt(art, true))).toEqual([...ABWESENHEITSARTEN]);
  });
});
