import type { Stempelart } from "@soll/arbeitszeit";

export type ZeitstrahlSegment = {
  art: "arbeit" | "pause";
  beginn: number;
  ende: number;
  minuten: number;
};

const MINUTE = 60_000;

/**
 * Turns a day's stamps (in chronological order) into visual work and break segments for the
 * interactive day timeline on Zeiten. An open work or break stretch ends at `jetzt` if later.
 */
export const zeitstrahlSegmente = (
  stempelungen: readonly { art: Stempelart; zeitpunkt: number }[],
  jetzt: number,
): ZeitstrahlSegment[] => {
  const sortiert = [...stempelungen].sort((a, b) => a.zeitpunkt - b.zeitpunkt);
  const segmente: ZeitstrahlSegment[] = [];
  let offen: { art: "arbeit" | "pause"; beginn: number } | null = null;

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

  for (const s of sortiert) {
    if (s.art === "kommen") {
      if (offen === null) offen = { art: "arbeit", beginn: s.zeitpunkt };
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
    }
  }
  if (offen !== null && jetzt > offen.beginn) schliessen(jetzt);
  return segmente;
};
