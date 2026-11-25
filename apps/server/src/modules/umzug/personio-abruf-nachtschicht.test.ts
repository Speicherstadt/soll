import { personioAbzugText, personioLesen } from "@soll/import";
import { describe, expect, it } from "vitest";
import { ersatzHolen } from "../../kimai-ersatz.ts";
import { personioErsatz, WEBER_IN_PERSONIO } from "../../personio-ersatz.ts";
import { personioAbrufen } from "./personio-abruf.ts";

// Review S-704: the same night shift through the fetch against the builder's stand-in.
const ZUGANG = { clientId: "papi-id", clientSecret: "papi-secret" };
const periode = (id: string, type: string, start: string, end: string) => ({
  id,
  person: { id: "1002" },
  type,
  start: { date_time: start },
  end: { date_time: end },
  approval: { status: "CONFIRMED" },
});

describe("review S-704: fetch of a night shift on the last day", () => {
  it("brings the break after midnight along and takes it out of the work", async () => {
    const daten = {
      ...WEBER_IN_PERSONIO,
      attendancePeriods: [
        periode(
          "a1b2c3d4-0000-4000-8000-000000000001",
          "WORK",
          "2026-09-30T22:00:00",
          "2026-10-01T06:00:00",
        ),
        periode(
          "a1b2c3d4-0000-4000-8000-000000000002",
          "BREAK",
          "2026-10-01T01:00:00",
          "2026-10-01T01:30:00",
        ),
      ],
      absencePeriods: [],
    };
    const ersatz = personioErsatz({ ...ZUGANG, daten });
    const abruf = await personioAbrufen(
      { holen: ersatzHolen(ersatz.fetch), basis: "https://personio.test" },
      ZUGANG,
      { von: "2026-09-01", bis: "2026-09-30" },
    );
    if (!abruf.ok) throw new Error(abruf.grund);
    const { daten: gelesen } = personioLesen(
      new TextEncoder().encode(personioAbzugText(abruf.wert)),
    );
    const minuten = gelesen.zeiten.reduce((s, z) => s + ((z.ende - z.beginn + 1440) % 1440), 0);
    expect(minuten).toBe(450);
  });
});
