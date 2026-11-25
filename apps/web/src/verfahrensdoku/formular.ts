import { type Angaben, FELDER } from "./typen.ts";

/** Field names of an own section in the form: its title and text by the row's key */
export const eigenerName = (teil: "titel" | "text", schluessel: number): string =>
  `eigene-${teil}-${schluessel}`;

/**
 * The statements from the form for PUT /api/v1/verfahrensdoku/angaben: every field, and the own
 * sections in the order of their rows; a row left empty in both parts is dropped
 */
export const angabenAus = (form: FormData, zeilen: readonly number[]): Angaben => {
  const wert = (name: string) => String(form.get(name) ?? "");
  const felder = Object.fromEntries(FELDER.map((name) => [name, wert(name)])) as Record<
    (typeof FELDER)[number],
    string
  >;
  const eigene = zeilen
    .map((schluessel) => ({
      titel: wert(eigenerName("titel", schluessel)),
      text: wert(eigenerName("text", schluessel)),
    }))
    .filter((teil) => teil.titel.trim() !== "" || teil.text.trim() !== "");
  return { ...felder, eigene };
};
