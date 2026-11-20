import type { Stempelart, Stempelzustand } from "@soll/arbeitszeit";

export type Aktion = {
  art: Stempelart;
  name: "kommen" | "gehen" | "pause_starten" | "pause_beenden";
};

/**
 * The buttons of Heute for a state (design/mockup/Main.dc.html): the big one is the next step, the
 * second one Gehen while in. Out: Kommen; working: Pause starten and Gehen; on a break: Pause beenden
 * and Gehen. Soll never stamps by itself (CLAUDE.md).
 */
export const aktionenFuer = (zustand: Stempelzustand): { haupt: Aktion; neben: Aktion | null } => {
  const gehen: Aktion = { art: "gehen", name: "gehen" };
  if (zustand === "arbeit")
    return { haupt: { art: "pause_beginn", name: "pause_starten" }, neben: gehen };
  if (zustand === "pause")
    return { haupt: { art: "pause_ende", name: "pause_beenden" }, neben: gehen };
  return { haupt: { art: "kommen", name: "kommen" }, neben: null };
};

/**
 * Minutes of the day from a time typed as 7:30, 07:30 or 0730, as `<input type="time">` gives it, or
 * null if it is none
 */
export const minuteAus = (text: string): number | null => {
  const teile = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
  if (!teile) return null;
  const stunde = Number(teile[1]);
  const minute = Number(teile[2]);
  return stunde < 24 && minute < 60 ? stunde * 60 + minute : null;
};
