import { type Context, Hono } from "hono";
import { z } from "zod";

/*
 * A stand-in for Haben's REST API (CLAUDE.md: what the outside world provides is replaced in tests),
 * built from Haben's documentation, docs/api.md in firsttris/haben (state of 20.11.2026), and the
 * schemas it names (apps/web/src/server/modules/api/leistungen-schemas.ts): Bearer token with rights,
 * the error form `{ error: { code, message, issues? } }`, lists with `limit`, `offset` and `total`,
 * `GET /kontakte`, `GET /kontakte/{id}` and `POST /leistungen`, repeatable with `source` and
 * `externalId` (201 new, 200 with the updated entry; an entry on an invoice stays as it is).
 * It answers through `fetch`, so no network is used; `stoeren` makes the next calls fail.
 */

export type ErsatzKontakt = {
  id: string;
  name: string;
  kundennummer: string | null;
  archived?: boolean;
  /** docs/api.md: "Der Kontakt muss ein Kunde und darf nicht archiviert sein, sonst 422" */
  isCustomer?: boolean;
  hourlyRateCents?: number | null;
};

export type ErsatzLeistung = {
  id: string;
  contactId: string;
  workedOn: string;
  minutes: number;
  description: string;
  hourlyRateCents: number | null;
  nonBillable: boolean;
  billableMinutes: number | null;
  project: string;
  source: string | null;
  externalId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: "draft" | "final" | null;
};

/** A failure of the next call: an HTTP status of Haben, or no answer at all */
export type Stoerung = 400 | 401 | 403 | 422 | 429 | 500 | 503 | "netz";

const LEISTUNGEN_LESEN = ["leistungen:lesen", "leistungen:schreiben"];
const KONTAKTE_LESEN = ["kontakte:lesen", "kontakte:schreiben"];

const fehler = (c: Context, status: number, code: string, message: string) =>
  c.json({ error: { code, message } }, status as 400);

