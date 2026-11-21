import { TEST_URL, testServer } from "../test-server.ts";

export type Server = ReturnType<typeof testServer>;
export type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;
export type Json = Record<string, unknown>;

export const json = async (antwort: Response) => (await antwort.json()) as Json;

/** A program calling with a token: no cookie, only `Authorization: Bearer` */
export const mitToken =
  (server: Server, token: string) =>
  (
    pfad: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) =>
    server.app.request(`${TEST_URL}${pfad}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...init.headers,
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

/** A new token of a signed-in person, as the settings create it */
export const tokenVon = async (
  wer: Person | { anfrage: Person["anfrage"] },
  angaben: { name?: string; gueltigTage?: number | null } = {},
) => {
  const antwort = await wer.anfrage("/api/v1/zugaenge", {
    body: { name: angaben.name ?? "Skript", gueltigTage: angaben.gueltigTage ?? null },
  });
  if (antwort.status !== 201)
    throw new Error(`zugaenge ${antwort.status}: ${await antwort.text()}`);
  return (await antwort.json()) as { token: string; zugang: { zugangId: string } & Json };
};

/** The member id Better Auth gives a person in the owner's business, for role changes */
export const mitgliedId = async (inhaber: Person, nutzerId: string) => {
  const organisation = await json(
    await inhaber.anfrage(
      `/api/auth/organization/get-full-organization?organizationId=${inhaber.betriebId}`,
    ),
  );
  return (organisation.members as { id: string; userId: string }[]).find(
    (m) => m.userId === nutzerId,
  )?.id;
};

/** Weber Haustechnik with Jonas (owner) and Sandra (fitter) */
export const weberMitSandra = async () => {
  const server = testServer();
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  return { server, jonas, sandra };
};
