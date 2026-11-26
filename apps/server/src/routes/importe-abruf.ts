import { istTag, plusTage, tagInBerlin } from "@soll/arbeitszeit";
import {
  abzugText,
  clockifyAbzugText,
  kimaiAbzugText,
  personioAbzugText,
  schichtplanerAbzugText,
  togglAbzugText,
} from "@soll/import";
import { Hono } from "hono";
import { z } from "zod";
import {
  type ClockifyDeps,
  type ClockodoDeps,
  clockifyAbrufen,
  clockodoAbrufen,
  crewmeisterAbrufen,
  type KimaiDeps,
  type KimaiFehler,
  kimaiAbrufen,
  MAX_BYTES,
  type PersonioDeps,
  papershiftAbrufen,
  personioAbrufen,
  plandayAbrufen,
  type SchichtplanerDeps,
  type TogglDeps,
  togglAbrufen,
} from "../modules/umzug/index.ts";
import type { Anfrage } from "./kontext.ts";
import { koerper, ungueltig } from "./projektzeit-gemeinsam.ts";

/*
 * The fetch of a tool's data over its API (BAULISTE.md S-703 Clockodo, S-705 Kimai, S-704 Personio,
 * S-706 Papershift, Planday, Crewmeister):
 * POST /api/v1/importe/abruf with the access and a period answers with the file the fetch became,
 * which the app then sends to preview, dry run and takeover like any file. The access is used for
 * this one request: it is not stored, not logged and in no answer (docs/plan.md, "API-Zugang eines
 * Werkzeugs").
 */

const zeitraum = { von: z.string().refine(istTag), bis: z.string().refine(istTag) };

