import { TEST_URL } from "../test-server.ts";
import type { Server } from "./zugaenge-testhilfen.ts";

export const MODERN = "2026-07-28";

type Optionen = { kopf?: Record<string, string>; fassung?: string | null };

/** The headers 2026-07-28 asks for, mirrored from the body (streamable-http.mdx, "Request Metadata") */
const kopfzeilen = (body: Record<string, unknown>, fassung: string | null) => {
  if (fassung === null) return {};
  if (fassung !== MODERN) return { "mcp-protocol-version": fassung };
  const params = body.params as { name?: string } | undefined;
  return {
    "mcp-protocol-version": fassung,
    "mcp-method": String(body.method),
    ...(params?.name ? { "mcp-name": params.name } : {}),
  };
};

/** One POST to /mcp with a token, as an MCP client of the given revision sends it */
export const mcp =
  (server: Server, token: string | null) =>
  async (body: Record<string, unknown>, optionen: Optionen = {}) => {
    const fassung = optionen.fassung === undefined ? MODERN : optionen.fassung;
    const mitMeta =
      fassung === MODERN && body.method
        ? {
            ...body,
            params: {
              ...(body.params as object),
              _meta: { "io.modelcontextprotocol/protocolVersion": MODERN },
            },
          }
        : body;
    return server.app.request(`${TEST_URL}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        ...kopfzeilen(mitMeta, fassung),
        ...optionen.kopf,
      },
      body: JSON.stringify(mitMeta),
    });
  };

export type Rpc = {
  id?: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: Record<string, unknown> };
};

export const rpc = async (antwort: Response) => (await antwort.json()) as Rpc;

/** A tool call in 2026-07-28 */
export const werkzeug = (name: string, args: Record<string, unknown> = {}) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name, arguments: args },
});
