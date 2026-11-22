/*
 * Fetching a source and the result of a check (findings and warnings). After firsttris/haben,
 * scripts/jahreswerte/abruf.ts (main of 20.11.2026): the retry, the charset of
 * gesetze-im-internet.de and the bounded parallelism are copied from there. `fetch` comes from
 * outside, so the tests stand in for the source without a network.
 */

/** Something Soll has to look at; it becomes an entry in the one issue of the Gesetzeswächter */
export type Befund = {
  /** Fixed key, e.g. `norm-arbzg-3` or `jahreswert-mindestlohn-2028` */
  schluessel: string;
  titel: string;
  /** Markdown: the source, what to do */
  text: string;
};

/** What a check returns; a source that does not answer is a warning, not a finding */
export type Ergebnis = { befunde: Befund[]; warnungen: string[] };

export type Holen = (url: string, init?: RequestInit) => Promise<Response>;

/** A response reduced to what the checks read */
export type Abruf =
  | { art: "antwort"; status: number; inhalt: Uint8Array<ArrayBuffer>; typ: string }
  | { art: "fehler"; meldung: string };

export const LEER: Ergebnis = { befunde: [], warnungen: [] };

export const zusammen = (ergebnisse: readonly Ergebnis[]): Ergebnis => ({
  befunde: ergebnisse.flatMap((e) => e.befunde),
  warnungen: ergebnisse.flatMap((e) => e.warnungen),
});

export const warnung = (meldung: string): Ergebnis => ({ befunde: [], warnungen: [meldung] });
export const befund = (b: Befund): Ergebnis => ({ befunde: [b], warnungen: [] });

const ZEITLIMIT_MS = 30_000;
const PAUSE_VOR_WIEDERHOLUNG_MS = 2_000;
/** For all fetches of a run; the job has `timeout-minutes: 15` and needs time for the issue */
const GESAMTFRIST_MS = 10 * 60_000;

/**
 * `holen` that retries once after a pause on a network error, a timeout or 5xx: gesetze-im-internet.de
 * now and then resets the connection (haben, abruf.ts). Each attempt has its own time limit; after
 * the `frist` nothing is fetched any more, and the source becomes a warning.
 */
export const mitWiederholung = (
  holen: Holen,
  pause = PAUSE_VOR_WIEDERHOLUNG_MS,
  zeitlimit = ZEITLIMIT_MS,
  frist: AbortSignal = AbortSignal.timeout(GESAMTFRIST_MS),
): Holen => {
  const versuch = (url: string, init?: RequestInit) =>
    holen(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(zeitlimit), frist]) });
  return async (url, init) => {
    frist.throwIfAborted();
    try {
      const antwort = await versuch(url, init);
      if (antwort.status < 500) return antwort;
      await antwort.body?.cancel();
    } catch {
      // a second attempt follows unless the deadline has passed
    }
    frist.throwIfAborted();
    await new Promise((fertig) => setTimeout(fertig, pause));
    return versuch(url, init);
  };
};

/** Fetches a URL without following redirects; an error becomes a value */
export async function abrufen(holen: Holen, url: string): Promise<Abruf> {
  try {
    const antwort = await holen(url, { redirect: "manual" });
    const inhalt = new Uint8Array(await antwort.arrayBuffer());
    return {
      art: "antwort",
      status: antwort.status,
      inhalt,
      typ: antwort.headers.get("content-type") ?? "",
    };
  } catch (e) {
    return { art: "fehler", meldung: e instanceof Error ? e.message : String(e) };
  }
}

/** Status or error message, for a warning */
export const beschreibe = (a: Abruf): string =>
  a.art === "fehler" ? a.meldung : `HTTP ${a.status}`;

const CHARSET = /charset=["']?([\w-]+)/i;
const LATIN1 = new Set(["iso-8859-1", "latin1", "windows-1252"]);

/**
 * The text of a response. gesetze-im-internet.de sends `text/html` without a charset and ISO-8859-1
 * bytes; the charset is named only in the meta element at the top (haben, abruf.ts).
 */
export function text(a: Abruf & { art: "antwort" }): string {
  const kopf = new TextDecoder("windows-1252").decode(a.inhalt.subarray(0, 1024));
  const zeichensatz = (CHARSET.exec(a.typ) ?? CHARSET.exec(kopf))?.[1]?.toLowerCase() ?? "utf-8";
  return new TextDecoder(LATIN1.has(zeichensatz) ? "windows-1252" : "utf-8").decode(a.inhalt);
}

export async function sha256(inhalt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inhalt));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Runs `aufgabe` with at most `parallel` at a time; results in the order of the input */
export async function begrenzt<T, E>(
  eingaben: readonly T[],
  parallel: number,
  aufgabe: (t: T) => Promise<E>,
): Promise<E[]> {
  const ergebnisse: E[] = new Array(eingaben.length);
  let naechste = 0;
  const arbeiter = async () => {
    while (naechste < eingaben.length) {
      const i = naechste++;
      ergebnisse[i] = await aufgabe(eingaben[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, eingaben.length) }, arbeiter));
  return ergebnisse;
}
