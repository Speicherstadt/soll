import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  geraetAnmelden,
  offlineStempeln,
  type SignaturErgebnis,
  signaturPruefen,
} from "../modules/arbeitszeit/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { antwort, art, koerper, kontextVon, zeitpunkt } from "./stempel-antwort.ts";

/** 32 bytes in base64url without padding: a coordinate of P-256 */
const koordinate = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const geraetId = z.string().uuid();
/** ECDSA P-256 with SHA-256 from WebCrypto: r and s of 32 bytes each, 86 characters of base64url */
const signatur = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
/** A running number of a device: from 1, and no further than an integer column holds safely */
const nummer = z.number().int().min(1).max(2_147_483_647);

/** The device, its number and its signature of a stamp (S-305) */
export const signiertSchema = z.object({ geraetId, nummer, signatur }).strict();

const anmeldeSchema = z
  .object({
    schluessel: z
      .object({ kty: z.literal("EC"), crv: z.literal("P-256"), x: koordinate, y: koordinate })
      // a JWK exported by WebCrypto also carries `ext` and `key_ops`; the key is kty, crv, x and y
      .passthrough(),
  })
  .strict();

const offlineSchema = z
  .object({ art, geraetZeitpunkt: zeitpunkt, gesendetAm: zeitpunkt, geraet: signiertSchema })
  .strict();

/** An unknown device answers like a device of someone else, so nothing tells whether it exists */
export const signaturFehler = (
  c: Context<Anfrage>,
  grund: Extract<SignaturErgebnis, { ok: false }>["grund"],
) =>
  grund === "geraet_unbekannt"
    ? c.json({ fehler: "geraet_unbekannt" }, 404)
    : c.json({ fehler: "signatur" }, 422);

/**
 * A device registers the public key of its non-extractable key pair for the person signed in:
 * PUT /api/v1/arbeitszeit/geraete/:geraetId; 201 when new, 200 again with the same key, 409 when the
 * id belongs to another key or person
 */
export const geraeteRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>().use(recht("stempeln")).put("/:geraetId", async (c) => {
    const id = geraetId.safeParse(c.req.param("geraetId"));
    const eingabe = await koerper(c, anmeldeSchema);
    if (!id.success || !eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const ergebnis = await geraetAnmelden(db, schreibDb, kontextVon(c, jetzt), {
      geraetId: id.data,
      schluessel: eingabe.data.schluessel,
    });
    if (!ergebnis.ok)
      return c.json({ fehler: ergebnis.grund }, ergebnis.grund === "vergeben" ? 409 : 400);
    return c.json({ geraetId: id.data }, ergebnis.neu ? 201 : 200);
  });

/**
 * An entry of a device's offline queue, sent once the network is back:
 * POST /api/v1/arbeitszeit/stempelungen/offline. The signature is checked against the device's key;
 * the same entry again answers 200 with the stamp it made, another entry under the same number 409.
 */
export const offlineRouten = (db: Db, schreibDb: SchreibDb, jetzt: () => number) =>
  new Hono<Anfrage>().post("/", async (c) => {
    const eingabe = await koerper(c, offlineSchema);
    if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
    const { art: stempelart, geraetZeitpunkt, gesendetAm, geraet } = eingabe.data;
    const geprueft = await signaturPruefen(
      db,
      c.get("betriebId"),
      c.get("nutzerId"),
      {
        geraetId: geraet.geraetId,
        nummer: geraet.nummer,
        art: stempelart,
        geraetZeitpunkt,
      },
      geraet.signatur,
    );
    if (!geprueft.ok) return signaturFehler(c, geprueft.grund);
    return antwort(
      c,
      offlineStempeln(db, schreibDb, kontextVon(c, jetzt), {
        art: stempelart,
        geraetZeitpunkt,
        gesendetAm,
        quelle: "app",
        signiert: geraet,
      }),
    );
  });
