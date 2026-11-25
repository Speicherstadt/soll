import type { Tag } from "@soll/arbeitszeit";

/*
 * Who hears what about the plan (S-503), as pure functions: a published week tells each person with
 * a shift in it once; a change to a published shift tells the person it was for and the person it
 * is for now. A draft tells nobody: it is not yet an instruction (docs/plan.md, "Entwurf und
 * Veröffentlichung").
 */

/** What a message needs of a shift, and what makes a change one */
export type Planstand = {
  schichtId: string;
  standortId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
  nutzerId: string | null;
  veroeffentlichtAm: number | null;
};

/** The shift a message is about: its id names the notification, so each keeps its own */
export type Zeitraum = { schichtId: string; tag: Tag; beginn: number; ende: number };

/** The steps of a swap that tell someone (S-504) */
export type TauschArt =
  | "angeboten"
  | "uebernommen"
  | "freigabe"
  | "freigegeben"
  | "abgelehnt"
  | "zurueckgezogen";

export type Meldung =
  | { art: "veroeffentlicht"; nutzerId: string; standortId: string; tag: Tag; kw: number }
  | { art: "neu" | "geaendert" | "entfaellt" | TauschArt; nutzerId: string; schicht: Zeitraum };

const FELDER = [
  "standortId",
  "tag",
  "beginn",
  "ende",
  "pauseMinuten",
  "rolle",
  "nutzerId",
] as const satisfies readonly (keyof Planstand)[];

/** Whether anything a person sees of a shift differs */
export const unterscheidet = (
  alt: Planstand,
  neu: Omit<Planstand, "schichtId" | "veroeffentlichtAm">,
): boolean => FELDER.some((feld) => alt[feld] !== neu[feld]);

const zeitraum = ({ schichtId, tag, beginn, ende }: Planstand): Zeitraum => ({
  schichtId,
  tag,
  beginn,
  ende,
});

/**
 * The messages of a change to a shift; `neu` null when it was removed. Only a published shift
 * tells anyone, and only when something changed.
 */
export const aenderungsMeldungen = (alt: Planstand, neu: Planstand | null): Meldung[] => {
  if (alt.veroeffentlichtAm === null) return [];
  if (neu === null)
    return alt.nutzerId === null
      ? []
      : [{ art: "entfaellt", nutzerId: alt.nutzerId, schicht: zeitraum(alt) }];
  if (!unterscheidet(alt, neu)) return [];
  if (alt.nutzerId === neu.nutzerId)
    return neu.nutzerId === null
      ? []
      : [{ art: "geaendert", nutzerId: neu.nutzerId, schicht: zeitraum(neu) }];
  return [
    ...(alt.nutzerId === null
      ? []
      : [{ art: "entfaellt" as const, nutzerId: alt.nutzerId, schicht: zeitraum(alt) }]),
    ...(neu.nutzerId === null
      ? []
      : [{ art: "neu" as const, nutzerId: neu.nutzerId, schicht: zeitraum(neu) }]),
  ];
};

/**
 * The messages of a published week: one per person with a newly published shift; an open shift
 * tells nobody. `tag` is the Monday, `kw` the calendar week, `standortId` the site published.
 */
export const veroeffentlichungsMeldungen = (
  schichten: readonly Pick<Planstand, "nutzerId">[],
  woche: { standortId: string; tag: Tag; kw: number },
): Meldung[] =>
  [...new Set(schichten.flatMap(({ nutzerId }) => (nutzerId === null ? [] : [nutzerId])))].map(
    (nutzerId) => ({ art: "veroeffentlicht", nutzerId, ...woche }),
  );
