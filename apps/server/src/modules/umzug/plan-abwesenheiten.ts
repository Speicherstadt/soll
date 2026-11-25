import {
  type Abwesenheitsart,
  monatVon,
  plusMonate,
  tageUeberschneiden,
  ueberschneidungErlaubt,
} from "@soll/arbeitszeit";
import type { ImportAbwesenheit } from "@soll/import";
import type { NeueAbwesenheit, PlanGrund, Stand, VorhandeneAbwesenheit } from "./plan-typen.ts";

/*
 * An absence of another tool as an approved absence of Soll (BAULISTE.md S-701): it happened or was
 * granted there. Like an entry in Soll it may not overlap another one (only sickness in leave,
 * § 9 BUrlG) and may not change a closed month (S-306).
 */

/** What the plan of absences remembers per person: the absences it took so far */
export type GenommeneAbwesenheiten = Map<string, VorhandeneAbwesenheit[]>;

const kollidiert = (neu: VorhandeneAbwesenheit, alle: readonly VorhandeneAbwesenheit[]): boolean =>
  alle.some((alt) => tageUeberschneiden(alt, neu) && !ueberschneidungErlaubt(alt.art, neu.art));

/** The months from `von` to `bis` */
export const monateZwischen = (von: string, bis: string): string[] => {
  const monate: string[] = [];
  for (let monat = monatVon(von); monat <= monatVon(bis); monat = plusMonate(monat, 1))
    monate.push(monat);
  return monate;
};

export const abwesenheitPlanen = (
  satz: ImportAbwesenheit,
  angaben: { nutzerId: string; art: Abwesenheitsart },
  stand: Stand,
  genommen: GenommeneAbwesenheiten,
): NeueAbwesenheit | PlanGrund => {
  const neu: NeueAbwesenheit = {
    ...angaben,
    von: satz.von,
    bis: satz.bis,
    ersterHalb: satz.ersterHalb === true,
    letzterHalb: satz.letzterHalb === true,
    externId: satz.externalId,
  };
  const bisher = genommen.get(angaben.nutzerId) ?? [];
  if (kollidiert(neu, [...stand.abwesenheitenVon(angaben.nutzerId), ...bisher]))
    return "ueberschneidung";
  const geschlossen = stand.geschlossen(angaben.nutzerId);
  if (
    monateZwischen(neu.von, neu.bis).some((monat) => geschlossen.has(monat)) ||
    stand.abwesenheitGesperrt(angaben.nutzerId, neu)
  )
    return "monat_abgeschlossen";
  genommen.set(angaben.nutzerId, [...bisher, neu]);
  return neu;
};
