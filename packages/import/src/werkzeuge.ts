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
  /** a file the owner exports; for some tools also an API with an access for one fetch (S-703) */
  wege: readonly ("datei" | "api")[];
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
    wege: ["datei"],
    felder: SOLL_CSV_FELDER,
    endungen: [".csv"],
    vorlagen: [],
  },
  {
    id: "tabelle",
    name: "Excel/CSV",
    wege: ["datei"],
    felder: TABELLE_FELDER,
    endungen: [".xlsx", ".csv"],
    vorlagen: ["soll-zeiten.xlsx", "soll-zeiten.csv"],
  },
  {
    id: "clockodo",
    name: "Clockodo",
    wege: ["datei", "api"],
    // the reader knows its columns: the CSV backup of entries or the file of a fetch (S-703)
    felder: [],
    endungen: [".csv", ".jsonl"],
    vorlagen: [],
  },
  {
    // only the API: the fetch becomes a file of JSON Lines the reader takes like an upload (S-705)
    id: "kimai",
    name: "Kimai",
    wege: ["api"],
    felder: [],
    endungen: [".jsonl"],
    vorlagen: [],
  },
];
