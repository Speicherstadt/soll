import { type Monat, plusTage, type Tag, wochenbeginn } from "@soll/arbeitszeit";
import type { Ereignis, Handlung, PlanSchicht, Zufall } from "./ereignis.ts";
import {
  isoWochentag,
  letzterWochentag,
  nterWochentag,
  tageVon,
  um,
  type Zeitraum,
} from "./zeitraum.ts";

/**
 * Three months of Café Elbblick (BAULISTE.md S-909): Lea plans each week on the Thursday before and
 * publishes it, everyone stamps at the terminal by the counter with their PIN. Monday is the day
 * off. On purpose: an evening event leaves Tom 9.5 hours of rest before his early shift (§ 5 ArbZG,
 * R-05), and the late shift on the last Saturday of October runs over the change to winter time.
 */
type Muster = Omit<PlanSchicht, "person" | "tag">;

const H = 60;
const FRUEH: Muster = {
  beginnMinute: 7 * H + 30,
  endeMinute: 15 * H + 30,
  pauseMinuten: 30,
  rolle: "Service",
};
const SPAET: Muster = {
  beginnMinute: 12 * H,
  endeMinute: 20 * H,
  pauseMinuten: 30,
  rolle: "Service",
};
const MITTE: Muster = {
  beginnMinute: 10 * H,
  endeMinute: 18 * H,
  pauseMinuten: 30,
  rolle: "Küche",
};
const AUSHILFE: Muster = {
  beginnMinute: 11 * H,
  endeMinute: 15 * H,
  pauseMinuten: 0,
  rolle: "Service",
};
const ABEND: Muster = {
  beginnMinute: 16 * H,
  endeMinute: 20 * H,
  pauseMinuten: 0,
  rolle: "Service",
};
const VERANSTALTUNG: Muster = {
  beginnMinute: 14 * H,
  endeMinute: 22 * H,
  pauseMinuten: 30,
  rolle: "Service",
};
/**
 * 20:00 to 3:30 on the clock: on the night the clocks go back an hour this is 8.5 real hours (3:30
 * comes once, in winter time; 2:30 would come twice, and Soll reads it as the first)
 */
const LANGE_NACHT: Muster = {
  beginnMinute: 20 * H,
  endeMinute: 3 * H + 30,
  pauseMinuten: 30,
  rolle: "Service",
};

/** The rota by ISO weekday (2 Tuesday … 7 Sunday) */
const ROTA: Readonly<Record<string, Readonly<Record<number, Muster>>>> = {
  tom: { 2: FRUEH, 3: FRUEH, 4: FRUEH, 5: FRUEH, 6: SPAET },
  lea: { 2: SPAET, 3: SPAET, 4: SPAET, 5: SPAET, 7: FRUEH },
  yusuf: { 3: MITTE, 4: MITTE, 5: MITTE, 6: FRUEH, 7: SPAET },
  olena: { 6: AUSHILFE, 7: AUSHILFE },
  piotr: { 5: ABEND, 7: AUSHILFE },
};

export const CAFE_PERSONEN = Object.keys(ROTA);

/** The days the story fixes, from the three full months */
export const cafeTage = (zr: Zeitraum) => {
  const [m1, m2, m3] = zr.volleMonate as [Monat, Monat, Monat];
  const yusufUrlaub = nterWochentag(m2, 3, 3);
  const leaKind = nterWochentag(m3, 2, 2);
  const oktober = zr.volleMonate.find((m) => m.endsWith("-10")) ?? `${zr.heute.slice(0, 4)}-10`;
  return {
    piotrVergisst: nterWochentag(m1, 5, 2),
    veranstaltung: nterWochentag(m2, 3, 2),
    yusufUrlaub: { von: yusufUrlaub, bis: plusTage(yusufUrlaub, 4) },
    leaKind: { von: leaKind, bis: plusTage(leaKind, 1) },
    // the Saturday before the last Sunday of October, when the clocks go back at 3:00
    langeNacht: plusTage(letzterWochentag(oktober, 7), -1),
  };
};

type Tage = ReturnType<typeof cafeTage>;

const imZeitraum = (tag: Tag, spanne: { von: Tag; bis: Tag }) =>
  tag >= spanne.von && tag <= spanne.bis;

/** The shift of a person on a day as planned, with the story's changes; null on a day off */
const geplant = (tage: Tage, person: string, tag: Tag): Muster | null => {
  if (person === "yusuf" && imZeitraum(tag, tage.yusufUrlaub)) return null;
  if (person === "tom" && tag === tage.veranstaltung) return VERANSTALTUNG;
  if (person === "tom" && tag === tage.langeNacht) return LANGE_NACHT;
  return ROTA[person]?.[isoWochentag(tag)] ?? null;
};

