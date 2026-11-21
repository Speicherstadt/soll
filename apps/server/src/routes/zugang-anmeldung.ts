import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { mitgliedschaftVon } from "../modules/mitglieder/index.ts";
import { nutzungMerken, type RatenGrenze, zugangFinden } from "../modules/zugaenge/index.ts";

/** What the sign-in with a personal access token needs (S-607) */
export type ZugangDeps = { schreibDb: SchreibDb; jetzt: () => number; grenze: RatenGrenze };

export type Abgelehnt = {
  ok: false;
  status: 401 | 403 | 429;
  fehler: string;
  kopf?: Record<string, string>;
};

/** Who calls, in which business and role, with which token (null for a session) */
export type Angemeldet = {
  ok: true;
  nutzerId: string;
  betriebId: string;
  rolle: string;
  zugangId: string | null;
};

/**
 * Marks a call the MCP server makes into the API for a tool (Hono's `env`, which no HTTP request
 * can set): the MCP request itself was counted against the token's limit already
 */
export const MCP_INTERN = Symbol("mcp-intern");

/** RFC 6750 Abschnitt 3: a refused token says so in WWW-Authenticate */
const UNGUELTIG = { "WWW-Authenticate": 'Bearer error="invalid_token"' };

/** The token of `Authorization: Bearer <token>` (RFC 6750), or null for another or no header */
export const bearer = (kopf: string | undefined): string | null =>
  /^Bearer\s+(\S+)\s*$/i.exec(kopf ?? "")?.[1] ?? null;

/**
 * The token's person in the token's business with her role now. A token made before the person's
 * current membership began is dead: whoever left and joins again does not get the old tokens back.
 * Then the rate limit per token, then the day of the last use.
 */
export const tokenAnmelden = (
  db: Db,
  deps: ZugangDeps,
  token: string,
  optionen: { zaehlen: boolean },
): Angemeldet | Abgelehnt => {
  const jetzt = deps.jetzt();
  const gefunden = zugangFinden(db, token, jetzt);
  if (!gefunden.ok)
    return { ok: false, status: 401, fehler: `zugang_${gefunden.grund}`, kopf: UNGUELTIG };
  const { zugang } = gefunden;
  const mitglied = mitgliedschaftVon(db, zugang.betriebId, zugang.nutzerId);
  if (!mitglied) return { ok: false, status: 403, fehler: "kein_mitglied" };
  if (zugang.angelegtAm < mitglied.seit)
    return { ok: false, status: 401, fehler: "zugang_ungueltig", kopf: UNGUELTIG };
  const frei = optionen.zaehlen ? deps.grenze(zugang.zugangId, jetzt) : { ok: true as const };
  if (!frei.ok)
    return {
      ok: false,
      status: 429,
      fehler: "zu_viele_anfragen",
      kopf: { "Retry-After": String(frei.wartenSekunden) },
    };
  nutzungMerken(deps.schreibDb, zugang, jetzt);
  return {
    ok: true,
    nutzerId: zugang.nutzerId,
    betriebId: zugang.betriebId,
    rolle: mitglied.rolle,
    zugangId: zugang.zugangId,
  };
};
