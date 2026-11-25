import {
  type Abschluss,
  type Monat,
  type Ueberstundenkonto,
  ueberstundenkonto,
} from "@soll/arbeitszeit";
import type { Db } from "../../../db/oeffnen.ts";
import {
  type AnpassungZeile,
  abschluesseVon,
  anpassungenVon,
  ausgesondertAb,
  stundenAnpassungen,
} from "./lesen.ts";
import type { KontoLuecke } from "./urlaub.ts";

/*
 * The overtime account of a person (S-402, S-208): Ist − Soll of every closed month as it was closed,
 * with the changes by hand. A month closed without sums ("nicht hinterlegt") or removed after its
 * retention period leaves the balance unknown: Soll names the months instead of a wrong number.
 */

export type UeberstundenStand = { ok: true; konto: Ueberstundenkonto } | KontoLuecke;

/** The month of the start balance, where there is one */
const startVon = (anpassungen: readonly AnpassungZeile[]): Monat | undefined =>
  anpassungen.find((a) => a.art === "startsaldo")?.monat ?? undefined;

/**
 * The start balance stands for everything before its month: a month before it closed only later
 * counts not (docs/plan.md, "Anpassungen der Konten"; review S-402), else the account could never
 * be computed again
 */
const abStart = <T extends Monat | Abschluss>(liste: readonly T[], start: Monat | undefined): T[] =>
  liste.filter((e) => start === undefined || (typeof e === "string" ? e : e.monat) >= start);

/**
 * Every closed month from the start balance on, for checking a change: one without sums or removed
 * counts as closed with nothing, so a start balance after it is refused like after any other
 */
const alleAbschluesse = (db: Db, betriebId: string, nutzerId: string, start?: Monat) => {
  const { abschluesse, ohneSummen } = abschluesseVon(db, betriebId, nutzerId);
  const leer = [...ohneSummen, ...ausgesondertAb(db, betriebId, nutzerId, "0000-01-01")];
  return abStart(
    [...abschluesse, ...leer.map((monat) => ({ monat, sollMinuten: 0, istMinuten: 0 }))],
    start,
  );
};

export const ueberstundenVon = (db: Db, betriebId: string, nutzerId: string): UeberstundenStand => {
  const anpassungen = anpassungenVon(db, betriebId, nutzerId);
  const start = startVon(anpassungen);
  const gelesen = abschluesseVon(db, betriebId, nutzerId);
  const ohneSummen = abStart(gelesen.ohneSummen, start);
  if (ohneSummen.length > 0) return { ok: false, grund: "nicht_hinterlegt", monate: ohneSummen };
  const ausgesondert = abStart(ausgesondertAb(db, betriebId, nutzerId, "0000-01-01"), start);
  if (ausgesondert.length > 0) return { ok: false, grund: "ausgesondert", monate: ausgesondert };
  const konto = ueberstundenkonto(
    abStart(gelesen.abschluesse, start),
    stundenAnpassungen(anpassungen),
  );
  return konto.ok
    ? { ok: true, konto: konto.wert }
    : { ok: false, grund: "nicht_hinterlegt", monate: [] };
};

/**
 * Whether the overtime account stays consistent with one more change: one start balance, no closed
 * month before a new one, and nothing else before it
 */
export const stundenAnpassungPasst = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  neu: AnpassungZeile,
): boolean => {
  const bisher = anpassungenVon(db, betriebId, nutzerId);
  return ueberstundenkonto(
    alleAbschluesse(db, betriebId, nutzerId, startVon(bisher)),
    stundenAnpassungen([...bisher, neu]),
  ).ok;
};
