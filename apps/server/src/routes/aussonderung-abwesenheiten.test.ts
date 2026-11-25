/**
 * Removal after the retention period (S-901) and absences (S-401): an absence is part of the content
 * of the months it touches, so it goes with them; one reaching into a month that is kept stays.
 */
import { describe, expect, it } from "vitest";
import { aussondern } from "../modules/arbeitszeit/index.ts";
import { kettePruefen } from "../modules/audit/index.ts";
import { angelegt, antrag, schritt } from "./abwesenheit-testhilfen.ts";
import { abgeschlossen, pruefen, um } from "./monat-testhilfen.ts";

const NEUJAHR_2029 = um("2029-01-01T00:00:00+01:00");

type Server = Awaited<ReturnType<typeof abgeschlossen>>["server"];

const abwesenheitenVon = (server: Server, nutzerId: string) =>
  server.sqlite
    .query("SELECT von, status FROM abwesenheiten WHERE nutzer_id = ? ORDER BY von")
    .all(nutzerId) as { von: string; status: string }[];

describe("removing the absences of a closed month after its retention period", () => {
  it("removes approved leave and a refused request of the month; the chain verifies", async () => {
    const { server, jonas, sandra, pruefwert } = await abgeschlossen({}, async (w) => {
      const urlaub = await angelegt(
        antrag(w.sandra, { art: "urlaub", von: "2026-10-07", bis: "2026-10-08" }),
      );
      expect((await schritt(w.jonas, urlaub, "freigeben")).status).toBe(200);
      const abgelehnt = await angelegt(
        antrag(w.sandra, { art: "urlaub", von: "2026-10-12", bis: "2026-10-12" }),
      );
      expect((await schritt(w.jonas, abgelehnt, "ablehnen", { grund: "Baustelle" })).status).toBe(
        200,
      );
    });
    expect(abwesenheitenVon(server, sandra.nutzerId)).toHaveLength(2);

    const { ausgesondert } = aussondern(server.db, server.schreibDb, NEUJAHR_2029);

    // eight rows of S-306 (six stamps, confirmation, closing) and the two absences
    expect(ausgesondert.map(({ monat, zeilen }) => ({ monat, zeilen }))).toEqual([
      { monat: "2026-10", zeilen: 10 },
    ]);
    expect(abwesenheitenVon(server, sandra.nutzerId)).toEqual([]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    // the check happens after the removal: its link is no later than now
    server.stelleUhr(Date.parse("2036-01-01T00:00:00+01:00"));
    expect(
      ((await pruefen(server, jonas.betriebId, pruefwert)) as { ergebnis: string }).ergebnis,
    ).toBe("ausgesondert");
  });

  it("keeps an absence that reaches into a month not removed", async () => {
    const { server, sandra } = await abgeschlossen({}, async (w) => {
      const urlaub = await angelegt(
        antrag(w.sandra, { art: "urlaub", von: "2026-10-29", bis: "2026-11-03" }),
      );
      expect((await schritt(w.jonas, urlaub, "freigeben")).status).toBe(200);
    });

    aussondern(server.db, server.schreibDb, NEUJAHR_2029);

    expect(abwesenheitenVon(server, sandra.nutzerId)).toEqual([
      { von: "2026-10-29", status: "genehmigt" },
    ]);
  });
});
