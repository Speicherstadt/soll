import { ABWESENHEITSARTEN, istMonat, monatVon, tagInBerlin } from "@soll/arbeitszeit";
import {
  MAX_TEXT,
  type Quelle,
  quelleVon,
  TABELLE_VORLAGE_CSV,
  tabelleVorlageXlsx,
} from "@soll/import";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  type ClockodoDeps,
  type Dateispeicher,
  type Eingabe,
  importDatei,
  importeLesen,
  MAX_BYTES,
  probelauf,
  uebernehmen,
  vorschau,
  zuordnungPruefen,
} from "../modules/umzug/index.ts";
import { abrufRouten } from "./importe-abruf.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon, ungueltig } from "./projektzeit-gemeinsam.ts";

/*
 * Imports from other tools below /api/v1/importe (BAULISTE.md S-701): preview, dry run, takeover and
 * the list with the original files, for the owner only. The routes belong to no module; what a
 * switched-off module would hold is refused per record (`modul_aus`).
 */

/** The file as base64 in JSON, as the app sends it; the server reads and keeps its bytes */
const dateiSchema = z
  .object({ name: z.string().trim().min(1).max(200), inhalt: z.base64() })
  .strict();

const schluessel = z.string().max(MAX_TEXT);
const spaltenSchema = z.record(z.string().max(40), z.string().max(200));
const zielSchema = z.union([
  z.literal("neu"),
  z.literal("aus"),
  z.object({ id: z.string().min(1).max(100) }).strict(),
]);

const zielId = z.string().min(1).max(100).nullable();

/** The order and activity of each project and activity of a spreadsheet's times (S-702) */
const buchungSchema = z
  .object({ projekte: z.record(schluessel, zielId), taetigkeiten: z.record(schluessel, zielId) })
  .strict();

export const vorschauSchema = z
  .object({ quelle: z.string().min(1).max(40), datei: dateiSchema, spalten: spaltenSchema })
  .strict();

export const uebernahmeSchema = vorschauSchema
  .extend({
    zuordnung: z
      .object({
        personen: z.record(schluessel, z.string().min(1).max(100).nullable()),
        arten: z.record(schluessel, z.enum(ABWESENHEITSARTEN).nullable()),
        kunden: z.record(schluessel, zielSchema),
        projekte: z.record(schluessel, zielSchema),
        // S-703: activities (Clockodo's services); none in a file without them
        taetigkeiten: z.record(schluessel, zielSchema).default({}),
        buchung: buchungSchema.optional(),
      })
      .strict(),
    abgeschlossenBis: z.string().refine(istMonat).nullable(),
  })
  .strict();

/** The templates of a spreadsheet of times (S-702), by file name: the same bytes on every call */
// a Map, so a name like "constructor" or "__proto__" finds nothing (review S-702)
const VORLAGEN = new Map<string, { typ: string; bytes: () => Uint8Array }>([
  [
    "soll-zeiten.csv",
    { typ: "text/csv; charset=utf-8", bytes: () => new TextEncoder().encode(TABELLE_VORLAGE_CSV) },
  ],
  [
    "soll-zeiten.xlsx",
    {
      typ: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: tabelleVorlageXlsx,
    },
  ],
]);

/** base64 of 5 MiB with the JSON around it */
const MAX_KOERPER = Math.ceil((MAX_BYTES * 4) / 3) + 64 * 1024;

type Gelesen<T> = { ok: true; wert: T } | { ok: false; antwort: Response };

/** The body checked: the tool known, the file not too large */
const eingabeLesen = async <S extends typeof vorschauSchema | typeof uebernahmeSchema>(
  c: Context<Anfrage>,
  schema: S,
): Promise<Gelesen<z.infer<S> & { tool: Quelle; bytes: Uint8Array }>> => {
  const eingabe = schema.safeParse(await koerper(c));
  if (!eingabe.success) return { ok: false, antwort: ungueltig(c) };
  const tool = quelleVon(eingabe.data.quelle);
  if (!tool) return { ok: false, antwort: c.json({ fehler: "quelle_unbekannt" }, 422) };
  // a column is chosen only for a field the tool reads (S-702)
  if (Object.keys(eingabe.data.spalten).some((feld) => !tool.felder.includes(feld)))
    return { ok: false, antwort: c.json({ fehler: "spalte_unbekannt" }, 422) };
  const bytes = new Uint8Array(Buffer.from(eingabe.data.datei.inhalt, "base64"));
  if (bytes.length > MAX_BYTES) return { ok: false, antwort: c.json({ fehler: "zu_gross" }, 413) };
  return {
    ok: true,
    wert: { ...eingabe.data, tool, bytes } as z.infer<S> & { tool: Quelle; bytes: Uint8Array },
  };
};

