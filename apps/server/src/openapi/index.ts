import { ABWESENHEITEN, KONTEN_OPERATIONEN } from "./abwesenheiten.ts";
import { ALLGEMEIN } from "./allgemein.ts";
import { ARBEITSZEIT } from "./arbeitszeit.ts";
import { AUSLASTUNG, BUCHUNGEN, STUNDENNACHWEISE } from "./buchungen.ts";
import { HABEN } from "./haben.ts";
import { IMPORTE } from "./importe.ts";
import { DIENSTPLAN, PROJEKTZEIT } from "./module.ts";
import { RUFBEREITSCHAFT } from "./rufbereitschaft.ts";
import { KIOSK, TERMINAL } from "./terminal.ts";
import { VERFAHRENSDOKU } from "./verfahrensdoku.ts";

export { type Operation, openapiDokument, openapiPfad } from "./dokument.ts";

/** Every route of /api/v1; openapi.test.ts compares this list with the routes of the app */
export const OPERATIONEN = [
  ...ALLGEMEIN,
  ...IMPORTE,
  ...ARBEITSZEIT,
  ...ABWESENHEITEN,
  ...KONTEN_OPERATIONEN,
  ...DIENSTPLAN,
  ...RUFBEREITSCHAFT,
  ...PROJEKTZEIT,
  ...BUCHUNGEN,
  ...AUSLASTUNG,
  ...STUNDENNACHWEISE,
  ...HABEN,
  ...TERMINAL,
  ...KIOSK,
  ...VERFAHRENSDOKU,
];
