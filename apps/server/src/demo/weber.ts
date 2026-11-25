import { letzterTag, type Monat, plusTage, type Tag, wochenbeginn } from "@soll/arbeitszeit";
import type { Ereignis, Handlung, PlanSchicht, Zufall } from "./ereignis.ts";
import {
  feiertageInHamburg,
  isoWochentag,
  nterWochentag,
  tageDes,
  um,
  type Zeitraum,
} from "./zeitraum.ts";

/**
 * Three months of Weber Haustechnik (BAULISTE.md S-909): the fitters and the apprentice stamp on
 * their phones Monday to Friday and book their hours on the orders; Anna in the office stamps and
 * corrects; leave, sickness, an emergency call that breaks §§ 3 and 4 ArbZG on purpose, a report the
 * customer signs, and next week's plan with a shift over eight hours for Leon (§ 8 JArbSchG).
 */
export const PROJEKTE = ["elbhof", "petersen", "speicherblick"] as const;

type Plan = { zr: Zeitraum; z: Zufall; tage: ReturnType<typeof weberTage> };
type Tagesplan = { kommen: number; pause: [number, number] | null; gehen: number | null };

const ereignis = (zeit: number, handlung: Handlung): Ereignis => ({
  zeit,
  betrieb: "weber",
  handlung,
});

const istWerktag = (tag: Tag, feiertage: ReadonlySet<Tag>) =>
  isoWochentag(tag) <= 5 && !feiertage.has(tag);

/** The first working day on or after `tag`: a chosen day of the story never falls on a holiday */
export const arbeitstagAb = (tag: Tag, feiertage: ReadonlySet<Tag>): Tag =>
  istWerktag(tag, feiertage) ? tag : arbeitstagAb(plusTage(tag, 1), feiertage);

/** The days the story fixes, from the three full months */
export const weberTage = (zr: Zeitraum) => {
  const [m1, m2, m3] = zr.volleMonate as [Monat, Monat, Monat];
  const feiertage = feiertageInHamburg(zr.beginn, plusTage(zr.heute, 14));
  const ab = (tag: Tag) => arbeitstagAb(tag, feiertage);
  const maxKrank = ab(nterWochentag(m1, 1, 3));
  const sandraUrlaub = nterWochentag(m2, 1, 2);
  const annaUrlaub = nterWochentag(m3, 4, 2);
  return {
    feiertage,
    sandraVergisst: ab(nterWochentag(m1, 3, 2)),
    maxKrank: { von: maxKrank, bis: plusTage(maxKrank, 3) },
    sandraUrlaub: { von: sandraUrlaub, bis: plusTage(sandraUrlaub, 4) },
    notdienst: ab(nterWochentag(m2, 2, 1)),
    nachweisBis: [...Array(7).keys()]
      .map((n) => plusTage(letzterTag(m2), -n))
      .find((tag) => istWerktag(tag, feiertage)) as Tag,
    annaUrlaub: { von: annaUrlaub, bis: plusTage(annaUrlaub, 1) },
    maxKorrektur: ab(nterWochentag(m3, 4, 3)),
  };
};

const imZeitraum = (tag: Tag, spanne: { von: Tag; bis: Tag }) =>
  tag >= spanne.von && tag <= spanne.bis;

/** The times of a normal day; `beginn` and `ende` as [hour, minute] */
const normalerTag = (
  { z }: Plan,
  tag: Tag,
  beginn: [number, number],
  pauseMinuten: number,
  ende: [number, number],
): Tagesplan => {
  const kommen = um(tag, beginn[0], beginn[1] + z(-6, 5));
  const pause = um(tag, 12, z(-10, 10));
  return {
    kommen,
    pause: [pause, pause + (pauseMinuten + z(0, 4)) * 60_000],
    gehen: um(tag, ende[0], ende[1] + z(-8, 6)),
  };
};

