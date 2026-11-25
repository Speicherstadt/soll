/**
 * S-901: October (monthly wage, 2 years) is removed while September (hourly wage,
 * 8 years) is kept; what October's removal must not take from September, and whether October,
 * from which payroll posts hours through a counter-entry, is kept as a voucher.
 */
import { lohnmonat } from "@soll/export";
import { describe, expect, it } from "vitest";
import { aussondern, lohndaten } from "../modules/arbeitszeit/index.ts";
import {
  abgeschlossen,
  abschliessen,
  bestaetigen,
  type Json,
  json,
  nachtrag,
  um,
} from "./monat-testhilfen.ts";

const NEUJAHR_2029 = um("2029-01-01T00:00:00+01:00");
const OKTOBER = um("2026-10-15T09:00:00+02:00");
const JETZT = um("2026-11-20T09:00:00+01:00");
const FALSCHES_GEHEN = um("2026-10-01T02:00:00+02:00");

/** Sandra paid by the hour in September, by the month from October; September closed in October */
const mitStundenlohnImSeptember = (gegeneintrag: boolean) =>
  abgeschlossen({}, async (w) => {
    const stunde = await json(
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
    );
    expect(
      (
        await w.jonas.anfrage(`/api/v1/arbeitszeit/personen/${w.sandra.nutzerId}/modell`, {
          method: "PUT",
          body: { modellId: stunde.modellId, gueltigAb: "2026-09-01" },
        })
      ).status,
    ).toBeLessThan(300);
    // the night shift of 30 September; its Gehen first entered wrongly at 02:00, removed, re-entered
    const fuer = (body: Json) => nachtrag(w.jonas, { nutzerId: w.sandra.nutzerId, ...body });
    expect(
      (await fuer({ art: "kommen", zeitpunkt: um("2026-09-30T22:00:00+02:00"), grund: "Zettel" }))
        .status,
    ).toBe(201);
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
    expect(
      (await fuer({ art: "gehen", zeitpunkt: um("2026-09-30T23:30:00+02:00"), grund: "Zettel" }))
        .status,
    ).toBe(201);

    w.server.stelleUhr(OKTOBER);
    expect((await bestaetigen(w.sandra, "2026-09")).status).toBe(201);
    expect((await abschliessen(w.jonas, w.sandra.nutzerId, { monat: "2026-09" })).status).toBe(201);
    if (gegeneintrag)
      // a counter-entry to a September day, entered and so booked in October
      expect(
        (
          await w.jonas.anfrage("/api/v1/arbeitszeit/monat/gegeneintrag", {
            body: { nutzerId: w.sandra.nutzerId, tag: "2026-09-15", minuten: 60, grund: "Fahrt" },
          })
        ).status,
      ).toBe(201);
    w.server.stelleUhr(JETZT);
  });

describe("September (8 years) kept, October (2 years) removed (S-901)", () => {
  it("keeps the correction history of a September shift for September's 8 years", async () => {
    const { server } = await mitStundenlohnImSeptember(false);
    const { ausgesondert } = aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    expect(ausgesondert.map(({ monat, jahre }) => ({ monat, jahre }))).toEqual([
      { monat: "2026-10", jahre: 2 },
    ]);
    // the wrong Gehen of 30 September's shift and its removal are September's history (GoBD Rz. 107 ff.)
    expect(
      server.sqlite
        .query("SELECT entfernt FROM stempelungen WHERE zeitpunkt = ? ORDER BY entfernt")
        .all(FALSCHES_GEHEN),
    ).toHaveLength(2);
  });

  it("keeps October for 8 years when payroll posts hours from it through a counter-entry", async () => {
    const { server, jonas, sandra } = await mitStundenlohnImSeptember(true);
    // payroll books hours from October: the counter-entry goes to September's hourly model
    const [oktober] = lohndaten(server.db, jonas.betriebId, "2026-10").monate.filter(
      (m) => m.nutzerId === sandra.nutzerId,
    );
    const lohn = lohnmonat(oktober as NonNullable<typeof oktober>);
    expect(lohn.ok && lohn.wert.posten).toContainEqual({ art: "stunden", minuten: 60 });

    const { ausgesondert } = aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    expect(ausgesondert.filter(({ monat }) => monat === "2026-10")).toEqual([]);
  });
});
