import { BESCHEINIGUNG_AB_TAG, GESUNDHEIT, istTag, jahrVon, tagInBerlin } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  type AbwesenheitErgebnis,
  abwesenheitenIn,
  abwesenheitsTageVon,
  antragMelden,
  beantragen,
  bescheinigungSetzen,
  bescheinigungVon,
  entscheiden,
  entscheidungMelden,
  krankheitBeenden,
  krankheitMelden,
  krankMelden,
  type Rechte,
  type Schichtquelle,
  sollGrundlagen,
  urlaubsstand,
  urlaubstageVon,
} from "../modules/arbeitszeit/index.ts";
import { bescheinigungAbTagSetzen } from "../modules/betrieb/index.ts";
import type { Mailer } from "../modules/mail/index.ts";
import { STATUS, sicht } from "./abwesenheit-sicht.ts";
import { abwesenheitLeseRouten } from "./abwesenheiten-lesen.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

const tag = z.string().refine(istTag);
const grund = z.string().trim().min(1).max(500);

export const antragSchema = z
  .object({
    art: z.enum(["urlaub", "sonderurlaub", "ueberstundenabbau"]),
    von: tag,
    bis: tag,
    ersterHalb: z.boolean().default(false),
    letzterHalb: z.boolean().default(false),
  })
  .strict();
export const krankSchema = z
  .object({
    art: z.enum(["krank", "kind_krank"]),
    bis: tag.nullable().default(null),
    // a short id of the child, nothing more (Art. 5 Abs. 1 lit. c DSGVO)
    kind: z.string().trim().min(1).max(20).nullable().default(null),
  })
  .strict();
export const grundSchema = z.object({ grund }).strict();
export const leerSchema = z.object({}).strict();
export const bescheinigungSchema = z
  .object({ bescheinigung: z.enum(["eau", "papier"]).nullable() })
  .strict();
export const beendenSchema = z.object({ bis: tag }).strict();
export const einstellungSchema = z
  .object({
    bescheinigungAbTag: z
      .number()
      .int()
      .refine((wert) => (BESCHEINIGUNG_AB_TAG as readonly number[]).includes(wert)),
  })
  .strict();

export type AbwesenheitOptionen = { mail: Mailer | null; schichten: Schichtquelle };

const rechteVon = (c: Context<Anfrage>): Rechte => ({
  freigeben: darf(c.get("rolle"), "abwesenheiten:freigeben"),
  gesundheit: darf(c.get("rolle"), "abwesenheiten:gesundheit"),
});

const fehlerAntwort = (
  c: Context<Anfrage>,
  ergebnis: Extract<AbwesenheitErgebnis, { ok: false }>,
) => c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);

type Deps = { db: Db; schreibDb: SchreibDb; jetzt: () => number; optionen: AbwesenheitOptionen };

