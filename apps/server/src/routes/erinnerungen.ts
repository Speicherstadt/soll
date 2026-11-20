import { Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  aboEntfernen,
  aboGueltig,
  aboSpeichern,
  abosVon,
  regelnSetzen,
  regelnVon,
  SPRACHEN,
  wuenscheSetzen,
  wuenscheVon,
} from "../modules/erinnerungen/index.ts";
import { zustellbar } from "../modules/mail/index.ts";
import { adresseVon } from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";

const base64url = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(200);

/**
 * A push service's endpoint: https only, with a host name that has a dot, so no IP address,
 * localhost or bare name of the local network, as the server posts to it (RFC 8030, Section 8: a
 * push service is reached over TLS). A name that resolves into the local network is not caught.
 */
const endpoint = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .refine((wert) => {
    const host = new URL(wert).hostname;
    return !/^(localhost|\[.*\]|\d+\.\d+\.\d+\.\d+)$/i.test(host) && host.includes(".");
  });

const aboSchema = z
  .object({
    endpoint,
    keys: z.object({ p256dh: base64url, auth: base64url }).strict(),
    sprache: z.enum(SPRACHEN),
  })
  .strict();
const abmeldenSchema = z.object({ endpoint: z.string().min(1).max(2048) }).strict();
const wuenscheSchema = z
  .object({ ausstempeln: z.boolean(), pause: z.boolean(), monat: z.boolean(), mail: z.boolean() })
  .strict();
const regelnSchema = z
  .object({
    // from one hour to the 16 hours after which a Gehen is overdue anyway (R-01)
    gehenMinuten: z.number().int().min(60).max(960),
    pauseVorlauf: z.number().int().min(0).max(120),
    // every month has the 28th
    monatTag: z.number().int().min(1).max(28),
  })
  .strict();

export type ErinnerungDeps = {
  geheimerSchluessel: Uint8Array;
  vapidOeffentlich: string;
  /** whether the instance sends mail at all (SOLL_SMTP_URL) */
  mailKonfiguriert: boolean;
};

/**
 * The reminders of the person signed in and the times of the business (S-307), below the module
 * working time, so a business that switched it off is refused
 */
export const erinnerungRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  deps: ErinnerungDeps,
) =>
  new Hono<Anfrage>()
    .use(recht("stempeln"))
    .get("/", (c) => {
      const betriebId = c.get("betriebId");
      const nutzerId = c.get("nutzerId");
      return c.json({
        vapidSchluessel: deps.vapidOeffentlich,
        wuensche: wuenscheVon(db, betriebId, nutzerId),
        regeln: regelnVon(db, betriebId),
        mail: deps.mailKonfiguriert && zustellbar(adresseVon(db, nutzerId)),
        geraete: abosVon(db, deps.geheimerSchluessel, betriebId, nutzerId).length,
      });
    })
    .put("/wuensche", async (c) => {
      const eingabe = await koerper(c, wuenscheSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return c.json(wuenscheSetzen(db, schreibDb, kontextVon(c, jetzt), eingabe.data));
    })
    .put("/regeln", recht("erinnerungen:regeln"), async (c) => {
      const eingabe = await koerper(c, regelnSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return c.json(regelnSetzen(db, schreibDb, kontextVon(c, jetzt), eingabe.data));
    })
    .post("/abos", async (c) => {
      const eingabe = await koerper(c, aboSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const abo = { endpoint: eingabe.data.endpoint, ...eingabe.data.keys };
      if (!aboGueltig(abo)) return c.json({ fehler: "schluessel_ungueltig" }, 400);
      const { neu } = aboSpeichern(db, schreibDb, deps.geheimerSchluessel, kontextVon(c, jetzt), {
        abo,
        sprache: eingabe.data.sprache,
      });
      return c.json({ ok: true }, neu ? 201 : 200);
    })
    .delete("/abos", async (c) => {
      const eingabe = await koerper(c, abmeldenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      return aboEntfernen(db, schreibDb, kontextVon(c, jetzt), eingabe.data.endpoint)
        ? c.body(null, 204)
        : c.json({ fehler: "unbekannt" }, 404);
    });
