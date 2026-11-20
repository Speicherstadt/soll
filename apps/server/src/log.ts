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
export const redactUrl = (url: string): string => {
  const parsed = new URL(url, "http://soll.invalid");
  return parsed.search.length > 1 ? `${parsed.pathname}?…` : parsed.pathname;
};

export const formatRequestLog = (entry: RequestLog): string => JSON.stringify(entry);
