/*
 * The file a fetch from Clockodo's API becomes (BAULISTE.md S-703): JSON Lines, a head line and one
 * record per line, so every record has a line a finding can name. It holds exactly the fields Soll
 * reads, as the API names them (snake_case; SDK src/lib/mappings.ts maps them to camelCase): no
 * notes, which may hold a diagnosis (Art. 9 DSGVO), no sick note, no e-mail, no rate or revenue.
 * Records are sorted by kind and id, so the same data in Clockodo gives the same file and the same
 * SHA-256, and a second fetch is recognised as the file of the first.
 */

export const ABZUG_FORMAT = "soll-clockodo-api";
export const ABZUG_VERSION = 1;

/** The fields kept per kind; the kinds in the order of the file */
export const ABZUG_FELDER = {
  user: ["id", "name"],
  customer: ["id", "name", "number"],
  project: ["id", "customers_id", "name", "number"],
  service: ["id", "name", "number"],
  entry: ["id", "users_id", "type", "time_since", "time_until", "offset"],
  absence: [
    "id",
    "users_id",
    "date_since",
    "date_until",
    "status",
    "type",
    "count_days",
    "count_hours",
  ],
} as const;
export type AbzugArt = keyof typeof ABZUG_FELDER;
export const ABZUG_ARTEN = Object.keys(ABZUG_FELDER) as AbzugArt[];

export type Abzug = { von: string; bis: string } & Record<AbzugArt, readonly unknown[]>;

type Wert = string | number | boolean | null;
const istWert = (wert: unknown): wert is Wert =>
  wert === null || ["string", "number", "boolean"].includes(typeof wert);

/** A record of the API with only the fields of its kind; anything but a plain value is null */
const auszug = (art: AbzugArt, satz: unknown): Record<string, Wert> | null => {
  if (typeof satz !== "object" || satz === null || Array.isArray(satz)) return null;
  const quelle = satz as Record<string, unknown>;
  const felder: Record<string, Wert> = { kind: art };
  for (const feld of ABZUG_FELDER[art]) {
    const wert = quelle[feld];
    if (wert !== undefined) felder[feld] = istWert(wert) ? wert : null;
  }
  return felder;
};

const nachId = (a: Record<string, Wert>, b: Record<string, Wert>): number =>
  Number(a.id) - Number(b.id) || String(a.id).localeCompare(String(b.id));

/** The text of the file: the head line, then each kind sorted by id, each line ending in LF */
export const abzugText = (abzug: Abzug): string => {
  const kopf = { format: ABZUG_FORMAT, version: ABZUG_VERSION, von: abzug.von, bis: abzug.bis };
  const zeilen = ABZUG_ARTEN.flatMap((art) =>
    abzug[art]
      .map((satz) => auszug(art, satz))
      .filter((satz): satz is Record<string, Wert> => satz !== null)
      .sort(nachId),
  );
  return [kopf, ...zeilen].map((zeile) => `${JSON.stringify(zeile)}\n`).join("");
};
