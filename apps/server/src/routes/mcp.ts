import { type Context, Hono } from "hono";
import type { Db } from "../db/oeffnen.ts";
import { fassungVon } from "../mcp/fassungen.ts";
import { FEHLERCODE, fehler, nachrichtSchema } from "../mcp/jsonrpc.ts";
import { type Api, beantworten } from "../mcp/server.ts";
import type { Aufruf } from "../mcp/werkzeuge.ts";
import { abgelehnt } from "./kontext.ts";
import { bearer, MCP_INTERN, tokenAnmelden, type ZugangDeps } from "./zugang-anmeldung.ts";

export type McpAngaben = {
  db: Db;
  zugang: ZugangDeps;
  version: string;
  /** Where the instance is reached: the only Origin a browser may send (DNS rebinding) */
  url: string;
  /** The app itself, for the API calls of the tools */
  fetch: (anfrage: Request, env: Record<symbol, unknown>) => Response | Promise<Response>;
};

/** A tool's call into the API, with the caller's token, marked as made by the MCP server */
const apiMit =
  (angaben: McpAngaben, token: string): Api =>
  async ({ methode, pfad, koerper }: Aufruf) => {
    const antwort = await angaben.fetch(
      new Request(new URL(pfad, angaben.url), {
        method: methode,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        ...(koerper === undefined ? {} : { body: JSON.stringify(koerper) }),
      }),
      { [MCP_INTERN]: true },
    );
    return { status: antwort.status, daten: await antwort.json().catch(() => null) };
  };

const herkunftErlaubt = (c: Context, url: string): boolean => {
  const herkunft = c.req.header("origin");
  if (herkunft === undefined) return true;
  try {
    return new URL(herkunft).origin === new URL(url).origin;
  } catch {
    return false;
  }
};

const nachrichtLesen = async (c: Context) => {
  const roh = await c.req.json().catch(() => undefined);
  if (roh === undefined)
    return { ok: false as const, antwort: fehler(undefined, FEHLERCODE.parse, "Parse error") };
  const nachricht = nachrichtSchema.safeParse(roh);
  if (!nachricht.success)
    return {
      ok: false as const,
      antwort: fehler(undefined, FEHLERCODE.anfrage, "Invalid Request"),
    };
  return { ok: true as const, nachricht: nachricht.data };
};

/**
 * The MCP server at /mcp (S-607), Streamable HTTP without sessions (MCP 2026-07-28,
 * basic/transports/streamable-http.mdx): one JSON-RPC request per POST, answered as JSON. Only with
 * a personal access token; a browser session is not accepted here, so no other site can make a
 * signed-in browser call it. Its tools call /api/v1 with the same token.
 */
export const mcpRouten = (angaben: McpAngaben) =>
  new Hono()
    .post("/", async (c) => {
      if (!herkunftErlaubt(c, angaben.url))
        return c.json(fehler(undefined, FEHLERCODE.anfrage, "Origin not allowed"), 403);
      const token = bearer(c.req.header("authorization"));
      if (token === null) {
        c.header("WWW-Authenticate", "Bearer");
        return c.json({ fehler: "nicht_angemeldet" }, 401);
      }
      const anmeldung = tokenAnmelden(angaben.db, angaben.zugang, token, { zaehlen: true });
      if (!anmeldung.ok) return abgelehnt(c, anmeldung);
      const gelesen = await nachrichtLesen(c);
      if (!gelesen.ok) return c.json(gelesen.antwort, 400);
      const { nachricht } = gelesen;
      const fassung = fassungVon(nachricht, (name) => c.req.header(name));
      if (!fassung.ok) return c.json(fassung.antwort, 400);
      // a notification asks for no answer (streamable-http.mdx, "Sending Messages", 5)
      if (nachricht.id === undefined) return c.body(null, 202);
      const { status, antwort } = await beantworten(
        { ...nachricht, id: nachricht.id },
        fassung.fassung,
        { version: angaben.version, api: apiMit(angaben, token) },
      );
      return c.json(antwort, status);
    })
    // no stream of the server's own and no sessions to end (streamable-http.mdx, "Backward Compatibility")
    .on(["GET", "DELETE"], "/", (c) => c.body(null, 405, { Allow: "POST" }));