const stempelungen = (person: string, plan: Tagesplan, ref?: string): Ereignis[] => [
  ereignis(plan.kommen, { art: "stempeln", person, stempel: "kommen", ...(ref ? { ref } : {}) }),
  ...(plan.pause
    ? [
        ereignis(plan.pause[0], { art: "stempeln", person, stempel: "pause_beginn" }),
        ereignis(plan.pause[1], { art: "stempeln", person, stempel: "pause_ende" }),
      ]
    : []),
  ...(plan.gehen === null
    ? []
    : [ereignis(plan.gehen, { art: "stempeln", person, stempel: "gehen" })]),
];

/** A fitter books the day after clocking out: the drive there, the work, the drive back */
const buchungen = (person: string, projekt: string, plan: Tagesplan, zeit: number): Ereignis[] => {
  if (!plan.pause || plan.gehen === null) return [];
  const taetigkeit = projekt === "speicherblick" ? "wartung" : "montage";
  const halbeStunde = 30 * 60_000;
  const spannen: [string, number, number][] = [
    ["fahrt", plan.kommen, plan.kommen + halbeStunde],
    [taetigkeit, plan.kommen + halbeStunde, plan.pause[0]],
    [taetigkeit, plan.pause[1], plan.gehen - halbeStunde],
    ["fahrt", plan.gehen - halbeStunde, plan.gehen],
  ];
  return spannen.map(([t, beginn, ende]) =>
    ereignis(zeit, { art: "buchen", person, projekt, taetigkeit: t, beginn, ende }),
  );
};

/** Sandra and Max: three orders in turn, week by week, never both on the same one */
const projektDer = (person: "sandra" | "max", tag: Tag, zr: Zeitraum): string => {
  const woche = Math.floor(
    (Date.parse(wochenbeginn(tag)) - Date.parse(wochenbeginn(zr.beginn))) / 604_800_000,
  );
  return PROJEKTE[(woche + (person === "max" ? 1 : 0)) % PROJEKTE.length] as string;
};

const monteurTag = (plan: Plan, person: "sandra" | "max", tag: Tag): Ereignis[] => {
  const { tage } = plan;
  const notdienst = person === "max" && tag === tage.notdienst;
  // the emergency call: 6:30 to 18:15 with half an hour's break breaks §§ 3 and 4 ArbZG (R-02, R-04)
  const zeiten = notdienst
    ? {
        kommen: um(tag, 6, 30),
        pause: [um(tag, 12, 0), um(tag, 12, 30)] as [number, number],
        gehen: um(tag, 18, 15),
      }
    : normalerTag(plan, tag, [7, 0], 30, [15, 15]);
  const vergisst = person === "sandra" && tag === tage.sandraVergisst;
  const korrektur = person === "max" && tag === tage.maxKorrektur;
  const gestempelt = korrektur ? { ...zeiten, kommen: um(tag, 7, 41) } : zeiten;
  const ref = `max-${tag}`;
  return [
    ...stempelungen(
      person,
      vergisst ? { ...gestempelt, gehen: null } : gestempelt,
      korrektur ? ref : undefined,
    ),
    ...buchungen(
      person,
      projektDer(person, tag, plan.zr),
      zeiten,
      (zeiten.gehen ?? 0) + plan.z(3, 10) * 60_000,
    ),
    ...(vergisst
      ? [
          ereignis(um(plusTage(tag, 1), 8, 40), {
            art: "nachtrag",
            von: "anna",
            person,
            stempel: "gehen",
            zeitpunkt: zeiten.gehen ?? 0,
            grund: "Gehen vergessen; Ende laut Baustellenbericht",
          }),
        ]
      : []),
    ...(korrektur
      ? [
          ereignis(um(tag, 9, 10), {
            art: "aendern",
            von: "anna",
            ref,
            stempel: "kommen",
            zeitpunkt: zeiten.kommen,
            grund: "Kommen zu spät gestempelt; Ankunft auf der Baustelle laut Fahrtenbuch",
          }),
        ]
      : []),
  ];
};

/** Whether a person is away on a day by the story (leave, sickness) */
const abwesend = (person: string, tag: Tag, tage: Plan["tage"]): boolean =>
  (person === "max" && imZeitraum(tag, tage.maxKrank)) ||
  (person === "sandra" && imZeitraum(tag, tage.sandraUrlaub)) ||
  (person === "anna" && imZeitraum(tag, tage.annaUrlaub));

