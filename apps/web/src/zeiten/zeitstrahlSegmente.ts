import type { Stempelart } from "@soll/arbeitszeit";

export type ZeitstrahlSegment = {
  art: "arbeit" | "pause";
  beginn: number;
  ende: number;
  minuten: number;
};

const MINUTE = 60_000;
/** Same 24-hour bound as LAENGSTE_SCHICHT in @soll/arbeitszeit: an overdue open shift is not extended */
const MAX_SCHICHT_MS = 24 * 60 * MINUTE;

const prioritaet = (art: Stempelart, zustand: "arbeit" | "pause" | null): number => {
  if (zustand === "arbeit")
    return art === "gehen" ? 0 : art === "pause_beginn" ? 1 : art === "kommen" ? 2 : 3;
  if (zustand === "pause")
    return art === "pause_ende" ? 0 : art === "kommen" ? 1 : art === "gehen" ? 2 : 3;
  return art === "kommen" ? 0 : art === "gehen" ? 1 : 2;
};

/**
 * Turns a day's stamps into visual work and break segments for the interactive day timeline on
 * Zeiten. Handles terminal Kommen-during-break, simultaneous stamps independent of input order,
 * and never extends an overdue open shift (>= 24 h) up to `jetzt` (R-01).
 */
export const zeitstrahlSegmente = (
  stempelungen: readonly { art: Stempelart; zeitpunkt: number }[],
  jetzt: number,
): ZeitstrahlSegment[] => {
  const nachZeit = [...stempelungen].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
  const segmente: ZeitstrahlSegment[] = [];
  let offen: { art: "arbeit" | "pause"; beginn: number } | null = null;
  let schichtBeginn: number | null = null;

  const schliessen = (ende: number) => {
    if (offen === null || ende <= offen.beginn) {
      offen = null;
      return;
    }
    segmente.push({
      art: offen.art,
      beginn: offen.beginn,
      ende,
      minuten: Math.max(1, Math.round((ende - offen.beginn) / MINUTE)),
    });
    offen = null;
  };

  let i = 0;
  while (i < nachZeit.length) {
    const zeit = nachZeit[i]?.zeitpunkt;
    const gruppe: { art: Stempelart; zeitpunkt: number }[] = [];
    while (i < nachZeit.length && nachZeit[i]?.zeitpunkt === zeit) {
      const eintrag = nachZeit[i];
      if (eintrag) gruppe.push(eintrag);
      i += 1;
    }
    while (gruppe.length > 0) {
      const zustand = offen?.art ?? null;
      gruppe.sort((a, b) => prioritaet(a.art, zustand) - prioritaet(b.art, zustand));
      const s = gruppe.shift();
      if (!s) break;
      if (s.art === "kommen") {
        if (offen === null) {
          offen = { art: "arbeit", beginn: s.zeitpunkt };
          schichtBeginn = s.zeitpunkt;
        } else if (offen.art === "pause") {
          schliessen(s.zeitpunkt);
          offen = { art: "arbeit", beginn: s.zeitpunkt };
        }
      } else if (s.art === "pause_beginn") {
        if (offen?.art === "arbeit") {
          schliessen(s.zeitpunkt);
          offen = { art: "pause", beginn: s.zeitpunkt };
        }
      } else if (s.art === "pause_ende") {
        if (offen?.art === "pause") {
          schliessen(s.zeitpunkt);
          offen = { art: "arbeit", beginn: s.zeitpunkt };
        }
      } else if (s.art === "gehen") {
        schliessen(s.zeitpunkt);
        schichtBeginn = null;
      }
    }
  }

  if (
    offen !== null &&
    schichtBeginn !== null &&
    jetzt > offen.beginn &&
    jetzt - schichtBeginn < MAX_SCHICHT_MS
  ) {
    schliessen(jetzt);
  }
  return segmente;
};
