import type { Fehlend, Ziel } from "./typen.ts";
import { PFAD } from "./typen.ts";

export type Ergebnis =
  | { ok: true }
  | { ok: false; fehlend: Fehlend[] }
  | { ok: false; grund: "netz" | "server" };

/** The file name the server gives in Content-Disposition */
export const dateinameAus = (kopf: string | null): string | null =>
  /filename="([^"]+)"/.exec(kopf ?? "")?.[1] ?? null;

/**
 * Fetches the file of a month and hands it to the browser as a download; a month that cannot be
 * exported comes back with what is "nicht hinterlegt" (S-308)
 */
export const herunterladen = async (monat: string, ziel: Ziel): Promise<Ergebnis> => {
  let antwort: Response;
  try {
    antwort = await fetch(`${PFAD}/export?monat=${monat}&ziel=${ziel}`, {
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, grund: "netz" };
  }
  if (antwort.status === 409) {
    const daten = (await antwort.json().catch(() => null)) as { fehlend?: Fehlend[] } | null;
    return { ok: false, fehlend: daten?.fehlend ?? [] };
  }
  if (!antwort.ok) return { ok: false, grund: "server" };
  const url = URL.createObjectURL(await antwort.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = dateinameAus(antwort.headers.get("content-disposition")) ?? "";
  link.click();
  // the browser takes the file after this turn; the address is freed once it has
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
};
