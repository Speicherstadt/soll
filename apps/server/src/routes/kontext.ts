import type { Context, MiddlewareHandler } from "hono";
import type { Auth } from "../auth/auth.ts";
import { darf, type Recht } from "../auth/rollen.ts";
import type { Db } from "../db/oeffnen.ts";
import { type Modul, modulAktiv } from "../modules/betrieb/index.ts";
import { mitgliedschaftVon } from "../modules/mitglieder/index.ts";
import {
  type Abgelehnt,
  type Angemeldet,
  bearer,
  MCP_INTERN,
  tokenAnmelden,
  type ZugangDeps,
} from "./zugang-anmeldung.ts";

/**
 * Who calls, for which business, in which role: set by `angemeldet` for every route of /api/v1.
 * `zugangId` names the personal access token of the call, null for a session (S-607).
 */
export type Anfrage = {
  Variables: { nutzerId: string; betriebId: string; rolle: string; zugangId: string | null };
};

const sitzungAnmelden = async (
  auth: Auth,
  db: Db,
  headers: Headers,
): Promise<Angemeldet | Abgelehnt> => {
  const sitzung = await auth.sitzung(headers);
  if (!sitzung) return { ok: false, status: 401, fehler: "nicht_angemeldet" };
  if (!sitzung.betriebId) return { ok: false, status: 403, fehler: "kein_betrieb" };
  const mitglied = mitgliedschaftVon(db, sitzung.betriebId, sitzung.nutzerId);
  if (!mitglied) return { ok: false, status: 403, fehler: "kein_mitglied" };
  return {
    ok: true,
    nutzerId: sitzung.nutzerId,
    betriebId: sitzung.betriebId,
    rolle: mitglied.rolle,
    zugangId: null,
  };
};

export const abgelehnt = (c: Context, anmeldung: Abgelehnt) => {
  for (const [name, wert] of Object.entries(anmeldung.kopf ?? {})) c.header(name, wert);
  return c.json({ fehler: anmeldung.fehler }, anmeldung.status);
};

/**
 * A signed-in member of the business chosen in the session, or the person of a personal access
 * token in the token's business. The role comes from Soll's mirror of the membership at every call,
 * so a member removed from the business loses access at once, and a token never carries more than
 * its person's role. A wrong token is refused, never answered from a session beside it.
 */
export const angemeldet =
  (auth: Auth, db: Db, zugang: ZugangDeps): MiddlewareHandler<Anfrage> =>
  async (c, next) => {
    const token = bearer(c.req.header("authorization"));
    const intern = (c.env as Record<symbol, unknown> | undefined)?.[MCP_INTERN] === true;
    const anmeldung =
      token === null
        ? await sitzungAnmelden(auth, db, c.req.raw.headers)
        : tokenAnmelden(db, zugang, token, { zaehlen: !intern });
    if (!anmeldung.ok) return abgelehnt(c, anmeldung);
    c.set("nutzerId", anmeldung.nutzerId);
    c.set("betriebId", anmeldung.betriebId);
    c.set("rolle", anmeldung.rolle);
    c.set("zugangId", anmeldung.zugangId);
    await next();
  };

export const recht =
  (benoetigt: Recht): MiddlewareHandler<Anfrage> =>
  async (c, next) => {
    if (!darf(c.get("rolle"), benoetigt)) return c.json({ fehler: "keine_berechtigung" }, 403);
    await next();
  };

/** Only with a session: a token does not create or revoke tokens (docs/plan.md, "Zugänge") */
export const nurSitzung: MiddlewareHandler<Anfrage> = async (c, next) => {
  if (c.get("zugangId") !== null) return c.json({ fehler: "nur_sitzung" }, 403);
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
