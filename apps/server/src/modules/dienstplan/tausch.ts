import type { schichttausche } from "../../db/schema.ts";
import type { Meldung, Zeitraum } from "./meldungen.ts";

/*
 * The shift swap (S-504) as pure functions: what a swap is now, who sees it, who may take it and who
 * hears of each step. The writes are in tauschen.ts.
 */

export type Tausch = typeof schichttausche.$inferSelect;
export type TauschStatus = Tausch["status"];

/** What a swap needs of its shift */
type Schichtstand = Zeitraum & { nutzerId: string | null; veroeffentlichtAm: number | null };

/** A swap is open while nobody decided it: offered, or taken and waiting for approval */
export const istOffen = (tausch: Pick<Tausch, "status">): boolean =>
  tausch.status === "offen" || tausch.status === "uebernommen";

/** An offer expires when its shift begins; nothing is written for it, it is read */
export const abgelaufen = (schicht: { beginn: number }, jetzt: number): boolean =>
  jetzt >= schicht.beginn;

/**
 * Whether the shift is still the one offered: published and planned for whoever offered it. A planner
 * who changes or removes it ends the offer (`hinfaellig`, schichten.ts); this guards the rest.
 */
export const nochAngeboten = (tausch: Tausch, schicht: Schichtstand | undefined): boolean =>
  schicht !== undefined &&
  schicht.veroeffentlichtAm !== null &&
  schicht.nutzerId === tausch.anbieterId;

/** Whether a person is a party of the swap: who offered it or who took it */
export const beteiligt = (tausch: Tausch, nutzerId: string): boolean =>
  tausch.anbieterId === nutzerId || tausch.uebernehmerId === nutzerId;

/**
 * Whether an open offer is meant for a person: the one named, or, offered to everyone, each who can
 * take it; never who offered it
 */
export const gemeint = (tausch: Tausch, nutzerId: string, kannUebernehmen: boolean): boolean =>
  tausch.anbieterId !== nutzerId &&
  kannUebernehmen &&
  (tausch.anNutzerId === null || tausch.anNutzerId === nutzerId);

/**
 * Whether someone who does not plan sees a swap: the parties always, an offer while it is open and
 * meant for them. An offer to a named colleague stays between the two (and whoever plans).
 */
export const sichtbarFuer = (tausch: Tausch, nutzerId: string, kannUebernehmen: boolean): boolean =>
  beteiligt(tausch, nutzerId) ||
  (tausch.status === "offen" && gemeint(tausch, nutzerId, kannUebernehmen));

/** Whether two spans of time overlap; touching ends do not */
export const ueberschneiden = (
  a: { beginn: number; ende: number },
  b: { beginn: number; ende: number },
): boolean => a.beginn < b.ende && b.beginn < a.ende;

const an = (art: Meldung["art"], schicht: Zeitraum, nutzerIds: readonly (string | null)[]) =>
  [...new Set(nutzerIds)].flatMap((nutzerId): Meldung[] =>
    nutzerId === null ? [] : [{ art, nutzerId, schicht } as Meldung],
  );

const zeitraum = ({ schichtId, tag, beginn, ende }: Zeitraum): Zeitraum => ({
  schichtId,
  tag,
  beginn,
  ende,
});

/**
 * Who hears of a step of the swap (S-504): the offer whoever it is meant for, a takeover the one who
 * offered and whoever approves, an approval or refusal both parties, a withdrawal the one who took
 * it. planMelden leaves out whoever acts.
 */
export const tauschMeldungen = (
  schritt: "angeboten" | "uebernommen" | "freigegeben" | "abgelehnt" | "zurueckgezogen",
  tausch: Pick<Tausch, "anbieterId" | "uebernehmerId">,
  schicht: Zeitraum,
  weitere: { gemeint?: readonly string[]; freigebende?: readonly string[] } = {},
): Meldung[] => {
  const ort = zeitraum(schicht);
  switch (schritt) {
    case "angeboten":
      return an("angeboten", ort, weitere.gemeint ?? []);
    case "uebernommen":
      return [
        ...an("uebernommen", ort, [tausch.anbieterId]),
        ...an(
          "freigabe",
          ort,
          (weitere.freigebende ?? []).filter((id) => id !== tausch.anbieterId),
        ),
      ];
    case "freigegeben":
    case "abgelehnt":
      return an(schritt, ort, [tausch.anbieterId, tausch.uebernehmerId]);
    case "zurueckgezogen":
      return an("zurueckgezogen", ort, [tausch.uebernehmerId]);
  }
};
