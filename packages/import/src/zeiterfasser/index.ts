import { type Gelesen, leer } from "../modell.ts";
import { textAusBytes } from "../text.ts";
import { type Anbieter, abzugLesen } from "./abzug-lesen.ts";
import { csvLesen } from "./csv.ts";
import { datenAus } from "./eintraege.ts";

/*
 * Toggl Track and Clockify (BAULISTE.md S-707): reads either a Detailed report CSV or the JSONL
 * file of an API fetch into the same flat entries and then into Soll's common model.
 */

export {
  ABZUG_VERSION,
  CLOCKIFY_ARTEN,
  CLOCKIFY_FELDER,
  CLOCKIFY_FORMAT,
  type ClockifyAbzug,
  type ClockifyArt,
  clockifyAbzugText,
  TOGGL_ARTEN,
  TOGGL_FELDER,
  TOGGL_FORMAT,
  type TogglAbzug,
  type TogglArt,
  togglAbzugText,
} from "./abzug.ts";

const lesen = (anbieter: Anbieter, bytes: Uint8Array): Gelesen => {
  const text = textAusBytes(bytes);
  const istJsonl = text.trimStart().startsWith("{");
  if (istJsonl) {
    const abzug = abzugLesen(anbieter, text);
    if (!("eintraege" in abzug))
      return { daten: leer(), fehler: [abzug.fehler], kopf: [], spalten: {} };
    return { ...datenAus(abzug.eintraege, abzug.staemme, abzug.fehler), kopf: [], spalten: {} };
  }
  const csv = csvLesen(anbieter, text);
  if (!("eintraege" in csv)) return { daten: leer(), fehler: [csv.fehler], kopf: [], spalten: {} };
  return { ...datenAus(csv.eintraege, [], csv.fehler), kopf: csv.kopf, spalten: {} };
};

export const togglLesen = (bytes: Uint8Array): Gelesen => lesen("toggl", bytes);
export const clockifyLesen = (bytes: Uint8Array): Gelesen => lesen("clockify", bytes);
