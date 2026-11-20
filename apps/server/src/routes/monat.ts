import {
  beginnInBerlin,
  ersterTag,
  istMonat,
  istTag,
  letzterTag,
  type Monat,
  plusTage,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { monatText, type Stundenzettel, stundenzettelPdf } from "@soll/export";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { Db, SchreibDb } from "../db/oeffnen.ts";
import {
  aenderungenIn,
  gegeneintragAnlegen,
  type MonatStatus,
  monatAbschliessen,
  monatBestaetigen,
  monatStatus,
  type SchrittErgebnis,
  stundenzettelAus,
} from "../modules/arbeitszeit/index.ts";
import { betriebLesen } from "../modules/betrieb/index.ts";
import { type Mailer, zustellbar } from "../modules/mail/index.ts";
import { adresseVon, namenVon } from "../modules/mitglieder/index.ts";
import { type Anfrage, recht } from "./kontext.ts";
import { koerper, kontextVon } from "./stempel-antwort.ts";
import { liestEigene, person } from "./zeiten.ts";

const monat = z.string().refine(istMonat);
const id = z.string().min(1).max(100);
const grund = z.string().trim().min(1).max(500);

const lesenSchema = z.object({ monat, nutzerId: id.optional() }).strict();
const bestaetigenSchema = z.object({ monat }).strict();
const abschliessenSchema = z.object({ monat, nutzerId: id, grund: grund.optional() }).strict();
const gegeneintragSchema = z
  .object({
    nutzerId: id,
    tag: z.string().refine(istTag),
    // whole minutes with a sign, at most a day; 0 changes nothing
    minuten: z
      .number()
      .int()
      .min(-24 * 60)
      .max(24 * 60)
      .refine((wert) => wert !== 0),
    grund,
  })
  .strict();

const STATUS = {
  monat_laeuft: 409,
  abgeschlossen: 409,
  offene_schicht: 409,
  bestaetigung_fehlt: 409,
  schicht_kann_weiterlaufen: 409,
} as const;

/** The days with a change by hand, so the sheet marks them (DESIGN.md, "Monatsabschluss") */
const geaenderteTage = (db: Db, betriebId: string, nutzerId: string, m: Monat) =>
  [
    ...new Set(
      aenderungenIn(
        db,
        betriebId,
        nutzerId,
        beginnInBerlin(ersterTag(m)),
        beginnInBerlin(plusTage(letzterTag(m), 1)),
      ).flatMap((aenderung) =>
        [aenderung.vorher, aenderung.nachher].flatMap((stempel) =>
          stempel === null ? [] : [tagInBerlin(stempel.zeitpunkt)],
        ),
      ),
    ),
  ]
    .filter((tag) => tag.startsWith(m))
    .sort();

/** A month as the app shows it, with the names of who confirmed, closed and corrected */
const ansicht = (db: Db, c: Context<Anfrage>, nutzerId: string, status: MonatStatus) => {
  const betriebId = c.get("betriebId");
  const ids = [nutzerId, status.bestaetigung?.von, status.abschluss?.von].filter(
    (wert): wert is string => wert !== undefined,
  );
  const namen = namenVon(db, ids);
  return {
    ...status,
    nutzerId,
    /** whether the month is the caller's own: only they confirm it */
    eigen: nutzerId === c.get("nutzerId"),
    name: namen.get(nutzerId) ?? "",
    bestaetigung: status.bestaetigung && {
      ...status.bestaetigung,
      vonName: namen.get(status.bestaetigung.von) ?? "",
    },
    abschluss: status.abschluss && {
      ...status.abschluss,
      vonName: namen.get(status.abschluss.von) ?? "",
    },
    geaenderteTage: geaenderteTage(db, betriebId, nutzerId, status.monat),
  };
};

/** Where a person checks their Prüfwert: the check page of the app, for this business */
const pruefseiteVon = (url: string, betriebId: string) =>
  `${url}/pruefen?betrieb=${encodeURIComponent(betriebId)}`;

const zettelVon = (
  db: Db,
  c: Context<Anfrage>,
  nutzerId: string,
  status: MonatStatus,
  url: string,
  jetzt: number,
): Stundenzettel => {
  const ids = [nutzerId, status.bestaetigung?.von, status.abschluss?.von].filter(
    (wert): wert is string => wert !== undefined,
  );
  const namen = namenVon(db, ids);
  return stundenzettelAus(status, {
    betrieb: betriebLesen(db, c.get("betriebId"))?.name ?? "",
    person: namen.get(nutzerId) ?? "",
    name: (wer) => namen.get(wer) ?? "",
    pruefseite: pruefseiteVon(url, c.get("betriebId")),
    jetzt,
  });
};

const schrittAntwort = (
  db: Db,
  c: Context<Anfrage>,
  nutzerId: string,
  ergebnis: SchrittErgebnis,
) =>
  ergebnis.ok
    ? c.json(ansicht(db, c, nutzerId, ergebnis.status), 201)
    : c.json({ fehler: ergebnis.grund }, STATUS[ergebnis.grund]);

export type MailStatus = "gesendet" | "fehler" | "keine_adresse" | "nicht_eingerichtet";

/** The time sheet to the person by mail once the month is closed; the result says what happened */
const zettelSenden = async (
  db: Db,
  mail: Mailer | null,
  nutzerId: string,
  zettel: Stundenzettel,
): Promise<MailStatus> => {
  if (mail === null) return "nicht_eingerichtet";
  const an = adresseVon(db, nutzerId);
  if (!zustellbar(an)) return "keine_adresse";
  const pdf = await stundenzettelPdf(zettel);
  const ergebnis = await mail({
    an,
    betreff: `Dein Stundenzettel ${monatText(zettel.monat)} · ${zettel.betrieb}`,
    text: [
      `Hallo ${zettel.person},`,
      "",
      `dein Monat ${monatText(zettel.monat)} bei ${zettel.betrieb} ist abgeschlossen. Im Anhang ist dein Stundenzettel.`,
      "",
      `Prüfwert: ${zettel.pruefwert ?? ""}`,
      "",
      "Bewahre ihn auf. Auf der Prüfseite siehst du jederzeit, ob sich an diesem Monat etwas geändert hat:",
      zettel.pruefseite,
      "",
    ].join("\n"),
    anhang: { name: `stundenzettel-${zettel.monat}.pdf`, inhalt: pdf, typ: "application/pdf" },
  });
  return ergebnis.ok ? "gesendet" : "fehler";
};

/**
 * Closing a month, below /api/v1/arbeitszeit/monat (S-306): reading a month and its time sheet as
 * the day view allows, confirming one's own month, closing by the owner, counter-entries to closed
 * months by owner and planner.
 */
export const monatRouten = (
  db: Db,
  schreibDb: SchreibDb,
  jetzt: () => number,
  optionen: { url: string; mail: Mailer | null },
) => {
  /** The month a call reads: oneself, or a person whose times the caller may see */
  const lesbar = (c: Context<Anfrage>) => {
    const eingabe = lesenSchema.safeParse(c.req.query());
    if (!eingabe.success) return { ok: false as const, status: 400 as const, fehler: "ungueltig" };
    const wer = person(db, c, eingabe.data.nutzerId, "zeiten:alle");
    if (!wer.ok) return { ok: false as const, status: wer.status, fehler: wer.fehler };
    if (wer.nutzerId === c.get("nutzerId") && !liestEigene(db, c))
      return { ok: false as const, status: 403 as const, fehler: "keine_berechtigung" };
    const status = monatStatus(db, c.get("betriebId"), wer.nutzerId, eingabe.data.monat, jetzt());
    return { ok: true as const, nutzerId: wer.nutzerId, status };
  };

  return new Hono<Anfrage>()
    .get("/", (c) => {
      const gelesen = lesbar(c);
      if (!gelesen.ok) return c.json({ fehler: gelesen.fehler }, gelesen.status);
      return c.json(ansicht(db, c, gelesen.nutzerId, gelesen.status));
    })
    .get("/stundenzettel", async (c) => {
      const gelesen = lesbar(c);
      if (!gelesen.ok) return c.json({ fehler: gelesen.fehler }, gelesen.status);
      const zettel = zettelVon(db, c, gelesen.nutzerId, gelesen.status, optionen.url, jetzt());
      const pdf = await stundenzettelPdf(zettel);
      return c.body(pdf.slice().buffer, 200, {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="stundenzettel-${zettel.monat}.pdf"`,
      });
    })
    .post("/bestaetigen", recht("stempeln"), async (c) => {
      const eingabe = await koerper(c, bestaetigenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const ergebnis = monatBestaetigen(db, schreibDb, kontextVon(c, jetzt), eingabe.data.monat);
      return schrittAntwort(db, c, c.get("nutzerId"), ergebnis);
    })
    .post("/abschliessen", recht("monat:abschliessen"), async (c) => {
      const eingabe = await koerper(c, abschliessenSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = person(db, c, eingabe.data.nutzerId, "zeiten:alle");
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const kontext = kontextVon(c, jetzt);
      const ergebnis = monatAbschliessen(db, schreibDb, kontext, {
        nutzerId: wer.nutzerId,
        monat: eingabe.data.monat,
        grund: eingabe.data.grund ?? null,
      });
      if (!ergebnis.ok)
        return c.json({ fehler: ergebnis.grund, ab: ergebnis.ab }, STATUS[ergebnis.grund]);
      const zettel = zettelVon(db, c, wer.nutzerId, ergebnis.status, optionen.url, kontext.jetzt);
      const mail = await zettelSenden(db, optionen.mail, wer.nutzerId, zettel);
      return c.json({ ...ansicht(db, c, wer.nutzerId, ergebnis.status), mail }, 201);
    })
    .post("/gegeneintrag", recht("zeiten:korrigieren"), async (c) => {
      const eingabe = await koerper(c, gegeneintragSchema);
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = person(db, c, eingabe.data.nutzerId, "zeiten:alle");
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      const ergebnis = gegeneintragAnlegen(db, schreibDb, kontextVon(c, jetzt), {
        ...eingabe.data,
        nutzerId: wer.nutzerId,
      });
      if (!ergebnis.ok) return c.json({ fehler: ergebnis.grund }, 409);
      return c.json({ korrekturId: ergebnis.korrekturId }, 201);
    });
};
