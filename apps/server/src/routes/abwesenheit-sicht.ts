import { sichtbareArt, type Tag } from "@soll/arbeitszeit";
import type { Context } from "hono";
import { darf } from "../auth/rollen.ts";
import type { AbwesenheitZeile, Monatsinhalt } from "../modules/arbeitszeit/index.ts";
import type { Anfrage } from "./kontext.ts";

/** Whether the caller sees the kind of a person's absences: their own, or with the right */
export const siehtGesundheit = (c: Context<Anfrage>, nutzerId: string): boolean =>
  nutzerId === c.get("nutzerId") || darf(c.get("rolle"), "abwesenheiten:gesundheit");

/**
 * An absence as a reader may see it (docs/plan.md, "Wer krank sieht"): with the right, or one's own,
 * as it is; without it a request still to decide with its kind (it is never a sickness, which needs
 * no approval), every other row as „abwesend“ without what would tell its kind: child, certificate,
 * reason, who decided and when, when it was entered; an open end, which only a sickness has, reads
 * as today, as in the team calendar (Art. 9 DSGVO)
 */
export const sicht = (zeile: AbwesenheitZeile, gesundheitSehen: boolean, heute: Tag) => {
  const verdeckt = !gesundheitSehen && zeile.status !== "beantragt";
  return {
    abwesenheitId: zeile.abwesenheitId,
    nutzerId: zeile.nutzerId,
    art: verdeckt ? ("abwesend" as const) : sichtbareArt(zeile.art, true),
    von: zeile.von,
    bis: verdeckt && zeile.bis === null ? (heute < zeile.von ? zeile.von : heute) : zeile.bis,
    ersterHalb: zeile.ersterHalb,
    letzterHalb: zeile.letzterHalb,
    status: zeile.status,
    kind: verdeckt ? null : zeile.kind,
    bescheinigung: verdeckt ? null : zeile.bescheinigung,
    grund: verdeckt ? null : zeile.grund,
    entschiedenVon: verdeckt ? null : zeile.entschiedenVon,
    entschiedenAm: verdeckt ? null : zeile.entschiedenAm,
    erstelltAm: verdeckt ? null : zeile.erstelltAm,
  };
};

export const STATUS = {
  ungueltig: 422,
  unbekannt: 404,
  keine_berechtigung: 403,
  status: 409,
  ueberschneidung: 409,
  abgeschlossen: 409,
} as const;

/**
 * A month's content as a reader may see it (S-401): without the right to see sickness the days show
 * every absence as „abwesend“, and the finding R-24 (sickness in leave) is left out, which would
 * tell it
 */
export const inhaltSicht = (inhalt: Monatsinhalt, gesundheitSehen: boolean) =>
  gesundheitSehen
    ? inhalt
    : {
        ...inhalt,
        tage: inhalt.tage.map((tag) =>
          tag.abwesenheiten === undefined
            ? tag
            : {
                ...tag,
                abwesenheiten: tag.abwesenheiten.map((a) => ({
                  art: sichtbareArt(a.art, false),
                  ...(a.halb ? { halb: true } : {}),
                })),
              },
        ),
        befunde: inhalt.befunde.filter((befund) => befund.regel !== "R-24"),
      };
