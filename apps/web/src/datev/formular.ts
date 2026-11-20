import type { DatevAnsicht } from "./typen.ts";

/** The body of the PUT: empty fields are "nicht hinterlegt" */
export const zuordnungAus = (daten: FormData, ansicht: DatevAnsicht) => {
  const text = (name: string) => String(daten.get(name) ?? "").trim();
  return {
    beraterNr: text("beraterNr") || null,
    mandantenNr: text("mandantenNr") || null,
    lohnarten: Object.fromEntries(
      ansicht.postenarten
        .map((art) => [art, text(`lohnart-${art}`)] as const)
        .filter(([, nummer]) => nummer !== ""),
    ),
    personalnummern: Object.fromEntries(
      ansicht.personen.map((p) => [p.nutzerId, text(`pnr-${p.nutzerId}`) || null]),
    ),
  };
};
