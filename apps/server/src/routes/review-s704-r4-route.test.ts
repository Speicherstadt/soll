import { describe, expect, it } from "vitest";
import { personioErsatz, WEBER_IN_PERSONIO } from "../personio-ersatz.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * Review S-704, round 4: a new span that continues a shift already in Soll (gap < 9 h,
 * schichten.ts `beginntSchicht`) belongs to the month that shift began in (CLAUDE.md: a working day
 * is the day the shift starts). October closed, September open: the shift of 30.9. may still grow,
 * as a stamp by hand would (abschluss.ts `aenderungGesperrt` compares the month contents).
 */
const ID = "papi-c0ffee00-1111-4222-8333-444455556666";
const SECRET = "papi-verY-Secret-p4ssw0rd";
const periode = (n: number, start: string, end: string) => ({
  id: `a1b2c3d4-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`,
  person: { id: "1002" },
  type: "WORK",
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});

describe("review S-704 r4: a new span continuing an existing shift", () => {
  it("October closed, September open: 1.10. 01:30–06:00 after the existing 30.9. 22:00–01:00 is taken", async () => {
    const daten = structuredClone(WEBER_IN_PERSONIO);
    const ersatz = personioErsatz({ clientId: ID, clientSecret: SECRET, daten });
    const w = await weberZumUmzug({ personioFetch: ersatz.fetch });
    const uebernehmen = async () => {
      const abruf = {
        quelle: "personio",
        zugang: { clientId: ID, clientSecret: SECRET },
        von: "2026-09-01",
        bis: "2026-10-31",
      };
      const datei = (await json(await w.weber.anfrage(`${IMP}/abruf`, { body: abruf }))).datei;
      return json(
        await w.weber.anfrage(IMP, {
          body: {
            quelle: "personio",
            datei,
            spalten: {},
            zuordnung: {
              personen: {
                "Sandra Kühn": w.sandra.nutzerId,
                "Max Brandt": w.max.nutzerId,
                "Jonas Weber": null,
              },
              arten: { Urlaub: "urlaub", Krankheit: "krank" },
              kunden: {},
              projekte: {},
              taetigkeiten: {},
            },
            abgeschlossenBis: null,
          },
        }),
      );
    };
    daten.attendancePeriods.push(periode(1, "2026-09-30T22:00:00", "2026-10-01T01:00:00"));
    await uebernehmen();
    const zu = await w.weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.sandra.nutzerId, grund: "Review" },
    });
    expect(zu.status).toBe(201);
    daten.attendancePeriods.push(periode(2, "2026-10-01T01:30:00", "2026-10-01T06:00:00"));
    const zweiter = await uebernehmen();
    const n = (
      w.server.sqlite
        .query(
          `SELECT count(*) AS n FROM stempelungen WHERE betrieb_id = ? AND extern_quelle = 'personio'
           AND extern_id LIKE 'a1b2c3d4-0000-4000-8000-000000000602%'`,
        )
        .get(w.weber.betriebId) as { n: number }
    ).n;
    expect({ n, abgelehnt: zweiter.abgelehnt }).toMatchObject({ n: 2 });
  });
});
