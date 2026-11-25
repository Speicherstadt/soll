import { describe, expect, it } from "vitest";
import { personioErsatz, WEBER_IN_PERSONIO } from "../personio-ersatz.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * Review S-704, round 3. Soll cuts shifts by two rules (packages/arbeitszeit/src/arbeitstag/
 * schichten.ts, `beginntSchicht`): a gap of 9 h or more, OR 24 h or more since the shift began
 * (LAENGSTE_SCHICHT, § 3 ArbZG: the Werktag counts from its beginning). The import's `schichtenVon`
 * uses only the first, so a chain of spans with short rests (8 h, a shortened rest, § 5 ArbZG) is
 * one "shift" for the import but two for Soll.
 */
const ID = "papi-c0ffee00-1111-4222-8333-444455556666";
const SECRET = "papi-verY-Secret-p4ssw0rd";
const periode = (n: number, start: string, end: string) => ({
  id: `a1b2c3d4-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`,
  person: { id: "1002" },
  type: "WORK",
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});
// Sandra: early 30.9., night 30.9./1.10. (8 h rest), late 1.10. (8 h rest)
const KETTE = [
  periode(1, "2026-09-30T06:00:00", "2026-09-30T14:00:00"),
  periode(2, "2026-09-30T22:00:00", "2026-10-01T06:00:00"),
  periode(3, "2026-10-01T14:00:00", "2026-10-01T22:00:00"),
];

const aufbau = async () => {
  const daten = structuredClone(WEBER_IN_PERSONIO);
  const ersatz = personioErsatz({ clientId: ID, clientSecret: SECRET, daten });
  const w = await weberZumUmzug({ personioFetch: ersatz.fetch });
  const uebernehmen = async (abgeschlossenBis: string | null = null) => {
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
          abgeschlossenBis,
        },
      }),
    );
  };
  const schliessen = async (monat: string) => {
    const zu = await w.weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat, nutzerId: w.sandra.nutzerId, grund: "Review" },
    });
    expect(zu.status).toBe(201);
  };
  const ketteStempel = () =>
    w.server.sqlite
      .query(
        `SELECT extern_id AS id FROM stempelungen WHERE betrieb_id = ? AND extern_quelle = 'personio'
         AND extern_id LIKE 'a1b2c3d4-0000-4000-8000-0000000007%' ORDER BY zeitpunkt`,
      )
      .all(w.weber.betriebId)
      .map((z) => (z as { id: string }).id.slice(0, 38));
  return { daten, uebernehmen, schliessen, ketteStempel };
};

const SPAET = "a1b2c3d4-0000-4000-8000-000000000703";

describe("review S-704 r3: the import cuts shifts as Soll does", () => {
  it("control: taken in two runs, Soll keeps the late shift of 1.10. out of closed September", async () => {
    const t = await aufbau();
    t.daten.attendancePeriods.push(...KETTE.slice(0, 2));
    await t.uebernehmen();
    await t.schliessen("2026-09");
    t.daten.attendancePeriods.push(KETTE[2] as (typeof KETTE)[number]);
    await t.uebernehmen();
    expect(t.ketteStempel().filter((id) => id.startsWith(SPAET))).toHaveLength(2);
  });

  it("one run, September closed: the late shift of 1.10. (24 h after 30.9. 06:00) is taken", async () => {
    const t = await aufbau();
    await t.schliessen("2026-09");
    t.daten.attendancePeriods.push(...KETTE);
    const ergebnis = await t.uebernehmen();
    expect({
      spaet: t.ketteStempel().filter((id) => id.startsWith(SPAET)).length,
      abgelehnt: ergebnis.abgelehnt,
    }).toMatchObject({ spaet: 2 });
  });

  it("closes as taken over every month a shift of the chain begins in", async () => {
    const t = await aufbau();
    t.daten.attendancePeriods.push(...KETTE);
    const ergebnis = await t.uebernehmen("2026-10");
    const monate = (ergebnis.gesperrt as { monat: string }[]).map((g) => g.monat);
    // Sandra's late shift of 1.10. is a shift of October (only it lies there): October is closed too
    expect(monate.filter((m) => m === "2026-10")).toHaveLength(1);
  });
});
