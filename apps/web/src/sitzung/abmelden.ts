import type { Antwort } from "../api.ts";
import type { Zustand } from "./ziel.ts";

export type AbmeldenErgebnis = "" | "netz" | "fehler";

export type AbmeldenSchritte = {
  senden: () => Promise<Antwort<unknown>>;
  loeschen: () => void;
  pruefen: () => Promise<Zustand>;
};

/**
 * Signs out with network/retry safety shared by Settings and Sidebar: without an answer the
 * session may still be alive; on a refusal (e.g. a second click) re-checks whether the server
 * already ended the session.
 */
export const abmeldenAblauf = async ({
  senden,
  loeschen,
  pruefen,
}: AbmeldenSchritte): Promise<AbmeldenErgebnis> => {
  const antwort = await senden();
  if (antwort.status === 0) return "netz";
  if (antwort.ok) loeschen();
  else if ((await pruefen()).art !== "abgemeldet") return "fehler";
  return "";
};
