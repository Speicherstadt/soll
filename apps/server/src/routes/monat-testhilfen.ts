/** Weber Haustechnik with a month to close, for the tests of S-306 */
import { expect } from "vitest";
import { testServer } from "../test-server.ts";

export type Json = Record<string, unknown>;
export const json = async (antwort: Response) => (await antwort.json()) as Json;
export const um = (text: string) => Date.parse(text);
export const JETZT = um("2026-11-20T09:00:00+01:00");

export type Server = ReturnType<typeof testServer>;
export type Person = {
  anfrage: Awaited<ReturnType<Server["inhaberMitBetrieb"]>>["anfrage"];
  nutzerId: string;
};

export const nachtrag = (wer: Person, body: Json) =>
  wer.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", { body });

/**
 * Weber Haustechnik in Hamburg with Sandra (fitter, full time from October), who worked
 * 6 October 8 to 16:30 with half an hour's break, and a night shift from 31 October into November
 */
export const weber = async (optionen: Parameters<typeof testServer>[0] = {}) => {
  const server = testServer(optionen);
  server.stelleUhr(JETZT);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  const anna = await server.eingeladen(jonas, "planer", "anna");
  const lohn = await server.eingeladen(jonas, "lohnbuero", "lohnbuero");
  await jonas.anfrage("/api/v1/standorte", { body: { name: "Werkstatt", land: "HH" } });
  const modell = await json(
    await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
      body: {
        name: "Vollzeit",
        sollMinuten: [480, 480, 480, 480, 480, 0, 0],
        lohnArt: "monat",
        lohnCent: null,
        minijob: false,
        gueltigAb: "2026-01-01",
      },
    }),
  );
  for (const wer of [sandra, jonas]) {
    await jonas.anfrage(`/api/v1/arbeitszeit/personen/${wer.nutzerId}/modell`, {
      method: "PUT",
      body: { modellId: modell.modellId, gueltigAb: "2026-10-01" },
    });
  }
  const tag = async (wer: Person, eintraege: [string, string][]) => {
    const ids: string[] = [];
    for (const [art, zeit] of eintraege) {
      const antwort = await json(
        await nachtrag(wer, { art, zeitpunkt: um(zeit), grund: "Zettel" }),
      );
      ids.push(antwort.stempelId as string);
    }
    return ids;
  };
  const [kommen, pauseBeginn, , gehen] = await tag(sandra, [
    ["kommen", "2026-10-06T08:00:00+02:00"],
    ["pause_beginn", "2026-10-06T12:00:00+02:00"],
    ["pause_ende", "2026-10-06T12:30:00+02:00"],
    ["gehen", "2026-10-06T16:30:00+02:00"],
  ]);
  const [nachtKommen, nachtGehen] = await tag(sandra, [
    ["kommen", "2026-10-31T20:00:00+01:00"],
    ["gehen", "2026-11-01T02:00:00+01:00"],
  ]);
  return {
    server,
    jonas,
    sandra,
    anna,
    lohn,
    modell,
    tag,
    ids: {
      kommen: kommen ?? "",
      pauseBeginn: pauseBeginn ?? "",
      gehen: gehen ?? "",
      nachtKommen: nachtKommen ?? "",
      nachtGehen: nachtGehen ?? "",
    },
  };
};

export const bestaetigen = (wer: Person, monat = "2026-10") =>
  wer.anfrage("/api/v1/arbeitszeit/monat/bestaetigen", { body: { monat } });

export const abschliessen = (wer: Person, nutzerId: string, mehr: Json = {}) =>
  wer.anfrage("/api/v1/arbeitszeit/monat/abschliessen", {
    body: { monat: "2026-10", nutzerId, ...mehr },
  });

/**
 * Sandra confirms October, Jonas closes it; the Prüfwert of her time sheet. `vorher` changes the
 * month before she confirms it.
 */
export const abgeschlossen = async (
  optionen: Parameters<typeof testServer>[0] = {},
  vorher: (w: Awaited<ReturnType<typeof weber>>) => Promise<void> = async () => {},
) => {
  const w = await weber(optionen);
  await vorher(w);
  expect((await bestaetigen(w.sandra)).status).toBe(201);
  const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
  expect(antwort.status).toBe(201);
  const daten = await json(antwort);
  const pruefwert = (daten.abschluss as Json).pruefwert as string;
  return { ...w, daten, pruefwert };
};

export const pruefen = async (server: Server, betriebId: string, pruefwert: string) =>
  json(await server.browser().anfrage("/api/v1/pruefen", { body: { betriebId, pruefwert } }));
