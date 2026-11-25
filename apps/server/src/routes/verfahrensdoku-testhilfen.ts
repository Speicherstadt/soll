import type { Angaben } from "@soll/export";
import { testServer } from "../test-server.ts";

/** Helpers for the tests of the Verfahrensdokumentation (S-902) */

export const ANGABEN: Angaben = {
  rechtsform: "Einzelunternehmen",
  anschrift: "Wandsbeker Chaussee 1, 22089 Hamburg",
  verantwortlich: "Jonas Weber",
  aufbewahrungsort: "Büro in Hamburg",
  serverbetrieb: "Jonas Weber",
  datensicherung: "täglich mit soll backup auf ein NAS",
  schluesselablage: "Tresor im Büro",
  eigene: [{ titel: "Papier vor Soll", text: "Ordner im Büro" }],
};

export type Doku = {
  dokument: {
    titel: string;
    stand: { datum: string; programm: string; version: string; pruefwert: string | null };
    abschnitte: { titel: string; absaetze: string[]; liste?: string[]; luecken?: string[] }[];
    luecken: number;
    vollstaendig: boolean;
  };
  angaben: Angaben;
};

/** Weber Haustechnik with its owner Jonas and Sandra (employee) */
export const weber = async () => {
  const server = testServer();
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  return { server, jonas, sandra };
};

/** The document as text: every title, paragraph, item and gap */
export const text = (doku: Doku["dokument"]): string =>
  doku.abschnitte
    .flatMap((a) => [a.titel, ...a.absaetze, ...(a.liste ?? []), ...(a.luecken ?? [])])
    .join("\n");
