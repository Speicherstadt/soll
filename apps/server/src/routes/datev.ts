import { istMonat } from "@soll/arbeitszeit";
import { DATEV_FORMAT, type Fehlend, POSTENARTEN } from "@soll/export";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { istBeschaeftigt, rollenVon } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { datevDatei, einstellungenLesen, einstellungenSetzen } from "../modules/datev/index.ts";
import { mitgliederMitNamen, namenVon } from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

/** A number of a given form, or null (or empty) for "nicht hinterlegt" */
const nummer = (format: RegExp) =>
  z
    .string()
    .trim()
    .transform((wert) => (wert === "" ? null : wert))
    .refine((wert) => wert === null || format.test(wert))
    .nullable();

/** A wage type per item; an item left out is "nicht hinterlegt" */
const lohnartenSchema = z.partialRecord(
  z.enum(POSTENARTEN),
  z.string().trim().regex(DATEV_FORMAT.lohnart),
);

const einstellungenSchema = z
  .object({
    beraterNr: nummer(DATEV_FORMAT.beraterNr),
    mandantenNr: nummer(DATEV_FORMAT.mandantenNr),
    lohnarten: lohnartenSchema,
    personalnummern: z.record(z.string().min(1).max(100), nummer(DATEV_FORMAT.personalnummer)),
  })
  .strict();

const exportSchema = z
  .object({ monat: z.string().refine(istMonat), ziel: z.enum(["lodas", "lug"]) })
  .strict();

/** Who may be on the payroll: the owner and who works for the business, no device or external */
const personenVon = (
  db: Db,
  betriebId: string,
  personalnummern: Readonly<Record<string, string>>,
) =>
  mitgliederMitNamen(db, betriebId)
    .filter((m) => istBeschaeftigt(m.rolle) || rollenVon(m.rolle).includes("inhaber"))
    .map((m) => ({
      nutzerId: m.nutzerId,
      name: m.name,
      personalnummer: personalnummern[m.nutzerId] ?? null,
    }));

const ansicht = (db: Db, betriebId: string) => {
  const einstellungen = einstellungenLesen(db, betriebId);
  return {
    beraterNr: einstellungen.beraterNr,
    mandantenNr: einstellungen.mandantenNr,
    lohnarten: einstellungen.lohnarten,
    postenarten: POSTENARTEN,
    personen: personenVon(db, betriebId, einstellungen.personalnummern),
  };
};

/** What is missing, with the names of the persons it concerns, so the app can say who */
const mitNamen = (db: Db, fehlend: readonly Fehlend[]) => {
  const namen = namenVon(
    db,
    fehlend.flatMap((f) => ("nutzerId" in f ? [f.nutzerId] : [])),
  );
  return fehlend.map((f) => ("nutzerId" in f ? { ...f, name: namen.get(f.nutzerId) ?? "" } : f));
};

const kontextVon = (c: Context<Anfrage>, jetzt: () => number) => ({
  betriebId: c.get("betriebId"),
  akteur: c.get("nutzerId"),
  jetzt: jetzt(),
});

/**
 * The DATEV payroll export below /api/v1/arbeitszeit/datev (S-308), refused while working time is
 * off: the mapping and the file of a closed month, for the owner and the payroll office.
 */
export const datevRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("lohn:datev"))
    .get("/", (c) => c.json(ansicht(db, c.get("betriebId"))))
    .put("/", async (c) => {
      const eingabe = einstellungenSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const ergebnis = einstellungenSetzen(db, schreibDb, kontextVon(c, jetzt), eingabe.data);
      if (!ergebnis.ok)
        return c.json({ fehler: ergebnis.grund }, ergebnis.grund === "unbekannt" ? 404 : 409);
      return c.json(ansicht(db, c.get("betriebId")));
    })
    .get("/export", (c) => {
      const eingabe = exportSchema.safeParse(c.req.query());
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const { monat, ziel } = eingabe.data;
      const ergebnis = datevDatei(db, c.get("betriebId"), monat, ziel);
      if (!ergebnis.ok)
        return c.json({ fehler: "nicht_hinterlegt", fehlend: mitNamen(db, ergebnis.fehlend) }, 409);
      const { dateiname, bytes } = ergebnis.datei;
      return new Response(bytes, {
        headers: {
          "content-type": "text/plain; charset=windows-1252",
          "content-disposition": `attachment; filename="${dateiname}"`,
        },
      });
    });
