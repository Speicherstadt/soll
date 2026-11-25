import {
  ANGABE_NAMEN,
  ANGABEN_FELDER,
  type AngabeName,
  alsMarkdown,
  EIGENE_ABSCHNITTE,
  verfahrensdokuPdf,
} from "@soll/export";
import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  angabenLesen,
  angabenSpeichern,
  verfahrensdokuVon,
} from "../modules/verfahrensdoku/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

const feld = (name: AngabeName) => z.string().trim().max(ANGABEN_FELDER[name].max);

/** The business's statements: every field at once, empty for one not given (S-902) */
export const angabenSchema = z
  .object({
    ...(Object.fromEntries(ANGABE_NAMEN.map((name) => [name, feld(name)])) as {
      [N in AngabeName]: ReturnType<typeof feld>;
    }),
    eigene: z
      .array(
        z
          .object({
            titel: z.string().trim().max(EIGENE_ABSCHNITTE.titel),
            text: z.string().trim().max(EIGENE_ABSCHNITTE.text),
          })
          .strict(),
      )
      .max(EIGENE_ABSCHNITTE.anzahl),
  })
  .strict();

export const dateiSchema = z.object({ format: z.enum(["md", "pdf"]) }).strict();

/**
 * The Verfahrensdokumentation below /api/v1/verfahrensdoku (S-902): the document made from the
 * business's state at each call, its download as Markdown or PDF and the statements only the
 * business can make; for the owner only (`verfahrensdoku:verwalten`), not behind a module
 */
export const verfahrensdokuRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  version: string,
) =>
  new Hono<Anfrage>()
    .use(recht("verfahrensdoku:verwalten"))
    .get("/", (c) => {
      const dokument = verfahrensdokuVon(db, c.get("betriebId"), jetzt(), version);
      if (!dokument) return c.json({ fehler: "kein_betrieb" }, 404);
      return c.json({ dokument, angaben: angabenLesen(db, c.get("betriebId")) });
    })
    .get("/datei", async (c) => {
      const eingabe = dateiSchema.safeParse(c.req.query());
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const dokument = verfahrensdokuVon(db, c.get("betriebId"), jetzt(), version);
      if (!dokument) return c.json({ fehler: "kein_betrieb" }, 404);
      const name = `verfahrensdokumentation-${dokument.stand.datum}.${eingabe.data.format}`;
      const anhang = `attachment; filename="${name}"`;
      if (eingabe.data.format === "md")
        return c.body(alsMarkdown(dokument), 200, {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": anhang,
        });
      const pdf = await verfahrensdokuPdf(dokument);
      return c.body(pdf.slice().buffer, 200, {
        "content-type": "application/pdf",
        "content-disposition": anhang,
      });
    })
    .put("/angaben", async (c) => {
      const eingabe = angabenSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      return c.json({ angaben: angabenSpeichern(db, schreibDb, kontext, eingabe.data) });
    });