/** The mapping checked against the business; the last closed month lies before this one */
const uebernahmeLesen = async (
  c: Context<Anfrage>,
  db: Db,
  jetzt: number,
): Promise<Gelesen<Eingabe>> => {
  const gelesen = await eingabeLesen(c, uebernahmeSchema);
  if (!gelesen.ok) return gelesen;
  const { tool, bytes, datei, spalten, zuordnung, abgeschlossenBis } = gelesen.wert;
  if (abgeschlossenBis !== null && abgeschlossenBis >= monatVon(tagInBerlin(jetzt)))
    return { ok: false, antwort: c.json({ fehler: "abgeschlossen_bis" }, 422) };
  const fehler = zuordnungPruefen(db, c.get("betriebId"), zuordnung);
  if (fehler) return { ok: false, antwort: c.json({ fehler }, 422) };
  return {
    ok: true,
    wert: {
      quelle: tool,
      datei: { name: datei.name, bytes },
      spalten,
      zuordnung,
      abgeschlossenBis,
    },
  };
};

export const importRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  speicher: Dateispeicher,
  clockodo: ClockodoDeps,
) =>
  new Hono<Anfrage>()
    .use(recht("umzug:importieren"))
    .use(bodyLimit({ maxSize: MAX_KOERPER, onError: (c) => c.json({ fehler: "zu_gross" }, 413) }))
    .route("/abruf", abrufRouten(clockodo, jetzt))
    .get("/", (c) => c.json({ importe: importeLesen(db, c.get("betriebId")) }))
    .post("/vorschau", async (c) => {
      const gelesen = await eingabeLesen(c, vorschauSchema);
      if (!gelesen.ok) return gelesen.antwort;
      const { tool, bytes, datei, spalten } = gelesen.wert;
      return c.json(
        vorschau(
          db,
          c.get("betriebId"),
          { quelle: tool, datei: { name: datei.name, bytes }, spalten },
          jetzt(),
        ),
      );
    })
    .post("/probelauf", async (c) => {
      const zeit = jetzt();
      const gelesen = await uebernahmeLesen(c, db, zeit);
      return gelesen.ok
        ? c.json(probelauf(db, c.get("betriebId"), gelesen.wert, zeit))
        : gelesen.antwort;
    })
    .post("/", async (c) => {
      const kontext = kontextVon(c, jetzt);
      const gelesen = await uebernahmeLesen(c, db, kontext.jetzt);
      if (!gelesen.ok) return gelesen.antwort;
      const ergebnis = await uebernehmen({ db, schreibDb, speicher }, kontext, gelesen.wert);
      return ergebnis.ok ? c.json(ergebnis.wert, 201) : c.json({ fehler: ergebnis.grund }, 409);
    })
    .get("/vorlagen/:datei", (c) => {
      const name = c.req.param("datei");
      const vorlage = VORLAGEN.get(name);
      if (!vorlage) return c.json({ fehler: "unbekannt" }, 404);
      c.header("content-type", vorlage.typ);
      c.header("content-disposition", `attachment; filename="${name}"`);
      return c.body(vorlage.bytes() as Uint8Array<ArrayBuffer>);
    })
    .get("/:importId/datei", async (c) => {
      const datei = await importDatei(db, speicher, c.get("betriebId"), c.req.param("importId"));
      if (!datei.ok)
        return c.json({ fehler: datei.grund }, datei.grund === "unbekannt" ? 404 : 409);
      c.header("content-type", "application/octet-stream");
      c.header(
        "content-disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(datei.name)}`,
      );
      return c.body(datei.bytes as Uint8Array<ArrayBuffer>);
    });
