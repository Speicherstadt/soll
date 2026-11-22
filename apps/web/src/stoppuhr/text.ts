import { m } from "../paraglide/messages.js";
import type { Projekt, Taetigkeit } from "../projekte/typen.ts";
import { taetigkeitName } from "../projekte/werte.ts";
import type { Wahl } from "./typen.ts";

/** The order of a booking by its name, or "ohne Auftrag" for internal time */
export const projektText = (projekte: readonly Projekt[], projektId: string | null): string =>
  projektId === null
    ? m.stoppuhr_ohne_auftrag()
    : (projekte.find((projekt) => projekt.projektId === projektId)?.name ?? "");

/** What a booking is on, as one line: order · activity */
export const wahlText = (
  projekte: readonly Projekt[],
  taetigkeiten: readonly Taetigkeit[],
  wahl: Wahl,
): string => {
  const taetigkeit = taetigkeiten.find((t) => t.taetigkeitId === wahl.taetigkeitId);
  return `${projektText(projekte, wahl.projektId)} · ${taetigkeit ? taetigkeitName(taetigkeit) : ""}`;
};

/** Whether a choice can still be booked: its order and activity are there and not archived */
export const buchbar = (
  projekte: readonly Projekt[],
  taetigkeiten: readonly Taetigkeit[],
  wahl: Wahl,
): boolean => {
  const projektOk =
    wahl.projektId === null ||
    projekte.some((p) => p.projektId === wahl.projektId && p.archiviertAm === null);
  return (
    projektOk &&
    taetigkeiten.some((t) => t.taetigkeitId === wahl.taetigkeitId && t.archiviertAm === null)
  );
};

const FEHLER: Record<string, () => string> = {
  ueberschneidung: m.buchung_fehler_ueberschneidung,
  spanne: m.buchung_fehler_spanne,
  abgerechnet: m.buchung_fehler_abgerechnet,
  unterschrieben: m.buchung_fehler_unterschrieben,
  laeuft: m.buchung_fehler_laeuft,
  archiviert: m.fehler_archiviert,
  netz: m.fehler_netz,
};

/** The text of a refusal of a write to a booking */
export const buchungFehler = (fehler: string): string => (FEHLER[fehler] ?? m.fehler_speichern)();
