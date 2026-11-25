import type { Monat, Tag } from "@soll/arbeitszeit";

/**
 * What happens in the demo (BAULISTE.md S-909), as data: each event is one thing a person does in
 * the app at an instant. The plan is made by pure functions and only then played through the HTTP
 * API (ablauf.ts), so the same `--heute` gives the same events.
 */
export type Stempelart = "kommen" | "gehen" | "pause_beginn" | "pause_ende";

/** A shift of a weekly plan, at a site of the business; minutes on the wall clock of `tag` */
export type PlanSchicht = {
  person: string;
  tag: Tag;
  beginnMinute: number;
  endeMinute: number;
  pauseMinuten: number;
  rolle: string;
};

export type Handlung =
  /** stamps for oneself: in the browser, or at the café's terminal with the PIN */
  | { art: "stempeln"; person: string; stempel: Stempelart; ref?: string }
  /** adds a stamp of someone else with a reason, as owner or planner */
  | {
      art: "nachtrag";
      von: string;
      person: string;
      stempel: Stempelart;
      zeitpunkt: number;
      grund: string;
    }
  /** changes the time of a stamp made earlier (named by `ref`) with a reason */
  | {
      art: "aendern";
      von: string;
      ref: string;
      stempel: Stempelart;
      zeitpunkt: number;
      grund: string;
    }
  | {
      art: "antrag";
      person: string;
      abwesenheit: "urlaub" | "sonderurlaub";
      von: Tag;
      bis: Tag;
      ref: string;
    }
  | { art: "freigeben"; von: string; ref: string }
  /** a sickness reported on its first day, from that day to `bis` */
  | {
      art: "krank";
      person: string;
      abwesenheit: "krank" | "kind_krank";
      bis: Tag;
      kind: string | null;
      ref: string;
    }
  | { art: "bescheinigung"; von: string; ref: string }
  /** plans the shifts of a week and publishes it */
  | { art: "planen"; von: string; woche: Tag; schichten: readonly PlanSchicht[] }
  | {
      art: "buchen";
      person: string;
      projekt: string | null;
      taetigkeit: string;
      beginn: number;
      ende: number;
      notiz?: string;
    }
  /** the customer signs the report of an order for a span, on the owner's tablet */
  | {
      art: "nachweis";
      von: string;
      projekt: string;
      vonTag: Tag;
      bisTag: Tag;
      unterzeichner: string;
    }
  | { art: "bestaetigen"; person: string; monat: Monat }
  | { art: "abschliessen"; von: string; person: string; monat: Monat };

export type Ereignis = { zeit: number; betrieb: "weber" | "cafe"; handlung: Handlung };

/** In order of time; events at the same instant keep the order they were made in */
export const geordnet = (ereignisse: readonly Ereignis[]): Ereignis[] =>
  ereignisse
    .map((ereignis, i) => ({ ereignis, i }))
    .sort((a, b) => a.ereignis.zeit - b.ereignis.zeit || a.i - b.i)
    .map(({ ereignis }) => ereignis);

/**
 * A small seeded generator (mulberry32), so the minutes a person is early or late are the same on
 * every run with the same `--heute`; not for anything secret
 */
export const zufall = (saat: string) => {
  let zustand = [...saat].reduce(
    (h, z) => Math.imul(h ^ z.charCodeAt(0), 16_777_619),
    2_166_136_261,
  );
  const naechste = () => {
    zustand = (zustand + 0x6d2b79f5) | 0;
    let t = zustand;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  /** a whole number from `min` to `max`, both included (integers only: minutes, never fractions) */
  return (min: number, max: number) => min + (naechste() % (max - min + 1));
};

export type Zufall = ReturnType<typeof zufall>;
