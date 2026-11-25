import { istTag, plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { abzugText } from "@soll/import";
import { Hono } from "hono";
import { z } from "zod";
import { type ClockodoDeps, clockodoAbrufen, MAX_BYTES } from "../modules/umzug/index.ts";
import type { Anfrage } from "./kontext.ts";
import { koerper, ungueltig } from "./projektzeit-gemeinsam.ts";

/*
 * The fetch of a tool's data over its API (BAULISTE.md S-703): POST /api/v1/importe/abruf with the
 * access and a period answers with the file the fetch became, which the app then sends to preview,
 * dry run and takeover like any file. The access is used for this one request: it is not stored,
 * not logged and in no answer (docs/plan.md, "API-Zugang eines Werkzeugs").
 */

export const abrufSchema = z
  .object({
    quelle: z.literal("clockodo"),
    zugang: z
      .object({
        // "Soll;<user>" goes to Clockodo as the application, at most 50 characters (SDK api.ts)
        nutzer: z.email().max(45),
        schluessel: z.string().min(1).max(200),
      })
      .strict(),
    von: z.string().refine(istTag),
    bis: z.string().refine(istTag),
  })
  .strict();

/** The longest period of one fetch: a year; a longer one is fetched in parts */
const MAX_TAGE = 366;

const STATUS = {
  zugang_abgelehnt: 422,
  zu_viele_anfragen: 429,
  nicht_erreichbar: 502,
  antwort_ungueltig: 502,
  zu_viele: 422,
} as const;

export const abrufRouten = (clockodo: ClockodoDeps, jetzt: () => number) =>
  new Hono<Anfrage>().post("/", async (c) => {
    const eingabe = abrufSchema.safeParse(await koerper(c));
    if (!eingabe.success) return ungueltig(c);
    const { zugang, von, bis } = eingabe.data;
    if (bis < von || bis > tagInBerlin(jetzt()) || plusTage(von, MAX_TAGE) <= bis)
      return c.json({ fehler: "zeitraum" }, 422);
    const abruf = await clockodoAbrufen(clockodo, zugang, { von, bis });
    if (!abruf.ok) {
      const { ok: _, ...fehler } = abruf;
      const { grund, ...rest } = fehler;
      return c.json({ fehler: grund, ...rest }, STATUS[grund]);
    }
    const bytes = Buffer.from(abzugText(abruf.wert), "utf8");
    if (bytes.length > MAX_BYTES) return c.json({ fehler: "zu_gross" }, 413);
    return c.json({
      datei: { name: `clockodo-${von}-${bis}.jsonl`, inhalt: bytes.toString("base64") },
    });
  });
