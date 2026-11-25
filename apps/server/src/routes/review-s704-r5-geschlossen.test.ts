import { describe, expect, it } from "vitest";
import { personioErsatz, WEBER_IN_PERSONIO } from "../personio-ersatz.ts";
import { IMP, weberZumUmzug } from "./importe-testhilfen.ts";
import { pruefen } from "./monat-testhilfen.ts";
import { json } from "./projektzeit-testhilfen.ts";

/*
 * Review S-704, round 5: CLAUDE.md "Never: change a closed month". Existing in Soll (Sandra):
 * 29.9. 18:30–19:00, 30.9. 03:30–06:00 and 1.10. 00:00–00:30 (a shift of its own on 1.10., in
 * October, which is then closed with its Prüfwert). New from Personio: N2 29.9. 01:00–10:00 and
 * N1 30.9. 14:30–15:30. Each alone leaves October as it is, so each working day passes
 * `stempelGesperrt` on its own; together they re-cut the shifts (schichten.ts `beginntSchicht`:
 * N2 starts 29.9., 30.9. 03:30 is 26.5 h later and opens the shift of 30.9., N1 and 1.10. 00:00
 * follow under 9 h) and move the stamps of 1.10. into the shift of 30.9.: October's records change
 * (abschluss.ts `aenderungGesperrt` would refuse the second when stamped by hand).
 */
const ID = "papi-c0ffee00-1111-4222-8333-444455556666";
const SECRET = "papi-verY-Secret-p4ssw0rd";
const periode = (n: number, start: string, end: string) => ({
  id: `a1b2c3d4-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`,
  person: { id: "1002" },
  type: "WORK",
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});

describe("review S-704 r5: two working days of one run must not alter a closed month together", () => {
  it("October closed: the Prüfwert of October still matches after the import", async () => {
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
    daten.attendancePeriods.push(
      periode(1, "2026-09-29T18:30:00", "2026-09-29T19:00:00"),
      periode(2, "2026-09-30T03:30:00", "2026-09-30T06:00:00"),
      periode(3, "2026-10-01T00:00:00", "2026-10-01T00:30:00"),
    );
    await uebernehmen();
    const zu = await w.weber.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
      body: { monat: "2026-10", nutzerId: w.sandra.nutzerId, grund: "Review" },
    });
    expect(zu.status).toBe(201);
    const pruefwert = ((await json(zu)).abschluss as { pruefwert: string }).pruefwert;
    expect(await pruefen(w.server, w.weber.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
    daten.attendancePeriods.push(
      periode(4, "2026-09-30T14:30:00", "2026-09-30T15:30:00"),
      periode(5, "2026-09-29T01:00:00", "2026-09-29T10:00:00"),
    );
    const zweiter = await uebernehmen();
    expect({
      pruefung: await pruefen(w.server, w.weber.betriebId, pruefwert),
      abgelehnt: zweiter.abgelehnt,
    }).toMatchObject({ pruefung: { ergebnis: "uebereinstimmend" } });
  });
});
