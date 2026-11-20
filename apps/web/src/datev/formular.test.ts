import { describe, expect, it } from "vitest";
import { zuordnungAus } from "./formular.ts";
import { dateinameAus } from "./herunterladen.ts";
import type { DatevAnsicht } from "./typen.ts";

const ANSICHT: DatevAnsicht = {
  beraterNr: null,
  mandantenNr: null,
  lohnarten: {},
  postenarten: ["stunden", "minijob", "sonntag_steuerfrei"],
  personen: [
    { nutzerId: "sandra", name: "Sandra", personalnummer: null },
    { nutzerId: "max", name: "Max", personalnummer: "102" },
  ],
};

const formular = (werte: Record<string, string>) => {
  const daten = new FormData();
  for (const [name, wert] of Object.entries(werte)) daten.set(name, wert);
  return daten;
};

describe("zuordnungAus", () => {
  it("sends filled fields trimmed, leaves empty wage types out and empty numbers as null", () => {
    const body = zuordnungAus(
      formular({
        beraterNr: " 1234567 ",
        mandantenNr: "",
        "lohnart-stunden": "1000",
        "lohnart-minijob": " ",
        "lohnart-sonntag_steuerfrei": "1310",
        "pnr-sandra": "101",
        "pnr-max": "",
      }),
      ANSICHT,
    );
    expect(body).toEqual({
      beraterNr: "1234567",
      mandantenNr: null,
      lohnarten: { stunden: "1000", sonntag_steuerfrei: "1310" },
      personalnummern: { sandra: "101", max: null },
    });
  });
});

describe("dateinameAus", () => {
  it("reads the file name of a download", () => {
    expect(dateinameAus('attachment; filename="DATEV_LODAS_2026-10.txt"')).toBe(
      "DATEV_LODAS_2026-10.txt",
    );
    expect(dateinameAus(null)).toBeNull();
  });
});
