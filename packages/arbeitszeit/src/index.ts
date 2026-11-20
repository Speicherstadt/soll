/**
 * Rules, holidays, target and actual time, accounts and surcharges: pure functions without a database
 * (docs/regeln.md, BAULISTE.md).
 */
export * from "./feiertage/index.ts";
export { jahrVon, plusTage, type Tag, tagAus, wochentag } from "./kalender/tag.ts";
