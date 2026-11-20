import type { Stempelart } from "../arbeitstag/stempelungen.ts";

/**
 * Stamps taken on a device without a network (S-305): what the device signs, where the numbers of a
 * device have gaps, and which instant an entry gets. Shared by the server and the app, so both sides
 * sign and check the same bytes (docs/plan.md, "Offline-Stempeln").
 */

/** An entry of the offline queue as the device signs it */
export type Offlineeintrag = {
  geraetId: string;
  /** running number per device, from 1 */
  nummer: number;
  art: Stempelart;
  /** the device's clock when the person stamped, UTC milliseconds */
  geraetZeitpunkt: number;
};

/** The version of the signed text: a change of its form gets a new one, old entries stay checkable */
const VERSION = "soll/stempel/1";

/**
 * The text a device signs for an entry: a JSON array in a fixed order, so the order of fields in an
 * object never changes it, and JSON quoting keeps one field from running into the next
 */
export const stempelNachricht = (eintrag: Offlineeintrag): string =>
  JSON.stringify([VERSION, eintrag.geraetId, eintrag.nummer, eintrag.art, eintrag.geraetZeitpunkt]);

/** A run of missing numbers, both ends included */
export type Luecke = { von: number; bis: number };

/**
 * The numbers missing from 1 to the highest number received, as ranges: an entry lost on the way (or
 * removed from the device) shows as soon as a later one arrives, and a late entry closes its gap
 */
export const nummernLuecken = (nummern: readonly number[]): Luecke[] => {
  const sortiert = [...new Set(nummern)].sort((a, b) => a - b);
  const luecken: Luecke[] = [];
  let erwartet = 1;
  for (const nummer of sortiert) {
    if (nummer > erwartet) luecken.push({ von: erwartet, bis: nummer - 1 });
    erwartet = Math.max(erwartet, nummer + 1);
  }
  return luecken;
};

/**
 * The instant of an entry sent late: the device's time, moved by how far its clock is off from the
 * server's when it sends (`empfangen − gesendetAm`), so a phone that runs wrong shifts no working time
 * (docs/plan.md, "Zeit einer Live-Stempelung"). The device measures only the time between stamping
 * and sending; an entry stamped after it was sent is refused.
 */
export const offlineZeitpunkt = (angaben: {
  geraetZeitpunkt: number;
  gesendetAm: number;
  empfangen: number;
}): { ok: true; zeitpunkt: number } | { ok: false } => {
  const vorher = angaben.gesendetAm - angaben.geraetZeitpunkt;
  if (vorher < 0 || vorher > angaben.empfangen) return { ok: false };
  return { ok: true, zeitpunkt: angaben.empfangen - vorher };
};
