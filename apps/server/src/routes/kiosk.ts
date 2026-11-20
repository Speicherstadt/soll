import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import { stempeln, tagLesen } from "../modules/arbeitszeit/index.ts";
import { betriebLesen, modulAktiv } from "../modules/betrieb/index.ts";
import { namenVon } from "../modules/mitglieder/index.ts";
import { istPin } from "../modules/pin/index.ts";
import {
  type Ausweis,
  erkennen,
  FEHLVERSUCHE_BIS_SPERRE,
  koppeln,
  type Terminal,
  terminalVonToken,
} from "../modules/terminal/index.ts";
import { art, zeitpunkt } from "./stempel-antwort.ts";

/** A call of a paired terminal: its row, found by its device token */
export type KioskAnfrage = { Variables: { terminal: Terminal } };

const kopplungSchema = z.object({ code: z.string().min(1).max(40) }).strict();
const ausweisSchema = z.union([
  z.object({ pin: z.string().refine(istPin) }).strict(),
  z.object({ qr: z.string().min(1).max(200) }).strict(),
]);
const stempelSchema = z
  .object({ ausweis: ausweisSchema, art, geraetZeitpunkt: zeitpunkt.optional() })
  .strict();

const STEMPEL_STATUS = {
  unbekannt: 404,
  keine_berechtigung: 403,
  zukunft: 422,
  abgeschlossen: 409,
  veraltet: 409,
  doppelt: 409,
} as const;

/**
 * A paired terminal: `Authorization: Bearer <device token>`, not revoked, its business's module
 * Terminal on. A device token opens these routes and nothing else of the API.
 */
const gekoppelt =
  (db: Db): MiddlewareHandler<KioskAnfrage> =>
  async (c, next) => {
    const token = /^Bearer (\S+)$/.exec(c.req.header("authorization") ?? "")?.[1];
    const terminal = token ? terminalVonToken(db, token) : undefined;
    if (!terminal) return c.json({ fehler: "terminal_unbekannt" }, 401);
    if (!modulAktiv(db, terminal.betriebId, "terminal"))
      return c.json({ fehler: "modul_aus", modul: "terminal" }, 403);
    c.set("terminal", terminal);
    await next();
  };

/** Stamping needs the module Arbeitszeit too: the stamps belong to it */
const arbeitszeit =
  (db: Db): MiddlewareHandler<KioskAnfrage> =>
  async (c, next) => {
    if (!modulAktiv(db, c.get("terminal").betriebId, "arbeitszeit"))
      return c.json({ fehler: "modul_aus", modul: "arbeitszeit" }, 403);
    await next();
  };

/** What the person sees after being recognised: their name and the running day, nothing more */
const personUndTag = (db: Db, betriebId: string, nutzerId: string, jetzt: number) => {
  const tag = tagLesen(db, betriebId, nutzerId, undefined, jetzt);
  return {
    person: { nutzerId, name: namenVon(db, [nutzerId]).get(nutzerId) ?? "" },
    tag: tag && { tag: tag.tag, jetzt: tag.jetzt, sollMinuten: tag.sollMinuten, stand: tag.stand },
  };
};

/**
 * The tablet's side (S-801) under /api/v1/kiosk: trading a pairing code for a device token, then,
 * with the token, the terminal itself, recognising a person by PIN or QR code and stamping for them
 * (`quelle` "terminal" with the terminal's id). Every refusal says why, so the kiosk can show it.
 */
export const kioskRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  pinSchluessel: Uint8Array,
) => {
  const erkannt = (terminal: Terminal, ausweis: Ausweis) =>
    erkennen(db, schreibDb, terminal, ausweis, pinSchluessel, jetzt());
  const abgelehnt = (ergebnis: Exclude<ReturnType<typeof erkannt>, { ok: true }>) =>
    ergebnis.grund === "gesperrt"
      ? ({ fehler: "gesperrt", gesperrtBis: ergebnis.gesperrtBis } as const)
      : ({
          fehler: "unbekannt",
          rest: FEHLVERSUCHE_BIS_SPERRE - ergebnis.fehlversuche,
        } as const);
  return new Hono<KioskAnfrage>()
    .post("/koppeln", async (c) => {
      const eingabe = kopplungSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const ergebnis = koppeln(db, schreibDb, eingabe.data.code, jetzt());
      if (!ergebnis.ok)
        return ergebnis.grund === "modul_aus"
          ? c.json({ fehler: "modul_aus", modul: "terminal" }, 403)
          : c.json({ fehler: "code_ungueltig" }, 404);
      const { terminal, token } = ergebnis;
      const betrieb = betriebLesen(db, terminal.betriebId)?.name ?? "";
      return c.json({ token, terminalId: terminal.terminalId, name: terminal.name, betrieb }, 201);
    })
    .use(gekoppelt(db))
    .get("/", (c) => {
      const terminal = c.get("terminal");
      const gesperrt = terminal.gesperrtBis !== null && terminal.gesperrtBis > jetzt();
      return c.json({
        terminalId: terminal.terminalId,
        name: terminal.name,
        betrieb: betriebLesen(db, terminal.betriebId)?.name ?? "",
        gesperrtBis: gesperrt ? terminal.gesperrtBis : null,
      });
    })
    .post("/erkennen", arbeitszeit(db), async (c) => {
      const eingabe = ausweisSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const terminal = c.get("terminal");
      const ergebnis = erkannt(terminal, eingabe.data);
      if (!ergebnis.ok)
        return c.json(abgelehnt(ergebnis), ergebnis.grund === "gesperrt" ? 423 : 401);
      return c.json(personUndTag(db, terminal.betriebId, ergebnis.nutzerId, jetzt()), 200);
    })
    .post("/stempeln", arbeitszeit(db), async (c) => {
      const eingabe = stempelSchema.safeParse(await c.req.json().catch(() => null));
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const terminal = c.get("terminal");
      const ergebnis = erkannt(terminal, eingabe.data.ausweis);
      if (!ergebnis.ok)
        return c.json(abgelehnt(ergebnis), ergebnis.grund === "gesperrt" ? 423 : 401);
      // the person stamps, through the terminal: they are the actor, the row names the terminal
      const kontext = { betriebId: terminal.betriebId, akteur: ergebnis.nutzerId, jetzt: jetzt() };
      const stempel = stempeln(db, schreibDb, kontext, {
        art: eingabe.data.art,
        geraetZeitpunkt: eingabe.data.geraetZeitpunkt ?? null,
        quelle: "terminal",
        terminalId: terminal.terminalId,
      });
      if (!stempel.ok) return c.json({ fehler: stempel.grund }, STEMPEL_STATUS[stempel.grund]);
      const rest = personUndTag(db, terminal.betriebId, ergebnis.nutzerId, kontext.jetzt);
      return c.json({ stempel: stempel.stempel, ...rest }, 201);
    });
};
