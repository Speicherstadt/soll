import { getTableName } from "drizzle-orm";
import { kettenTabellen, type TabellenName } from "../audit/index.ts";
import type { Auskunft } from "./index.ts";
import { INHABERKOPIE } from "./tabellen.ts";

/*
 * The owner's copy of someone else's Auskunft (S-309): picked part by part from the person's own
 * copy, never the own copy minus a list. A part added to the own copy reaches the owner only once
 * it is named here and its tables are allowed in tabellen.ts (docs/plan.md, "Auskunft").
 */

/** Links of the chain on a table the owner's copy holds; a table the chain does not know stays out */
const freigegeben = (glied: { tabelle: string }): boolean => {
  const kette = kettenTabellen[glied.tabelle as TabellenName];
  return kette !== undefined && INHABERKOPIE[getTableName(kette.tabelle)]?.frei === true;
};

export const kopieFuerInhaber = (eigen: Auskunft) => ({
  art: eigen.art,
  fassung: eigen.fassung,
  erstelltAm: eigen.erstelltAm,
  verantwortlicher: eigen.verantwortlicher,
  person: eigen.person,
  hinweise: eigen.hinweise,
  // of the account only name and address, as the business's members show them
  konto: eigen.konto && { name: eigen.konto.name, email: eigen.konto.email },
  mitgliedschaft: eigen.mitgliedschaft,
  einladungen: eigen.einladungen,
  stempelungen: eigen.stempelungen,
  gegeneintraege: eigen.gegeneintraege,
  monatsabschluesse: eigen.monatsabschluesse,
  arbeitszeitmodelle: eigen.arbeitszeitmodelle,
  schichten: eigen.schichten,
  stundensaetze: eigen.stundensaetze,
  projektzeiten: eigen.projektzeiten,
  personalnummer: eigen.personalnummer,
  ausweis: eigen.ausweis,
  karten: eigen.karten,
  // the owner sees every absence with its kind (abwesenheiten:gesundheit, docs/abwesenheiten.md)
  abwesenheiten: eigen.abwesenheiten,
  // the owner reads and writes what the rules need of a person (personen:angaben, S-502)
  personenangaben: eigen.personenangaben,
  auditKette: {
    zuDeinenDaten: eigen.auditKette.zuDeinenDaten.filter(freigegeben),
    vonDir: eigen.auditKette.vonDir.filter(freigegeben),
  },
});
