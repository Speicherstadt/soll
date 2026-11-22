import type { BescheinigungsPruefung } from "@soll/arbeitszeit";
import { m } from "../paraglide/messages.js";
import { tagText } from "./text.ts";

/** Where a sickness stands with its certificate, in words with the norm (R-27, § 5 EntgFG) */
export const fristText = (frist: BescheinigungsPruefung): string => {
  const datum = frist.faelligAm === null ? "" : tagText(frist.faelligAm);
  switch (frist.stand) {
    case "nicht_noetig":
      return m.abw_frist_nicht_noetig();
    case "liegt_vor":
      return m.abw_frist_liegt_vor();
    case "spaeter":
      return m.abw_frist_faellig({ datum });
    case "heute":
      return m.abw_frist_heute();
    case "ueberfaellig":
      return m.abw_frist_ueberfaellig({ datum });
  }
};
