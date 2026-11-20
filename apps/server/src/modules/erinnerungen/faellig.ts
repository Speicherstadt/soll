import {
  aktuellerTag,
  arbeitstage,
  ersterTag,
  LAENGSTE_SCHICHT,
  type Monat,
  monatVon,
  plusMonate,
  plusTage,
  type Stempelung,
  tagesstand,
  tagInBerlin,
  zeitpunktInBerlin,
} from "@soll/arbeitszeit";

/*
 * Which reminders are due (S-307): a pure function of the data and the instant, so the loop in the
 * server only reads, calls this and sends. It never stamps: a shift stays open until the person
 * stamps Gehen (CLAUDE.md, "Never").
 */

export type Art = "ausstempeln" | "pause" | "monat";

/** The times of the business */
export type Regeln = {
  /** minutes a shift is open before "Ausstempeln vergessen" */
  gehenMinuten: number;
  /** minutes before a break is owed under § 4 ArbZG */
  pauseVorlauf: number;
  /** day of the following month from which "Monat bestätigen" comes, at 9:00 in Berlin */
  monatTag: number;
};

/** 10 hours: no working day may be longer (§ 3 ArbZG), so a shift open that long is forgotten or too long */
export const REGELN_VORGABE: Regeln = { gehenMinuten: 600, pauseVorlauf: 15, monatTag: 1 };

/** What a person wants: each kind, and mail when no push arrives */
export type Wuensche = { ausstempeln: boolean; pause: boolean; monat: boolean; mail: boolean };
export const ALLE_WUENSCHE: Wuensche = { ausstempeln: true, pause: true, monat: true, mail: true };

/** Where the person's last month stands */
export type Vormonat = {
  monat: Monat;
  /** the month has stamps of the person */
  aufgezeichnet: boolean;
  /** confirmed, and the confirmation still holds for the records */
  bestaetigt: boolean;
  abgeschlossen: boolean;
};

export type PersonDaten = {
  nutzerId: string;
  wuensche: Wuensche;
  /** the stamps in force of the last days, up to now */
  stempelungen: readonly Stempelung[];
  /** read only when a reminder for the month could be due: it reads the whole month */
  vormonat: () => Vormonat | null;
};

export type Eingabe = {
  jetzt: number;
  regeln: Regeln;
  personen: readonly PersonDaten[];
  /** `schluesselVon` of every reminder already sent */
  erinnert: ReadonlySet<string>;
};

export type Faellig =
  | { nutzerId: string; art: "ausstempeln"; bezug: string; seit: number }
  | { nutzerId: string; art: "pause"; bezug: string; um: number; minuten: number }
  | { nutzerId: string; art: "monat"; bezug: string; monat: Monat };

const MINUTE = 60_000;
/** "Monat bestätigen" comes at 9:00, not at midnight */
const MONAT_UHRZEIT = 9 * 60;

/** The key of a reminder: it goes out once per person, kind and what it is about */
export const schluesselVon = (e: { nutzerId: string; art: Art; bezug: string }): string =>
  JSON.stringify([e.nutzerId, e.art, e.bezug]);

/** The month before the one running in Berlin */
export const vormonatVon = (jetzt: number): Monat => plusMonate(monatVon(tagInBerlin(jetzt)), -1);

/** The shift a stamp can still end: open and younger than 24 hours, as on Heute */
const offeneSchicht = (stempelungen: readonly Stempelung[], jetzt: number) => {
  const tage = arbeitstage(stempelungen, jetzt);
  const letzte = tage.ok ? tage.wert.at(-1)?.schichten.at(-1) : undefined;
  if (letzte?.offen == null || jetzt - letzte.beginn >= LAENGSTE_SCHICHT) return null;
  return letzte;
};

const ausstempeln = (p: PersonDaten, regeln: Regeln, jetzt: number): Faellig[] => {
  const schicht = offeneSchicht(p.stempelungen, jetzt);
  if (!schicht || jetzt - schicht.beginn < regeln.gehenMinuten * MINUTE) return [];
  return [
    {
      nutzerId: p.nutzerId,
      art: "ausstempeln",
      bezug: String(schicht.beginn),
      seit: schicht.beginn,
    },
  ];
};

/**
 * The break `tagesstand` names next while working; the key holds the shift, the breaks taken and
 * the minutes owed, so each step of § 4 ArbZG comes once and a new step after a break again
 */
const pause = (p: PersonDaten, regeln: Regeln, jetzt: number): Faellig[] => {
  const stand = tagesstand(p.stempelungen, jetzt, aktuellerTag(p.stempelungen, jetzt));
  if (!stand.ok || stand.wert.zustand !== "arbeit") return [];
  const { ausblick, seit, pausenMinuten } = stand.wert;
  if (ausblick?.art !== "pause" || ausblick.inMinuten > regeln.pauseVorlauf) return [];
  return [
    {
      nutzerId: p.nutzerId,
      art: "pause",
      bezug: `${seit}:${pausenMinuten}:${ausblick.minuten}`,
      um: ausblick.um,
      minuten: ausblick.minuten,
    },
  ];
};

const monat = (
  p: PersonDaten,
  regeln: Regeln,
  jetzt: number,
  erinnert: ReadonlySet<string>,
): Faellig[] => {
  const gesucht = vormonatVon(jetzt);
  const ab = zeitpunktInBerlin(
    plusTage(ersterTag(plusMonate(gesucht, 1)), regeln.monatTag - 1),
    MONAT_UHRZEIT,
  );
  const e = { nutzerId: p.nutzerId, art: "monat", bezug: gesucht, monat: gesucht } as const;
  if (jetzt < ab || erinnert.has(schluesselVon(e))) return [];
  const v = p.vormonat();
  if (!v || v.monat !== gesucht || !v.aufgezeichnet || v.bestaetigt || v.abgeschlossen) return [];
  return [e];
};

const PRUEFUNGEN: Record<
  Art,
  (p: PersonDaten, regeln: Regeln, jetzt: number, erinnert: ReadonlySet<string>) => Faellig[]
> = {
  ausstempeln,
  pause,
  monat,
};

export const faelligeErinnerungen = ({ jetzt, regeln, personen, erinnert }: Eingabe): Faellig[] =>
  personen.flatMap((p) =>
    (Object.keys(PRUEFUNGEN) as Art[])
      .filter((art) => p.wuensche[art])
      .flatMap((art) => PRUEFUNGEN[art](p, regeln, jetzt, erinnert))
      .filter((e) => !erinnert.has(schluesselVon(e))),
  );
