import { m } from "../paraglide/messages.js";
import type { Schichtkopf, TauschAnsicht, TauschStatus } from "./tausch.ts";
import { spanneText, tagLang } from "./text.ts";

/* What the swap says in the language of the app (S-504) */

/** "Montag, 23. November · 14:00–22:00 · Service" */
export const schichtZeile = (schicht: Schichtkopf): string =>
  [tagLang(schicht.tag), spanneText(schicht), schicht.rolle].filter(Boolean).join(" · ");

const STATUS: Record<TauschStatus, () => string> = {
  offen: m.plan_tausch_status_offen,
  uebernommen: m.plan_tausch_status_uebernommen,
  freigegeben: m.plan_tausch_status_freigegeben,
  abgelehnt: m.plan_tausch_status_abgelehnt,
  zurueckgezogen: m.plan_tausch_status_zurueckgezogen,
  hinfaellig: m.plan_tausch_status_hinfaellig,
};

export const statusText = (status: TauschStatus): string => STATUS[status]();

/** The tone of the state's badge; the word says it too (DESIGN.md, "Farben") */
export const statusTon = (status: TauschStatus) =>
  status === "freigegeben"
    ? "success"
    : status === "uebernommen"
      ? "warning"
      : status === "abgelehnt"
        ? "danger"
        : "neutral";

/** "Tom bietet an · an Yusuf · übernommen von Yusuf" */
export const beteiligteText = (tausch: TauschAnsicht): string =>
  [
    m.plan_tausch_von({ name: tausch.anbieter.name }),
    tausch.an && m.plan_tausch_an_person({ name: tausch.an.name }),
    tausch.uebernehmer && m.plan_tausch_uebernommen_von({ name: tausch.uebernehmer.name }),
  ]
    .filter(Boolean)
    .join(" · ");

const FEHLER: Record<string, () => string> = {
  ueberschneidung: m.plan_tausch_fehler_ueberschneidung,
  abgelaufen: m.plan_tausch_fehler_abgelaufen,
  nicht_offen: m.plan_tausch_fehler_entschieden,
  hinfaellig: m.plan_tausch_fehler_entschieden,
  schon_angeboten: m.plan_tausch_fehler_entschieden,
};

/** Why a step was refused, in words; anything else as a failed save */
export const fehlerText = (fehler: string): string => (FEHLER[fehler] ?? m.fehler_speichern)();
