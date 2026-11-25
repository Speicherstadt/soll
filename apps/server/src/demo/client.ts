/**
 * How the demo talks to Soll: through the app's own HTTP routes, as a browser or the tablet would
 * (BAULISTE.md S-909), so every write goes through auth, Zod, the modules and the audit chain.
 */
export type Holen = (url: string, init: RequestInit) => Promise<Response>;

export type Anfrage = (
  pfad: string,
  init?: { method?: string; body?: unknown },
) => Promise<Response>;

const senden =
  (holen: Holen, url: string, kopf: Record<string, string>): Anfrage =>
  async (pfad, init = {}) =>
    holen(`${url}${pfad}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", origin: url, ...kopf },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

/** A browser of one person: keeps its session cookie between calls */
export const browser = (holen: Holen, url: string): Anfrage => {
  let cookie = "";
  return async (pfad, init) => {
    const antwort = await senden(holen, url, cookie ? { cookie } : {})(pfad, init);
    const gesetzt = antwort.headers.getSetCookie();
    if (gesetzt.length > 0) cookie = gesetzt.map((zeile) => zeile.split(";")[0]).join("; ");
    return antwort;
  };
};

/** The paired tablet: its device token, no cookie (S-801) */
export const tablet = (holen: Holen, url: string, token: string): Anfrage =>
  senden(holen, url, { authorization: `Bearer ${token}` });

/** Calls and fails loudly with the path and the answer unless it succeeds */
export const erwarten = async <T = Record<string, unknown>>(
  anfrage: Anfrage,
  pfad: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> => {
  const antwort = await anfrage(pfad, init);
  const text = await antwort.text();
  if (!antwort.ok) throw new Error(`${init.method ?? "POST"} ${pfad}: ${antwort.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
};
