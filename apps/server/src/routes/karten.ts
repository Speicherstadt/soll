import { Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { mitgliedschaftVon, namenVon } from "../modules/mitglieder/index.ts";
import {
  type KartenEingabe,
  karteEintragen,
  karteEntziehen,
  kartenVon,
  type TerminalSchluessel,
  uidNormalisieren,
} from "../modules/terminal/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { kontextVon } from "./stempel-antwort.ts";

const uid = z
  .string()
  .max(40)
  .transform((wert, kontext) => {
    const normal = uidNormalisieren(wert);
    if (normal === null) kontext.addIssue({ code: "custom", message: "uid" });
    return normal ?? "";
  });

/** An AES-128 key as 32 hex digits; the factory key of zeros is no key, anyone knows it */
const aesSchluessel = z
  .string()
  .regex(/^[0-9a-fA-F]{32}$/)
  .refine((wert) => !/^0+$/.test(wert))
  .transform((wert) => wert.toUpperCase());

const karteSchema = z.discriminatedUnion("art", [
  z.object({ nutzerId: z.string().min(1), art: z.literal("uid"), uid }).strict(),
  z
    .object({
      nutzerId: z.string().min(1),
      art: z.literal("ntag424"),
      uid,
      meta: aesSchluessel,
      datei: aesSchluessel,
    })
    .strict(),
]);

/**
 * The NFC cards of the terminal (S-802), below /api/v1/terminal/karten behind the module's switch:
 * the owner lists them by name, enters one for a person who stamps (409 `karte_vergeben` for a UID in use)
 * and revokes one
 */
export const kartenRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  schluessel: TerminalSchluessel,
) =>
  new Hono<Anfrage>()
    .use(recht("terminal:verwalten"))
    .get("/", (c) => {
      const liste = kartenVon(db, c.get("betriebId"));
      const namen = namenVon(
        db,
        liste.map((karte) => karte.nutzerId),
      );
      return c.json({
        karten: liste
          .map((karte) => ({ ...karte, name: namen.get(karte.nutzerId) ?? "" }))
          .sort((a, b) => a.name.localeCompare(b.name, "de")),
      });
    })
    .post("/", async (c) => {
      const eingabe = karteSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const mitglied = mitgliedschaftVon(db, c.get("betriebId"), eingabe.data.nutzerId);
      if (!mitglied || !darf(mitglied.rolle, "stempeln"))
        return c.json({ fehler: "unbekannt" }, 404);
      const ergebnis = karteEintragen(
        db,
        schreibDb,
        kontextVon(c, jetzt),
        schluessel,
        eingabe.data as KartenEingabe,
      );
      if (!ergebnis.ok) return c.json({ fehler: "karte_vergeben" }, 409);
      return c.json({ karteId: ergebnis.karteId }, 201);
    })
    .delete("/:karteId", (c) =>
      karteEntziehen(db, schreibDb, kontextVon(c, jetzt), c.req.param("karteId"))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    );
