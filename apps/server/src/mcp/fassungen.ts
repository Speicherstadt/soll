import { type Antwort, FEHLERCODE, fehler, metaVon, type Nachricht } from "./jsonrpc.ts";

/*
 * The protocol versions Soll's MCP server speaks (MCP 2026-07-28, basic/versioning.mdx, "Backward
 * Compatibility with Initialization-Based Versions"): the stateless revision 2026-07-28 with
 * `server/discover` and per-request `_meta`, and the earlier revisions with `initialize`, served
 * statelessly too (the session id is optional there and Soll mints none).
 */

export const MODERN = "2026-07-28";
export const FRUEHERE = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const FASSUNGEN = [MODERN, ...FRUEHERE];

/** Without the header a client predates 2025-06-18 (streamable-http.mdx, "Protocol Version Header") */
const OHNE_KOPF = "2025-03-26";

const META_FASSUNG = "io.modelcontextprotocol/protocolVersion";

export type Fassung = { modern: boolean; fassung: string };

/** `=?base64?…?=` carries a value that is no plain ASCII header (streamable-http.mdx, "Value Encoding") */
export const kopfWert = (wert: string | undefined): string | undefined => {
  const treffer = /^=\?base64\?([A-Za-z0-9+/=]*)\?=$/.exec(wert ?? "");
  return treffer ? Buffer.from(treffer[1] ?? "", "base64").toString("utf8") : wert;
};

type Kopf = (name: string) => string | undefined;

const abweichung = (nachricht: Nachricht, text: string): Antwort =>
  fehler(nachricht.id, FEHLERCODE.kopfzeilen, `Header mismatch: ${text}`);

/**
 * The headers of 2026-07-28 against the body: version, method and, for a tool call, the tool's name
 * (streamable-http.mdx, "Server Validation"); a mismatch is refused with 400 and -32020
 */
const kopfzeilenPruefen = (nachricht: Nachricht, kopf: Kopf): Antwort | null => {
  if (metaVon(nachricht)[META_FASSUNG] !== MODERN)
    return abweichung(nachricht, "MCP-Protocol-Version does not match the body's _meta");
  if (kopf("mcp-method") !== nachricht.method)
    return abweichung(nachricht, "Mcp-Method does not match the body's method");
  if (nachricht.method === "tools/call" && kopfWert(kopf("mcp-name")) !== nachricht.params?.name)
    return abweichung(nachricht, "Mcp-Name does not match the body's params.name");
  return null;
};

/** The version a request is served in, or the error that refuses it with 400 */
export const fassungVon = (
  nachricht: Nachricht,
  kopf: Kopf,
): { ok: true; fassung: Fassung } | { ok: false; antwort: Antwort } => {
  const angefragt = kopf("mcp-protocol-version") ?? OHNE_KOPF;
  if (angefragt === MODERN) {
    const falsch = kopfzeilenPruefen(nachricht, kopf);
    return falsch
      ? { ok: false, antwort: falsch }
      : { ok: true, fassung: { modern: true, fassung: MODERN } };
  }
  if ((FRUEHERE as readonly string[]).includes(angefragt))
    return { ok: true, fassung: { modern: false, fassung: angefragt } };
  return {
    ok: false,
    antwort: fehler(nachricht.id, FEHLERCODE.fassung, "Unsupported protocol version", {
      supported: FASSUNGEN,
      requested: angefragt,
    }),
  };
};

/** The legacy `initialize` answers with the client's version if Soll speaks it, else its newest */
export const ausgehandelt = (gewuenscht: unknown): string =>
  (FRUEHERE as readonly string[]).includes(gewuenscht as string)
    ? (gewuenscht as string)
    : FRUEHERE[0];