/** A request and a sickness report, each for the caller, with the mails after the write */
const meldeRouten = ({ db, schreibDb, jetzt, optionen }: Deps) => {
  const { schichten } = optionen;
  return new Hono<Anfrage>()
    .post("/antrag", recht("stempeln"), async (c) => {
      const eingabe = await koerper(c, antragSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const nutzerId = c.get("nutzerId");
      const kontext = kontextVon(c, jetzt);
      const ergebnis = beantragen(db, schreibDb, kontext, { ...eingabe.data, nutzerId });
      if (!ergebnis.ok) return fehlerAntwort(c, ergebnis);
      const { zeile } = ergebnis;
      await antragMelden(db, optionen.mail, zeile);
      const heute = tagInBerlin(kontext.jetzt);
      const jahr = jahrVon(zeile.von);
      const imJahr = abwesenheitenIn(db, kontext.betriebId, {
        nutzerId,
        von: `${jahr}-01-01`,
        bis: `${jahr}-12-31`,
        status: ["beantragt", "genehmigt"],
      });
      const grundlagen = sollGrundlagen(
        db,
        kontext.betriebId,
        nutzerId,
        abwesenheitsTageVon([zeile, ...imJahr], heute),
      );
      return c.json(
        {
          ...sicht(zeile, true, heute),
          urlaubHalbtage: urlaubstageVon(grundlagen, zeile),
          urlaub: urlaubsstand(grundlagen, imJahr, jahr, heute),
          // the person's own shifts in the span, as far as they are published (S-501, S-503)
          eigeneSchichten: schichten(
            kontext.betriebId,
            nutzerId,
            zeile.von,
            zeile.bis ?? zeile.von,
            false,
          ),
        },
        201,
      );
    })
    .post("/krank", recht("stempeln"), async (c) => {
      const eingabe = await koerper(c, krankSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = krankMelden(db, schreibDb, kontext, {
        ...eingabe.data,
        nutzerId: c.get("nutzerId"),
      });
      if (!ergebnis.ok) return fehlerAntwort(c, ergebnis);
      const { zeile } = ergebnis;
      const heute = tagInBerlin(kontext.jetzt);
      const frist = bescheinigungVon(db, zeile, heute);
      // the planned shifts from today are reported to whoever plans as open, not taken off the
      // plan; with the end still open up to the day the certificate is due (docs/plan.md)
      // (a sickness begins today, so its certificate is never due before today)
      const bis = zeile.bis ?? frist?.faelligAm ?? heute;
      const geplant = schichten(kontext.betriebId, zeile.nutzerId, zeile.von, bis, true);
      await krankheitMelden(db, optionen.mail, zeile, {
        faelligAm: frist?.faelligAm ?? null,
        offeneSchichten: geplant,
      });
      const offeneSchichten = geplant.filter((schicht) => !schicht.entwurf);
      return c.json({ ...sicht(zeile, true, heute), frist, offeneSchichten }, 201);
    });
};

/** A step on an existing absence: decisions, the certificate, the end of a sickness */
const schrittRouten = ({ db, schreibDb, jetzt, optionen }: Deps) => {
  /** A step on an existing absence, answered with the row as the caller may see it */
  const schritt = async <T>(
    c: Context<Anfrage>,
    schema: z.ZodType<T>,
    tun: (eingabe: T, id: string, rechte: Rechte) => AbwesenheitErgebnis,
    melden?: (zeile: Extract<AbwesenheitErgebnis, { ok: true }>["zeile"]) => Promise<void>,
  ) => {
    const eingabe = await koerper(c, schema);
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const ergebnis = tun(eingabe.data, c.req.param("id") ?? "", rechteVon(c));
    if (!ergebnis.ok) return fehlerAntwort(c, ergebnis);
    await melden?.(ergebnis.zeile);
    const { zeile } = ergebnis;
    // the step just taken shows its kind: a planner decides only on what is no sickness, and knows
    // its kind in that moment; afterwards the lists show it as „abwesend“ (docs/plan.md)
    const artZeigen =
      zeile.nutzerId === c.get("nutzerId") || rechteVon(c).gesundheit || !GESUNDHEIT.has(zeile.art);
    return c.json(sicht(zeile, artZeigen, tagInBerlin(jetzt())));
  };

  return new Hono<Anfrage>()
    .post("/:id/freigeben", (c) =>
      schritt(
        c,
        leerSchema,
        (_, id, rechte) =>
          entscheiden(db, schreibDb, kontextVon(c, jetzt), id, { aktion: "freigeben" }, rechte),
        (zeile) => entscheidungMelden(db, optionen.mail, zeile),
      ),
    )
    .post("/:id/ablehnen", (c) =>
      schritt(
        c,
        grundSchema,
        (e, id, rechte) =>
          entscheiden(
            db,
            schreibDb,
            kontextVon(c, jetzt),
            id,
            { aktion: "ablehnen", ...e },
            rechte,
          ),
        (zeile) => entscheidungMelden(db, optionen.mail, zeile),
      ),
    )
    .post("/:id/zurueckziehen", (c) =>
      schritt(c, leerSchema, (_, id, rechte) =>
        entscheiden(db, schreibDb, kontextVon(c, jetzt), id, { aktion: "zurueckziehen" }, rechte),
      ),
    )
    .post("/:id/stornieren", (c) =>
      schritt(
        c,
        grundSchema,
        (e, id, rechte) =>
          entscheiden(
            db,
            schreibDb,
            kontextVon(c, jetzt),
            id,
            { aktion: "stornieren", ...e },
            rechte,
          ),
        (zeile) => entscheidungMelden(db, optionen.mail, zeile),
      ),
    )
    .post("/:id/bescheinigung", (c) =>
      schritt(c, bescheinigungSchema, (e, id, rechte) =>
        bescheinigungSetzen(db, schreibDb, kontextVon(c, jetzt), id, e.bescheinigung, rechte),
      ),
    )
    .post("/:id/beenden", (c) =>
      schritt(c, beendenSchema, (e, id, rechte) =>
        krankheitBeenden(db, schreibDb, kontextVon(c, jetzt), id, e.bis, rechte),
      ),
    );
};

/**
 * Absences below /api/v1/arbeitszeit/abwesenheiten (S-401): a person asks for leave and reports
 * sickness for themselves; owner and planner decide on requests; whoever may see sickness marks its
 * certificate; every change goes through the audit chain, mails go out after it.
 */
export const abwesenheitRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  optionen: AbwesenheitOptionen,
) => {
  const deps = { db, schreibDb, jetzt, optionen };
  return new Hono<Anfrage>()
    .route("/", abwesenheitLeseRouten(db, jetzt))
    .route("/", meldeRouten(deps))
    .route("/", schrittRouten(deps))
    .put("/einstellungen", recht("abwesenheiten:einstellen"), async (c) => {
      const eingabe = await koerper(c, einstellungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const betrieb = bescheinigungAbTagSetzen(
        schreibDb,
        kontextVon(c, jetzt),
        eingabe.data.bescheinigungAbTag,
      );
      return c.json({ bescheinigungAbTag: betrieb.bescheinigungAbTag });
    });
};
