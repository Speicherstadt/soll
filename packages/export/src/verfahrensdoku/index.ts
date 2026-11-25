/* The Verfahrensdokumentation (S-902): model, generator, Markdown and PDF */

export {
  ANGABE_NAMEN,
  ANGABEN_FELDER,
  type AngabeName,
  type Angaben,
  EIGENE_ABSCHNITTE,
  type EigenerAbschnitt,
  LEERE_ANGABEN,
} from "./angaben.ts";
export { tagInDeutschland, verfahrensdokuAus } from "./dokument.ts";
export { alsMarkdown, markdownText } from "./markdown.ts";
export type { Verfahrensdoku, VerfahrensdokuAbschnitt, VerfahrensdokuStand } from "./modell.ts";
export { verfahrensdokuPdf } from "./pdf.ts";
export { RECHTE_TEXTE, ROLLEN_NAMEN } from "./rechte.ts";
export type { DokuRolle, DokuStandDaten, DokuTerminal, Module } from "./typen.ts";
