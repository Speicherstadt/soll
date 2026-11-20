import { tageText } from "../monat/text.ts";
import { m } from "../paraglide/messages.js";
import type { Fehlend } from "./typen.ts";

/** The name of each item of payroll (packages/export, POSTENARTEN) */
const POSTEN: Record<string, () => string> = {
  stunden: m.datev_posten_stunden,
  minijob: m.datev_posten_minijob,
  feiertag: m.datev_posten_feiertag,
  urlaub: m.datev_posten_urlaub,
  krank: m.datev_posten_krank,
  kind_krank: m.datev_posten_kind_krank,
  sonderurlaub: m.datev_posten_sonderurlaub,
  ueberstunden: m.datev_posten_ueberstunden,
  nacht_steuerfrei: m.datev_posten_nacht_steuerfrei,
  nacht_steuerpflichtig: m.datev_posten_nacht_steuerpflichtig,
  sonntag_steuerfrei: m.datev_posten_sonntag_steuerfrei,
  sonntag_steuerpflichtig: m.datev_posten_sonntag_steuerpflichtig,
  feiertag_steuerfrei: m.datev_posten_feiertag_steuerfrei,
  feiertag_steuerpflichtig: m.datev_posten_feiertag_steuerpflichtig,
};

export const postenText = (art: string): string => POSTEN[art]?.() ?? art;

const FEHLEND: Record<string, (f: { name: string; posten: string; tage: string }) => string> = {
  beraternummer: () => m.datev_fehlend_beraternummer(),
  mandantennummer: () => m.datev_fehlend_mandantennummer(),
  personalnummer: ({ name }) => m.datev_fehlend_personalnummer({ name }),
  lohnart: ({ posten }) => m.datev_fehlend_lohnart({ posten }),
  monat_offen: ({ name }) => m.datev_fehlend_monat_offen({ name }),
  modell: ({ name, tage }) => m.datev_fehlend_modell({ name, tage }),
  lohn: ({ name }) => m.datev_fehlend_lohn({ name }),
  feiertage: ({ name }) => m.datev_fehlend_feiertage({ name }),
  zuschlaege: ({ name, tage }) => m.datev_fehlend_zuschlaege({ name, tage }),
  negativ: ({ name }) => m.datev_fehlend_negativ({ name }),
};

/** One line of what is "nicht hinterlegt", in the language of the app */
export const fehlendText = (f: Fehlend): string =>
  FEHLEND[f.art]?.({
    name: f.name ?? "",
    posten: f.posten ? postenText(f.posten) : "",
    tage: tageText(f.tage ?? []),
  }) ?? f.art;
