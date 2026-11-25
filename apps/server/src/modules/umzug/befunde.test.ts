import type { ImportZeit } from "@soll/import";
import { describe, expect, it } from "vitest";
import { vorschauBefunde } from "./befunde.ts";

const zeit = (
  person: string,
  tag: string,
  beginn: number,
  ende: number,
  pause = 0,
): ImportZeit => ({
  externalId: `${person}-${tag}`,
  zeile: 2,
  person,
  tag,
  beginn,
  ende,
  pauseMinuten: pause,
});

const JETZT = Date.parse("2026-11-25T12:00:00+01:00");

describe("findings of the rules on the times of a file", () => {
  it("shows a shift too long and without a break, with their norms, per person", () => {
    const befunde = vorschauBefunde(
      [
        zeit("Sandra Kühn", "2026-09-01", 7 * 60, 18 * 60 + 30),
        zeit("Sandra Kühn", "2026-09-02", 2 * 60, 6 * 60),
        zeit("Max Brandt", "2026-09-01", 7 * 60, 15 * 60 + 30, 30),
      ],
      JETZT,
    );
    // the span from 2:00 begins under 9 h after 18:30 and so continues the shift of 1 September
    // (S-201): 15:30 of work in one shift, without a break
    expect(befunde).toEqual([
      {
        person: "Sandra Kühn",
        regel: "R-02",
        norm: "§ 3 Satz 2 ArbZG",
        schwere: "verstoss",
        tage: ["2026-09-01"],
      },
      {
        person: "Sandra Kühn",
        regel: "R-04",
        norm: "§ 4 Satz 3 ArbZG",
        schwere: "verstoss",
        tage: ["2026-09-01"],
      },
    ]);
  });

  it("has nothing to say about a correct week", () => {
    const woche = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"];
    expect(
      vorschauBefunde(
        woche.map((tag) => zeit("Max", tag, 7 * 60, 15 * 60 + 30, 30)),
        JETZT,
      ),
    ).toEqual([]);
  });
});
