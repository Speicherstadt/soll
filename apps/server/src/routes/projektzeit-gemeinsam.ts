import type { Context } from "hono";
import { z } from "zod";
import type { Ergebnis, Grund } from "../modules/projektzeit/index.ts";
import type { Anfrage } from "./kontext.ts";

/** The parts the routes of the module Projektzeit share (S-601) */

export const name = z.string().trim().min(1).max(100);
export const nummer = z.string().trim().max(40);
export const archiviert = z.boolean();

/** The reference to another source, as Haben names a platform (docs/api.md: externalSource) */
export const extern = {
  externQuelle: z
    .string()
    .regex(/^[a-z0-9._-]{1,40}$/)
    .optional(),
  externId: z.string().trim().min(1).max(100).optional(),
};

export const beideOderKeins = (werte: {
  externQuelle?: string | undefined;
  externId?: string | undefined;
}) => (werte.externQuelle === undefined) === (werte.externId === undefined);

/** A PATCH that changes nothing is no change */
export const nichtLeer = (werte: object) => Object.keys(werte).length > 0;

/** The body as JSON or null, so a broken body fails the schema like a wrong one */
export const koerper = (c: Context<Anfrage>) => c.req.json().catch(() => null);

export const kontextVon = (c: Context<Anfrage>, jetzt: () => number) => ({
  betriebId: c.get("betriebId"),
  akteur: c.get("nutzerId"),
  jetzt: jetzt(),
});

const STATUS: Record<Grund, 404 | 409 | 422> = {
  unbekannt: 404,
  verwendet: 409,
  archiviert: 409,
  fest: 409,
  doppelt: 409,
  kunde_unbekannt: 422,
  projekt_unbekannt: 422,
  taetigkeit_unbekannt: 422,
  person_unbekannt: 422,
  laeuft: 409,
  laeuft_nicht: 409,
  ueberschneidung: 409,
  abgerechnet: 409,
  spanne: 422,
};

/** The answer to a write: the row, 204 for a removal, or the reason with its status */
export const antwort = <T>(c: Context<Anfrage>, ergebnis: Ergebnis<T>, status: 200 | 201 = 200) => {
  if (!ergebnis.ok) return c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);
  if (ergebnis.wert === null) return c.body(null, 204);
  return c.json(ergebnis.wert as object, status);
};

export const ungueltig = (c: Context<Anfrage>) => c.json({ fehler: "ungueltig" }, 400);
