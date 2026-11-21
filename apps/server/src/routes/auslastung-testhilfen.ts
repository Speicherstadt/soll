import { json, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, type Person, stempeln, um, werkstatt } from "./stoppuhr-testhilfen.ts";

/** Helpers for the tests of the utilisation (S-604) */

export const AL = `${PZ}/auslastung`;
/** The month the tests look at, from a day after it */
export const MONAT = "2026-11";
export const DANACH = um("09:00", "2026-12-02");

/** One shift of 7:00 to 15:00 on 20.11.2026, stamped live */
const schicht = async (
  server: { stelleUhr: (ms: number) => void },
  person: Person,
  bis = "15:00",
) => {
  server.stelleUhr(um("07:00"));
  await stempeln(person, "kommen");
  server.stelleUhr(um(bis));
  await stempeln(person, "gehen");
};

/**
 * Weber Haustechnik in November 2026: Sandra and Max (fitters) and Leon (apprentice) each stamped
 * 8 hours on 20.11.; Sandra booked 6 hours on the order (billable) and 1 hour of Fahrt (internal),
 * Max 4 hours on the order, Leon nothing (without his shift: two people with time). The clock stands on 2.12.2026.
 */
export const novemberBeiWeber = async ({ leonStempelt = true } = {}) => {
  const w = await werkstatt();
  const max = await w.server.eingeladen(w.weber, "mitarbeiter", "max");
  const leon = await w.server.eingeladen(w.weber, "mitarbeiter", "leon");
  for (const person of leonStempelt ? [w.sandra, max, leon] : [w.sandra, max])
    await schicht(w.server, person);
  const auftrag = { projektId: w.projekt.projektId, taetigkeitId: w.montage.taetigkeitId };
  await buchen(w.sandra, { ...auftrag, beginn: um("07:00"), ende: um("13:00") });
  await buchen(w.sandra, {
    projektId: null,
    taetigkeitId: "fahrt",
    beginn: um("13:00"),
    ende: um("14:00"),
  });
  await buchen(max, { ...auftrag, beginn: um("07:00"), ende: um("11:00") });
  w.server.stelleUhr(DANACH);
  return { ...w, max, leon };
};

export const team = async (person: Person, monat = MONAT) => person.anfrage(`${AL}?monat=${monat}`);

export const einstellen = (person: Person, jePerson: boolean) =>
  person.anfrage(`${AL}/einstellung`, { method: "PUT", body: { jePerson } });

export { json, um };
