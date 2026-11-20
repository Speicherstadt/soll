import { TEST_URL, testServer } from "../test-server.ts";

export type Server = ReturnType<typeof testServer>;
type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;

export const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

/** A Friday morning in Hamburg */
export const JETZT = Date.parse("2026-11-20T07:58:00+01:00");

/** The tablet: no cookies, only its device token in `Authorization` (S-801) */
export const tablet = (server: Server, token = "") => ({
  token,
  anfrage: (pfad: string, init: { method?: string; body?: unknown } = {}) =>
    server.app.request(`${TEST_URL}${pfad}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
});

/** A pairing code of the owner, as POST /api/v1/terminal/geraete answers */
export const kopplungscode = async (inhaber: Person, name = "Eingang") =>
  (await json(await inhaber.anfrage("/api/v1/terminal/geraete", { body: { name } }))) as {
    terminalId: string;
    code: string;
    gueltigBis: number;
  };

/** A tablet paired with a fresh code of the owner */
export const gekoppelt = async (server: Server, inhaber: Person, name = "Eingang") => {
  const { code, terminalId } = await kopplungscode(inhaber, name);
  const antwort = await tablet(server).anfrage("/api/v1/kiosk/koppeln", { body: { code } });
  if (antwort.status !== 201) throw new Error(`koppeln ${antwort.status}`);
  const { token } = (await antwort.json()) as { token: string };
  return { ...tablet(server, token), terminalId };
};

export const pinSetzen = (inhaber: Person, nutzerId: string, pin: string) =>
  inhaber.anfrage(`/api/v1/pins/${nutzerId}`, { method: "PUT", body: { pin } });

/** A business with the module Terminal on and an employee with PIN 4711 */
export const betriebMitTerminal = async (
  server: Server,
  name = "Café Elbblick",
  slug = "elbblick",
  person = "lea",
) => {
  const inhaber = await server.inhaberMitBetrieb(name, slug);
  await inhaber.anfrage("/api/v1/betrieb/module", { method: "PATCH", body: { terminal: true } });
  const mitarbeiterin = await server.eingeladen(inhaber, "mitarbeiter", person);
  await pinSetzen(inhaber, mitarbeiterin.nutzerId, "4711");
  return { inhaber, mitarbeiterin };
};

export const neuerServer = () => {
  const server = testServer();
  server.stelleUhr(JETZT);
  return server;
};