const tagDer = (plan: Plan, person: string, tag: Tag): Ereignis[] => {
  if (!istWerktag(tag, plan.tage.feiertage) || abwesend(person, tag, plan.tage)) return [];
  if (person === "sandra" || person === "max") return monteurTag(plan, person, tag);
  if (person === "leon")
    return isoWochentag(tag) === 5
      ? []
      : stempelungen(person, normalerTag(plan, tag, [7, 0], 60, [15, 30]));
  return stempelungen(person, normalerTag(plan, tag, [8, 0], 30, [14, 30]));
};

/** Requests and reports of absences, with the owner's answers */
const abwesenheiten = (tage: Plan["tage"]): Ereignis[] => {
  const antrag = (person: string, spanne: { von: Tag; bis: Tag }, vorher: number): Ereignis[] => {
    const ref = `urlaub-${person}-${spanne.von}`;
    const gestellt = plusTage(spanne.von, -vorher);
    return [
      ereignis(um(gestellt, 19, 12), {
        art: "antrag",
        person,
        abwesenheit: "urlaub",
        ...spanne,
        ref,
      }),
      ereignis(um(plusTage(gestellt, 1), 8, 5), { art: "freigeben", von: "jonas", ref }),
    ];
  };
  const krank = `krank-max-${tage.maxKrank.von}`;
  return [
    ...antrag("sandra", tage.sandraUrlaub, 21),
    ...antrag("anna", tage.annaUrlaub, 14),
    ereignis(um(tage.maxKrank.von, 6, 32), {
      art: "krank",
      person: "max",
      abwesenheit: "krank",
      bis: tage.maxKrank.bis,
      kind: null,
      ref: krank,
    }),
    // the fourth day: the eAU is due (§ 5 Abs. 1 EntgFG) and the owner marks it as retrieved
    ereignis(um(tage.maxKrank.bis, 10, 0), { art: "bescheinigung", von: "jonas", ref: krank }),
  ];
};

/**
 * The plan of the coming week, published this morning: Wednesday, 7:00 to 17:00 with an hour's
 * break, is 9 hours of work for Leon, over the 8.5 hours of § 8 Abs. 2a JArbSchG (R-15)
 */
const naechsteWoche = (zr: Zeitraum): Ereignis => {
  const montag = plusTage(wochenbeginn(zr.heute), 7);
  const schicht = (
    person: string,
    n: number,
    beginn: number,
    ende: number,
    pause: number,
  ): PlanSchicht => ({
    person,
    tag: plusTage(montag, n),
    beginnMinute: beginn,
    endeMinute: ende,
    pauseMinuten: pause,
    rolle: "Montage",
  });
  const schichten = [0, 1, 2, 3, 4].flatMap((n) => [
    schicht("sandra", n, 7 * 60, 15 * 60 + 15, 30),
    schicht("max", n, 7 * 60, 15 * 60 + 15, 30),
    ...(n === 4 ? [] : [schicht("leon", n, 7 * 60, n === 2 ? 17 * 60 : 15 * 60 + 30, 60)]),
  ]);
  return ereignis(um(zr.heute, 9, 0), { art: "planen", von: "anna", woche: montag, schichten });
};

export const weberEreignisse = (zr: Zeitraum, z: Zufall): Ereignis[] => {
  const tage = weberTage(zr);
  const plan: Plan = { zr, z, tage };
  const personen = ["anna", "sandra", "max", "leon"];
  return [
    ...abwesenheiten(tage),
    ...tageDes(zr).flatMap((tag) => personen.flatMap((person) => tagDer(plan, person, tag))),
    ereignis(um(tage.nachweisBis, 17, 0), {
      art: "nachweis",
      von: "jonas",
      projekt: "elbhof",
      vonTag: `${zr.volleMonate[1]}-01`,
      bisTag: letzterTag(zr.volleMonate[1] as Monat),
      unterzeichner: "Erika Elbhof",
    }),
    naechsteWoche(zr),
  ];
};
