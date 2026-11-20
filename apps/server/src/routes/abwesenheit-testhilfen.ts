/** Weber Haustechnik with absences, for the tests of S-401 */
import { expect } from "vitest";
import { type Json, json, type Person, type Server, weber } from "./monat-testhilfen.ts";

export { type Json, json, um } from "./monat-testhilfen.ts";

const BASIS = "/api/v1/arbeitszeit/abwesenheiten";

export const antrag = (wer: Person, body: Json) => wer.anfrage(`${BASIS}/antrag`, { body });
export const krank = (wer: Person, body: Json = { art: "krank" }) =>
  wer.anfrage(`${BASIS}/krank`, { body });
export const schritt = (wer: Person, id: string, aktion: string, body: Json = {}) =>
  wer.anfrage(`${BASIS}/${id}/${aktion}`, { body });
export const liste = async (wer: Person, abfrage = "") =>
  json(await wer.anfrage(`${BASIS}${abfrage ? `?${abfrage}` : ""}`));
export const offen = async (wer: Person) => json(await wer.anfrage(`${BASIS}/offen`));

/** Creates an absence and gives its id, failing the test if it was refused */
export const angelegt = async (antwort: Promise<Response>, status = 201): Promise<string> => {
  const a = await antwort;
  const daten = await json(a);
  expect(a.status, JSON.stringify(daten)).toBe(status);
  return daten.abwesenheitId as string;
};

/** Gives an account an e-mail address, as if it had been invited with one (Better Auth's table) */
export const adresse = (server: Server, wer: Person, email: string) =>
  server.sqlite.run("UPDATE user SET email = ? WHERE id = ?", [email, wer.nutzerId]);

/** Weber with absences: Sandra (fitter), Anna (planner), payroll, Jonas (owner), Max (fitter) */
export const weberMitAbwesenheiten = async (optionen: Parameters<typeof weber>[0] = {}) => {
  const w = await weber(optionen);
  const max = await w.server.eingeladen(w.jonas, "mitarbeiter", "max");
  return { ...w, max };
};

/** The approved leave from `von` to `bis` of a person, approved by the owner */
export const genehmigt = async (
  w: Awaited<ReturnType<typeof weberMitAbwesenheiten>>,
  wer: Person,
  body: Json,
) => {
  const id = await angelegt(antrag(wer, { art: "urlaub", ...body }));
  expect((await schritt(w.jonas, id, "freigeben")).status).toBe(200);
  return id;
};
