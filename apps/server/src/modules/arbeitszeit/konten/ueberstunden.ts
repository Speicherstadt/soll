import { type Abschluss, type Ueberstundenkonto, ueberstundenkonto } from "@soll/arbeitszeit";
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

/**
 * Every closed month for checking a change: one without sums or removed counts as closed with
 * nothing, so a start balance after it is refused like after any other
 */
const alleAbschluesse = (db: Db, betriebId: string, nutzerId: string): Abschluss[] => {
  const { abschluesse, ohneSummen } = abschluesseVon(db, betriebId, nutzerId);
  const leer = [...ohneSummen, ...ausgesondertAb(db, betriebId, nutzerId, "0000-01-01")];
  return [...abschluesse, ...leer.map((monat) => ({ monat, sollMinuten: 0, istMinuten: 0 }))];
};

export const ueberstundenVon = (db: Db, betriebId: string, nutzerId: string): UeberstundenStand => {
  const { abschluesse, ohneSummen } = abschluesseVon(db, betriebId, nutzerId);
  if (ohneSummen.length > 0) return { ok: false, grund: "nicht_hinterlegt", monate: ohneSummen };
  const ausgesondert = ausgesondertAb(db, betriebId, nutzerId, "0000-01-01");
  if (ausgesondert.length > 0) return { ok: false, grund: "ausgesondert", monate: ausgesondert };
  const konto = ueberstundenkonto(
    abschluesse,
    stundenAnpassungen(anpassungenVon(db, betriebId, nutzerId)),
  );
  return konto.ok
    ? { ok: true, konto: konto.wert }
    : { ok: false, grund: "nicht_hinterlegt", monate: [] };
};

/** Whether the overtime account stays consistent with one more change (one start, nothing before) */
export const stundenAnpassungPasst = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  neu: AnpassungZeile,
): boolean =>
  ueberstundenkonto(
    alleAbschluesse(db, betriebId, nutzerId),
    stundenAnpassungen([...anpassungenVon(db, betriebId, nutzerId), neu]),
  ).ok;
