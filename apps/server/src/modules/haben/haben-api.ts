import { z } from "zod";

/*
 * Calls of Haben's REST API (docs/api.md in firsttris/haben): `Authorization: Bearer`, JSON, the
 * version in the path (`/api/v1`), unknown fields in answers passed over. Errors come back as values
 * (CLAUDE.md), each with Haben's own German message where it sent one.
 */

/** Where a business reaches its Haben: the address with `/api/v1`, the token and how to call */
export type HabenAnschluss = { fetch: typeof fetch; basis: string; token: string };

/**
 * Why a call failed: no answer (`nicht_erreichbar`), 401 (`zugang_abgelehnt`: token wrong, expired,
 * revoked or the access switched off), 403 (`recht_fehlt`), 400/404/409/422 (`abgelehnt`: this one
 * entry), 429 (`zu_viele`: 120 calls a minute per token), anything else (`haben_fehler`)
 */
export type HabenFehler =
  | "nicht_erreichbar"
  | "zugang_abgelehnt"
  | "recht_fehlt"
  | "abgelehnt"
  | "zu_viele"
  | "haben_fehler";

export type HabenAntwort<T> =
  | { ok: true; wert: T; status: number }
  | { ok: false; fehler: HabenFehler; meldung: string };

/** A contact as `GET /kontakte` lists it; only what Soll needs */
const kontaktSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string(),
  kundennummer: z.string().nullable(),
  archived: z.boolean().optional(),
});
export type HabenKontakt = z.infer<typeof kontaktSchema>;

const kontaktListe = z.object({ data: z.array(kontaktSchema), total: z.number().int() });

/**
 * A Leistung for `POST /leistungen` (serviceEntryCreateSchema in Haben): customer, working day,
 * whole minutes 1 to 1440, text, optionally the hourly rate in cents (missing: the customer's in
 * Haben), whether it is billable, the project as free text, and the source with the row's id there
 */
export type Leistung = {
  contactId: string;
  workedOn: string;
  minutes: number;
  description: string;
  hourlyRateCents?: number;
  nonBillable: boolean;
  project: string;
  source: string;
  externalId: string;
};

const leistungAntwort = z.object({ id: z.string().min(1).max(100) });

/** How long Soll waits for Haben before it calls it unreachable */
const WARTEZEIT_MS = 15_000;

const fehlerAus = (status: number): HabenFehler => {
  if (status === 401) return "zugang_abgelehnt";
  if (status === 403) return "recht_fehlt";
  if (status === 429) return "zu_viele";
  if ([400, 404, 409, 413, 422].includes(status)) return "abgelehnt";
  return "haben_fehler";
};

/** Haben's message from the error form `{ error: { code, message } }`, at most 500 characters */
const meldungAus = (koerper: unknown): string => {
  const meldung = (koerper as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof meldung === "string" ? meldung.slice(0, 500) : "";
};

const aufrufen = async <T>(
  anschluss: HabenAnschluss,
  pfad: string,
  schema: z.ZodType<T>,
  koerper?: unknown,
): Promise<HabenAntwort<T>> => {
  let antwort: Response;
  try {
    antwort = await anschluss.fetch(`${anschluss.basis}${pfad}`, {
      method: koerper === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${anschluss.token}`,
        accept: "application/json",
        ...(koerper === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(koerper === undefined ? {} : { body: JSON.stringify(koerper) }),
      redirect: "error",
      signal: AbortSignal.timeout(WARTEZEIT_MS),
    });
  } catch {
    return { ok: false, fehler: "nicht_erreichbar", meldung: "" };
  }
  const daten: unknown = await antwort.json().catch(() => null);
  if (!antwort.ok)
    return { ok: false, fehler: fehlerAus(antwort.status), meldung: meldungAus(daten) };
  const gelesen = schema.safeParse(daten);
  return gelesen.success
    ? { ok: true, wert: gelesen.data, status: antwort.status }
    : { ok: false, fehler: "haben_fehler", meldung: "" };
};

/** Haben lists at most 500 per page; more than 20 pages (10,000 contacts) Soll does not read */
const SEITE = 500;
const SEITEN = 20;

/** The contacts that are not archived, page by page (`limit`, `offset`, `total`) */
export const kontakteLesen = async (
  anschluss: HabenAnschluss,
): Promise<HabenAntwort<HabenKontakt[]>> => {
  const alle: HabenKontakt[] = [];
  for (let seite = 0; seite < SEITEN; seite++) {
    const antwort = await aufrufen(
      anschluss,
      `/kontakte?limit=${SEITE}&offset=${seite * SEITE}`,
      kontaktListe,
    );
    if (!antwort.ok) return antwort;
    alle.push(...antwort.wert.data);
    if (antwort.wert.data.length === 0 || alle.length >= antwort.wert.total) break;
  }
  return { ok: true, wert: alle, status: 200 };
};

/** One contact by its id (404 is `abgelehnt`) */
export const kontaktLesen = (anschluss: HabenAnschluss, id: string) =>
  aufrufen(anschluss, `/kontakte/${encodeURIComponent(id)}`, kontaktSchema);

/**
 * Sends a Leistung: 201 created, 200 the existing one with the same `source` and `externalId`
 * (updated, or unchanged while it stands on an invoice); `neu` tells which
 */
export const leistungSenden = async (
  anschluss: HabenAnschluss,
  leistung: Leistung,
): Promise<HabenAntwort<{ id: string; neu: boolean }>> => {
  const antwort = await aufrufen(anschluss, "/leistungen", leistungAntwort, leistung);
  return antwort.ok
    ? {
        ok: true,
        wert: { id: antwort.wert.id, neu: antwort.status === 201 },
        status: antwort.status,
      }
    : antwort;
};