/** serviceEntryCreateSchema of Haben: strict, minutes 1 to 1440, source and externalId together */
const leistungSchema = z
  .object({
    contactId: z.uuid(),
    workedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    minutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60),
    description: z.string().trim().max(2000).optional(),
    hourlyRateCents: z.number().int().min(0).max(10_000_000).optional(),
    nonBillable: z.boolean().optional(),
    billableMinutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .nullable()
      .optional(),
    project: z.string().trim().max(200).optional(),
    source: z.string().trim().min(1).max(40).optional(),
    externalId: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((v) => (v.source === undefined) === (v.externalId === undefined), {
    message: "Quelle und Kennung gehören zusammen",
    path: ["externalId"],
  });

const kontaktFrage = z
  .object({
    q: z.string().trim().max(200).optional(),
    archived: z.enum(["true", "false"]).default("false"),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

const alsKontakt = (k: ErsatzKontakt, basis: string) => ({
  id: k.id,
  kundennummer: k.kundennummer,
  name: k.name,
  strasse: "",
  plz: "",
  ort: "",
  land: "DE",
  email: "",
  hourlyRateCents: k.hourlyRateCents ?? null,
  archived: k.archived ?? false,
  version: 1,
  url: `${basis}/kontakte/${k.id}`,
});

type Zustand = {
  token: string;
  rechte: string[];
  kontakte: ErsatzKontakt[];
  leistungen: ErsatzLeistung[];
  stoerungen: Stoerung[];
  anfragen: { methode: string; pfad: string; koerper: unknown }[];
};

const vorhanden = (zs: Zustand, eingabe: z.infer<typeof leistungSchema>) =>
  eingabe.source === undefined
    ? undefined
    : zs.leistungen.find((l) => l.source === eingabe.source && l.externalId === eingabe.externalId);

/** docs/api.md: missing fields keep the values of an existing entry; one on an invoice stays */
const aktualisiert = (alt: ErsatzLeistung, e: z.infer<typeof leistungSchema>): ErsatzLeistung =>
  alt.invoiceId !== null
    ? alt
    : {
        ...alt,
        contactId: e.contactId,
        workedOn: e.workedOn,
        minutes: e.minutes,
        description: e.description ?? alt.description,
        hourlyRateCents: e.hourlyRateCents ?? alt.hourlyRateCents,
        nonBillable: e.nonBillable ?? alt.nonBillable,
        billableMinutes: e.billableMinutes === undefined ? alt.billableMinutes : e.billableMinutes,
        project: e.project ?? alt.project,
      };

const leistungAnlegen = (zs: Zustand, e: z.infer<typeof leistungSchema>, satz: number | null) => {
  const neu: ErsatzLeistung = {
    id: crypto.randomUUID(),
    contactId: e.contactId,
    workedOn: e.workedOn,
    minutes: e.minutes,
    description: e.description ?? "",
    hourlyRateCents: e.hourlyRateCents ?? satz,
    nonBillable: e.nonBillable ?? false,
    billableMinutes: e.billableMinutes ?? null,
    project: e.project ?? "",
    source: e.source ?? null,
    externalId: e.externalId ?? null,
    invoiceId: null,
    invoiceNumber: null,
    invoiceStatus: null,
  };
  zs.leistungen.push(neu);
  return neu;
};

const app = (zs: Zustand, basis: string) => {
  const darf = (c: Context, rechte: string[]) => {
    if (c.req.header("authorization") !== `Bearer ${zs.token}`)
      return fehler(c, 401, "unauthorized", "Kein gültiges Token.");
    if (!rechte.some((recht) => zs.rechte.includes(recht)))
      return fehler(c, 403, "forbidden", `Dem Token fehlt das Recht ${rechte[0]}.`);
    return null;
  };
  return new Hono()
    .basePath("/api/v1")
    .get("/kontakte", (c) => {
      const abgelehnt = darf(c, KONTAKTE_LESEN);
      if (abgelehnt) return abgelehnt;
      const frage = kontaktFrage.safeParse(c.req.query());
      if (!frage.success) return fehler(c, 400, "validation_failed", "Ungültige Eingabe.");
      const { q, archived, limit, offset } = frage.data;
      const passend = zs.kontakte.filter(
        (k) =>
          (archived === "true" || !k.archived) &&
          (!q || `${k.name} ${k.kundennummer ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      );
      const data = passend.slice(offset, offset + limit).map((k) => alsKontakt(k, basis));
      return c.json({ data, total: passend.length, limit, offset });
    })
    .get("/kontakte/:id", (c) => {
      const abgelehnt = darf(c, KONTAKTE_LESEN);
      if (abgelehnt) return abgelehnt;
      const kontakt = zs.kontakte.find((k) => k.id === c.req.param("id"));
      return kontakt
        ? c.json(alsKontakt(kontakt, basis))
        : fehler(c, 404, "not_found", "Kontakt nicht gefunden.");
    })
    .post("/leistungen", async (c) => {
      const abgelehnt = darf(c, ["leistungen:schreiben"]);
      if (abgelehnt) return abgelehnt;
      const koerper = await c.req.json().catch(() => undefined);
      if (koerper === undefined) return fehler(c, 400, "invalid_json", "Kein gültiges JSON.");
      const eingabe = leistungSchema.safeParse(koerper);
      if (!eingabe.success) return fehler(c, 400, "validation_failed", "Ungültige Eingabe.");
      const kontakt = zs.kontakte.find((k) => k.id === eingabe.data.contactId);
      if (!kontakt || kontakt.archived || kontakt.isCustomer === false)
        return fehler(c, 422, "unprocessable", "Der Kontakt ist kein aktiver Kunde.");
      const alt = vorhanden(zs, eingabe.data);
      if (alt) {
        const neu = aktualisiert(alt, eingabe.data);
        zs.leistungen[zs.leistungen.indexOf(alt)] = neu;
        return c.json(neu, 200);
      }
      const neu = leistungAnlegen(zs, eingabe.data, kontakt.hourlyRateCents ?? null);
      c.header("Location", `/api/v1/leistungen/${neu.id}`);
      return c.json(neu, 201);
    })
    .get("/leistungen", (c) => {
      const abgelehnt = darf(c, LEISTUNGEN_LESEN);
      if (abgelehnt) return abgelehnt;
      return c.json({ data: zs.leistungen, total: zs.leistungen.length, limit: 500, offset: 0 });
    });
};

/**
 * A Haben at `basis` (e.g. https://haben.test) with an API token and its rights; `fetch` answers
 * for it, `stoeren` lets the next calls fail (an HTTP status or no answer), `rechnen` puts an entry
 * on an invoice
 */
export const habenErsatz = (
  optionen: { basis?: string; token?: string; rechte?: string[]; kontakte?: ErsatzKontakt[] } = {},
) => {
  const basis = optionen.basis ?? "https://haben.test";
  const zustand: Zustand = {
    token: optionen.token ?? "hb_ersatz",
    rechte: optionen.rechte ?? ["kontakte:lesen", "leistungen:schreiben"],
    kontakte: [...(optionen.kontakte ?? [])],
    leistungen: [],
    stoerungen: [],
    anfragen: [],
  };
  const hono = app(zustand, basis);
  const fetch = async (eingabe: string | URL | Request, init?: RequestInit) => {
    const anfrage = new Request(eingabe, init);
    const url = new URL(anfrage.url);
    if (url.origin !== new URL(basis).origin) throw new TypeError("fetch failed");
    const koerper =
      anfrage.method === "POST"
        ? await anfrage
            .clone()
            .json()
            .catch(() => null)
        : null;
    zustand.anfragen.push({ methode: anfrage.method, pfad: url.pathname + url.search, koerper });
    const stoerung = zustand.stoerungen.shift();
    if (stoerung === "netz") throw new TypeError("fetch failed");
    if (stoerung !== undefined)
      return new Response(
        JSON.stringify({ error: { code: "gestoert", message: `Störung ${stoerung}` } }),
        {
          status: stoerung,
          headers: {
            "content-type": "application/json",
            ...(stoerung === 429 ? { "retry-after": "60" } : {}),
          },
        },
      );
    return hono.request(anfrage);
  };
  return {
    basis,
    token: zustand.token,
    fetch: fetch as typeof globalThis.fetch,
    leistungen: () => zustand.leistungen,
    anfragen: () => zustand.anfragen,
    kontakte: zustand.kontakte,
    stoeren: (...stoerungen: Stoerung[]) => {
      zustand.stoerungen.push(...stoerungen);
    },
    rechte: (rechte: string[]) => {
      zustand.rechte = rechte;
    },
    rechnen: (leistungId: string) => {
      const eintrag = zustand.leistungen.find((l) => l.id === leistungId);
      if (eintrag)
        Object.assign(eintrag, { invoiceId: crypto.randomUUID(), invoiceStatus: "draft" });
    },
  };
};

export type HabenErsatz = ReturnType<typeof habenErsatz>;
