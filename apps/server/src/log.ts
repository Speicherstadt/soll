/**
 * One JSON line per request, without secrets: no query values (an ICS feed carries its token there),
 * no headers at all (Authorization, cookies, API tokens) and no bodies (PINs, passwords).
 */

export type RequestLog = {
  time: string;
  method: string;
  path: string;
  status: number;
  ms: number;
};

export type LogSink = (line: string) => void;

/**
 * The path, with a query only marked as `?…`: no part of it is logged, not even its keys, as a bare or
 * encoded token can stand where a key would (two review rounds of S-101 found such leaks)
 */
/** A path segment with its valid percent escapes decoded, as Hono decodes the path for routing */
const entschluesselt = (teil: string): string =>
  teil.replace(/(%[0-9A-Fa-f]{2})+/g, (folge) => {
    try {
      return decodeURIComponent(folge);
    } catch {
      return folge;
    }
  });

export const redactUrl = (url: string): string => {
  const parsed = new URL(url, "http://soll.invalid");
  // the token of an invitation link is the only key to it (routes/einladungen.ts); Hono routes the
  // decoded path, so `/%65inladung/<token>` reaches the same route and must be redacted as well
  const teile = parsed.pathname.split("/");
  const pfad = teile
    .map((teil, i) => (i > 0 && entschluesselt(teile[i - 1] ?? "") === "einladung" ? "…" : teil))
    .join("/");
  return parsed.search.length > 1 ? `${pfad}?…` : pfad;
};

export const formatRequestLog = (entry: RequestLog): string => JSON.stringify(entry);
