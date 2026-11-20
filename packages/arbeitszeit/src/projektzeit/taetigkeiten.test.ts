import { describe, expect, it } from "vitest";
import { FESTE_TAETIGKEITEN, istFesteTaetigkeit } from "./taetigkeiten.ts";

describe("FESTE_TAETIGKEITEN", () => {
  it("are travel, workshop, store and training", () => {
    expect(FESTE_TAETIGKEITEN).toEqual(["fahrt", "werkstatt", "lager", "schulung"]);
  });

  it("recognises their ids and nothing else", () => {
    for (const id of FESTE_TAETIGKEITEN) expect(istFesteTaetigkeit(id)).toBe(true);
    for (const id of ["montage", "Fahrt", "", crypto.randomUUID()])
      expect(istFesteTaetigkeit(id)).toBe(false);
  });
});
