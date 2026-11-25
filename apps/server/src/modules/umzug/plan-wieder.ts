import { type Abwesenheitsart, type Monat, monatVon, tagInBerlin } from "@soll/arbeitszeit";
import type { ImportAbwesenheit, ImportZeit } from "@soll/import";
import { monateZwischen } from "./plan-abwesenheiten.ts";
import {
  type GespeicherteAbwesenheit,
  type GespeicherterStempel,
  type PlanGrund,
  STEMPELARTEN,
} from "./plan-typen.ts";
import { stempelAus, stempelKennung } from "./plan-zeiten.ts";

/*
 * A record of the file an earlier import took over already (BAULISTE.md S-701). Soll keeps the row
 * it wrote; the record counts as "there already" only when it still says what that row says, and
 * then its months are those of the row. Taken over for another person, or changed in the old tool
 * since, it is reported with its line and closes no month: a month is closed only for the records
 * Soll holds in it (S-306).
 */

/** There already, with the months of the row in Soll; or why it is reported */
export type Wiederfund = { monate: Monat[] } | { grund: PlanGrund };

/** Whether a span stamps exactly what the rows of its id in Soll hold */
const gleicheStempel = (
  zeit: ImportZeit,
  vorhanden: ReadonlyMap<string, GespeicherterStempel>,
): boolean => {
  const stempel = stempelAus(zeit);
  if (typeof stempel === "string") return false;
  return STEMPELARTEN.every((art) => {
    const neu = stempel.find((s) => s.art === art);
    const alt = vorhanden.get(stempelKennung(zeit.externalId, art));
    return neu === undefined ? alt === undefined : alt?.zeitpunkt === neu.zeitpunkt;
  });
};

/** A span found again by the id of its Kommen, or null when no import took it over */
export const zeitWieder = (
  zeit: ImportZeit,
  nutzerId: string,
  vorhanden: ReadonlyMap<string, GespeicherterStempel>,
): Wiederfund | null => {
  const kommen = vorhanden.get(stempelKennung(zeit.externalId, "kommen"));
  if (kommen === undefined) return null;
  if (kommen.nutzerId !== nutzerId) return { grund: "zuordnung_abweichend" };
  if (!gleicheStempel(zeit, vorhanden)) return { grund: "geaendert_im_alten_tool" };
  // the working day is the day the shift begins (CLAUDE.md, "Time"), the day of the stored Kommen
  return { monate: [monatVon(tagInBerlin(kommen.zeitpunkt))] };
};

/** An absence found again by its id, or null when no import took it over */
export const abwesenheitWieder = (
  satz: ImportAbwesenheit,
  angaben: { nutzerId: string; art: Abwesenheitsart },
  vorhanden: ReadonlyMap<string, GespeicherteAbwesenheit>,
): Wiederfund | null => {
  const alt = vorhanden.get(satz.externalId);
  if (alt === undefined) return null;
  // another person or another kind than the row in Soll: the mapping differs from the first run
  if (alt.nutzerId !== angaben.nutzerId || alt.art !== angaben.art)
    return { grund: "zuordnung_abweichend" };
  if (alt.von !== satz.von || alt.bis !== satz.bis) return { grund: "geaendert_im_alten_tool" };
  return { monate: monateZwischen(alt.von, satz.bis) };
};
