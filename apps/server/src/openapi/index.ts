import { ALLGEMEIN } from "./allgemein.ts";
import { ARBEITSZEIT } from "./arbeitszeit.ts";
import { AUSLASTUNG, BUCHUNGEN } from "./buchungen.ts";
import { DIENSTPLAN, PROJEKTZEIT } from "./module.ts";
import { KIOSK, TERMINAL } from "./terminal.ts";

export { type Operation, openapiDokument, openapiPfad } from "./dokument.ts";

/** Every route of /api/v1; openapi.test.ts compares this list with the routes of the app */
export const OPERATIONEN = [
  ...ALLGEMEIN,
  ...ARBEITSZEIT,
  ...DIENSTPLAN,
  ...PROJEKTZEIT,
  ...BUCHUNGEN,
  ...AUSLASTUNG,
  ...TERMINAL,
  ...KIOSK,
];
