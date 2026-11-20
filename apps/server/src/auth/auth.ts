import { AsyncLocalStorage } from "node:async_hooks";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { organization, username } from "better-auth/plugins";
import { defaultAc } from "better-auth/plugins/organization/access";
import * as authSchema from "../db/auth-schema.ts";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { arbeitszeitPflichtWahren, betriebAnlegen } from "../modules/betrieb/index.ts";
import {
  mitgliedschaftEntfernen,
  mitgliedschaftSpiegeln,
  mitgliedschaftVon,
} from "../modules/mitglieder/index.ts";
import { darf, istRolle, ROLLEN, rollenVon } from "./rollen.ts";

export type AuthDeps = {
  db: Db;
  schreibDb: SchreibDb;
  /** SOLL_SECRET_KEY, decoded; Better Auth signs its cookies with it */
  geheimerSchluessel: Uint8Array;
  url: string;
  jetzt: () => number;
};

/**
 * What a role may do through Better Auth's own routes: the owner changes and removes members, nobody
 * renames or deletes the business there or sends Better Auth's e-mail invitations (Soll invites by
 * link, and the business row follows the organization only through Soll's routes)
 */
const KEINE_RECHTE = {
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
} as const;
const RECHTE_IN_BETTER_AUTH: Partial<
  Record<string, typeof KEINE_RECHTE | { [key: string]: readonly string[] }>
> = {
  inhaber: {
    organization: [],
    member: ["update", "delete"],
    invitation: [],
    team: [],
    ac: ["read"],
  },
};

/**
 * Better Auth's routes that show other members (names, e-mail addresses, roles): it asks only for
 * membership, Soll for the right to read the business, which a device lacks (rollen.ts)
 */
const MITGLIEDER_LESEN: readonly string[] = [
  "/organization/get-full-organization",
  "/organization/list-members",
  "/organization/get-active-member-role",
];

/** The actor of a change through Better Auth when no signed-in person made it */
const AKTEUR = "anmeldung";

/**
 * The person on whose request Better Auth runs its hooks: the hooks get no session, but the audit
 * chain names who changed a membership or role (CLAUDE.md, actor of each link)
 */
const akteure = new AsyncLocalStorage<string>();

/**
 * Better Auth with one organization per business, passkeys and usernames for people without e-mail
 * (BAULISTE.md S-106). Its tables stay outside the audit chain; its hooks mirror every business,
 * membership and role into Soll's tables, so these changes stand in the chain (CLAUDE.md).
 */
const betterAuthFuer = ({ db, schreibDb, geheimerSchluessel, url, jetzt }: AuthDeps) => {
  const kontext = (betriebId: string) => ({
    betriebId,
    akteur: akteure.getStore() ?? AKTEUR,
    jetzt: jetzt(),
  });
  const spiegeln = (member: { organizationId: string; userId: string; role: string }) => {
    mitgliedschaftSpiegeln(
      db,
      schreibDb,
      kontext(member.organizationId),
      member.userId,
      member.role,
    );
    arbeitszeitPflichtWahren(db, schreibDb, kontext(member.organizationId));
  };
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!MITGLIEDER_LESEN.includes(ctx.path)) return;
        const sitzung = await getSessionFromCtx(ctx);
        if (!sitzung) return;
        // the business as Better Auth picks it: slug, then id, then the active one (each if not empty)
        const { organizationSlug, organizationId, userId } = (ctx.query ?? {}) as Record<
          string,
          string
        >;
        // one's own role is no one else's data
        if (ctx.path === "/organization/get-active-member-role" && !userId) return;
        const betriebId = organizationSlug
          ? (
              await ctx.context.adapter.findOne<{ id: string }>({
                model: "organization",
                where: [{ field: "slug", value: organizationSlug }],
              })
            )?.id
          : organizationId ||
            (sitzung.session as { activeOrganizationId?: string | null }).activeOrganizationId;
        const mitglied = betriebId && mitgliedschaftVon(db, betriebId, sitzung.user.id);
        if (mitglied && !darf(mitglied.rolle, "mitglieder:lesen"))
          throw new APIError("FORBIDDEN", { message: "not allowed to read the members" });
      }),
      // Leaving a business has no organization hook in Better Auth (1.7.26, routes/crud-members
      // leaveOrganization), so the mirror follows it here; otherwise the member's other sessions
      // would keep the business
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/organization/leave") return;
        const member = ctx.context.returned as { organizationId?: string; userId?: string } | null;
        if (!member?.organizationId || !member.userId || member instanceof Error) return;
        mitgliedschaftEntfernen(db, schreibDb, kontext(member.organizationId), member.userId);
      }),
    },
    plugins: [
      username(),
      passkey({ rpID: new URL(url).hostname, rpName: "Soll", origin: url }),
      organization({
        creatorRole: "inhaber",
        // Better Auth's access types are invariant in the statements; the roles are built from them
        ac: defaultAc as never,
        roles: Object.fromEntries(
          ROLLEN.map((rolle) => [
            rolle,
            defaultAc.newRole((RECHTE_IN_BETTER_AUTH[rolle] ?? KEINE_RECHTE) as never),
          ]),
        ) as never,
        organizationHooks: {
          afterCreateOrganization: async ({ organization: org, member }) => {
            betriebAnlegen(schreibDb, kontext(org.id), org.name);
            mitgliedschaftSpiegeln(db, schreibDb, kontext(org.id), member.userId, member.role);
          },
          afterAddMember: async ({ member }) => spiegeln(member),
          // Better Auth also accepts its own default roles (owner, admin, member); Soll knows only its own
          beforeUpdateMemberRole: async ({ newRole }) => {
            if (!rollenVon(newRole).every(istRolle))
              throw new APIError("BAD_REQUEST", { message: "unknown role" });
          },
          afterUpdateMemberRole: async ({ member }) => spiegeln(member),
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
    handler: async (request) => {
      // without refreshing, so the session cookie is renewed only by the request itself
      const angemeldet = await auth.api.getSession({
        headers: request.headers,
        query: { disableRefresh: true },
      });
      return angemeldet
        ? akteure.run(angemeldet.user.id, () => auth.handler(request))
        : auth.handler(request);
    },
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
      // the invited person accepts, so she is the actor of her membership
      await akteure.run(nutzerId, () =>
        auth.api.addMember({
          body: { userId: nutzerId, organizationId: betriebId, role: rolle as never },
        }),
      );
    },
  };
};
