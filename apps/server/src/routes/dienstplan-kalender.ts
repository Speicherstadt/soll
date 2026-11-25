import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  kalenderAusstellen,
  kalenderFeed,
  kalenderVon,
  kalenderWiderrufen,
} from "../modules/dienstplan/index.ts";
import { SPRACHEN } from "../modules/erinnerungen/index.ts";
import { type Anfrage, nurSitzung, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

/** The language of the feed's words: the app's language when it is issued */
export const kalenderSchema = z.object({ sprache: z.enum(SPRACHEN).default("de") }).strict();

/** Where the feed of a token is read: below /api/v1/ics, outside the session (S-503) */
export const feedPfad = (url: string, token: string) => `${url}/api/v1/ics/${token}.ics`;

/**
 * The caller's own calendar feed, below /api/v1/dienstplan/kalender (S-503): everyone who reads the
 * plan; issued and revoked only with a session, as a token never makes another (S-607). The link
 * with the token is in the answer to issuing it only.
 */
export const kalenderRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number, url: string) =>
  new Hono<Anfrage>()
    .use(recht("plan:lesen"))
    .get("/", (c) => c.json({ abo: kalenderVon(db, c.get("betriebId"), c.get("nutzerId")) }))
    .post("/", nurSitzung, async (c) => {
      const eingabe = await koerper(c, kalenderSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const { token, abo } = kalenderAusstellen(
        db,
        schreibDb,
        kontextVon(c, jetzt),
        eingabe.data.sprache,
      );
      return c.json({ abo, url: feedPfad(url, token) }, 201);
    })
    .delete("/", nurSitzung, (c) =>
      kalenderWiderrufen(db, schreibDb, kontextVon(c, jetzt))
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404),
    );

/**
 * The feed itself, for a calendar app without a session: the token is the only key (S-503). Read
 * only; not cached by anyone in between, and kept out of the log (log.ts) and of referrers.
 */
export const feedRouten = (db: Db, jetzt: () => number) =>
  new Hono().get("/:datei", (c) => {
    const datei = c.req.param("datei");
    if (!datei.endsWith(".ics")) return c.json({ fehler: "unbekannt" }, 404);
    const feed = kalenderFeed(db, datei.slice(0, -".ics".length), jetzt());
    if (!feed.ok)
      return feed.grund === "modul_aus"
        ? c.json({ fehler: "modul_aus", modul: "dienstplan" }, 403)
        : c.json({ fehler: "unbekannt" }, 404);
    return c.body(feed.ics, 200, {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="soll.ics"',
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    });
  });
