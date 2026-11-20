import { istMonat, monatVorbei, tagInBerlin, teamAuslastung } from "@soll/arbeitszeit";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  auswertungJePersonSeit,
  auswertungJePersonSetzen,
  betriebLesen,
} from "../modules/betrieb/index.ts";
import { namenVon } from "../modules/mitglieder/index.ts";
import { auslastungImMonat, auslastungVon } from "../modules/projektzeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon, ungueltig } from "./projektzeit-gemeinsam.ts";

const monatSchema = z.object({ monat: z.string().refine(istMonat) }).strict();
const einstellungSchema = z.object({ jePerson: z.boolean() }).strict();

/** Since when the caller's business shows the utilisation per person; null: off */
const seitVon = (db: Db, c: Context<Anfrage>): number | null => {
  const betrieb = betriebLesen(db, c.get("betriebId"));
  return betrieb ? auswertungJePersonSeit(db, betrieb) : null;
};

/** Numbers per person only while the business has switched them on (§ 87 Abs. 1 Nr. 6 BetrVG) */
const nurEingeschaltet =
  (db: Db): MiddlewareHandler<Anfrage> =>
  async (c, next) => {
    if (seitVon(db, c) === null) return c.json({ fehler: "auswertung_aus" }, 403);
    await next();
  };

/**
 * The utilisation below /api/v1/projektzeit/auslastung (S-604): stamped against booked time of a
 * month. The team for owner and planner, only for a month that has ended and only for a group of
 * at least three; per person only while the owner has switched it on, then for owner and planner
 * all, for everyone their own.
 */
export const auslastungRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("projekte:lesen"))
    .get("/", recht("projekte:verwalten"), (c) => {
      const eingabe = monatSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const { monat } = eingabe.data;
      // within a running month the change between two calls would show what one person did
      if (!monatVorbei(monat, tagInBerlin(jetzt()))) return c.json({ fehler: "monat_laeuft" }, 422);
      const personen = auslastungImMonat(db, c.get("betriebId"), monat, jetzt());
      return c.json({ monat, jePersonSeit: seitVon(db, c), team: teamAuslastung(personen) });
    })
    .get("/personen", recht("projekte:verwalten"), nurEingeschaltet(db), (c) => {
      const eingabe = monatSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const { monat } = eingabe.data;
      const personen = auslastungImMonat(db, c.get("betriebId"), monat, jetzt());
      const namen = namenVon(
        db,
        personen.map((p) => p.nutzerId),
      );
      return c.json({
        monat,
        jePersonSeit: seitVon(db, c),
        personen: personen.map((p) => ({ ...p, name: namen.get(p.nutzerId) ?? "" })),
      });
    })
    .get("/ich", nurEingeschaltet(db), (c) => {
      const eingabe = monatSchema.safeParse(c.req.query());
      if (!eingabe.success) return ungueltig(c);
      const { monat } = eingabe.data;
      return c.json({
        monat,
        jePersonSeit: seitVon(db, c),
        eigene: auslastungVon(db, c.get("betriebId"), c.get("nutzerId"), monat, jetzt()),
      });
    })
    .put("/einstellung", recht("betrieb:module"), async (c) => {
      const eingabe = einstellungSchema.safeParse(await koerper(c));
      if (!eingabe.success) return ungueltig(c);
      const ergebnis = auswertungJePersonSetzen(
        db,
        schreibDb,
        kontextVon(c, jetzt),
        eingabe.data.jePerson,
      );
      if (!ergebnis.ok) return c.json({ fehler: ergebnis.grund }, 404);
      return c.json({ jePersonSeit: ergebnis.jePersonSeit });
    });
