import { z } from "zod";
import * as dienstplan from "../routes/dienstplan.ts";
import * as monat from "../routes/monat.ts";
import { art } from "../routes/stempel-antwort.ts";
import * as zeiten from "../routes/zeiten.ts";

/*
 * The tools of Soll's MCP server (S-607). Each is one call of the REST API under /api/v1, made with
 * the caller's own token: the same rights of the role, the same module switches, the same business,
 * and nothing the API itself would not answer. Their input is the route's Zod schema, with words
 * for the model where the schema alone says only "string".
 */

export type Aufruf = { methode: "GET" | "POST"; pfad: string; koerper?: unknown };

export type Werkzeug = {
  name: string;
  title: string;
  description: string;
  eingabe: z.ZodObject;
  lesend: boolean;
  aufruf: (eingabe: Record<string, unknown>) => Aufruf;
};

const V1 = "/api/v1";
const leer = z.object({}).strict();
const nutzerId = z
  .string()
  .min(1)
  .max(100)
  .describe(
    "nutzerId einer anderen Person; ohne: die eigene. Nur mit dem Recht, alle Zeiten zu sehen",
  );

/** A GET with the input as query parameters; empty values are left out */
const lesen =
  (pfad: string) =>
  (eingabe: Record<string, unknown>): Aufruf => {
    const frage = new URLSearchParams(
      Object.entries(eingabe).filter((e): e is [string, string] => typeof e[1] === "string"),
    ).toString();
    return { methode: "GET", pfad: frage ? `${V1}${pfad}?${frage}` : `${V1}${pfad}` };
  };

/** Sorted by name: `tools/list` SHOULD be deterministic (MCP 2026-07-28, changelog, minor 3) */
export const WERKZEUGE: readonly Werkzeug[] = [
  {
    name: "auftraege_lesen",
    title: "Aufträge",
    description: "Die Aufträge (Projekte) des Betriebs mit Kunde, Nummer und Budget in Minuten.",
    eingabe: leer,
    lesend: true,
    aufruf: lesen("/projektzeit/projekte"),
  },
  {
    name: "betrieb_lesen",
    title: "Betrieb",
    description:
      "Der Betrieb des Tokens: Name, die eigene Rolle mit ihren Rechten und welche Module eingeschaltet sind.",
    eingabe: leer,
    lesend: true,
    aufruf: lesen("/betrieb"),
  },
  {
    name: "dienstplan_woche",
    title: "Woche im Dienstplan",
    description:
      "Die Schichten einer Woche (Montag bis Sonntag) an einem Standort; Mitarbeiter sehen nur Veröffentlichtes.",
    eingabe: dienstplan.wocheSchema.extend({
      standortId: dienstplan.wocheSchema.shape.standortId.describe("Id aus standorte_lesen"),
      tag: dienstplan.wocheSchema.shape.tag.describe(
        "Ein Tag der Woche als YYYY-MM-DD; ohne: heute",
      ),
    }),
    lesend: true,
    aufruf: lesen("/dienstplan/woche"),
  },
  {
    name: "kunden_lesen",
    title: "Kunden",
    description: "Die Kunden des Betriebs mit Name und Nummer.",
    eingabe: leer,
    lesend: true,
    aufruf: lesen("/projektzeit/kunden"),
  },
  {
    name: "monat_lesen",
    title: "Monat",
    description:
      "Ein Monat einer Person: Tage mit Soll und Ist in Minuten, Konto, Befunde nach dem Arbeitszeitgesetz mit Paragraf, Stand des Abschlusses.",
    eingabe: monat.lesenSchema.extend({
      monat: monat.lesenSchema.shape.monat.describe("Monat als YYYY-MM"),
      nutzerId: nutzerId.optional(),
    }),
    lesend: true,
    aufruf: lesen("/arbeitszeit/monat"),
  },
  {
    name: "standorte_lesen",
    title: "Standorte",
    description: "Die Standorte des Betriebs mit ihrer Id.",
    eingabe: leer,
    lesend: true,
    aufruf: lesen("/standorte"),
  },
  {
    name: "stempeln",
    title: "Stempeln",
    description:
      "Jetzt stempeln, mit der Uhr des Servers: kommen, gehen, pause_beginn oder pause_ende. Die Stempelung trägt die Quelle api und lässt sich nur mit Grund ändern.",
    eingabe: z
      .object({ art: art.describe("kommen, gehen, pause_beginn oder pause_ende") })
      .strict(),
    lesend: false,
    aufruf: (eingabe) => ({
      methode: "POST",
      pfad: `${V1}/arbeitszeit/stempelungen`,
      koerper: eingabe,
    }),
  },
  {
    name: "taetigkeiten_lesen",
    title: "Tätigkeiten",
    description:
      "Die Tätigkeiten des Betriebs, auch die festen internen (Fahrt, Werkstatt, Lager, Schulung).",
    eingabe: leer,
    lesend: true,
    aufruf: lesen("/projektzeit/taetigkeiten"),
  },
  {
    name: "tag_lesen",
    title: "Tag",
    description:
      "Ein Arbeitstag einer Person: Stempelungen, Ist und Pausen in Minuten, Befunde nach dem Arbeitszeitgesetz mit Paragraf, Änderungen mit Grund.",
    eingabe: zeiten.tagSchema.extend({
      datum: zeiten.tagSchema.shape.datum.describe("Tag als YYYY-MM-DD; ohne: heute"),
      nutzerId: nutzerId.optional(),
    }),
    lesend: true,
    aufruf: lesen("/arbeitszeit/tag"),
  },
];

/** A tool as `tools/list` shows it (MCP 2026-07-28, server/tools.mdx, "Tool") */
export const werkzeugBeschreibung = (werkzeug: Werkzeug) => {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(werkzeug.eingabe, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  return {
    name: werkzeug.name,
    title: werkzeug.title,
    description: werkzeug.description,
    inputSchema,
    annotations: {
      readOnlyHint: werkzeug.lesend,
      destructiveHint: false,
      idempotentHint: werkzeug.lesend,
      openWorldHint: false,
    },
  };
};
