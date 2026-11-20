import type { MiddlewareHandler } from "hono";
import type { Auth } from "../auth/auth.ts";
import { darf, type Recht } from "../auth/rollen.ts";
import type { Db } from "../db/oeffnen.ts";
import { type Modul, modulAktiv } from "../modules/betrieb/index.ts";
import { mitgliedschaftVon } from "../modules/mitglieder/index.ts";

/** Who calls, for which business, in which role: set by `angemeldet` for every route of /api/v1 */
export type Anfrage = { Variables: { nutzerId: string; betriebId: string; rolle: string } };

/**
 * A signed-in member of the business chosen in the session. The role comes from Soll's mirror of the
 * membership, so a member removed from the business loses access at once.
 */
export const angemeldet =
  (auth: Auth, db: Db): MiddlewareHandler<Anfrage> =>
  async (c, next) => {
    const sitzung = await auth.sitzung(c.req.raw.headers);
    if (!sitzung) return c.json({ fehler: "nicht_angemeldet" }, 401);
    if (!sitzung.betriebId) return c.json({ fehler: "kein_betrieb" }, 403);
    const mitglied = mitgliedschaftVon(db, sitzung.betriebId, sitzung.nutzerId);
    if (!mitglied) return c.json({ fehler: "kein_mitglied" }, 403);
    c.set("nutzerId", sitzung.nutzerId);
    c.set("betriebId", sitzung.betriebId);
    c.set("rolle", mitglied.rolle);
    await next();
  };

export const recht =
  (benoetigt: Recht): MiddlewareHandler<Anfrage> =>
  async (c, next) => {
    if (!darf(c.get("rolle"), benoetigt)) return c.json({ fehler: "keine_berechtigung" }, 403);
    await next();
  };

/** A route of a module the business switched off is refused by the server, not only hidden */
export const modul =
  (db: Db, name: Modul): MiddlewareHandler<Anfrage> =>
  async (c, next) => {
    if (!modulAktiv(db, c.get("betriebId"), name))
      return c.json({ fehler: "modul_aus", modul: name }, 403);
    await next();
  };
