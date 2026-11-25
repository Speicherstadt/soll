import { istTag, type Tag, tageZwischen } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  adresseNormalisieren,
  type HabenDeps,
  HOECHSTENS,
  habenKontakte,
  kontaktVerbinden,
  uebergabeListe,
  uebergeben,
  zugangEntfernen,
  zugangLesen,
  zugangSetzen,
} from "../modules/haben/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { antwort, koerper, kontextVon, ungueltig } from "./projektzeit-gemeinsam.ts";

export const zugangSchema = z
  .object({
    adresse: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine((a) => adresseNormalisieren(a) !== null),
    token: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const verbindenSchema = z.object({ kundeId: z.string().min(1).optional() }).strict();

export const uebergabeSchema = z
  .object({ buchungIds: z.array(z.string().min(1)).min(1).max(HOECHSTENS) })
  .strict();

/** The bookings of an order in a span of a year of working days at most, as for a Stundennachweis */
export const listeSchema = z
  .object({
    projektId: z.string().min(1),
    von: z.string().refine(istTag),
    bis: z.string().refine(istTag),
  })
  .strict()
  .refine((w) => {
    const tage = tageZwischen(w.von as Tag, w.bis as Tag);
    return tage >= 0 && tage < 366;
  });

/** Haben failed or refused: 502 with Soll's code and Haben's message; the rest are Soll's own refusals */
const fehlerAntwort = (
  c: Context<Anfrage>,
  f: { grund: string; fehler?: string; meldung?: string },
) => {
  if (f.grund === "haben") return c.json({ fehler: f.fehler, meldung: f.meldung ?? "" }, 502);
  if (f.grund === "haben_fehlt" || f.grund === "schluessel_falsch")
    return c.json({ fehler: f.grund }, 409);
  if (f.grund === "kunde_ohne_haben" || f.grund === "kontakt_unbekannt" || f.grund === "zu_lang")
    return c.json({ fehler: f.grund }, 422);
  return antwort(c, { ok: false, grund: f.grund as "unbekannt" });
};

/**
 * The link to Haben below /api/v1/projektzeit/haben (S-606): the owner keeps address and token;
 * owner and planner link customers with contacts of Haben and hand bookings over as Leistungen
 */
export const habenRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  haben: { schluessel: Uint8Array; holen: typeof fetch },
) => {
  const deps: HabenDeps = { db, schreibDb, schluessel: haben.schluessel, holen: haben.holen };
  return new Hono<Anfrage>()
    .use(recht("projekte:verwalten"))
    .get("/zugang", (c) => c.json({ zugang: zugangLesen(db, c.get("betriebId")) }))
    .put("/zugang", recht("betrieb:einrichten"), async (c) => {
      const eingabe = zugangSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const adresse = adresseNormalisieren(eingabe.data.adresse) as string;
      const gesetzt = zugangSetzen(db, schreibDb, haben.schluessel, kontextVon(c, jetzt), {
        adresse,
        token: eingabe.data.token,
      });
      return gesetzt.ok ? c.json({ zugang: gesetzt.wert }) : c.json({ fehler: gesetzt.grund }, 422);
    })
    .get("/kontakte", async (c) => {
      const gelesen = await habenKontakte(deps, c.get("betriebId"));
      return gelesen.ok ? c.json({ kontakte: gelesen.wert }) : fehlerAntwort(c, gelesen);
    })
    .post("/kontakte/:kontaktId", async (c) => {
      const eingabe = verbindenSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = await kontaktVerbinden(
        deps,
        kontext,
        c.req.param("kontaktId"),
        eingabe.data.kundeId,
      );
      return ergebnis.ok
        ? c.json(ergebnis.wert, eingabe.data.kundeId === undefined ? 201 : 200)
        : fehlerAntwort(c, ergebnis);
    })
    .get("/buchungen", (c) => {
      const eingabe = listeSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const liste = uebergabeListe(db, c.get("betriebId"), eingabe.data);
      return liste.ok ? c.json(liste.wert) : fehlerAntwort(c, liste);
    })
    .post("/uebergabe", async (c) => {
      const eingabe = uebergabeSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const ergebnis = await uebergeben(deps, kontextVon(c, jetzt), eingabe.data.buchungIds);
      return ergebnis.ok ? c.json({ buchungen: ergebnis.wert }) : fehlerAntwort(c, ergebnis);
    })
    .delete("/zugang", recht("betrieb:einrichten"), (c) =>
      zugangEntfernen(db, schreibDb, kontextVon(c, jetzt))
        ? c.body(null, 204)
        : c.json({ fehler: "haben_fehlt" }, 404),
    );
};
