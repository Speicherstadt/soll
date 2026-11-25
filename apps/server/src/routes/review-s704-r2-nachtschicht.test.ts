import { describe, expect, it } from "vitest";
import { kimaiErsatz, WEBER_IN_KIMAI } from "../kimai-ersatz.ts";
import { personioErsatz, WEBER_IN_PERSONIO } from "../personio-ersatz.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * Review S-704, round 2: the night shift 30.9. 22:00 – 1.10. 06:00 with a break 01:00–01:30 is now
 * two spans, 22:00–01:00 dated 30.9. and 01:30–06:00 dated 1.10. In Soll a working day is the day
 * the shift starts (CLAUDE.md; schichten.ts: a gap under 9 h is an interruption of the same shift),
 * so the whole shift belongs to September. Whether a month is closed must decide the shift as one:
 * never one half taken and the other refused.
 */

const ID = "papi-c0ffee00-1111-4222-8333-444455556666";
const SECRET = "papi-verY-Secret-p4ssw0rd";
const periode = (n: number, type: string, start: string, end: string) => ({
  id: `a1b2c3d4-0000-4000-8000-0000000009${String(n).padStart(2, "0")}`,
  person: { id: "1002" },
  type,
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});
const NACHT = [
  periode(1, "WORK", "2026-09-30T22:00:00", "2026-10-01T06:00:00"),
  periode(2, "BREAK", "2026-10-01T01:00:00", "2026-10-01T01:30:00"),
];

const aufbau = async () => {
  const daten = structuredClone(WEBER_IN_PERSONIO);
  const ersatz = personioErsatz({ clientId: ID, clientSecret: SECRET, daten });
  const w = await weberZumUmzug({ personioFetch: ersatz.fetch });
  const abrufen = async () =>
    (
      await json(
        await w.weber.anfrage(`${IMP}/abruf`, {
          body: {
            quelle: "personio",
            zugang: { clientId: ID, clientSecret: SECRET },
            von: "2026-09-01",
            bis: "2026-09-30",
          },
        }),
      )
    ).datei;
  const uebernehmen = async (abgeschlossenBis: string | null = null) =>
    json(
      await w.weber.anfrage(IMP, {
        body: {
          quelle: "personio",
          datei: await abrufen(),
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
  const nachtStempel = () =>
    w.server.sqlite
      .query(
        `SELECT extern_id AS id FROM stempelungen WHERE betrieb_id = ? AND extern_quelle = 'personio'
         AND extern_id LIKE 'a1b2c3d4-0000-4000-8000-0000000009%' ORDER BY zeitpunkt`,
      )
      .all(w.weber.betriebId)
      .map((z) => (z as { id: string }).id);
  return { w, daten, uebernehmen, nachtStempel };
};

describe("review S-704 r2: a night shift across the month end and closed months", () => {
  it("September closed: the part after the break is not taken alone into the closed shift", async () => {
    const { daten, uebernehmen, nachtStempel } = await aufbau();
    // the first takeover closes September as Personio had (as in importe-personio.test.ts)
    await uebernehmen("2026-09");
    // the night shift is entered in Personio afterwards, in the closed September
    daten.attendancePeriods.push(...NACHT);
    const zweiter = await uebernehmen();
    // before the fix: one span dated 30.9., refused as a whole (monat_abgeschlossen)
    expect({ stempel: nachtStempel(), abgelehnt: zweiter.abgelehnt }).toMatchObject({
      stempel: [],
    });
  });

  it("October closed, September open: the shift of 30.9. is taken whole, not half", async () => {
    const { w, daten, uebernehmen, nachtStempel } = await aufbau();
    const zu = await w.weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.sandra.nutzerId, grund: "Review" },
    });
    expect(zu.status).toBe(201);
    daten.attendancePeriods.push(...NACHT);
    const ergebnis = await uebernehmen();
    const ids = nachtStempel();
    // either the whole shift (4 stamps) or none of it, never two of four
    expect({ stempel: ids.length, abgelehnt: ergebnis.abgelehnt }).toMatchObject({
      stempel: 4,
    });
  });
});

/*
 * The same night shift from Kimai (S-705): one timesheet 30.9. 22:00 – 1.10. 06:00 with a break of
 * 30 min, which the reader places in the middle, so it too becomes two spans dated 30.9. and 1.10.
 */
const KIMAI_TOKEN = "kimai_e2e_4711";

const kimaiAufbau = async () => {
  const daten = structuredClone(WEBER_IN_KIMAI);
  daten.timesheets.push({
    id: 99,
    user: 2,
    begin: "2026-09-30T22:00:00+0200",
    end: "2026-10-01T06:00:00+0200",
    break: 1800,
    project: null,
    activity: null,
  });
  const ersatz = kimaiErsatz({ token: KIMAI_TOKEN, daten });
  const w = await weberZumUmzug({ kimaiFetch: ersatz.fetch });
  const zugang = { instanz: "https://zeit.weber.test", token: KIMAI_TOKEN, benutzer: null };
  const abruf = { quelle: "kimai", zugang, von: "2026-09-01", bis: "2026-09-30" };
  const datei = (await json(await w.weber.anfrage(`${IMP}/abruf`, { body: abruf }))).datei;
  const personen = {
    "Sandra Kühn": w.sandra.nutzerId,
    "Max Brandt": w.max.nutzerId,
    "Jonas Weber": null,
  };
  const zuordnung = { personen, arten: {}, kunden: {}, projekte: {}, taetigkeiten: {} };
  const uebernehmen = async () =>
    json(
      await w.weber.anfrage(IMP, {
        body: { quelle: "kimai", datei, spalten: {}, zuordnung, abgeschlossenBis: null },
      }),
    );
  const nachtStempel = () =>
    (
      w.server.sqlite
        .query(
          `SELECT count(*) AS n FROM stempelungen WHERE betrieb_id = ? AND extern_quelle = 'kimai'
           AND extern_id LIKE '99%'`,
        )
        .get(w.weber.betriebId) as { n: number }
    ).n;
  const schliessen = async (monat: string) => {
    const zu = await w.weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat, nutzerId: w.sandra.nutzerId, grund: "Review" },
    });
    expect(zu.status).toBe(201);
  };
  return { uebernehmen, nachtStempel, schliessen };
};

describe("review S-704 r2: the same night shift from Kimai", () => {
  it("October closed, September open: the shift of 30.9. is taken whole", async () => {
    const k = await kimaiAufbau();
    await k.schliessen("2026-10");
    await k.uebernehmen();
    expect(k.nachtStempel()).toBe(4);
  });

  it("September closed: no part of the shift is taken", async () => {
    const k = await kimaiAufbau();
    await k.schliessen("2026-09");
    await k.uebernehmen();
    expect(k.nachtStempel()).toBe(0);
  });
});
