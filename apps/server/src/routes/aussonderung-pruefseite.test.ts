/**
 * S-901: the check page after a removal whose 8 years came from a counter-entry booked in the month
 */
import { describe, expect, it } from "vitest";
import { aussondern } from "../modules/arbeitszeit/index.ts";
import {
  abgeschlossen,
  abschliessen,
  bestaetigen,
  type Json,
  json,
  nachtrag,
  pruefen,
  um,
} from "./monat-testhilfen.ts";

const OKTOBER = um("2026-10-15T09:00:00+02:00");
const JETZT = um("2026-11-20T09:00:00+01:00");
const FALSCHES_GEHEN = um("2026-10-01T02:00:00+02:00");

/** September by the hour (8 years) or by the month (2 years) */
const fall = (stundenlohn: boolean) =>
  abgeschlossen({}, async (w) => {
    const modell = stundenlohn
      ? await json(
          await w.jonas.anfrage("/api/v1/arbeitszeit/modelle", {
            body: {
              name: "Stundenlohn",
              sollMinuten: [480, 480, 480, 480, 480, 0, 0],
              lohnArt: "stunde",
              lohnCent: 1_500,
              minijob: false,
              gueltigAb: "2026-01-01",
            },
          }),
        )
      : w.modell;
    expect(
      (
        await w.jonas.anfrage(`/api/v1/arbeitszeit/personen/${w.sandra.nutzerId}/modell`, {
          method: "PUT",
          body: { modellId: modell.modellId, gueltigAb: "2026-09-01" },
        })
      ).status,
    ).toBeLessThan(300);
    const fuer = (body: Json) => nachtrag(w.jonas, { nutzerId: w.sandra.nutzerId, ...body });
    await fuer({ art: "kommen", zeitpunkt: um("2026-09-30T22:00:00+02:00"), grund: "Zettel" });
    const falsch = await json(
      await fuer({ art: "gehen", zeitpunkt: FALSCHES_GEHEN, grund: "Zettel" }),
    );
    expect(
      (
        await w.jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${falsch.stempelId}/entfernen`, {
          body: { grund: "falsche Zeit" },
        })
      ).status,
    ).toBeLessThan(300);
    await fuer({ art: "gehen", zeitpunkt: um("2026-09-30T23:30:00+02:00"), grund: "Zettel" });
    w.server.stelleUhr(OKTOBER);
    expect((await bestaetigen(w.sandra, "2026-09")).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId, { monat: "2026-09" })).status).toBe(201);
    w.server.stelleUhr(JETZT);
  });

type S = Awaited<ReturnType<typeof fall>>["server"];
const falsche = (server: S) =>
  server.sqlite.query("SELECT entfernt FROM stempelungen WHERE zeitpunkt = ?").all(FALSCHES_GEHEN);

describe("S-901 review 2: removed stamps are removed at all", () => {
  it("removes the removed Gehen once September (8 y) follows October (2 y)", async () => {
    const { server } = await fall(true);
    aussondern(server.db, server.schreibDb, um("2029-01-01T00:00:00+01:00"));
    expect(falsche(server)).toHaveLength(2);
    const { ausgesondert } = aussondern(
      server.db,
      server.schreibDb,
      um("2035-01-01T00:00:00+01:00"),
    );
    expect(ausgesondert.map((a) => a.monat)).toEqual(["2026-09"]);
    expect(falsche(server)).toHaveLength(0);
  });

  it("recognises November's Prüfwert after removal when a counter-entry made it 8 years", async () => {
    const { server, jonas, sandra } = await fall(true);
    // a counter-entry to an hourly September day, booked in November and closed with November
    server.stelleUhr(um("2026-11-25T09:00:00+01:00"));
    expect(
      (
        await jonas.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
          body: { nutzerId: sandra.nutzerId, tag: "2026-09-15", minuten: 60, grund: "Fahrt" },
        })
      ).status,
    ).toBe(201);
    server.stelleUhr(um("2026-12-02T09:00:00+01:00"));
    expect((await bestaetigen(sandra, "2026-11")).status).toBe(201);
    const nov = await json(await abschliessen(jonas, sandra.nutzerId, { monat: "2026-11" }));
    const novPruefwert = (nov.abschluss as Json).pruefwert as string;
    const { ausgesondert } = aussondern(
      server.db,
      server.schreibDb,
      um("2035-01-01T00:00:00+01:00"),
    );
    expect(ausgesondert.map(({ monat, jahre }) => ({ monat, jahre }))).toEqual([
      { monat: "2026-09", jahre: 8 },
      { monat: "2026-10", jahre: 2 },
      { monat: "2026-11", jahre: 8 },
    ]);
    expect(await pruefen(server, jonas.betriebId, novPruefwert)).toMatchObject({
      ergebnis: "ausgesondert",
      monat: "2026-11",
      jahre: 8,
    });
  });

  it("removes the removed Gehen when September and October go in one run", async () => {
    const { server } = await fall(false);
    const { ausgesondert } = aussondern(
      server.db,
      server.schreibDb,
      um("2029-01-01T00:00:00+01:00"),
    );
    expect(ausgesondert.map((a) => a.monat)).toEqual(["2026-09", "2026-10"]);
    expect(falsche(server)).toHaveLength(0);
  });
});
