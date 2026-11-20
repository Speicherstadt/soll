import { sichtbareArt } from "@soll/arbeitszeit";
import type { Context } from "hono";
import { darf } from "../auth/rollen.ts";
import type { AbwesenheitZeile, Monatsinhalt } from "../modules/arbeitszeit/index.ts";
import type { Anfrage } from "./kontext.ts";

/** Whether the caller sees the kind of a person's absences: their own, or with the right */
export const siehtGesundheit = (c: Context<Anfrage>, nutzerId: string): boolean =>
  nutzerId === c.get("nutzerId") || darf(c.get("rolle"), "abwesenheiten:gesundheit");

/**
 * An absence as a reader may see it: sickness and a child's sickness only as „abwesend“ without the
 * right (Art. 9 DSGVO), and then without child, certificate and reason, which would tell it
 */
export const sicht = (zeile: AbwesenheitZeile, gesundheitSehen: boolean) => {
  const art = sichtbareArt(zeile.art, gesundheitSehen);
  const verdeckt = art === "abwesend";
  return {
    abwesenheitId: zeile.abwesenheitId,
    nutzerId: zeile.nutzerId,
    art,
    von: zeile.von,
    bis: zeile.bis,
    ersterHalb: zeile.ersterHalb,
    letzterHalb: zeile.letzterHalb,
    status: zeile.status,
    kind: verdeckt ? null : zeile.kind,
    bescheinigung: verdeckt ? null : zeile.bescheinigung,
    grund: verdeckt ? null : zeile.grund,
    entschiedenVon: zeile.entschiedenVon,
    entschiedenAm: zeile.entschiedenAm,
    erstelltAm: zeile.erstelltAm,
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
 * „abwesend“ for it, and the finding R-24 (sickness in leave) is left out, which would tell it
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
