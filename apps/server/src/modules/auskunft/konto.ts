import { and, eq } from "drizzle-orm";
import { account, passkey, session, user } from "../../db/auth-schema.ts";
import type { Db } from "../../db/oeffnen.ts";
import { apiZugaenge, einladungen, mitgliedschaften, pins } from "../../db/schema.ts";
import { iso } from "./zeit.ts";

/*
 * The account and membership of a person, as Better Auth and Soll keep them: never a password, a
 * token, a PIN hash or the hash of an invitation token (Art. 15 Abs. 4 DSGVO: a copy must not
 * expose what protects the account)
 */

const kontoVon = (db: Db, nutzerId: string) => {
  const zeile = db.select().from(user).where(eq(user.id, nutzerId)).get();
  return zeile
    ? {
        name: zeile.name,
        email: zeile.email,
        emailBestaetigt: zeile.emailVerified,
        benutzername: zeile.username,
        angelegtAm: iso(zeile.createdAt),
        geaendertAm: iso(zeile.updatedAt),
      }
    : null;
};

/** Sessions in this business: when, until when, from which address and browser */
const sitzungenVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(session)
    .where(and(eq(session.userId, nutzerId), eq(session.activeOrganizationId, betriebId)))
    .all()
    .map((zeile) => ({
      angelegtAm: iso(zeile.createdAt),
      gueltigBis: iso(zeile.expiresAt),
      ipAdresse: zeile.ipAddress,
      browser: zeile.userAgent,
    }));

const anmeldewegeVon = (db: Db, nutzerId: string) => ({
  konten: db
    .select()
    .from(account)
    .where(eq(account.userId, nutzerId))
    .all()
    .map((zeile) => ({ anbieter: zeile.providerId, angelegtAm: iso(zeile.createdAt) })),
  passkeys: db
    .select()
    .from(passkey)
    .where(eq(passkey.userId, nutzerId))
    .all()
    .map((zeile) => ({
      name: zeile.name,
      geraeteart: zeile.deviceType,
      gesichert: zeile.backedUp,
      angelegtAm: zeile.createdAt ? iso(zeile.createdAt) : null,
    })),
});

const mitgliedschaftVon = (db: Db, betriebId: string, nutzerId: string) => {
  const zeile = db
    .select()
    .from(mitgliedschaften)
    .where(and(eq(mitgliedschaften.betriebId, betriebId), eq(mitgliedschaften.nutzerId, nutzerId)))
    .get();
  return zeile ? { rolle: zeile.rolle, seit: iso(zeile.seit) } : null;
};

const pinVon = (db: Db, betriebId: string, nutzerId: string) => {
  const zeile = db
    .select()
    .from(pins)
    .where(and(eq(pins.betriebId, betriebId), eq(pins.nutzerId, nutzerId)))
    .get();
  return zeile
    ? { gesetzt: true, fehlversuche: zeile.fehlversuche, gesperrt: zeile.gesperrt }
    : null;
};

/** The invitation the person accepted: the name and role it was made out to */
const einladungenVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(einladungen)
    .where(and(eq(einladungen.betriebId, betriebId), eq(einladungen.angenommenVon, nutzerId)))
    .all()
    .map((zeile) => ({
      einladungId: zeile.einladungId,
      name: zeile.name,
      rolle: zeile.rolle,
      gueltigBis: iso(zeile.gueltigBis),
    }));

/** The person's tokens for the API (S-607): name and dates, never the hash or the start of a token */
const zugaengeVon = (db: Db, betriebId: string, nutzerId: string) =>
  db
    .select()
    .from(apiZugaenge)
    .where(and(eq(apiZugaenge.betriebId, betriebId), eq(apiZugaenge.nutzerId, nutzerId)))
    .all()
    .map((zeile) => ({
      zugangId: zeile.zugangId,
      name: zeile.name,
      angelegtAm: iso(zeile.angelegtAm),
      gueltigBis: zeile.gueltigBis === null ? null : iso(zeile.gueltigBis),
      zuletztGenutzt: zeile.zuletztGenutzt,
    }));

/** The account in the person's own copy; the owner's copy picks from it (inhaber.ts) */
export const kontoteil = (db: Db, betriebId: string, nutzerId: string) => ({
  konto: kontoVon(db, nutzerId),
  anmeldung: anmeldewegeVon(db, nutzerId),
  sitzungen: sitzungenVon(db, betriebId, nutzerId),
  mitgliedschaft: mitgliedschaftVon(db, betriebId, nutzerId),
  pin: pinVon(db, betriebId, nutzerId),
  einladungen: einladungenVon(db, betriebId, nutzerId),
  zugaenge: zugaengeVon(db, betriebId, nutzerId),
});
