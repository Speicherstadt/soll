import { istTag, plusTage, type Tag } from "@soll/arbeitszeit";
import { type Pruefexport, pruefexportCsv, pruefexportPdf } from "@soll/export";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/oeffnen.ts";
import { pruefexportPerson } from "../modules/arbeitszeit/index.ts";
import { betriebLesen } from "../modules/betrieb/index.ts";
import { namenVon } from "../modules/mitglieder/index.ts";
import type { Anfrage } from "./kontext.ts";
import { pruefseiteVon } from "./monat.ts";
import { liestEigene, person } from "./zeiten.ts";

/** Two years, as long as the records are kept (§ 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG) */
const LAENGSTENS_TAGE = 731;

const tag = z.string().refine(istTag);
export const abfrageSchema = z
  .object({
    von: tag,
    bis: tag,
    format: z.enum(["csv", "pdf"]),
    nutzerId: z.array(z.string().min(1).max(100)).max(100).optional(),
  })
  .strict()
  .refine(({ von, bis }) => von <= bis && bis < plusTage(von, LAENGSTENS_TAGE));

/** The query with `nutzerId` given once or several times */
const abfrageVon = (c: Context<Anfrage>) => {
  const { nutzerId: _, ...rest } = c.req.query();
  const ids = c.req.queries("nutzerId");
  return abfrageSchema.safeParse(ids ? { ...rest, nutzerId: ids } : rest);
};

type Wer = { ok: true; ids: string[] } | { ok: false; status: 403 | 404; fehler: string };

/** The people of the export: oneself, or anyone whose times the caller may see (`zeiten:alle`) */
const personenVon = (db: Db, c: Context<Anfrage>, ids: readonly string[] | undefined): Wer => {
  const gewuenscht = [...new Set(ids ?? [c.get("nutzerId")])];
  const geprueft: string[] = [];
  for (const id of gewuenscht) {
    const wer = person(db, c, id, "zeiten:alle");
    if (!wer.ok) return wer;
    if (wer.nutzerId === c.get("nutzerId") && !liestEigene(db, c))
      return { ok: false, status: 403, fehler: "keine_berechtigung" };
    geprueft.push(wer.nutzerId);
  }
  return { ok: true, ids: geprueft };
};

const dateiname = (von: Tag, bis: Tag, endung: string) => `pruefexport-${von}-${bis}.${endung}`;

/**
 * The Prüfexport below /api/v1/arbeitszeit/pruefexport (S-309): the working days of people in a
 * period as CSV or PDF for customs and labour inspection, refused while working time is off
 */
export const pruefexportRouten = (db: Db, jetzt: () => number, optionen: { url: string }) =>
  new Hono<Anfrage>().get("/", async (c) => {
    const eingabe = abfrageVon(c);
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const { von, bis, format } = eingabe.data;
    const wer = personenVon(db, c, eingabe.data.nutzerId);
    if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
    const betriebId = c.get("betriebId");
    const namen = new Map<string, string>();
    const name = (id: string) => {
      if (!namen.has(id)) namen.set(id, namenVon(db, [id]).get(id) ?? "");
      return namen.get(id) ?? "";
    };
    const daten: Pruefexport = {
      betrieb: betriebLesen(db, betriebId)?.name ?? "",
      von,
      bis,
      erstelltAm: jetzt(),
      pruefseite: pruefseiteVon(optionen.url, betriebId),
      personen: wer.ids.map((id) =>
        pruefexportPerson(db, betriebId, id, { von, bis, jetzt: jetzt(), name, person: name(id) }),
      ),
    };
    if (format === "csv")
      return c.body(pruefexportCsv(daten), 200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${dateiname(von, bis, "csv")}"`,
      });
    const pdf = await pruefexportPdf(daten);
    return c.body(pdf.slice().buffer, 200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${dateiname(von, bis, "pdf")}"`,
    });
  });
