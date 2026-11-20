import type { Bedarf, PlanSchicht } from "./typen.ts";
import { schichtZeiten } from "./zeiten.ts";

const minute = (uhrzeit: string): number => {
  const [stunden = 0, minuten = 0] = uhrzeit.split(":").map(Number);
  return stunden * 60 + minuten;
};

let zaehler = 0;

/** A planned shift from day and clock times, "Café Elbblick" at its site "elbe" by default */
export const schicht = (
  tag: string,
  von: string,
  bis: string,
  weiteres: Partial<PlanSchicht> = {},
): PlanSchicht => {
  const zeiten = schichtZeiten(tag, minute(von), minute(bis));
  if (!zeiten) throw new Error(`no times for ${tag} ${von}–${bis}`);
  zaehler += 1;
  return {
    schichtId: `s${zaehler}`,
    standortId: "elbe",
    tag,
    ...zeiten,
    pauseMinuten: 0,
    rolle: "Service",
    nutzerId: "tom",
    ...weiteres,
  };
};

export const bedarf = (
  wochentag: number,
  von: string,
  bis: string,
  anzahl: number,
  weiteres: Partial<Bedarf> = {},
): Bedarf => ({
  bedarfId: `b${wochentag}${von}`,
  standortId: "elbe",
  rolle: "Service",
  wochentag,
  beginnMinute: minute(von),
  endeMinute: minute(bis),
  anzahl,
  ...weiteres,
});
