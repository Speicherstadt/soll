import { describe, expect, it } from "vitest";
import { personioErsatz, WEBER_IN_PERSONIO } from "../personio-ersatz.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * Review S-704, round 5. Existing in Soll: 29.9. 22:00 – 30.9. 06:00. New from Personio:
 * A 29.9. 08:00–13:30 and B 30.9. 14:30 – 1.10. 00:00. October closed, September open.
 * With A, the shift of 29.9. begins 08:00, B begins 30.5 h later and is its own shift of 30.9.
 * (schichten.ts `beginntSchicht`, 24 h), so A and B together leave October's records unchanged
 * (abschluss.ts `aenderungGesperrt`): stamped by hand, A then B, Soll accepts both. Without A, B
 * would join the shift of 29.22:00, run past 24 h and put its Gehen on 1.10. The plan checks the
 * working day of B against the database alone, without A taken in the same run, and refuses B;
 * a second run then takes it.
 */
const ID = "papi-c0ffee00-1111-4222-8333-444455556666";
const SECRET = "papi-verY-Secret-p4ssw0rd";
const periode = (n: number, start: string, end: string) => ({
  id: `a1b2c3d4-0000-4000-8000-0000000005${String(n).padStart(2, "0")}`,
  person: { id: "1002" },
  type: "WORK",
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});

describe("review S-704 r5: working days of one run are checked together", () => {
  it("October closed: A and B are both taken in one run, as by hand", async () => {
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
    const zahl = (n: number) =>
      (
        w.server.sqlite
          .query(
            `SELECT count(*) AS n FROM stempelungen WHERE betrieb_id = ? AND extern_quelle = 'personio'
             AND extern_id LIKE 'a1b2c3d4-0000-4000-8000-0000000005${String(n).padStart(2, "0")}%'`,
          )
          .get(w.weber.betriebId) as { n: number }
      ).n;
    daten.attendancePeriods.push(periode(1, "2026-09-29T22:00:00", "2026-09-30T06:00:00"));
    await uebernehmen();
    expect(zahl(1)).toBe(2);
    const zu = await w.weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.sandra.nutzerId, grund: "Review" },
    });
    expect(zu.status).toBe(201);
    daten.attendancePeriods.push(
      periode(2, "2026-09-29T08:00:00", "2026-09-29T13:30:00"),
      periode(3, "2026-09-30T14:30:00", "2026-10-01T00:00:00"),
    );
    const zweiter = await uebernehmen();
    const nachZweitem = { a: zahl(2), b: zahl(3), abgelehnt: zweiter.abgelehnt };
    const dritter = await uebernehmen();
    expect({
      nachZweitem,
      nachDrittem: { b: zahl(3), abgelehnt: dritter.abgelehnt },
    }).toMatchObject({
      nachZweitem: { a: 2, b: 2 },
    });
  });
});
