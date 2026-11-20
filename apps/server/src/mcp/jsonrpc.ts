import { z } from "zod";

/*
 * The JSON-RPC 2.0 messages MCP is made of (jsonrpc.org/specification; MCP 2026-07-28,
 * basic/index.mdx): a request has an id, a notification has none. The error codes are JSON-RPC's
 * and the ones the MCP specification reserves (schema/2026-07-28/schema.ts).
 */

export const FEHLERCODE = {
  parse: -32700,
  anfrage: -32600,
  methode: -32601,
  parameter: -32602,
  intern: -32603,
  kopfzeilen: -32020,
  fassung: -32022,
} as const;

const id = z.union([z.string(), z.number().int()]);

export const nachrichtSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: id.optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type Nachricht = z.infer<typeof nachrichtSchema>;
export type Id = z.infer<typeof id>;

export type Antwort =
  | { jsonrpc: "2.0"; id: Id; result: Record<string, unknown> }
  | {
      jsonrpc: "2.0";
      id?: Id;
      error: { code: number; message: string; data?: Record<string, unknown> };
    };

export const ergebnis = (anfrageId: Id, result: Record<string, unknown>): Antwort => ({
  jsonrpc: "2.0",
  id: anfrageId,
  result,
});

/** An error; without an id when the message could not be read far enough to know it */
export const fehler = (
  anfrageId: Id | undefined,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): Antwort => ({
  jsonrpc: "2.0",
  ...(anfrageId === undefined ? {} : { id: anfrageId }),
  error: { code, message, ...(data ? { data } : {}) },
});

/** The `_meta` of a request's params, empty when it has none */
export const metaVon = (nachricht: Nachricht): Record<string, unknown> => {
  const meta = nachricht.params?._meta;
  return meta !== null && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
};
