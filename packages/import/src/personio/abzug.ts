/*
 * The file a fetch from Personio's API v2 becomes (BAULISTE.md S-704): JSON Lines, a head line and
 * one flat record per line, so every record has a line a finding can name (as Kimai's, S-705). It
 * holds exactly the fields Soll reads, under the names of Personio's API, a nested field by its path
 * (`person.id`, `start.date_time`, `approval.status`; persons-service-api-v2 for persons, the v2
 * clients PK-Consulting/n8n-nodes-personio-hr and ninjaneers-team/pysonio for the periods): no
 * e-mail, no gender, no picture, no custom attributes, no comment, no project. Records are sorted by
 * kind and id, so the same data in Personio gives the same file and the same SHA-256.
 */

export const PERSONIO_FORMAT = "soll-personio-api";
export const PERSONIO_VERSION = 1;

/** The fields kept per kind, each as the path of its value in Personio's record */
export const PERSONIO_FELDER = {
  person: ["id", "first_name", "last_name", "preferred_name"],
  absence_type: ["id", "name", "unit"],
  attendance: ["id", "person.id", "type", "start.date_time", "end.date_time", "approval.status"],
  absence: [
    "id",
    "person.id",
    "absence_type.id",
    "starts_from.date_time",
    "starts_from.type",
    "ends_at.date_time",
    "ends_at.type",
    "approval.status",
  ],
} as const;
export type PersonioArt = keyof typeof PERSONIO_FELDER;
export const PERSONIO_ARTEN = Object.keys(PERSONIO_FELDER) as PersonioArt[];

/** What a fetch got: the period and the records of each kind as the API answered them */
export type PersonioAbzug = { von: string; bis: string } & Record<PersonioArt, readonly unknown[]>;

type Wert = string | number | boolean | null;
const istWert = (wert: unknown): wert is Wert =>
  wert === null || ["string", "number", "boolean"].includes(typeof wert);

const istObjekt = (wert: unknown): wert is Record<string, unknown> =>
  typeof wert === "object" && wert !== null && !Array.isArray(wert);

/** The value at a path; undefined where the record has none */
const anPfad = (satz: Record<string, unknown>, pfad: string): unknown =>
  pfad.split(".").reduce<unknown>((wert, teil) => (istObjekt(wert) ? wert[teil] : undefined), satz);

/** A record of the API, flat, with only the fields of its kind; anything but a plain value is null */
const auszug = (art: PersonioArt, satz: unknown): Record<string, Wert> | null => {
  if (!istObjekt(satz)) return null;
  const felder: Record<string, Wert> = { kind: art };
  for (const pfad of PERSONIO_FELDER[art]) {
    const wert = anPfad(satz, pfad);
    if (wert !== undefined) felder[pfad] = istWert(wert) ? wert : null;
  }
  return felder;
};

/** Persons have numbers as ids, periods UUIDs: numbers by value, the rest as text */
const nachId = (a: Record<string, Wert>, b: Record<string, Wert>): number => {
  const x = String(a.id);
  const y = String(b.id);
  return /^\d+$/.test(x) && /^\d+$/.test(y) && x.length !== y.length
    ? x.length - y.length
    : x < y
      ? -1
      : x > y
        ? 1
        : 0;
};

/** The text of the file: the head line, then each kind sorted by id, each line ending in LF */
export const personioAbzugText = (abzug: PersonioAbzug): string => {
  const kopf = {
    format: PERSONIO_FORMAT,
    version: PERSONIO_VERSION,
    von: abzug.von,
    bis: abzug.bis,
  };
  const zeilen = PERSONIO_ARTEN.flatMap((art) =>
    abzug[art]
      .map((satz) => auszug(art, satz))
      .filter((satz): satz is Record<string, Wert> => satz !== null)
      .sort(nachId),
  );
  return [kopf, ...zeilen].map((zeile) => `${JSON.stringify(zeile)}\n`).join("");
};
