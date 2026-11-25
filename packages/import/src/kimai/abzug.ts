/*
 * The file a fetch from Kimai's REST API becomes (BAULISTE.md S-705): JSON Lines, a head line and one
 * record per line, so every record has a line a finding can name (as Clockodo's in S-703). It holds
 * exactly the fields Soll reads, as Kimai's API names them (github.com/kimai/kimai 2.73.0,
 * src/Entity/*.php, serializer groups of the collections): no description of a timesheet, no rates,
 * no tags, no e-mail, no comment. Records are sorted by kind and id, so the same data in Kimai gives
 * the same file and the same SHA-256, and a second fetch is recognised as the file of the first.
 */

export const KIMAI_FORMAT = "soll-kimai-api";
export const KIMAI_VERSION = 1;

/** The fields kept per kind; the kinds in the order of the file */
export const KIMAI_FELDER = {
  user: ["id", "username", "alias"],
  customer: ["id", "name", "number"],
  project: ["id", "customer", "name", "number"],
  activity: ["id", "project", "name", "number"],
  timesheet: ["id", "user", "begin", "end", "break", "project", "activity"],
} as const;
export type KimaiArt = keyof typeof KIMAI_FELDER;
export const KIMAI_ARTEN = Object.keys(KIMAI_FELDER) as KimaiArt[];

/** What a fetch got: the period and the records of each kind as the API answered them */
export type KimaiAbzug = { von: string; bis: string } & Record<KimaiArt, readonly unknown[]>;

type Wert = string | number | boolean | null;
const istWert = (wert: unknown): wert is Wert =>
  wert === null || ["string", "number", "boolean"].includes(typeof wert);

/** A record of the API with only the fields of its kind; anything but a plain value is null */
const auszug = (art: KimaiArt, satz: unknown): Record<string, Wert> | null => {
  if (typeof satz !== "object" || satz === null || Array.isArray(satz)) return null;
  const quelle = satz as Record<string, unknown>;
  const felder: Record<string, Wert> = { kind: art };
  for (const feld of KIMAI_FELDER[art]) {
    const wert = quelle[feld];
    if (wert !== undefined) felder[feld] = istWert(wert) ? wert : null;
  }
  return felder;
};

const nachId = (a: Record<string, Wert>, b: Record<string, Wert>): number =>
  Number(a.id) - Number(b.id) || String(a.id).localeCompare(String(b.id));

/** The text of the file: the head line, then each kind sorted by id, each line ending in LF */
export const kimaiAbzugText = (abzug: KimaiAbzug): string => {
  const kopf = { format: KIMAI_FORMAT, version: KIMAI_VERSION, von: abzug.von, bis: abzug.bis };
  const zeilen = KIMAI_ARTEN.flatMap((art) =>
    abzug[art]
      .map((satz) => auszug(art, satz))
      .filter((satz): satz is Record<string, Wert> => satz !== null)
      .sort(nachId),
  );
  return [kopf, ...zeilen].map((zeile) => `${JSON.stringify(zeile)}\n`).join("");
};
