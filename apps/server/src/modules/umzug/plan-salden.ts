import type { Tag } from "@soll/arbeitszeit";
import type { ImportSaldo } from "@soll/import";
import type { GespeicherterSaldo, NeuerSaldo, PlanGrund, Stand } from "./plan-typen.ts";

/*
 * The balances on a cut-off date of a file (BAULISTE.md S-708): each record becomes a start balance
 * of the overtime (`startsaldo`) and the leave on the cut-off date (`urlaub_stichtag`) of its
 * person, checked by the same rules as by hand (`Stand.saldoPruefen`). A record an earlier import
 * took over is there already, or reported when it says something else now; it never overwrites.
 * Pure, as the rest of the plan.
 */

/** The parts of a record as start balances, each with its id in the old tool */
export const saldoTeile = (satz: ImportSaldo, nutzerId: string): NeuerSaldo[] => {
  const monat = satz.stichtag.slice(0, 7);
  return [
    ...(satz.ueberstundenMinuten === null
      ? []
      : [
          {
            nutzerId,
            art: "startsaldo" as const,
            monat,
            wert: satz.ueberstundenMinuten,
            externId: `${satz.externalId}/ueberstunden`,
          },
        ]),
    ...(satz.urlaubHalbtage === null
      ? []
      : [
          {
            nutzerId,
            art: "urlaub_stichtag" as const,
            monat,
            wert: satz.urlaubHalbtage,
            externId: `${satz.externalId}/urlaub`,
          },
        ]),
  ];
};

const gleich = (neu: NeuerSaldo, alt: GespeicherterSaldo | undefined): boolean =>
  alt !== undefined && alt.monat === neu.monat && alt.wert === neu.wert;

/**
 * A record found again by its ids: there already when every part says what the rows in Soll say;
 * another person is `zuordnung_abweichend`, another value or month `geaendert_im_alten_tool`; null
 * when no import took any part of it over
 */
export const saldoWieder = (
  satz: ImportSaldo,
  nutzerId: string,
  vorhanden: ReadonlyMap<string, GespeicherterSaldo>,
): "vorhanden" | PlanGrund | null => {
  const teile = saldoTeile(satz, nutzerId);
  const ids = [`${satz.externalId}/ueberstunden`, `${satz.externalId}/urlaub`];
  const alte = ids.flatMap((id) => {
    const alt = vorhanden.get(id);
    return alt === undefined ? [] : [alt];
  });
  if (alte.length === 0) return null;
  if (alte.some((alt) => alt.nutzerId !== nutzerId)) return "zuordnung_abweichend";
  const alleGleich =
    alte.length === teile.length && teile.every((t) => gleich(t, vorhanden.get(t.externId)));
  return alleGleich ? "vorhanden" : "geaendert_im_alten_tool";
};

export type SaldoErgebnis =
  | { art: "neu"; teile: NeuerSaldo[] }
  | { art: "vorhanden" }
  | { art: "abgelehnt"; grund: PlanGrund };

/**
 * What becomes of one record of a member: `geplant` holds the members with a start planned in this
 * file already, as a person has one start of each account
 */
export const saldoPlanen = (
  satz: ImportSaldo,
  nutzerId: string,
  kontext: { stand: Stand; geplant: Set<string>; ab: Tag | null },
): SaldoErgebnis => {
  const { stand, geplant } = kontext;
  const wieder = saldoWieder(satz, nutzerId, stand.vorhanden.salden);
  if (wieder === "vorhanden") return { art: "vorhanden" };
  if (wieder !== null) return { art: "abgelehnt", grund: wieder };
  if (geplant.has(nutzerId)) return { art: "abgelehnt", grund: "saldo_vorhanden" };
  const teile = saldoTeile(satz, nutzerId);
  for (const teil of teile) {
    const grund = stand.saldoPruefen(teil, kontext.ab);
    if (grund !== null) return { art: "abgelehnt", grund };
  }
  geplant.add(nutzerId);
  return { art: "neu", teile };
};
