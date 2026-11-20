import { type RasterZeile, wochenRaster } from "@soll/arbeitszeit";
import { m } from "../paraglide/messages.js";
import type { Schicht, Woche } from "./typen.ts";

export type Planzeile = RasterZeile<Schicht> & { name: string; unter: string };

/**
 * The rows of the week with names: people, then the open shifts. Whoever plans sees every row;
 * everyone else only the rows with a published shift, so no member list reaches them.
 */
export const planzeilen = (woche: Woche, planer: boolean): Planzeile[] => {
  const namen = new Map(woche.personen.map((person) => [person.nutzerId, person.name]));
  return wochenRaster(
    woche.tage,
    woche.personen.map((person) => person.nutzerId),
    woche.schichten,
  )
    .filter((zeile) => planer || zeile.zellen.some((zelle) => zelle.length > 0))
    .map((zeile) => ({
      ...zeile,
      name: zeile.nutzerId === null ? m.plan_offen() : (namen.get(zeile.nutzerId) ?? ""),
      unter: zeile.nutzerId === null ? m.plan_offen_text() : "",
    }));
};
