import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, username } from "better-auth/plugins";
import * as authSchema from "../db/auth-schema.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { betriebAnlegen } from "../modules/betrieb/index.ts";
import { mitgliedschaftEntfernen, mitgliedschaftSpiegeln } from "../modules/mitglieder/index.ts";
import { ROLLEN } from "./rollen.ts";

export type AuthDeps = {
  db: Db;
  schreibDb: SchreibDb;
  /** SOLL_SECRET_KEY, decoded; Better Auth signs its cookies with it */
  geheimerSchluessel: Uint8Array;
  url: string;
  jetzt: () => number;
};

/** Changes of membership and role reach the audit chain under this actor, with the user in the row */
const AKTEUR = "anmeldung";

/**
 * Better Auth with one organization per business, passkeys and usernames for people without e-mail
 * (BAULISTE.md S-106). Its tables stay outside the audit chain; its hooks mirror every business,
 * membership and role into Soll's tables, so these changes stand in the chain (CLAUDE.md).
 */
const betterAuthFuer = ({ db, schreibDb, geheimerSchluessel, url, jetzt }: AuthDeps) => {
  const kontext = (betriebId: string) => ({ betriebId, akteur: AKTEUR, jetzt: jetzt() });
  return betterAuth({
    baseURL: url,
    secret: Buffer.from(geheimerSchluessel).toString("base64"),
    // Better Auth owns its tables and writes them itself, on the writable connection
    database: drizzleAdapter(schreibDb.verbindung, {
      provider: "sqlite",
      schema: authSchema,
      transaction: false,
    }),
    emailAndPassword: { enabled: true },
    telemetry: { enabled: false },
    plugins: [
      username(),
      passkey({ rpID: new URL(url).hostname, rpName: "Soll", origin: url }),
      organization({
        creatorRole: "inhaber",
        roles: Object.fromEntries(ROLLEN.map((rolle) => [rolle, undefined])) as never,
        organizationHooks: {
          afterCreateOrganization: async ({ organization: org, member }) => {
            betriebAnlegen(schreibDb, kontext(org.id), org.name);
            mitgliedschaftSpiegeln(db, schreibDb, kontext(org.id), member.userId, member.role);
          },
          afterAddMember: async ({ member }) => {
            mitgliedschaftSpiegeln(
              db,
              schreibDb,
              kontext(member.organizationId),
              member.userId,
              member.role,
            );
          },
          afterUpdateMemberRole: async ({ member }) => {
            mitgliedschaftSpiegeln(
              db,
              schreibDb,
              kontext(member.organizationId),
              member.userId,
              member.role,
            );
          },
          afterRemoveMember: async ({ member }) => {
            mitgliedschaftEntfernen(db, schreibDb, kontext(member.organizationId), member.userId);
          },
        },
      }),
    ],
  });
};

/** What Soll needs of Better Auth; the rest of the server sees only this */
export type Auth = {
  /** Better Auth's own routes under /api/auth */
  handler: (request: Request) => Promise<Response>;
  /** The signed-in user and the business chosen in the session, or null */
  sitzung: (headers: Headers) => Promise<{ nutzerId: string; betriebId: string | null } | null>;
  /** An account with username and password, for a person without e-mail (invitation by link) */
  kontoAnlegen: (angaben: {
    benutzername: string;
    passwort: string;
    name: string;
    einladungId: string;
  }) => Promise<
    { ok: true; nutzerId: string } | { ok: false; grund: "benutzername_vergeben" | "ungueltig" }
  >;
  /** Adds a user to a business with a role (server side, for an accepted invitation) */
  mitgliedHinzufuegen: (angaben: {
    nutzerId: string;
    betriebId: string;
    rolle: string;
  }) => Promise<void>;
};

export const createAuth = (deps: AuthDeps): Auth => {
  const auth = betterAuthFuer(deps);
  return {
    handler: (request) => auth.handler(request),
    sitzung: async (headers) => {
      const ergebnis = await auth.api.getSession({ headers });
      if (!ergebnis) return null;
      const aktiv = (ergebnis.session as { activeOrganizationId?: string | null })
        .activeOrganizationId;
      return { nutzerId: ergebnis.user.id, betriebId: aktiv ?? null };
    },
    kontoAnlegen: async ({ benutzername, passwort, name, einladungId }) => {
      try {
        const ergebnis = await auth.api.signUpEmail({
          // Better Auth needs an address; a person invited without one gets an address that never
          // receives mail (.invalid, RFC 2606) and signs in with the username
          body: {
            email: `${einladungId}@einladung.soll.invalid`,
            password: passwort,
            name,
            username: benutzername,
          },
        });
        return { ok: true, nutzerId: ergebnis.user.id };
      } catch (fehler) {
        const text = String((fehler as { body?: { code?: string } }).body?.code ?? fehler);
        return {
          ok: false,
          grund: /USERNAME|ALREADY|EXIST/i.test(text) ? "benutzername_vergeben" : "ungueltig",
        };
      }
    },
    mitgliedHinzufuegen: async ({ nutzerId, betriebId, rolle }) => {
      await auth.api.addMember({
        body: { userId: nutzerId, organizationId: betriebId, role: rolle as never },
      });
    },
  };
};
