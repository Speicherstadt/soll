import { z } from "zod";

/*
 * The OpenAPI 3.1 description of Soll's API (S-607), generated from the Zod schemas the routes check
 * their input with. OpenAPI 3.1 takes JSON Schema 2020-12 as it is (OpenAPI 3.1.0, 4.8.24 "Schema
 * Object"), which is what Zod 4's `z.toJSONSchema` writes, so no library sits in between.
 */

export type Methode = "get" | "post" | "put" | "patch" | "delete";

/** What a route answers with when it succeeds */
export type Antwortart = "json" | "pdf" | "csv" | "text" | "datei";

/** One route as the description shows it; `pfad` is written as in Hono (`:name`) */
export type Operation = {
  methode: Methode;
  pfad: string;
  zusammenfassung: string;
  bereich: string;
  abfrage?: z.ZodObject;
  koerper?: z.ZodType;
  antwort?: Antwortart;
  /** No sign-in: an invitation, the check page of a Prüfwert, this description */
  oeffentlich?: boolean;
};

const MEDIEN: Record<Antwortart, string> = {
  json: "application/json",
  pdf: "application/pdf",
  csv: "text/csv",
  // the original file of an import, as it was uploaded (S-701)
  datei: "application/octet-stream",
  text: "text/plain",
};

/** JSON Schema 2020-12 for what a client sends: the input side of transforms and defaults */
const jsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  return rest;
};

const pfadNamen = (pfad: string): string[] =>
  [...pfad.matchAll(/:([A-Za-z]+)/g)].map((treffer) => treffer[1] as string);

/** `/a/:id` in Hono is `/a/{id}` in OpenAPI */
export const openapiPfad = (pfad: string): string => pfad.replace(/:([A-Za-z]+)/g, "{$1}");

const parameter = (op: Operation) => [
  ...pfadNamen(op.pfad).map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  })),
  ...Object.entries(op.abfrage?.shape ?? {}).map(([name, feld]) => {
    const schema = jsonSchema(feld as z.ZodType);
    return {
      name,
      in: "query",
      required: !(feld as z.ZodType).safeParse(undefined).success,
      schema,
      ...(schema.type === "array" ? { explode: true } : {}),
    };
  }),
];

const FEHLER = {
  "400": "Eingabe ungültig (`ungueltig`)",
  "401": "Nicht angemeldet, Token unbekannt, widerrufen oder abgelaufen",
  "403": "Keine Berechtigung der Rolle, kein Mitglied oder Modul aus (`modul_aus`)",
  "404": "Nicht gefunden in diesem Betrieb",
  "429": "Mehr als 120 Aufrufe in der Minute mit einem Token (`Retry-After`)",
} as const;

const antworten = (op: Operation) => ({
  "2XX": {
    description: "Erfolg",
    content: { [MEDIEN[op.antwort ?? "json"]]: { schema: {} } },
  },
  ...Object.fromEntries(
    Object.keys(FEHLER)
      .filter((status) => !op.oeffentlich || status === "400" || status === "404")
      .map((status) => [status, { $ref: `#/components/responses/F${status}` }]),
  ),
});

const operationId = (op: Operation): string =>
  `${op.methode}${op.pfad
    .replace(/^\/api\/v1/, "")
    .split(/[/:.-]/)
    .filter(Boolean)
    .map((teil) => teil[0]?.toUpperCase() + teil.slice(1))
    .join("")}`;

const operation = (op: Operation) => ({
  operationId: operationId(op),
  summary: op.zusammenfassung,
  tags: [op.bereich],
  ...(op.oeffentlich ? { security: [] } : {}),
  parameters: parameter(op),
  ...(op.koerper
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: jsonSchema(op.koerper) } },
        },
      }
    : {}),
  responses: antworten(op),
});

const komponenten = {
  securitySchemes: {
    token: {
      type: "http",
      scheme: "bearer",
      description: "Persönlicher Zugang aus den Einstellungen (`soll_…`)",
    },
    sitzung: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
  },
  schemas: {
    Fehler: {
      type: "object",
      properties: { fehler: { type: "string" } },
      required: ["fehler"],
    },
  },
  responses: Object.fromEntries(
    Object.entries(FEHLER).map(([status, description]) => [
      `F${status}`,
      {
        description,
        content: { "application/json": { schema: { $ref: "#/components/schemas/Fehler" } } },
      },
    ]),
  ),
};

/** The whole description: one path item per path, the operations of each under their method */
export const openapiDokument = (
  operationen: readonly Operation[],
  angaben: { version: string; url: string },
) => {
  const pfade: Record<string, Record<string, unknown>> = {};
  for (const op of operationen) {
    const pfad = openapiPfad(op.pfad);
    pfade[pfad] = { ...pfade[pfad], [op.methode]: operation(op) };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Soll",
      version: angaben.version,
      description:
        "Zeiterfassung und Dienstplan. Ein Token trägt die Rechte der Rolle seiner Person in seinem Betrieb; eine Route eines abgeschalteten Moduls antwortet 403 `modul_aus`.",
      license: { name: "AGPL-3.0-only", identifier: "AGPL-3.0-only" },
    },
    servers: [{ url: angaben.url }],
    security: [{ token: [] }, { sitzung: [] }],
    paths: pfade,
    components: komponenten,
  };
};
