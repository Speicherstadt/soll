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

/** A key as the app's own URLs name them; anything else in key position may be a value */
const plainKey = /^[A-Za-z0-9_.-]+$/;

/**
 * One query part as it may be logged: `key=…` for a plain key with a value, else only `…`. A part
 * without `=` is all value (`feed.ics?<token>`), and so is one whose `=` are only trailing, since that is
 * how a padded base64 token ends (`feed.ics?<token>==`). A key is checked undecoded, so
 * `token%3D<secret>` does not show its value once decoded.
 */
const redactPart = (part: string): string => {
  const separator = part.indexOf("=");
  const key = part.slice(0, separator);
  const value = part.slice(separator + 1);
  const hasValue = /[^=]/.test(value);
  return separator > 0 && hasValue && plainKey.test(key) ? `${key}=…` : "…";
};

/** The path with each query value replaced by `…`, so the keys still show what was asked */
export const redactUrl = (url: string): string => {
  const parsed = new URL(url, "http://soll.invalid");
  const parts = parsed.search
    .slice(1)
    .split("&")
    .filter((part) => part !== "");
  const redacted = [...new Set(parts.map(redactPart))];
  return redacted.length === 0 ? parsed.pathname : `${parsed.pathname}?${redacted.join("&")}`;
};

export const formatRequestLog = (entry: RequestLog): string => JSON.stringify(entry);
