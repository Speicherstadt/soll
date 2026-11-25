import { istTag, plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { kimaiAbzugText } from "@soll/import";
import { Hono } from "hono";
import { z } from "zod";
import { type KimaiDeps, kimaiAbrufen, MAX_BYTES } from "../modules/umzug/index.ts";
import type { Anfrage } from "./kontext.ts";
import { koerper, ungueltig } from "./projektzeit-gemeinsam.ts";

/*
 * The fetch of a tool's data over its API (BAULISTE.md S-705, as Clockodo's in S-703):
 * POST /api/v1/importe/abruf with the access and a period answers with the file the fetch became,
 * which the app then sends to preview, dry run and takeover like any file. The access is used for
 * this one request: it is not stored, not logged and in no answer (docs/plan.md, "API-Zugang eines
 * Werkzeugs").
 */

export const abrufSchema = z
  .object({
    quelle: z.literal("kimai"),
    zugang: z
      .object({
        instanz: z.string().trim().min(1).max(300),
        token: z.string().min(1).max(500),
        // only for a Kimai before API tokens (X-AUTH-USER); empty: the token as a bearer
        benutzer: z.string().trim().max(180).nullable().default(null),
      })
      .strict(),
    von: z.string().refine(istTag),
    bis: z.string().refine(istTag),
  })
  .strict();

/** The longest period of one fetch: a year; a longer one is fetched in parts */
const MAX_TAGE = 366;

const STATUS = {
  adresse_ungueltig: 422,
  adresse_intern: 422,
  weiterleitung: 502,
  zugang_abgelehnt: 422,
  rechte_fehlen: 422,
  zu_viele_anfragen: 429,
  nicht_erreichbar: 502,
  antwort_ungueltig: 502,
  antwort_zu_gross: 502,
  zu_viele: 422,
} as const;

export const abrufRouten = (kimai: KimaiDeps, jetzt: () => number) =>
  new Hono<Anfrage>().post("/", async (c) => {
    const eingabe = abrufSchema.safeParse(await koerper(c));
    if (!eingabe.success) return ungueltig(c);
    const { zugang, von, bis } = eingabe.data;
    if (bis < von || bis > tagInBerlin(jetzt()) || plusTage(von, MAX_TAGE) <= bis)
      return c.json({ fehler: "zeitraum" }, 422);
    const abruf = await kimaiAbrufen(
      kimai,
      { ...zugang, benutzer: zugang.benutzer || null },
      { von, bis },
    );
    if (!abruf.ok) {
      const { ok: _, grund, ...rest } = abruf;
      return c.json({ fehler: grund, ...rest }, STATUS[grund]);
    }
    const bytes = Buffer.from(kimaiAbzugText(abruf.wert), "utf8");
    if (bytes.length > MAX_BYTES) return c.json({ fehler: "zu_gross" }, 413);
    return c.json({
      datei: { name: `kimai-${von}-${bis}.jsonl`, inhalt: bytes.toString("base64") },
    });
  });
