/**
 * S-901: a removal whose link is dated after the time of the check (a server clock set
 * forward, then back) must not pass as a genuine removal after the retention period
 */
import { describe, expect, it } from "vitest";
import { aussondern } from "../modules/arbeitszeit/index.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { abgeschlossen, JETZT, nachtrag, pruefen, um } from "./monat-testhilfen.ts";

describe("a removal dated in the future (S-901)", () => {
  it("does not recognise October 2026 as removed in November 2026", async () => {
    const { server, jonas, sandra, pruefwert } = await abgeschlossen();
    // the clock stood at 2029 for one run of the loop, then was set back
    const { ausgesondert } = aussondern(
      server.db,
      server.schreibDb,
      um("2029-01-01T00:00:00+01:00"),
    );
    expect(ausgesondert.map((a) => a.monat)).toEqual(["2026-10"]);
    server.stelleUhr(JETZT);
    // work goes on in November 2026: a later link with an earlier time
    expect(
      (
        await nachtrag(sandra, {
          art: "kommen",
          zeitpunkt: um("2026-11-05T08:00:00+01:00"),
          grund: "Zettel",
        })
      ).status,
    ).toBe(201);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    // checked on 20 November 2026, a month closed in November 2026 cannot be past its 2 years
    expect(await pruefen(server, jonas.betriebId, pruefwert)).not.toMatchObject({
      ergebnis: "ausgesondert",
    });
  });
});
