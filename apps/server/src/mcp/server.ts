import { ausgehandelt, FASSUNGEN, type Fassung } from "./fassungen.ts";
import { type Antwort, ergebnis, FEHLERCODE, fehler, type Id, type Nachricht } from "./jsonrpc.ts";
import { type Aufruf, WERKZEUGE, werkzeugBeschreibung } from "./werkzeuge.ts";

/*
 * The methods of Soll's MCP server: `server/discover` (2026-07-28), `initialize` and `ping` (the
 * earlier revisions), `tools/list` and `tools/call` (both). It holds no state between requests.
 */

/** Calls the REST API with the caller's token and gives its status and JSON answer */
export type Api = (aufruf: Aufruf) => Promise<{ status: number; daten: unknown }>;

export type ServerAngaben = { version: string; api: Api };

const INFO = (version: string) => ({ name: "soll", title: "Soll", version });

const ANLEITUNG =
  "Soll erfasst Arbeitszeit nach dem Arbeitszeitgesetz. Zeiten in ganzen Minuten, Tage als YYYY-MM-DD in Europe/Berlin. Was ein Werkzeug darf, entscheidet die Rolle der Person des Tokens; ein abgeschaltetes Modul antwortet mit modul_aus.";

/** An hour: the tools change only with a new version of the server */
const STUNDE_MS = 60 * 60 * 1000;

type Ausgang = { status: 200 | 404; antwort: Antwort };

/** A result of 2026-07-28 says it is complete and names the server (changelog, major 2 and 8) */
const fertig = (fassung: Fassung, version: string, result: Record<string, unknown>) =>
  fassung.modern
    ? {
        resultType: "complete",
        ...result,
        _meta: { "io.modelcontextprotocol/serverInfo": INFO(version) },
      }
    : result;

const werkzeugAufrufen = async (
  params: Record<string, unknown> | undefined,
  api: Api,
): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; meldung: string }> => {
  const werkzeug = WERKZEUGE.find((w) => w.name === params?.name);
  if (!werkzeug) return { ok: false, meldung: `Unknown tool: ${String(params?.name)}` };
  const eingabe = werkzeug.eingabe.safeParse(params?.arguments ?? {});
  if (!eingabe.success)
    return {
      ok: true,
      result: {
        content: [{ type: "text", text: `Ungültige Eingabe: ${eingabe.error.message}` }],
        isError: true,
      },
    };
  const { status, daten } = await api(werkzeug.aufruf(eingabe.data));
  return {
    ok: true,
    result: {
      content: [{ type: "text", text: JSON.stringify(daten) }],
      ...(daten !== null && typeof daten === "object" ? { structuredContent: daten } : {}),
      isError: status >= 400,
    },
  };
};

const methoden = (
  fassung: Fassung,
  angaben: ServerAngaben,
): Record<string, (nachricht: Nachricht, id: Id) => Promise<Antwort>> => {
  const gemeinsam = {
    "tools/list": async (_: Nachricht, id: Id) =>
      ergebnis(
        id,
        fertig(fassung, angaben.version, {
          tools: WERKZEUGE.map(werkzeugBeschreibung),
          ...(fassung.modern ? { ttlMs: STUNDE_MS, cacheScope: "public" } : {}),
        }),
      ),
    "tools/call": async (nachricht: Nachricht, id: Id) => {
      const aufruf = await werkzeugAufrufen(nachricht.params, angaben.api);
      return aufruf.ok
        ? ergebnis(id, fertig(fassung, angaben.version, aufruf.result))
        : fehler(id, FEHLERCODE.parameter, aufruf.meldung);
    },
  };
  if (fassung.modern)
    return {
      ...gemeinsam,
      "server/discover": async (_: Nachricht, id: Id) =>
        ergebnis(
          id,
          fertig(fassung, angaben.version, {
            supportedVersions: FASSUNGEN,
            capabilities: { tools: {} },
            instructions: ANLEITUNG,
            ttlMs: STUNDE_MS,
            cacheScope: "public",
          }),
        ),
    };
  return {
    ...gemeinsam,
    initialize: async (nachricht: Nachricht, id: Id) =>
      ergebnis(id, {
        protocolVersion: ausgehandelt(nachricht.params?.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: INFO(angaben.version),
        instructions: ANLEITUNG,
      }),
    ping: async (_: Nachricht, id: Id) => ergebnis(id, {}),
  };
};

/**
 * Answers one request. An unknown method is 404 in 2026-07-28 (streamable-http.mdx, "Protocol
 * Version Header"); earlier revisions read a 404 as a lost session, so there it is a 200 with the
 * JSON-RPC error.
 */
export const beantworten = async (
  nachricht: Nachricht & { id: Id },
  fassung: Fassung,
  angaben: ServerAngaben,
): Promise<Ausgang> => {
  const methode = methoden(fassung, angaben)[nachricht.method];
  if (!methode)
    return {
      status: fassung.modern ? 404 : 200,
      antwort: fehler(nachricht.id, FEHLERCODE.methode, `Method not found: ${nachricht.method}`),
    };
  return { status: 200, antwort: await methode(nachricht, nachricht.id) };
};