export const abrufSchema = z.discriminatedUnion("quelle", [
  z
    .object({
      quelle: z.literal("clockodo"),
      zugang: z
        .object({
          // "Soll;<user>" goes to Clockodo as the application, at most 50 characters (SDK api.ts)
          nutzer: z.email().max(45),
          schluessel: z.string().min(1).max(200),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
  z
    .object({
      quelle: z.literal("kimai"),
      zugang: z
        .object({
          // the instance the owner names; kimai-adresse.ts decides whether it may be called
          instanz: z.string().trim().min(1).max(300),
          // a line break pasted with the token is dropped; kimai-abruf.ts refuses what cannot be sent
          token: z.string().trim().min(1).max(500),
          // only for a Kimai before API tokens (X-AUTH-USER); empty: the token as a bearer
          benutzer: z.string().trim().max(180).nullable().default(null),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
  z
    .object({
      quelle: z.literal("personio"),
      zugang: z
        .object({
          // the credentials of a custom integration; they go in a form, so any text can be sent
          clientId: z.string().trim().min(1).max(200),
          clientSecret: z.string().trim().min(1).max(500),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
  // S-706: the shift planners, each at its own address
  z
    .object({
      quelle: z.literal("papershift"),
      zugang: z.object({ token: z.string().trim().min(1).max(500) }).strict(),
      ...zeitraum,
    })
    .strict(),
  z
    .object({
      quelle: z.literal("planday"),
      zugang: z
        .object({
          // the app id goes as X-ClientId: visible ASCII only, refused before anything is sent
          appId: z
            .string()
            .trim()
            .regex(/^[\x21-\x7e]{1,100}$/),
          token: z.string().trim().min(1).max(2000),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
  z
    .object({
      quelle: z.literal("crewmeister"),
      zugang: z
        .object({ email: z.email().max(254), passwort: z.string().min(1).max(200) })
        .strict(),
      ...zeitraum,
    })
    .strict(),
  // S-707: solo time trackers
  z
    .object({
      quelle: z.literal("toggl"),
      zugang: z.object({ token: z.string().trim().min(1).max(500) }).strict(),
      ...zeitraum,
    })
    .strict(),
  z
    .object({
      quelle: z.literal("clockify"),
      zugang: z
        .object({
          schluessel: z.string().trim().min(1).max(500),
          region: z.enum(["global", "eu", "usa", "uk", "au"]).default("global"),
        })
        .strict(),
      ...zeitraum,
    })
    .strict(),
]);

export type AbrufDeps = {
  clockodo: ClockodoDeps;
  kimai: KimaiDeps;
  personio: PersonioDeps;
  schichtplaner: SchichtplanerDeps;
  toggl: TogglDeps;
  clockify: ClockifyDeps;
};

/** The longest period of one fetch: a year; a longer one is fetched in parts */
const MAX_TAGE = 366;
/** How far a shift planner's period may reach ahead: the coming plan and approved leave (S-706) */
const VORAUS_TAGE = 92;
const SCHICHTPLANER = new Set(["papershift", "planday", "crewmeister"]);

const STATUS = {
  adresse_ungueltig: 422,
  adresse_intern: 422,
  zugang_ungueltig: 422,
  weiterleitung: 502,
  zugang_abgelehnt: 422,
  rechte_fehlen: 422,
  zu_viele_anfragen: 429,
  nicht_erreichbar: 502,
  antwort_ungueltig: 502,
  antwort_zu_gross: 502,
  zu_viele: 422,
} as const;

type Eingabe = z.infer<typeof abrufSchema>;

/** A fetch's records as the text of its file, or why there is none */
const alsDatei = <T>(
  abruf: { ok: true; wert: T } | ({ ok: false } & KimaiFehler),
  text: (wert: T) => string,
) => (abruf.ok ? { ok: true as const, text: text(abruf.wert) } : abruf);

/** The fetch of the tool chosen; the shift planners give the same kind of file (S-706) */
const abrufen = async (deps: AbrufDeps, eingabe: Eingabe, heute: string) => {
  const zeitraum = { von: eingabe.von, bis: eingabe.bis };
  const bisHeute = { ...zeitraum, heute };
  switch (eingabe.quelle) {
    case "clockodo":
      return alsDatei(await clockodoAbrufen(deps.clockodo, eingabe.zugang, zeitraum), abzugText);
    case "kimai": {
      const zugang = { ...eingabe.zugang, benutzer: eingabe.zugang.benutzer || null };
      return alsDatei(await kimaiAbrufen(deps.kimai, zugang, zeitraum), kimaiAbzugText);
    }
    case "personio":
      return alsDatei(
        await personioAbrufen(deps.personio, eingabe.zugang, zeitraum),
        personioAbzugText,
      );
    case "papershift":
      return alsDatei(
        await papershiftAbrufen(deps.schichtplaner, eingabe.zugang, bisHeute),
        schichtplanerAbzugText,
      );
    case "planday":
      return alsDatei(
        await plandayAbrufen(deps.schichtplaner, eingabe.zugang, bisHeute),
        schichtplanerAbzugText,
      );
    case "crewmeister":
      return alsDatei(
        await crewmeisterAbrufen(deps.schichtplaner, eingabe.zugang, bisHeute),
        schichtplanerAbzugText,
      );
    case "toggl":
      return alsDatei(await togglAbrufen(deps.toggl, eingabe.zugang, zeitraum), togglAbzugText);
    case "clockify":
      return alsDatei(
        await clockifyAbrufen(deps.clockify, eingabe.zugang, zeitraum),
        clockifyAbzugText,
      );
  }
};

export const abrufRouten = (deps: AbrufDeps, jetzt: () => number) =>
  new Hono<Anfrage>().post("/", async (c) => {
    const eingabe = abrufSchema.safeParse(await koerper(c));
    if (!eingabe.success) return ungueltig(c);
    const { quelle, von, bis } = eingabe.data;
    const heute = tagInBerlin(jetzt());
    const spaetestens = SCHICHTPLANER.has(quelle) ? plusTage(heute, VORAUS_TAGE) : heute;
    if (
      bis < von ||
      bis > spaetestens ||
      plusTage(von, MAX_TAGE) <= bis ||
      (quelle === "toggl" && von < plusTage(heute, -89))
    )
      return c.json({ fehler: "zeitraum" }, 422);
    const abruf = await abrufen(deps, eingabe.data, heute);
    if (!abruf.ok) {
      const { ok: _, grund, ...rest } = abruf;
      return c.json({ fehler: grund, ...rest }, STATUS[grund]);
    }
    const bytes = Buffer.from(abruf.text, "utf8");
    if (bytes.length > MAX_BYTES) return c.json({ fehler: "zu_gross" }, 413);
    return c.json({
      datei: { name: `${quelle}-${von}-${bis}.jsonl`, inhalt: bytes.toString("base64") },
    });
  });
