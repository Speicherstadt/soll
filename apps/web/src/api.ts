import { demoAntwort } from "./demo/demoApi.ts";

/**
 * Calls of the API under the app's own origin (Vite forwards /api in development, the server serves
 * both in production). Errors come back as values (CLAUDE.md): status 0 means no answer at all.
 */
export type Antwort<T> =
  | { ok: true; status: number; daten: T }
  /** `koerper`: the whole answer, for refusals that say more than why (e.g. until when) */
  | { ok: false; status: number; fehler: string; koerper?: unknown };

export const api = async <T>(
  pfad: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Antwort<T>> => {
  if (import.meta.env.VITE_DEMO === "1") return demoAntwort<T>(pfad, init);
  let antwort: Response;
  try {
    antwort = await fetch(pfad, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      headers: {
        ...init.headers,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    return { ok: false, status: 0, fehler: "netz" };
  }
  const text = await antwort.text().catch(() => "");
  let daten: unknown = null;
  try {
    daten = text ? JSON.parse(text) : null;
  } catch {
    // a proxy's error page or nothing at all: no answer from the API
    return { ok: false, status: antwort.ok ? 0 : antwort.status, fehler: "netz" };
  }
  if (antwort.ok) return { ok: true, status: antwort.status, daten: daten as T };
  const fehler = (daten as { fehler?: string; code?: string } | null) ?? {};
  return {
    ok: false,
    status: antwort.status,
    fehler: fehler.fehler ?? fehler.code ?? "unbekannt",
    koerper: daten,
  };
};
