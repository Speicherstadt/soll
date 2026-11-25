import { SOLL_CSV_FELDER } from "./soll-csv-saetze.ts";
import { TABELLE_FELDER } from "./tabelle-zeile.ts";

/*
 * The tools Soll imports from, without their readers (BAULISTE.md S-701, S-702): what the app
 * shows to choose one, so its bundle carries no reader, no ZIP and no hash. quellen.ts adds the
 * readers for the server.
 */

export type Werkzeug = {
  /** stored as `extern_quelle` at every row taken over: lower case, digits, `.`, `_`, `-` */
  id: string;
  /** the tool's own name, the same in every language */
  name: string;
  weg: "datei";
  /** the fields of the file, for the mapping of columns */
  felder: readonly string[];
  /** the endings of the files it reads, for the file picker */
  endungen: readonly string[];
  /** the templates to download, by file name (served by the server, S-702) */
  vorlagen: readonly string[];
};

export const WERKZEUGE: readonly Werkzeug[] = [
  {
    id: "soll-csv",
    name: "Soll-CSV",
    weg: "datei",
    felder: SOLL_CSV_FELDER,
    endungen: [".csv"],
    vorlagen: [],
  },
  {
    id: "tabelle",
    name: "Excel/CSV",
    weg: "datei",
    felder: TABELLE_FELDER,
    endungen: [".xlsx", ".csv"],
    vorlagen: ["soll-zeiten.xlsx", "soll-zeiten.csv"],
  },
];
