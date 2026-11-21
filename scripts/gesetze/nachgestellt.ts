/*
 * Stand-in sources for the tests: a response or a network error per URL, after
 * firsttris/haben, scripts/jahreswerte/nachgestellt.ts. Unknown URLs answer 404.
 */
import type { Holen } from "./abruf.ts";

export type Nachgestellt =
  | {
      status: number;
      text?: string;
      bytes?: Uint8Array<ArrayBuffer>;
      headers?: Record<string, string>;
    }
  | { fehler: string };

export const antwort = (
  status: number,
  text = "",
  headers: Record<string, string> = {},
): Nachgestellt => ({ status, text, headers });

export const netzwerkfehler: Nachgestellt = { fehler: "Connection reset by peer" };

export function nachgestellt(
  antworten: Record<string, Nachgestellt>,
): Holen & { aufrufe: string[] } {
  const aufrufe: string[] = [];
  const holen = async (url: string) => {
    aufrufe.push(url);
    const a = antworten[url] ?? antwort(404);
    if ("fehler" in a) throw new TypeError(a.fehler);
    return new Response(a.bytes ?? a.text ?? "", { status: a.status, headers: a.headers ?? {} });
  };
  return Object.assign(holen, { aufrufe });
}
