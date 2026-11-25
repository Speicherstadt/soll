import { istTag, plusTage, tagInBerlin } from "@soll/arbeitszeit";
import { abzugText, kimaiAbzugText } from "@soll/import";
import { Hono } from "hono";
import { z } from "zod";
import {
  type ClockodoDeps,
  clockodoAbrufen,
  type KimaiDeps,
  kimaiAbrufen,
  MAX_BYTES,
} from "../modules/umzug/index.ts";
import type { Anfrage } from "./kontext.ts";
import { koerper, ungueltig } from "./projektzeit-gemeinsam.ts";

/*
 * The fetch of a tool's data over its API (BAULISTE.md S-703 Clockodo, S-705 Kimai):
 * POST /api/v1/importe/abruf with the access and a period answers with the file the fetch became,
 * which the app then sends to preview, dry run and takeover like any file. The access is used for
 * this one request: it is not stored, not logged and in no answer (docs/plan.md, "API-Zugang eines
 * Werkzeugs").
 */

const zeitraum = { von: z.string().refine(istTag), bis: z.string().refine(istTag) };

export const abrufSchema = z.discriminatedUnion("quelle", [
  z
    .object({
      quelle: z.literal("clockodo"),
      zugang: z
        .object({
          // "Soll;<user>" goes to Clockodo as the application, at most 50 characters (SDK api.ts)
          nutzer: z.email().max(45),
          schluessel: z.string().min(1).max(200),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
  z
    .object({
      quelle: z.literal("kimai"),
      zugang: z
        .object({
          // the instance the owner names; kimai-adresse.ts decides whether it may be called
          instanz: z.string().trim().min(1).max(300),
          token: z.string().min(1).max(500),
          // only for a Kimai before API tokens (X-AUTH-USER); empty: the token as a bearer
          benutzer: z.string().trim().max(180).nullable().default(null),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
]);

export type AbrufDeps = { clockodo: ClockodoDeps; kimai: KimaiDeps };

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

type Eingabe = z.infer<typeof abrufSchema>;

/** The fetch of the tool chosen, as the text of its file, or why there is none */
const abrufen = async (deps: AbrufDeps, eingabe: Eingabe) => {
  const zeitraum = { von: eingabe.von, bis: eingabe.bis };
  if (eingabe.quelle === "clockodo") {
    const abruf = await clockodoAbrufen(deps.clockodo, eingabe.zugang, zeitraum);
    return abruf.ok ? { ok: true as const, text: abzugText(abruf.wert) } : abruf;
  }
  const zugang = { ...eingabe.zugang, benutzer: eingabe.zugang.benutzer || null };
  const abruf = await kimaiAbrufen(deps.kimai, zugang, zeitraum);
  return abruf.ok ? { ok: true as const, text: kimaiAbzugText(abruf.wert) } : abruf;
};

export const abrufRouten = (deps: AbrufDeps, jetzt: () => number) =>
  new Hono<Anfrage>().post("/", async (c) => {
    const eingabe = abrufSchema.safeParse(await koerper(c));
    if (!eingabe.success) return ungueltig(c);
    const { quelle, von, bis } = eingabe.data;
    if (bis < von || bis > tagInBerlin(jetzt()) || plusTage(von, MAX_TAGE) <= bis)
      return c.json({ fehler: "zeitraum" }, 422);
    const abruf = await abrufen(deps, eingabe.data);
    if (!abruf.ok) {
      const { ok: _, grund, ...rest } = abruf;
      return c.json({ fehler: grund, ...rest }, STATUS[grund]);
    }
    const bytes = Buffer.from(abruf.text, "utf8");
    if (bytes.length > MAX_BYTES) return c.json({ fehler: "zu_gross" }, 413);
    return c.json({
      datei: { name: `${quelle}-${von}-${bis}.jsonl`, inhalt: bytes.toString("base64") },
    });
  });
