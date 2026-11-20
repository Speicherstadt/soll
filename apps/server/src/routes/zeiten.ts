import { istTag, tagInBerlin } from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  hatStempelungen,
  lueckenVon,
  modellAm,
  modellZuordnen,
  nachtragen,
  signaturPruefen,
  stempelAendern,
  stempelEntfernen,
  stempeln,
  tagLesen,
} from "../modules/arbeitszeit/index.ts";
import { mitgliederMitNamen, mitgliedschaftVon, namenVon } from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { geraeteRouten, offlineRouten, signaturFehler, signiertSchema } from "./offline.ts";
import { antwort, art, koerper, kontextVon, zeitpunkt } from "./stempel-antwort.ts";

/** A change by hand always says why (docs/plan.md, "Änderungen an Stempelungen") */
const grund = z.string().trim().min(1).max(500);
const id = z.string().min(1).max(100);

// No `nutzerId` and no instant: a person stamps only for themselves, and the server's clock counts;
// a device that signs its stamps sends its number and signature along (S-305)
const stempelSchema = z
  .object({ art, geraetZeitpunkt: zeitpunkt.optional(), geraet: signiertSchema.optional() })
  .strict();
const nachtragSchema = z.object({ nutzerId: id.optional(), art, zeitpunkt, grund }).strict();
const aenderungSchema = z.object({ art, zeitpunkt, grund }).strict();
const entfernenSchema = z.object({ grund }).strict();
const zuordnungSchema = z
  .object({ modellId: id, gueltigAb: z.string().refine(istTag).optional() })
  .strict();
const tagSchema = z
  .object({ datum: z.string().refine(istTag).optional(), nutzerId: id.optional() })
  .strict();

type Person =
  | { ok: true; nutzerId: string }
  | { ok: false; status: 403 | 404; fehler: "keine_berechtigung" | "unbekannt" };

/**
 * The person a call is about: oneself, or a member of the business who stamps, for whoever may;
 * external staff and devices do not stamp here (docs/plan.md, "Wer Stempelungen ändert"). Whoever
 * may see all times also reads the past stamps of someone who left or no longer stamps.
 */
const person = (
  db: Db,
  c: Context<Anfrage>,
  nutzerId: string | undefined,
  benoetigt: "zeiten:alle" | "zeiten:korrigieren",
): Person => {
  const ziel = nutzerId ?? c.get("nutzerId");
  if (ziel === c.get("nutzerId")) return { ok: true, nutzerId: ziel };
  if (!darf(c.get("rolle"), benoetigt))
    return { ok: false, status: 403, fehler: "keine_berechtigung" };
  const mitglied = mitgliedschaftVon(db, c.get("betriebId"), ziel);
  const stempelt = mitglied !== undefined && darf(mitglied.rolle, "stempeln");
  // the records stay readable two years (§ 16 Abs. 2 ArbZG), also after a person left or no
  // longer stamps; adding stamps stays for members who stamp
  const frueher = benoetigt === "zeiten:alle" && hatStempelungen(db, c.get("betriebId"), ziel);
  if (!stempelt && !frueher) return { ok: false, status: 404, fehler: "unbekannt" };
  return { ok: true, nutzerId: ziel };
};

/**
 * Who stamps reads their own days; so does whoever has stamps in the business but no longer stamps
 * (e.g. now external staff), read-only (Art. 15 DSGVO; docs/anmeldung.md, "die eigenen Daten")
 */
const liestEigene = (db: Db, c: Context<Anfrage>) =>
  darf(c.get("rolle"), "stempeln") || hatStempelungen(db, c.get("betriebId"), c.get("nutzerId"));

/** A day of a person with the names of who changed what */
const tagRouten = (db: Db, jetzt: () => number) =>
  new Hono<Anfrage>().get("/tag", (c) => {
    const eingabe = tagSchema.safeParse(c.req.query());
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const wer = person(db, c, eingabe.data.nutzerId, "zeiten:alle");
    if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
    if (wer.nutzerId === c.get("nutzerId") && !liestEigene(db, c))
      return c.json({ fehler: "keine_berechtigung" }, 403);
    const ansicht = tagLesen(db, c.get("betriebId"), wer.nutzerId, eingabe.data.datum, jetzt());
    if (!ansicht) return c.json({ fehler: "ungueltig" }, 400);
    const namen = namenVon(db, [wer.nutzerId, ...ansicht.aenderungen.map((a) => a.von)]);
    return c.json({
      ...ansicht,
      // gaps in the numbers of the person's devices (S-305), for the person and whoever reads them
      luecken: lueckenVon(db, c.get("betriebId"), wer.nutzerId),
      nutzerId: wer.nutzerId,
      name: namen.get(wer.nutzerId) ?? "",
      aenderungen: ansicht.aenderungen.map((a) => ({ ...a, vonName: namen.get(a.von) ?? "" })),
    });
  });

