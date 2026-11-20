import { ALLGEMEIN } from "./allgemein.ts";
import { ARBEITSZEIT } from "./arbeitszeit.ts";
import { DIENSTPLAN, PROJEKTZEIT, TERMINAL } from "./module.ts";

export { type Operation, openapiDokument, openapiPfad } from "./dokument.ts";

/** Every route of /api/v1; openapi.test.ts compares this list with the routes of the app */
export const OPERATIONEN = [
  ...ALLGEMEIN,
  ...ARBEITSZEIT,
  ...DIENSTPLAN,
  ...PROJEKTZEIT,
  ...TERMINAL,
];
