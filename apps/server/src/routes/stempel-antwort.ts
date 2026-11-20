import { STEMPELARTEN, type Stempelart } from "@soll/arbeitszeit";
import type { Context } from "hono";
import { z } from "zod";
import type { StempelErgebnis } from "../modules/arbeitszeit/index.ts";
import type { Anfrage } from "./kontext.ts";

/** What the routes of stamping share: the kinds, an instant, the body, the context, the answer */
export const art = z.enum(STEMPELARTEN as [Stempelart, ...Stempelart[]]);
/** An instant in whole UTC milliseconds (CLAUDE.md, "Time") */
export const zeitpunkt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const STATUS = {
  unbekannt: 404,
  keine_berechtigung: 403,
  zukunft: 422,
  abgeschlossen: 409,
  veraltet: 409,
  doppelt: 409,
} as const;

/** 201 for a new stamp, 200 for an entry of a device's queue that came again (S-305) */
export const antwort = (c: Context<Anfrage>, ergebnis: StempelErgebnis) =>
  ergebnis.ok
    ? c.json(ergebnis.stempel, ergebnis.vorhanden ? 200 : 201)
    : c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);

export const koerper = async <T>(c: Context<Anfrage>, schema: z.ZodType<T>) =>
  schema.safeParse(await c.req.json().catch(() => null));

export const kontextVon = (c: Context<Anfrage>, jetzt: () => number) => ({
  betriebId: c.get("betriebId"),
  akteur: c.get("nutzerId"),
  jetzt: jetzt(),
});
