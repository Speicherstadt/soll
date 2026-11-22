import { json, PZ } from "./projektzeit-testhilfen.ts";
import { buchen, type Person, um, werkstatt } from "./stoppuhr-testhilfen.ts";

/** Helpers for the tests of the Stundennachweis (S-605) */

export const SN = `${PZ}/stundennachweise`;

/** A signature: two strokes of whole numbers on the surface of 600 × 200 */
export const UNTERSCHRIFT = [
  [
    [20, 150],
    [120, 40],
    [240, 160],
  ],
  [
    [300, 100],
    [420, 100],
  ],
];

/**
 * Weber at 18:00 on 20.11.2026: Sandra booked Montage 8:00–11:30 on "Bad Elbhof", Jonas Fahrt
 * 12:00–12:45 there; besides, Sandra's internal Werkstatt and a booking on 18.11. outside the span
 */
export const baustelle = async () => {
  const w = await werkstatt();
  w.server.stelleUhr(um("18:00"));
  const auftrag = { projektId: w.projekt.projektId };
  const sandraMontage = await buchen(w.sandra, {
    ...auftrag,
    taetigkeitId: w.montage.taetigkeitId,
    beginn: um("08:00"),
    ende: um("11:30"),
    notiz: "Vorwand gesetzt",
  });
  const jonasFahrt = await buchen(w.weber, {
    ...auftrag,
    taetigkeitId: "fahrt",
    beginn: um("12:00"),
    ende: um("12:45"),
  });
  await buchen(w.sandra, {
    projektId: null,
    taetigkeitId: "werkstatt",
    beginn: um("13:00"),
    ende: um("14:00"),
  });
  await buchen(w.sandra, {
    ...auftrag,
    taetigkeitId: w.montage.taetigkeitId,
    beginn: um("08:00", "2026-11-18"),
    ende: um("09:00", "2026-11-18"),
  });
  return { ...w, sandraMontage, jonasFahrt };
};

export const vorschau = async (person: Person, frage: Record<string, string>) =>
  person.anfrage(`${SN}/vorschau?${new URLSearchParams(frage).toString()}`);

/** The preview of the report on "Bad Elbhof" for 19. to 20.11. */
export const tageFrage = (projektId: string, mehr: Record<string, string> = {}) => ({
  projektId,
  von: "2026-11-19",
  bis: "2026-11-20",
  ...mehr,
});

/** Signs the report the preview shows, with Erika Elbhof's name and signature */
export const unterschreiben = async (
  person: Person,
  frage: Record<string, string>,
  mehr: Record<string, unknown> = {},
) => {
  const stand = (await json(await vorschau(person, frage))).stand;
  return person.anfrage(SN, {
    body: { ...frage, stand, unterzeichner: "Erika Elbhof", unterschrift: UNTERSCHRIFT, ...mehr },
  });
};
