import { monatVon, type Tag, tagInBerlin } from "@soll/arbeitszeit";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { abgeschlosseneMonate } from "./abschluss.ts";

export type GegeneintragErgebnis =
  | { ok: true; korrekturId: string }
  | { ok: false; grund: "offen" | "abgeschlossen" };

/**
 * A counter-entry to a day of a closed month (S-306): whole minutes with a sign and a reason, counted
 * in the month it is entered in. The closed rows and the Prüfwert stay as they are; a day of an open
 * month is corrected on its stamps instead (`offen`).
 */
export const gegeneintragAnlegen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  angaben: { nutzerId: string; tag: Tag; minuten: number; grund: string },
): GegeneintragErgebnis => {
  const geschlossen = abgeschlosseneMonate(db, kontext.betriebId, angaben.nutzerId);
  if (!geschlossen.has(monatVon(angaben.tag))) return { ok: false, grund: "offen" };
  const gebuchtIn = monatVon(tagInBerlin(kontext.jetzt));
  if (geschlossen.has(gebuchtIn)) return { ok: false, grund: "abgeschlossen" };
  const zeile = schreiben(schreibDb, kontext, (s) =>
    s.einfuegen("korrekturen", {
      betriebId: kontext.betriebId,
      korrekturId: crypto.randomUUID(),
      nutzerId: angaben.nutzerId,
      tag: angaben.tag,
      minuten: angaben.minuten,
      grund: angaben.grund,
      gebuchtIn,
      erstelltVon: kontext.akteur,
      erstelltAm: kontext.jetzt,
    }),
  );
  return { ok: true, korrekturId: zeile.korrekturId };
};
