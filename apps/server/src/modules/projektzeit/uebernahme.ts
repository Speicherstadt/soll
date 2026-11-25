import type { Kontext, Schreiber } from "../audit/index.ts";

/*
 * Customers and orders taken over from another tool (S-701), written by an import in its one
 * transaction with the import, the tool and their id there (`extern_quelle`, `extern_id`, S-601).
 */

export type Herkunft = { importId: string; quelle: string };

export type UebernommenerKunde = {
  kundeId: string;
  name: string;
  nummer: string;
  externId: string;
};
export type UebernommenesProjekt = UebernommenerKunde & { projektId: string };

export const kundenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommenerKunde[],
): void => {
  for (const kunde of neue)
    s.einfuegen("kunden", {
      betriebId: kontext.betriebId,
      kundeId: kunde.kundeId,
      name: kunde.name,
      nummer: kunde.nummer,
      externQuelle: herkunft.quelle,
      externId: kunde.externId,
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
    });
};

export type UebernommeneTaetigkeit = { taetigkeitId: string; name: string; externId: string };

/**
 * Activities from another tool (services in Clockodo, S-703), not billed: whether a service was
 * billed in Clockodo is decided per customer and project there, so the owner sets it here
 */
export const taetigkeitenUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommeneTaetigkeit[],
): void => {
  for (const taetigkeit of neue)
    s.einfuegen("taetigkeiten", {
      betriebId: kontext.betriebId,
      taetigkeitId: taetigkeit.taetigkeitId,
      name: taetigkeit.name,
      abrechenbar: false,
      externQuelle: herkunft.quelle,
      externId: taetigkeit.externId,
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
    });
};

export const projekteUebernehmen = (
  s: Schreiber,
  kontext: Kontext,
  herkunft: Herkunft,
  neue: readonly UebernommenesProjekt[],
): void => {
  for (const projekt of neue)
    s.einfuegen("projekte", {
      betriebId: kontext.betriebId,
      projektId: projekt.projektId,
      kundeId: projekt.kundeId,
      name: projekt.name,
      nummer: projekt.nummer,
      externQuelle: herkunft.quelle,
      externId: projekt.externId,
      angelegtAm: kontext.jetzt,
      importId: herkunft.importId,
    });
};