/** Stamping live, adding, changing and removing stamps with a reason */
const stempelRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .use(recht("stempeln"))
    .post("/", async (c) => {
      const eingabe = await koerper(c, stempelSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const { art, geraetZeitpunkt, geraet } = eingabe.data;
      // a signed stamp names the device's time it signed (stempelNachricht)
      if (geraet && geraetZeitpunkt === undefined) return c.json({ fehler: "ungueltig" }, 400);
      if (geraet && geraetZeitpunkt !== undefined) {
        const eintrag = { geraetId: geraet.geraetId, nummer: geraet.nummer, art, geraetZeitpunkt };
        const geprueft = await signaturPruefen(
          db,
          c.get("betriebId"),
          c.get("nutzerId"),
          eintrag,
          geraet.signatur,
        );
        if (!geprueft.ok) return signaturFehler(c, geprueft.grund);
      }
      return antwort(
        c,
        stempeln(db, schreibDb, kontextVon(c, jetzt), {
          art,
          geraetZeitpunkt: geraetZeitpunkt ?? null,
          quelle: "app",
          signiert: geraet,
        }),
      );
    })
    .route("/offline", offlineRouten(db, schreibDb, jetzt))
    .post("/nachtrag", async (c) => {
      const eingabe = await koerper(c, nachtragSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = person(db, c, eingabe.data.nutzerId, "zeiten:korrigieren");
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const angaben = { ...eingabe.data, nutzerId: wer.nutzerId };
      return antwort(c, nachtragen(db, schreibDb, kontextVon(c, jetzt), angaben));
    })
    .patch("/:stempelId", async (c) => {
      const eingabe = await koerper(c, aenderungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return antwort(
        c,
        stempelAendern(db, schreibDb, kontextVon(c, jetzt), {
          ...eingabe.data,
          stempelId: c.req.param("stempelId"),
          fuerAndere: darf(c.get("rolle"), "zeiten:korrigieren"),
        }),
      );
    })
    .post("/:stempelId/entfernen", async (c) => {
      const eingabe = await koerper(c, entfernenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return antwort(
        c,
        stempelEntfernen(db, schreibDb, kontextVon(c, jetzt), {
          grund: eingabe.data.grund,
          stempelId: c.req.param("stempelId"),
          fuerAndere: darf(c.get("rolle"), "zeiten:korrigieren"),
        }),
      );
    });

/** The people whose times the caller may see, with their model today, and assigning a model */
const personenRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", recht("zeiten:alle"), (c) => {
      const heute = tagInBerlin(jetzt());
      const betriebId = c.get("betriebId");
      return c.json({
        personen: mitgliederMitNamen(db, betriebId)
          .filter(({ rolle }) => darf(rolle, "stempeln"))
          .map((mitglied) => ({
            ...mitglied,
            modellId: modellAm(db, betriebId, mitglied.nutzerId, heute)?.modellId ?? null,
          })),
      });
    })
    .put("/:nutzerId/modell", recht("modelle:zuordnen"), async (c) => {
      const eingabe = await koerper(c, zuordnungSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const nutzerId = c.req.param("nutzerId");
      if (!mitgliedschaftVon(db, c.get("betriebId"), nutzerId))
        return c.json({ fehler: "unbekannt" }, 404);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = modellZuordnen(db, schreibDb, kontext, {
        nutzerId,
        modellId: eingabe.data.modellId,
        gueltigAb: eingabe.data.gueltigAb ?? tagInBerlin(kontext.jetzt),
      });
      if (!ergebnis.ok) return c.json({ fehler: ergebnis.grund }, 404);
      return c.json({ ok: true });
    });

/**
 * Stamping and the times of a day, below /api/v1/arbeitszeit (S-304): refused while the module is
 * off. A person stamps and reads for themselves; owner and planner read and correct others' times
 * with a reason, payroll reads them (rollen.ts).
 */
export const zeitRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>()
    .route("/", tagRouten(db, jetzt))
    .route("/stempelungen", stempelRouten(db, schreibDb, jetzt))
    .route("/geraete", geraeteRouten(db, schreibDb, jetzt))
    .route("/personen", personenRouten(db, schreibDb, jetzt));
