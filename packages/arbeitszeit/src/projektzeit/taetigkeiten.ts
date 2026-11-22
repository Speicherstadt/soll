/**
 * The fixed internal activities every business has (BAULISTE.md S-601): time that belongs to the
 * business itself rather than an order. They are part of Soll, not rows of a business, so they can be
 * neither renamed nor archived nor removed; the app names them in each language.
 */
export const FESTE_TAETIGKEITEN = ["fahrt", "werkstatt", "lager", "schulung"] as const;

export type FesteTaetigkeit = (typeof FESTE_TAETIGKEITEN)[number];

export const istFesteTaetigkeit = (id: string): id is FesteTaetigkeit =>
  (FESTE_TAETIGKEITEN as readonly string[]).includes(id);
