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

/** The path with each query value replaced by `…`, so the keys still show what was asked */
export const redactUrl = (url: string): string => {
  const parsed = new URL(url, "http://soll.invalid");
  const keys = [...new Set(parsed.searchParams.keys())];
  return keys.length === 0
    ? parsed.pathname
    : `${parsed.pathname}?${keys.map((key) => `${key}=…`).join("&")}`;
};

export const formatRequestLog = (entry: RequestLog): string => JSON.stringify(entry);
