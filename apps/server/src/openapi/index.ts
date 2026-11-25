import { ABWESENHEITEN } from "./abwesenheiten.ts";
import { ALLGEMEIN } from "./allgemein.ts";
import { ARBEITSZEIT } from "./arbeitszeit.ts";
import { AUSLASTUNG, BUCHUNGEN, STUNDENNACHWEISE } from "./buchungen.ts";
import { HABEN } from "./haben.ts";
import { DIENSTPLAN, PROJEKTZEIT } from "./module.ts";
import { KIOSK, TERMINAL } from "./terminal.ts";

export { type Operation, openapiDokument, openapiPfad } from "./dokument.ts";

/** Every route of /api/v1; openapi.test.ts compares this list with the routes of the app */
export const OPERATIONEN = [
  ...ALLGEMEIN,
  ...ARBEITSZEIT,
  ...ABWESENHEITEN,
  ...DIENSTPLAN,
  ...PROJEKTZEIT,
  ...BUCHUNGEN,
  ...AUSLASTUNG,
  ...STUNDENNACHWEISE,
  ...HABEN,
  ...TERMINAL,
  ...KIOSK,
];
