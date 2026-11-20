import { testServer } from "../test-server.ts";

export const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

export const SPAET = {
  name: "Spät",
  beginnMinute: 14 * 60,
  endeMinute: 22 * 60,
  pauseMinuten: 30,
  rolle: "Service",
};

/**
 * "Café Elbblick" with the module Dienstplan, its site at the Elbe and Tom, who works in shifts;
 * Lea as planner. The test clock stands on Monday 21 September 2026.
 */
export const elbblick = async (server = testServer()) => {
  const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
  await mia.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { dienstplan: true } });
  const standort = await json(
    await mia.anfrage("/api/v1/standorte", { body: { name: "Elbe", land: "HH" } }),
  );
  const tom = await server.eingeladen(mia, "mitarbeiter", "tom");
  const lea = await server.eingeladen(mia, "planer", "lea");
  return { server, mia, tom, lea, standortId: standort.standortId as string };
};

export const schichtVon = (standortId: string, nutzerId: string | null, tag = "2026-11-23") => ({
  standortId,
  tag,
  beginnMinute: 14 * 60,
  endeMinute: 22 * 60,
  pauseMinuten: 30,
  rolle: "Service",
  nutzerId,
});
