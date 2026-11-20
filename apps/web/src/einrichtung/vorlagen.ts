/**
 * The templates of working-time models (design/mockup/Einrichtung.dc.html): the owner takes what fits
 * and changes only what differs. A mini-job has no fixed hours here: its hours come from the plan, and
 * its limit is a yearly value that comes with S-104 ("nicht hinterlegt" until then).
 */
export type Vorlage = {
  id: "vollzeit" | "teilzeit" | "minijob";
  wochenMinuten: number;
  /** Monday to Sunday */
  tage: readonly boolean[];
  lohnArt: "monat" | "stunde";
  minijob: boolean;
};

const MO_BIS_FR = [true, true, true, true, true, false, false] as const;
const KEINE = [false, false, false, false, false, false, false] as const;

export const VORLAGEN: readonly Vorlage[] = [
  { id: "vollzeit", wochenMinuten: 40 * 60, tage: MO_BIS_FR, lohnArt: "monat", minijob: false },
  { id: "teilzeit", wochenMinuten: 20 * 60, tage: MO_BIS_FR, lohnArt: "stunde", minijob: false },
  { id: "minijob", wochenMinuten: 0, tage: KEINE, lohnArt: "stunde", minijob: true },
];
