import { testServer } from "../test-server.ts";

/** Helpers for the tests of the module Projektzeit (S-601) */
export const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

export const PZ = "/api/v1/projektzeit";

type Server = ReturnType<typeof testServer>;
export type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;

/** An owner whose business has the module Projektzeit switched on */
export const mitProjektzeit = async (server: Server, name: string, slug: string) => {
  const inhaber = await server.inhaberMitBetrieb(name, slug);
  const an = await inhaber.anfrage("/api/v1/betrieb/module", {
    method: "PATCH",
    body: { projektzeit: true },
  });
  if (an.status !== 200) throw new Error(`module ${an.status}`);
  return inhaber;
};

/** Posts and returns the created row, failing loudly on anything but 201 */
export const anlegen = async (person: Person, pfad: string, body: unknown) => {
  const antwort = await person.anfrage(`${PZ}${pfad}`, { body });
  if (antwort.status !== 201) throw new Error(`${pfad} ${antwort.status}: ${await antwort.text()}`);
  return json(antwort);
};

/** Weber Haustechnik with customer Elbhof and its order "Bad Elbhof" */
export const weberMitAuftrag = async (optionen: Parameters<typeof testServer>[0] = {}) => {
  const server = testServer(optionen);
  const weber = await mitProjektzeit(server, "Weber Haustechnik", "weber");
  const kunde = await anlegen(weber, "/kunden", { name: "Elbhof", nummer: "K-1001" });
  const projekt = await anlegen(weber, "/projekte", {
    kundeId: kunde.kundeId,
    name: "Bad Elbhof",
    budgetMinuten: 2_400,
    budgetCent: 400_000,
  });
  return { server, weber, kunde, projekt };
};
