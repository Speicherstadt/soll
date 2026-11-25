import { testServer } from "../test-server.ts";
import { json, mitProjektzeit } from "./projektzeit-testhilfen.ts";

/** Helpers for the tests of imports (S-701) */

export const IMP = "/api/v1/importe";

/** 25.11.2026, 12:00 in Berlin: September and October are over */
export const JETZT = Date.parse("2026-11-25T12:00:00+01:00");

/** A Soll-CSV of Weber Haustechnik's old tool: Sandra's and Max's times, an absence, a customer */
export const WEBER_CSV = [
  "Typ;Kennung;Person;Datum;Beginn;Ende;Pause;Bis;Art;Kunde;Name;Nummer",
  "zeit;z-1;Sandra;01.09.2026;7:00;15:30;30;;;;;",
  "zeit;z-2;Sandra;02.09.2026;7:00;15:30;30;;;;;",
  "zeit;z-3;Max Brandt;01.10.2026;7:00;18:30;0;;;;;",
  "zeit;z-4;Leon;01.10.2026;7:00;12:00;;;;;;",
  "zeit;z-5;Sandra;31.09.2026;7:00;12:00;;;;;;",
  "abwesenheit;a-1;Sandra;07.09.2026;;;;11.09.2026;Urlaub;;;",
  "kunde;k-1;;;;;;;;;Elbhof Immobilien;K-1001",
  "projekt;p-1;;;;;;;;k-1;Bad Elbhof;A-17",
  "",
].join("\r\n");

export const datei = (text: string, name = "altes-tool.csv") => ({
  name,
  inhalt: Buffer.from(text, "utf8").toString("base64"),
});

/** Weber Haustechnik on 25.11.2026 with Projektzeit, Sandra and Max as fitters, Anna as planner */
export const weberZumUmzug = async () => {
  const server = testServer();
  server.stelleUhr(JETZT);
  const weber = await mitProjektzeit(server, "Weber Haustechnik", "weber");
  const sandra = await server.eingeladen(weber, "mitarbeiter", "sandra");
  const max = await server.eingeladen(weber, "mitarbeiter", "max");
  const anna = await server.eingeladen(weber, "planer", "anna");
  return { server, weber, sandra, max, anna };
};

type Person = { anfrage: Awaited<ReturnType<typeof weberZumUmzug>>["weber"]["anfrage"] };

/** The mapping of Weber's file: Sandra and Max, leave as leave, Leon left out */
export const zuordnungFuer = (sandra: string, max: string) => ({
  personen: { Sandra: sandra, "Max Brandt": max, Leon: null },
  arten: { Urlaub: "urlaub" },
  kunden: {},
  projekte: {},
});

export const koerper = (
  zuordnung: unknown,
  text = WEBER_CSV,
  abgeschlossenBis: string | null = null,
) => ({ quelle: "soll-csv", datei: datei(text), spalten: {}, zuordnung, abgeschlossenBis });

export const vorschauVon = (person: Person, text = WEBER_CSV) =>
  person.anfrage(`${IMP}/vorschau`, {
    body: { quelle: "soll-csv", datei: datei(text), spalten: {} },
  });

/** Takes the import over and returns its answer, failing loudly on anything but 201 */
export const uebernehmen = async (person: Person, body: unknown) => {
  const antwort = await person.anfrage(IMP, { body });
  if (antwort.status !== 201) throw new Error(`import ${antwort.status}: ${await antwort.text()}`);
  return json(antwort);
};
