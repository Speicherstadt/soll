import type { Tag } from "@soll/arbeitszeit";
import type { TeamEintrag } from "./typen.ts";

/*
 * The team calendar as a grid (S-402): a row per person away, a cell per day, each only „abwesend“,
 * whole or half (Art. 9 DSGVO). No count per person (BetrVG § 87 Abs. 1 Nr. 6).
 */

export type Zelle = "ganz" | "halb" | null;
export type Kalenderzeile = { nutzerId: string; name: string; zellen: Zelle[] };

const TAG_MS = 86_400_000;

/** The days from `von` to `bis`, both included; by noon UTC, so no change of the clocks counts */
export const tageVonBis = (von: Tag, bis: Tag): Tag[] => {
  const tage: Tag[] = [];
  for (let ms = Date.parse(`${von}T12:00:00Z`); ms <= Date.parse(`${bis}T12:00:00Z`); ms += TAG_MS)
    tage.push(new Date(ms).toISOString().slice(0, 10));
  return tage;
};

/** The cell of a day in one absence: half on a half first or last day */
const zelleAm = (e: TeamEintrag, tag: Tag): Zelle => {
  if (tag < e.von || tag > e.bis) return null;
  const halb = (tag === e.von && e.ersterHalb) || (tag === e.bis && e.letzterHalb);
  return halb ? "halb" : "ganz";
};

/** A whole day wins over a half one: two halves of one person are still „abwesend“ */
const staerker = (a: Zelle, b: Zelle): Zelle => (a === "ganz" || b === "ganz" ? "ganz" : (a ?? b));

export const kalender = (
  eintraege: readonly TeamEintrag[],
  von: Tag,
  bis: Tag,
): { tage: Tag[]; zeilen: Kalenderzeile[] } => {
  const tage = tageVonBis(von, bis);
  const zeilen = new Map<string, Kalenderzeile>();
  for (const e of eintraege) {
    const zeile = zeilen.get(e.nutzerId) ?? {
      nutzerId: e.nutzerId,
      name: e.name,
      zellen: tage.map(() => null),
    };
    zeile.zellen = zeile.zellen.map((zelle, i) => staerker(zelle, zelleAm(e, tage[i] as Tag)));
    zeilen.set(e.nutzerId, zeile);
  }
  return {
    tage,
    zeilen: [...zeilen.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
};