const schichtenAm = (tage: Tage, tag: Tag): PlanSchicht[] =>
  CAFE_PERSONEN.flatMap((person) => {
    const muster = geplant(tage, person, tag);
    return muster ? [{ ...muster, person, tag }] : [];
  });

const ereignis = (zeit: number, handlung: Handlung): Ereignis => ({
  zeit,
  betrieb: "cafe",
  handlung,
});

/** When a week is planned: the Thursday before at 16:00, or right after the setup for the first */
const planungVon = (montag: Tag, zr: Zeitraum): number =>
  Math.max(um(plusTage(montag, -4), 16, 0), um(plusTage(zr.beginn, -1), 12, 0));

/** Each week from the first of the demo to the one after `heute`, planned and published */
const wochenplaene = (zr: Zeitraum, tage: Tage): Ereignis[] => {
  const letzte = plusTage(wochenbeginn(zr.heute), 7);
  const montage = tageVon(wochenbeginn(zr.beginn), letzte).filter((tag) => isoWochentag(tag) === 1);
  return montage.map((montag) =>
    ereignis(planungVon(montag, zr), {
      art: "planen",
      von: "lea",
      woche: montag,
      schichten: tageVon(montag, plusTage(montag, 6))
        .filter((tag) => tag >= zr.beginn)
        .flatMap((tag) => schichtenAm(tage, tag)),
    }),
  );
};

/** The stamps of a planned shift at the terminal: a little early or late, as people are */
const gestempelt = (schicht: PlanSchicht, z: Zufall, ohneGehen: boolean): Ereignis[] => {
  const { person, tag, beginnMinute, endeMinute, pauseMinuten } = schicht;
  const ende = endeMinute > beginnMinute ? endeMinute : endeMinute + 24 * H;
  const stempeln = (zeit: number, stempel: "kommen" | "gehen" | "pause_beginn" | "pause_ende") =>
    ereignis(zeit, { art: "stempeln", person, stempel });
  const pause = beginnMinute + Math.floor((ende - beginnMinute - pauseMinuten) / 2) + z(-10, 10);
  return [
    stempeln(zeitpunkt(tag, beginnMinute + z(-6, 2)), "kommen"),
    ...(pauseMinuten > 0
      ? [
          stempeln(zeitpunkt(tag, pause), "pause_beginn"),
          stempeln(zeitpunkt(tag, pause + pauseMinuten + z(0, 3)), "pause_ende"),
        ]
      : []),
    ...(ohneGehen ? [] : [stempeln(zeitpunkt(tag, ende + z(0, 8)), "gehen")]),
  ];
};

/**
 * A wall-clock minute of a day; past midnight it is the next day's clock, so an end at 2:30 on the
 * night clocks go back is 3:30 winter time, 8.5 real hours after 20:00 summer time
 */
const zeitpunkt = (tag: Tag, minute: number): number =>
  minute >= 24 * H ? um(plusTage(tag, 1), 0, minute - 24 * H) : um(tag, 0, minute);

const stempelungen = (zr: Zeitraum, tage: Tage, z: Zufall): Ereignis[] =>
  tageVon(zr.beginn, zr.heute)
    .flatMap((tag) => schichtenAm(tage, tag))
    .filter((s) => !(s.person === "lea" && imZeitraum(s.tag, tage.leaKind)))
    .flatMap((s) => gestempelt(s, z, s.person === "piotr" && s.tag === tage.piotrVergisst));

const geschichte = (tage: Tage): Ereignis[] => {
  const urlaub = `urlaub-yusuf-${tage.yusufUrlaub.von}`;
  const gestellt = plusTage(tage.yusufUrlaub.von, -28);
  return [
    ereignis(um(gestellt, 21, 3), {
      art: "antrag",
      person: "yusuf",
      abwesenheit: "urlaub",
      ...tage.yusufUrlaub,
      ref: urlaub,
    }),
    ereignis(um(plusTage(gestellt, 1), 9, 30), { art: "freigeben", von: "mia", ref: urlaub }),
    ereignis(um(tage.leaKind.von, 6, 40), {
      art: "krank",
      person: "lea",
      abwesenheit: "kind_krank",
      bis: tage.leaKind.bis,
      kind: "K1",
      ref: `kind-lea-${tage.leaKind.von}`,
    }),
    ereignis(um(plusTage(tage.piotrVergisst, 1), 9, 0), {
      art: "nachtrag",
      von: "mia",
      person: "piotr",
      stempel: "gehen",
      zeitpunkt: um(tage.piotrVergisst, 20, 4),
      grund: "Gehen am Terminal vergessen; Ende laut Kassenabschluss",
    }),
  ];
};

export const cafeEreignisse = (zr: Zeitraum, z: Zufall): Ereignis[] => {
  const tage = cafeTage(zr);
  return [...geschichte(tage), ...wochenplaene(zr, tage), ...stempelungen(zr, tage, z)];
};
