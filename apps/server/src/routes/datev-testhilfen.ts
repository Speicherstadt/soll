/** Weber Haustechnik with Sandra's October closed, for the tests of the DATEV export (S-308) */
import { expect } from "vitest";
import { testServer } from "../test-server.ts";
import { JETZT, type Json, json, nachtrag, um } from "./monat-testhilfen.ts";

export const PFAD = "/api/v1/arbeitszeit/datev";

/** A mapping as the payroll office of Weber might set it */
export const ZUORDNUNG = {
  beraterNr: "1234567",
  mandantenNr: "10001",
  lohnarten: { stunden: "1000", feiertag: "1010", sonntag_steuerfrei: "1310" },
};

export const exportPfad = (monat: string, ziel: string) =>
  `${PFAD}/export?monat=${monat}&ziel=${ziel}`;

/**
 * Weber Haustechnik in Hamburg: Sandra on 21,50 € an hour, Mo–Fr 8 h, 50 % on Sundays, works
 * Sun 4.10.2026 10:00–14:00 and Tue 6.10. 8:00–16:30 with half an hour's break, confirms October,
 * and Jonas closes it. Anna plans, Lea does payroll.
 */
export const weberMitOktober = async () => {
  const server = testServer();
  server.stelleUhr(JETZT);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  const anna = await server.eingeladen(jonas, "planer", "anna");
  const lohn = await server.eingeladen(jonas, "lohnbuero", "lea");
  await jonas.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } });
  const modell = await json(
    await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
      body: {
        name: "Stundenlohn",
        sollMinuten: [480, 480, 480, 480, 480, 0, 0],
        lohnArt: "stunde",
        lohnCent: 2150,
        minijob: false,
        zuschlagssaetze: { sonntag: 5000 },
        gueltigAb: "2026-01-01",
      },
    }),
  );
  const zuordnen = (nutzerId: string) =>
    jonas.anfrage(`/api/v1/arbeitszeit/personen/${nutzerId}/modell`, {
      method: "PUT",
      body: { modellId: modell.modellId, gueltigAb: "2026-10-01" },
    });
  await zuordnen(sandra.nutzerId);
  for (const [art, zeit] of [
    ["kommen", "2026-10-04T10:00:00+02:00"],
    ["gehen", "2026-10-04T14:00:00+02:00"],
    ["kommen", "2026-10-06T08:00:00+02:00"],
    ["pause_beginn", "2026-10-06T12:00:00+02:00"],
    ["pause_ende", "2026-10-06T12:30:00+02:00"],
    ["gehen", "2026-10-06T16:30:00+02:00"],
  ] as const)
    await nachtrag(sandra, { art, zeitpunkt: um(zeit), grund: "Zettel" });
  const bestaetigt = await sandra.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", {
    body: { monat: "2026-10" },
  });
  expect(bestaetigt.status).toBe(201);
  const geschlossen = await jonas.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
    body: { monat: "2026-10", nutzerId: sandra.nutzerId },
  });
  expect(geschlossen.status).toBe(201);
  const zuordnung = (mehr: Json = {}) =>
    lohn.anfrage(PFAD, {
      method: "PUT",
      body: { ...ZUORDNUNG, personalnummern: { [sandra.nutzerId]: "101" }, ...mehr },
    });
  return { server, jonas, sandra, anna, lohn, modell, zuordnen, zuordnung };
};

/** The text of a downloaded file, read as Windows-1252 */
export const dateiText = async (antwort: Response) =>
  new TextDecoder("windows-1252").decode(await antwort.arrayBuffer());
