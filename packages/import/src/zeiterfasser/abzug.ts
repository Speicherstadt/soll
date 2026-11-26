/*
 * The files a fetch from Toggl Track's API v9 (engineering.toggl.com) or Clockify's API v1
 * (docs.clockify.me) becomes (BAULISTE.md S-707): JSON Lines, one head line and one record per line,
 * holding only the fields Soll reads (no e-mail, no description, no tags, no rates), sorted by kind
 * and id so the same state yields the same file and SHA-256.
 */

export const TOGGL_FORMAT = "soll-toggl-api";
export const CLOCKIFY_FORMAT = "soll-clockify-api";
export const ABZUG_VERSION = 1;

export const TOGGL_FELDER = {
  user: ["id", "fullname"],
  client: ["id", "name"],
  project: ["id", "client_id", "name"],
  task: ["id", "project_id", "name"],
  time_entry: ["id", "user_id", "project_id", "task_id", "start", "stop", "duration"],
} as const;
export type TogglArt = keyof typeof TOGGL_FELDER;
export const TOGGL_ARTEN = Object.keys(TOGGL_FELDER) as TogglArt[];

const CLOCKIFY_BASIS = ["id", "userId", "projectId", "taskId", "type"] as const;

export const CLOCKIFY_FELDER = {
  user: ["id", "name"],
  client: ["id", "name"],
  project: ["id", "clientId", "name"],
  task: ["id", "projectId", "name"],
  time_entry: [...CLOCKIFY_BASIS, "start", "end"],
} as const;
export type ClockifyArt = keyof typeof CLOCKIFY_FELDER;
export const CLOCKIFY_ARTEN = Object.keys(CLOCKIFY_FELDER) as ClockifyArt[];

export type TogglAbzug = { von: string; bis: string } & Record<TogglArt, readonly unknown[]>;
export type ClockifyAbzug = { von: string; bis: string } & Record<ClockifyArt, readonly unknown[]>;

type Wert = string | number | boolean | null;
const istEinfach = (wert: unknown): wert is Wert =>
  wert === null || ["string", "number", "boolean"].includes(typeof wert);

const auszug = (
  art: string,
  felderListe: readonly string[],
  satz: unknown,
): Record<string, Wert> | null => {
  if (typeof satz !== "object" || satz === null || Array.isArray(satz)) return null;
  const quelle = satz as Record<string, unknown>;
  const felder: Record<string, Wert> = { kind: art };
  const intervall =
    typeof quelle.timeInterval === "object" &&
    quelle.timeInterval !== null &&
    !Array.isArray(quelle.timeInterval)
      ? (quelle.timeInterval as Record<string, unknown>)
      : null;
  for (const feld of felderListe) {
    const wert =
      (feld === "start" || feld === "end") && quelle[feld] === undefined && intervall !== null
        ? intervall[feld]
        : quelle[feld];
    if (wert !== undefined) felder[feld] = istEinfach(wert) ? wert : null;
  }
  return felder;
};

const nachId = (a: Record<string, Wert>, b: Record<string, Wert>): number => {
  const num = Number(a.id) - Number(b.id);
  if (Number.isFinite(num) && num !== 0) return num;
  return String(a.id).localeCompare(String(b.id));
};

const abzugText = <A extends string>(
  format: string,
  arten: readonly A[],
  felderVon: Record<A, readonly string[]>,
  abzug: { von: string; bis: string } & Record<A, readonly unknown[]>,
): string => {
  const kopf = { format, version: ABZUG_VERSION, von: abzug.von, bis: abzug.bis };
  const zeilen = arten.flatMap((art) =>
    abzug[art]
      .map((satz) => auszug(art, felderVon[art], satz))
      .filter((satz): satz is Record<string, Wert> => satz !== null)
      .sort(nachId),
  );
  return [kopf, ...zeilen].map((zeile) => `${JSON.stringify(zeile)}\n`).join("");
};

export const togglAbzugText = (abzug: TogglAbzug): string =>
  abzugText(TOGGL_FORMAT, TOGGL_ARTEN, TOGGL_FELDER, abzug);

export const clockifyAbzugText = (abzug: ClockifyAbzug): string =>
  abzugText(CLOCKIFY_FORMAT, CLOCKIFY_ARTEN, CLOCKIFY_FELDER, abzug);
