import { statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import type { Context } from "hono";

/** Vite names every file under assets/ by its content hash, so a cached copy never goes stale */
const UNVERAENDERLICH = "public, max-age=31536000, immutable";

/**
 * index.html and sw.js are asked again every time: a new build reaches every device on its next
 * visit, and the service worker then replaces the cached app (apps/web/build/service-worker.ts)
 */
const IMMER_FRAGEN = "no-cache";

/** Paths the API owns: they never answer with the app, also when no route matches */
const istApi = (pfad: string): boolean =>
  pfad === "/api" || pfad.startsWith("/api/") || pfad === "/health";

/** The decoded path, or null for one that does not decode or carries a NUL byte */
const dekodiert = (url: string): string | null => {
  try {
    const pfad = decodeURIComponent(new URL(url).pathname);
    return pfad.includes("\0") ? null : pfad;
  } catch {
    return null;
  }
};

/** The file under `wurzel` the path names, or null when it would lie outside or is no file */
const dateiUnter = (wurzel: string, pfad: string): string | null => {
  const datei = resolve(wurzel, `.${pfad}`);
  if (!datei.startsWith(wurzel + sep)) return null;
  try {
    return statSync(datei).isFile() ? datei : null;
  } catch {
    return null;
  }
};

const ausliefern = (datei: string, cache: string): Response => {
  const inhalt = Bun.file(datei);
  return new Response(inhalt, {
    headers: { "content-type": inhalt.type, "cache-control": cache },
  });
};

/**
 * Serves the static build of apps/web next to the API (S-905): a file of the build with its type, a
 * route of the SPA (a path without a file extension) with index.html, anything else 404. The
 * server stays one binary plus one directory, and the browser sees one origin for app and API.
 */
export const webAuslieferung = (verzeichnis: string) => {
  const wurzel = resolve(verzeichnis);
  const index = resolve(wurzel, "index.html");
  return (c: Context): Response => {
    const pfad = dekodiert(c.req.url);
    if (pfad === null || istApi(pfad)) return c.notFound() as Response;
    const datei = pfad === "/" ? index : dateiUnter(wurzel, pfad);
    if (datei) {
      return ausliefern(datei, pfad.startsWith("/assets/") ? UNVERAENDERLICH : IMMER_FRAGEN);
    }
    return extname(pfad) === "" ? ausliefern(index, IMMER_FRAGEN) : (c.notFound() as Response);
  };
};
