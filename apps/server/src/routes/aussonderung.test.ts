/**
 * Removal after the retention period (S-901): with a set clock, the content of a closed month goes,
 * its links stay and the chain verifies; the removal is a link of its own, the month stays locked and
 * the Prüfwert the person holds is still recognised.
 */
import { describe, expect, it } from "vitest";
import { aussondern } from "../modules/arbeitszeit/index.ts";
import { kettePruefen } from "../modules/audit/index.ts";
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

/** The last instant of 2028 and the first of 2029 in Berlin */
const SILVESTER_2028 = um("2028-12-31T23:59:59+01:00");
const NEUJAHR_2029 = um("2029-01-01T00:00:00+01:00");

type Server = Awaited<ReturnType<typeof abgeschlossen>>["server"];

const anzahl = (server: Server, sql: string, ...werte: string[]) =>
  (server.sqlite.query(sql).get(...werte) as { n: number }).n;

const stempelVon = (server: Server, nutzerId: string) =>
  server.sqlite
    .query("SELECT zeitpunkt FROM stempelungen WHERE nutzer_id = ? ORDER BY zeitpunkt")
    .all(nutzerId)
    .map((zeile) => (zeile as { zeitpunkt: number }).zeitpunkt);

describe("removing a closed month after its retention period", () => {
  it("removes the content once the 2 years after the year of closing have ended; the chain verifies", async () => {
    const { server, jonas, sandra, pruefwert } = await abgeschlossen();
    const elbblick = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    // a stamp of the open November stays
    expect(
      (
        await nachtrag(sandra, {
          art: "kommen",
          zeitpunkt: um("2026-11-05T08:00:00+01:00"),
          grund: "Zettel",
        })
      ).status,
    ).toBe(201);
    const glieder = anzahl(
      server,
      "SELECT COUNT(*) AS n FROM audit_glieder WHERE betrieb_id = ?",
      jonas.betriebId,
    );

    expect(aussondern(server.db, server.schreibDb, SILVESTER_2028)).toEqual({
      ausgesondert: [],
      aufgeschoben: [],
    });

    const { ausgesondert, aufgeschoben } = aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    expect(aufgeschoben).toEqual([]);
    // six stamps (the night shift's Gehen on 1 November with its working day), confirmation, closing
    expect(ausgesondert).toEqual([
      {
        betriebId: jonas.betriebId,
        nutzerId: sandra.nutzerId,
        monat: "2026-10",
        jahre: 2,
        zeilen: 8,
        inhalte: 8,
      },
    ]);
    expect(stempelVon(server, sandra.nutzerId)).toEqual([um("2026-11-05T08:00:00+01:00")]);
    expect(
      anzahl(
        server,
        "SELECT COUNT(*) AS n FROM monatsabschluesse WHERE betrieb_id = ?",
        jonas.betriebId,
      ),
    ).toBe(0);
    // the links stay; one per removed row and one for the record of the removal
    expect(
      anzahl(
        server,
        "SELECT COUNT(*) AS n FROM audit_glieder WHERE betrieb_id = ?",
        jonas.betriebId,
      ),
    ).toBe(glieder + 9);
    expect(
      server.sqlite
        .query(
          "SELECT monat, jahre, ausgesondert_am AS am FROM aussonderungen WHERE betrieb_id = ?",
        )
        .all(jonas.betriebId),
    ).toEqual([{ monat: "2026-10", jahre: 2, am: NEUJAHR_2029 }]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    expect(kettePruefen(server.db, elbblick.betriebId)).toEqual([]);

    // the Prüfwert Sandra holds is recognised: genuine, its content removed
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toEqual({
      ergebnis: "ausgesondert",
      monat: "2026-10",
      abgeschlossenAm: um("2026-11-20T09:00:00+01:00"),
      ausgesondertAm: NEUJAHR_2029,
      jahre: 2,
      betrieb: "Weber Haustechnik",
    });

    // a second run finds nothing more
    expect(aussondern(server.db, server.schreibDb, NEUJAHR_2029 + 60_000).ausgesondert).toEqual([]);
  });

  it("keeps the month locked and says so in the month view", async () => {
    const { server, jonas, sandra } = await abgeschlossen();
    aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    server.stelleUhr(NEUJAHR_2029);
    const monat = await json(await sandra.anfrage("/api/v1/arbeitszeit/monat?monat=2026-10"));
    expect(monat.abschluss).toBeNull();
    expect(monat.ausgesondert).toEqual({
      am: NEUJAHR_2029,
      abgeschlossenAm: um("2026-11-20T09:00:00+01:00"),
      jahre: 2,
    });
    expect(await json(await bestaetigen(sandra))).toEqual({ fehler: "abgeschlossen" });
    expect(await json(await abschliessen(jonas, sandra.nutzerId, { grund: "x" }))).toEqual({
      fehler: "abgeschlossen",
    });
    const zettel = await sandra.anfrage("/api/v1/arbeitszeit/monat/stundenzettel?monat=2026-10");
    expect(zettel.status).toBe(410);
    const spaet = await nachtrag(jonas, {
      nutzerId: sandra.nutzerId,
      art: "kommen",
      zeitpunkt: um("2026-10-07T08:00:00+02:00"),
      grund: "x",
    });
    expect(spaet.status).toBe(409);
    expect(await json(spaet)).toEqual({ fehler: "abgeschlossen" });
  });

  it("keeps a month payroll posted from for 8 years", async () => {
    const { server, jonas, sandra, pruefwert } = await abgeschlossen({}, async (w) => {
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
      await w.jonas.anfrage(`/api/v1/arbeitszeit/personen/${w.sandra.nutzerId}/modell`, {
        method: "PUT",
        body: { modellId: stunde.modellId, gueltigAb: "2026-10-20" },
      });
    });
    expect(aussondern(server.db, server.schreibDb, NEUJAHR_2029).ausgesondert).toEqual([]);
    expect(
      aussondern(server.db, server.schreibDb, um("2034-12-31T23:59:59+01:00")).ausgesondert,
    ).toEqual([]);
    const { ausgesondert } = aussondern(
      server.db,
      server.schreibDb,
      um("2035-01-01T00:00:00+01:00"),
    );
    expect(ausgesondert.map(({ monat, jahre }) => ({ monat, jahre }))).toEqual([
      { monat: "2026-10", jahre: 8 },
    ]);
    expect(stempelVon(server, sandra.nutzerId)).toEqual([]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    expect(((await pruefen(server, jonas.betriebId, pruefwert)) as Json).ergebnis).toBe(
      "ausgesondert",
    );
  });

  it("removes every version of a corrected stamp, so none comes back in force", async () => {
    const { server, jonas, sandra, ids } = await abgeschlossen({}, async (w) => {
      await w.jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${w.ids.gehen}`, {
        method: "PATCH",
        body: {
          art: "gehen",
          zeitpunkt: Date.parse("2026-10-06T17:00:00+02:00"),
          grund: "Baustelle",
        },
      });
    });
    aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    expect(
      anzahl(
        server,
        "SELECT COUNT(*) AS n FROM stempelungen WHERE stempel_id = ? OR ersetzt = ?",
        ids.gehen,
        ids.gehen,
      ),
    ).toBe(0);
    expect(stempelVon(server, sandra.nutzerId)).toEqual([]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
  });

  it("refuses a Prüfwert whose closing was removed past the chain", async () => {
    const { server, jonas, pruefwert } = await abgeschlossen();
    aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    // a removal record moved to an earlier day past the chain: it no longer matches its link
    server.sqlite.run("UPDATE aussonderungen SET ausgesondert_am = ausgesondert_am - 1");
    expect(await pruefen(server, jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "abweichung",
      grund: "abschluss",
    });
  });

  it("names the removal in the Auskunft of the person, without the month's content", async () => {
    const { server, sandra } = await abgeschlossen();
    aussondern(server.db, server.schreibDb, NEUJAHR_2029);
    server.stelleUhr(NEUJAHR_2029);
    const auskunft = await json(await sandra.anfrage("/api/v1/auskunft"));
    expect(auskunft.aussonderungen).toEqual([
      expect.objectContaining({
        monat: "2026-10",
        jahre: 2,
        ausgesondertAm: new Date(NEUJAHR_2029).toISOString(),
      }),
    ]);
    expect(auskunft.stempelungen).toEqual([]);
  });
});
