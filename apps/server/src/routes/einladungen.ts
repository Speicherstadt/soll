import { Hono } from "hono";
import { z } from "zod";
import type { Auth } from "../auth/auth.ts";
import { ROLLEN, rollenVon } from "../auth/rollen.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { betriebLesen } from "../modules/betrieb/index.ts";
import {
  einladungAngenommen,
  einladungenErstellen,
  einladungFinden,
} from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";

export const einladenSchema = z
  .object({ rolle: z.enum(ROLLEN), name: z.string().trim().min(1).max(100) })
  .strict();

/** The people of the setup's list (S-303); as many as the CSV import reads at once */
export const listeSchema = z.object({ personen: z.array(einladenSchema).min(1).max(200) }).strict();

/** Roles a planner may invite; owners, payroll and devices are invited by the owner (S-106) */
const PLANER_DARF: readonly string[] = ["mitarbeiter", "extern"];

const darfEinladen = (rolleDesAufrufers: string, rolle: string): boolean =>
  rollenVon(rolleDesAufrufers).includes("inhaber") || PLANER_DARF.includes(rolle);

/**
 * POST /api/v1/einladungen: an invitation link for the caller's business; POST …/liste: one link per
 * person of a list, all or none
 */
export const einladungRouten = (schreibDb: SchreibDb, url: string, jetzt: () => number) => {
  const erstellen = (
    kontext: { betriebId: string; akteur: string; jetzt: number },
    personen: z.infer<typeof einladenSchema>[],
  ) =>
    einladungenErstellen(schreibDb, kontext, personen).map(({ einladung, token }) => ({
      einladungId: einladung.einladungId,
      name: einladung.name,
      rolle: einladung.rolle,
      link: `${url}/einladung/${token}`,
      gueltigBis: einladung.gueltigBis,
    }));
  return new Hono<Anfrage>()
    .post("/", recht("mitglieder:einladen"), async (c) => {
      const eingabe = einladenSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      if (!darfEinladen(c.get("rolle"), eingabe.data.rolle))
        return c.json({ fehler: "keine_berechtigung" }, 403);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      const [einladung] = erstellen(kontext, [eingabe.data]);
      return c.json(
        {
          einladungId: einladung?.einladungId,
          link: einladung?.link,
          gueltigBis: einladung?.gueltigBis,
        },
        201,
      );
    })
    .post("/liste", recht("mitglieder:einladen"), async (c) => {
      const eingabe = listeSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      if (!eingabe.data.personen.every((p) => darfEinladen(c.get("rolle"), p.rolle)))
        return c.json({ fehler: "keine_berechtigung" }, 403);
      const kontext = { betriebId: c.get("betriebId"), akteur: c.get("nutzerId"), jetzt: jetzt() };
      return c.json({ einladungen: erstellen(kontext, eingabe.data.personen) }, 201);
    });
};

export const annehmenSchema = z
  .object({
    benutzername: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_.]{3,30}$/),
    passwort: z.string().min(10).max(128),
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
