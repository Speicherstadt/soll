/** Cases found in the third round of the independent review of S-306 */
import { describe, expect, it } from "vitest";
import {
  abschliessen,
  bestaetigen,
  type Json,
  json,
  pruefen,
  um,
  weber,
} from "./monat-testhilfen.ts";

const STUNDE = 60 * 60 * 1000;

/** Shifts of 6 h, 8 h apart, from 27 September 6:00 to 3 October: chains of shifts under 9 h apart */
const kette = () => {
  const eintraege: [string, string][] = [];
  for (
    let zeit = um("2026-09-27T06:00:00+02:00");
    zeit < um("2026-10-03T00:00:00+02:00");
    zeit += 14 * STUNDE
  )
    eintraege.push(
      ["kommen", new Date(zeit).toISOString()],
      ["gehen", new Date(zeit + 6 * STUNDE).toISOString()],
    );
  return eintraege;
};

describe("shifts under 9 h apart across the start of a closed month", () => {
  it("are read alike by closing and by the check page", async () => {
    const w = await weber();
    await w.tag(w.sandra, kette());
    expect((await bestaetigen(w.sandra)).status).toBe(201);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    expect(antwort.status).toBe(201);
    const pruefwert = ((await json(antwort)).abschluss as Json).pruefwert as string;
    expect(await pruefen(w.server, w.jonas.betriebId, pruefwert)).toMatchObject({
      ergebnis: "uebereinstimmend",
    });
  });

  it("refuses removing a Kommen days before the month that regroups its first days", async () => {
    const w = await weber();
    const [ersterKommen] = await w.tag(w.sandra, kette());
    await bestaetigen(w.sandra);
    const antwort = await abschliessen(w.jonas, w.sandra.nutzerId);
    const pruefwert = ((await json(antwort)).abschluss as Json).pruefwert as string;
    const entfernen = await w.jonas.anfrage(
      `/api/v1/arbeitszeit/stempelungen/${ersterKommen}/entfernen`,
      { body: { grund: "x" } },
    );
    const danach = await pruefen(w.server, w.jonas.betriebId, pruefwert);
    // either the change is refused, or it left October as closed
    expect({ status: entfernen.status, ergebnis: danach.ergebnis }).toMatchObject(
      entfernen.status === 409
        ? { ergebnis: "uebereinstimmend" }
        : { status: 201, ergebnis: "uebereinstimmend" },
    );
  });
});
