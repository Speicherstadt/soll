import type { Antwort } from "../api.ts";

/**
 * How long a call of the kiosk may take before it counts as no network: a server out of reach
 * behind a working Wi-Fi leaves `fetch` pending for minutes, and the kiosk must go on (S-803)
 */
export const FRIST_MS = 15_000;

/** The answer, or after FRIST_MS the answer of no network (status 0); the timer ends with the call */
export const mitFrist = <T>(antwort: Promise<Antwort<T>>): Promise<Antwort<T>> => {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  const abgelaufen = new Promise<Antwort<T>>((fertig) => {
    uhr = setTimeout(() => fertig({ ok: false, status: 0, fehler: "netz" }), FRIST_MS);
  });
  return Promise.race([antwort, abgelaufen]).finally(() => clearTimeout(uhr));
};
