import { Hono } from "hono";
import { z } from "zod";
import type { Auth } from "../auth/auth.ts";
import { ROLLEN, rollenVon } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { betriebLesen } from "../modules/betrieb/index.ts";
import {
  einladungAngenommen,
  einladungErstellen,
  einladungFinden,
} from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

const einladenSchema = z
  .object({ rolle: z.enum(ROLLEN), name: z.string().trim().min(1).max(100) })
  .strict();

/** Roles a planner may invite; owners, payroll and devices are invited by the owner (S-106) */
const PLANER_DARF: readonly string[] = ["mitarbeiter", "extern"];

/** POST /api/v1/einladungen: an invitation link for the caller's business */
export const einladungRouten = (schreibDb: SchreibDb, url: string, jetzt: () => number) =>
  new Hono<Anfrage>().post("/", recht("mitglieder:einladen"), async (c) => {
    const eingabe = einladenSchema.safeParse(await c.req.json().catch(() => null));
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    if (
      !rollenVon(c.get("rolle")).includes("inhaber") &&
      !PLANER_DARF.includes(eingabe.data.rolle)
    ) {
      return c.json({ fehler: "keine_berechtigung" }, 403);
    }
    const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
    const { einladung, token } = einladungErstellen(schreibDb, kontext, eingabe.data);
    return c.json(
      {
        einladungId: einladung.einladungId,
        link: `${url}/einladung/${token}`,
        gueltigBis: einladung.gueltigBis,
      },
      201,
    );
  });

const annehmenSchema = z
  .object({
    benutzername: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_.]{3,30}$/),
    passwort: z.string().min(10).max(200),
  })
  .strict();

/**
 * The public side of an invitation: what it is for, and accepting it with a username and password,
 * no e-mail address needed. The token in the path is the only key.
 */
export const oeffentlicheEinladungRouten = (
  db: Db,
  schreibDb: SchreibDb,
  auth: Auth,
  jetzt: () => number,
) =>
  new Hono()
    .get("/:token", (c) => {
      const gefunden = einladungFinden(db, c.req.param("token"), jetzt());
      if (!gefunden.ok) return c.json({ fehler: gefunden.grund }, 404);
      const betrieb = betriebLesen(db, gefunden.einladung.betriebId);
      return c.json({
        betrieb: betrieb?.name ?? "",
        name: gefunden.einladung.name,
        rolle: gefunden.einladung.rolle,
      });
    })
    .post("/:token/annehmen", async (c) => {
      const gefunden = einladungFinden(db, c.req.param("token"), jetzt());
      if (!gefunden.ok) return c.json({ fehler: gefunden.grund }, 404);
      const eingabe = annehmenSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const { einladung } = gefunden;
      const konto = await auth.kontoAnlegen({
        benutzername: eingabe.data.benutzername,
        passwort: eingabe.data.passwort,
        name: einladung.name,
        einladungId: einladung.einladungId,
      });
      if (!konto.ok) return c.json({ fehler: konto.grund }, 409);
      const kontext = { betriebId: einladung.betriebId, akteur: konto.nutzerId, jetzt: jetzt() };
      einladungAngenommen(schreibDb, kontext, einladung.einladungId, konto.nutzerId);
      await auth.mitgliedHinzufuegen({
        nutzerId: konto.nutzerId,
        betriebId: einladung.betriebId,
        rolle: einladung.rolle,
      });
      return c.json({ nutzerId: konto.nutzerId }, 201);
    });
