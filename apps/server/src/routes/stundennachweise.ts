import { FLAECHE, istTag, type Tag, tageZwischen, unterschriftPruefen } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  type Auswahl,
  nachweiseLesen,
  nachweisLesen,
  nachweisPdf,
  nachweisUnterschreiben,
  nachweisVorschau,
} from "../modules/projektzeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { antwort, koerper, kontextVon, ungueltig } from "./projektzeit-gemeinsam.ts";
import { buchendePerson } from "./stoppuhr.ts";

/** A report covers a year of working days at most */
const LAENGSTE_SPANNE = 366;

const auswahl = {
  projektId: z.string().min(1),
  von: z.string().refine(istTag),
  bis: z.string().refine(istTag),
  nutzerId: z.string().min(1).optional(),
};

const spanneGilt = (werte: { von: string; bis: string }) => {
  const tage = tageZwischen(werte.von as Tag, werte.bis as Tag);
  return tage >= 0 && tage < LAENGSTE_SPANNE;
};

const vorschauSchema = z.object(auswahl).strict().refine(spanneGilt);

/** Points as whole numbers only: [x, y], nothing more (no time, no pressure) */
const punkt = z.tuple([
  z.number().int().min(0).max(FLAECHE.breite),
  z.number().int().min(0).max(FLAECHE.hoehe),
]);

const unterschriftSchema = z
  .object({
    ...auswahl,
    stand: z.string().regex(/^[0-9a-f]{64}$/),
    bemerkung: z.string().trim().max(2_000).optional(),
    unterzeichner: z.string().trim().min(1).max(100),
    unterschrift: z.array(z.array(punkt)).refine(unterschriftPruefen),
  })
  .strict()
  .refine(spanneGilt);

/** Who sees all reports and makes them for anyone: whoever keeps the orders */
const fuerAlle = (c: Context<Anfrage>) => darf(c.get("rolle"), "projekte:verwalten");

/**
 * The people whose bookings a report holds: whoever keeps the orders chooses one or everyone (null),
 * anyone else only their own
 */
const auswahlVon = (
  db: Db,
  c: Context<Anfrage>,
  werte: { projektId: string; von: string; bis: string; nutzerId?: string | undefined },
) => {
  const { nutzerId, ...rest } = werte;
  if (nutzerId === undefined && fuerAlle(c))
    return { ok: true as const, auswahl: { ...rest, nutzerId: null } };
  const wer = buchendePerson(db, c, nutzerId);
  if (!wer.ok) return wer;
  return { ok: true as const, auswahl: { ...rest, nutzerId: wer.nutzerId } satisfies Auswahl };
};

/** Only one's own reports for someone who keeps no orders */
const sichtbarFuer = (c: Context<Anfrage>) => (fuerAlle(c) ? null : c.get("nutzerId"));

/**
 * The Stundennachweis below /api/v1/projektzeit/stundennachweise (S-605): preview, signature, list,
 * one report and its PDF, for whoever books project time
 */
export const stundennachweisRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("projekte:lesen"))
    .get("/vorschau", (c) => {
      const eingabe = vorschauSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const wahl = auswahlVon(db, c, eingabe.data);
      if (!wahl.ok) return c.json({ fehler: wahl.fehler }, wahl.status);
      const vorschau = nachweisVorschau(db, c.get("betriebId"), wahl.auswahl);
      return vorschau.ok ? c.json(vorschau.wert) : antwort(c, vorschau);
    })
    .post("/", async (c) => {
      const eingabe = unterschriftSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const { stand, bemerkung, unterzeichner, unterschrift, ...werte } = eingabe.data;
      const wahl = auswahlVon(db, c, werte);
      if (!wahl.ok) return c.json({ fehler: wahl.fehler }, wahl.status);
      const ergebnis = nachweisUnterschreiben(db, schreibDb, kontextVon(c, jetzt), wahl.auswahl, {
        stand,
        bemerkung: bemerkung ?? "",
        unterzeichner,
        striche: unterschrift,
      });
      return antwort(c, ergebnis, 201);
    })
    .get("/", (c) => c.json({ nachweise: nachweiseLesen(db, c.get("betriebId"), sichtbarFuer(c)) }))
    .get("/:nachweisId", (c) =>
      antwort(c, nachweisLesen(db, c.get("betriebId"), c.req.param("nachweisId"), sichtbarFuer(c))),
    )
    .get("/:nachweisId/pdf", async (c) => {
      const ergebnis = await nachweisPdf(
        db,
        c.get("betriebId"),
        c.req.param("nachweisId"),
        sichtbarFuer(c),
      );
      if (!ergebnis.ok) return antwort(c, ergebnis);
      return c.body(ergebnis.wert.pdf.slice().buffer, 200, {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="stundennachweis-${ergebnis.wert.nummer}.pdf"`,
      });
    });
