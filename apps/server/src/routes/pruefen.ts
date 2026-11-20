import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/oeffnen.ts";
import { pruefwertEinesMonats } from "../modules/arbeitszeit/index.ts";
import { betriebLesen } from "../modules/betrieb/index.ts";
import { namenVon } from "../modules/mitglieder/index.ts";

export const pruefSchema = z
  .object({ betriebId: z.string().min(1).max(100), pruefwert: z.string().min(1).max(500) })
  .strict();

/**
 * The check page's API, without sign-in (S-306, docs/plan.md "Prüfseite"): a person, also one who
 * left, or an inspector holding the time sheet checks its Prüfwert against the business's database.
 * Month, name and changed days are shown only for a Prüfwert whose link still matches: holding it
 * proves one was given the sheet. Not behind the module switch: a business must not hide its
 * closed months by switching working time off.
 */
export const pruefRouten = (db: Db) =>
  new Hono().post("/", async (c) => {
    const eingabe = pruefSchema.safeParse(await c.req.json().catch(() => null));
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const betrieb = betriebLesen(db, eingabe.data.betriebId);
    if (!betrieb) return c.json({ ergebnis: "unbekannt" });
    const pruefung = pruefwertEinesMonats(db, betrieb.betriebId, eingabe.data.pruefwert);
    if (!("nutzerId" in pruefung)) return c.json({ ...pruefung, betrieb: betrieb.name });
    const { nutzerId, ...rest } = pruefung;
    return c.json({
      ...rest,
      betrieb: betrieb.name,
      name: namenVon(db, [nutzerId]).get(nutzerId) ?? "",
    });
  });
