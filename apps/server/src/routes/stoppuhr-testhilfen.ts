import { anlegen, json, PZ, weberMitAuftrag } from "./projektzeit-testhilfen.ts";

/** Helpers for the tests of the stopwatch (S-602) */

// 20.11.2026, a Friday in winter time (+01:00)
export const um = (zeit: string, tag = "2026-11-20") => Date.parse(`${tag}T${zeit}+01:00`);

type Weber = Awaited<ReturnType<typeof weberMitAuftrag>>;
export type Person = Pick<Weber["weber"], "anfrage" | "nutzerId">;

/**
 * Weber Haustechnik at 7:00 on 20.11.2026 with the order "Bad Elbhof", the own activity Montage and
 * Sandra, a fitter
 */
export const werkstatt = async () => {
  const weber = await weberMitAuftrag();
  weber.server.stelleUhr(um("07:00"));
  const montage = await anlegen(weber.weber, "/taetigkeiten", { name: "Montage" });
  const sandra = await weber.server.eingeladen(weber.weber, "mitarbeiter", "sandra");
  return {
    ...weber,
    kunde: weber.kunde as { kundeId: string },
    projekt: weber.projekt as { projektId: string; kundeId: string },
    montage: montage as { taetigkeitId: string },
    sandra,
  };
};

export const starten = (person: Person, body: Record<string, unknown>) =>
  person.anfrage(`${PZ}/stoppuhr/start`, { body });

export const stoppen = (person: Person) => person.anfrage(`${PZ}/stoppuhr/stopp`, { body: {} });

/** The stopwatch's day: GET /stoppuhr with its query */
export const stand = async (person: Person, frage = "") =>
  json(await person.anfrage(`${PZ}/stoppuhr${frage ? `?${frage}` : ""}`));

export const stempeln = async (person: Person, art: string) => {
  const antwort = await person.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art } });
  if (antwort.status !== 201) throw new Error(`stempeln ${antwort.status}`);
  return json(antwort);
};

/** Books by hand and returns the booking, failing loudly on anything but 201 */
export const buchen = async (person: Person, body: Record<string, unknown>) => {
  const antwort = await person.anfrage(`${PZ}/buchungen`, { body });
  if (antwort.status !== 201) throw new Error(`buchen ${antwort.status}: ${await antwort.text()}`);
  return json(antwort);
};
