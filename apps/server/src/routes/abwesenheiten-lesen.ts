import {
  GESUNDHEIT,
  istTag,
  jahrVon,
  type Tag,
  tageZwischen,
  tagInBerlin,
} from "@soll/arbeitszeit";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { darf } from "../auth/rollen.ts";
import type { Db } from "../db/oeffnen.ts";
import {
  abwesenheitenIn,
  bescheinigungAbTagVon,
  bescheinigungVon,
  erinnerungenVon,
  kinderkrankstand,
  sollGrundlagen,
  urlaubsstand,
  urlaubstageVon,
} from "../modules/arbeitszeit/index.ts";
import { mitgliederMitNamen, namenVon } from "../modules/mitglieder/index.ts";
import { sicht, siehtGesundheit } from "./abwesenheit-sicht.ts";
import type { Anfrage } from "./kontext.ts";
import { liestEigene, person } from "./zeiten.ts";

const id = z.string().min(1).max(100);
const tag = z.string().refine(istTag);
const jahr = z.coerce.number().int().min(2000).max(9999);
const listeSchema = z.object({ nutzerId: id.optional(), jahr: jahr.optional() }).strict();
const teamSchema = z.object({ von: tag, bis: tag }).strict();

/** The team calendar shows at most two months at once */
const TEAM_TAGE = 62;

/** A person's absences of a year with leave left, Kind krank and the certificates (S-401) */
const liste = (db: Db, c: Context<Anfrage>, nutzerId: string, imJahr: number, heute: Tag) => {
  const betriebId = c.get("betriebId");
  const gesundheit = siehtGesundheit(c, nutzerId);
  const zeilen = abwesenheitenIn(db, betriebId, {
    nutzerId,
    von: `${imJahr}-01-01`,
    bis: `${imJahr}-12-31`,
  });
  const grundlagen = sollGrundlagen(db, betriebId, nutzerId);
  const zaehlend = zeilen.filter((z) => z.status === "genehmigt" || z.status === "beantragt");
  return {
    nutzerId,
    name: namenVon(db, [nutzerId]).get(nutzerId) ?? "",
    jahr: imJahr,
    heute,
    bescheinigungAbTag: bescheinigungAbTagVon(db, betriebId),
    // what the caller may do, so the app shows only that; the server checks it on every call
    rechte: {
      freigeben: darf(c.get("rolle"), "abwesenheiten:freigeben"),
      gesundheit: darf(c.get("rolle"), "abwesenheiten:gesundheit"),
      einstellen: darf(c.get("rolle"), "abwesenheiten:einstellen"),
    },
    abwesenheiten: zeilen.map((zeile) => ({
      ...sicht(zeile, gesundheit, heute),
      // the leave days of a row would tell leave from sickness where its kind is not shown
      urlaubHalbtage:
        gesundheit || zeile.status === "beantragt" ? urlaubstageVon(grundlagen, zeile) : null,
      frist: gesundheit ? bescheinigungVon(db, zeile, heute, grundlagen) : null,
    })),
    urlaub: urlaubsstand(grundlagen, zaehlend, imJahr, heute),
    kinderkrank: gesundheit ? kinderkrankstand(grundlagen, zaehlend, imJahr, heute) : null,
  };
};

/**
 * The approved absences of everyone from `von` to `bis` as the team calendar and the plan show them:
 * every one only as „abwesend“, to everyone; were leave named, „abwesend“ would mean sickness
 * (Art. 9 DSGVO, S-401)
 */
const teamkalender = (
  db: Db,
  c: Context<Anfrage>,
  { von, bis }: { von: Tag; bis: Tag },
  heute: Tag,
) => {
  const freigeben = darf(c.get("rolle"), "abwesenheiten:freigeben");
  const siehtKrank = darf(c.get("rolle"), "abwesenheiten:gesundheit");
  const ich = c.get("nutzerId");
  const betriebId = c.get("betriebId");
  const mitglieder = new Map(mitgliederMitNamen(db, betriebId).map((m) => [m.nutzerId, m]));
  // an open end reaches no further than today, in every window: shown to the end of a window from
  // today but gone from one from tomorrow, it would tell itself apart from long leave, and only a
  // sickness has one (review S-401)
  const ende = (zeile: { bis: Tag | null }): Tag => {
    // days as text compare by their order, so no Math.min
    const bekannt = zeile.bis ?? heute;
    if (bekannt > bis) return bis;
    return bekannt;
  };
  return {
    von,
    bis,
    abwesenheiten: abwesenheitenIn(db, betriebId, { von, bis, status: ["genehmigt"] })
      .filter((zeile) => mitglieder.has(zeile.nutzerId) && ende(zeile) >= von)
      .map((zeile) => ({
        abwesenheitId: zeile.abwesenheitId,
        nutzerId: zeile.nutzerId,
        name: mitglieder.get(zeile.nutzerId)?.name ?? "",
        art: "abwesend" as const,
        von: zeile.von,
        bis: ende(zeile),
        ersterHalb: zeile.ersterHalb,
        letzterHalb: zeile.letzterHalb && zeile.bis !== null && zeile.bis <= bis,
        // whoever sees every kind cancels leave here; a planner only the leave they approved and so
        // knew (docs/plan.md, "Wer krank sieht")
        ...(freigeben
          ? {
              stornierbar:
                !GESUNDHEIT.has(zeile.art) && (siehtKrank || zeile.entschiedenVon === ich),
            }
          : {}),
      })),
  };
};

/**
 * Reading absences below /api/v1/arbeitszeit/abwesenheiten: one's own, a person's for whoever sees
 * all times, what waits for a decision or a certificate, and the team calendar with „abwesend“
 */
export const abwesenheitLeseRouten = (db: Db, jetzt: () => number) =>
  new Hono<Anfrage>()
    .get("/", (c) => {
      const eingabe = listeSchema.safeParse(c.req.query());
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const wer = person(db, c, eingabe.data.nutzerId, "zeiten:alle");
      if (!wer.ok) return c.json({ fehler: wer.fehler }, wer.status);
      if (wer.nutzerId === c.get("nutzerId") && !liestEigene(db, c))
        return c.json({ fehler: "keine_berechtigung" }, 403);
      const heute = tagInBerlin(jetzt());
      return c.json(liste(db, c, wer.nutzerId, eingabe.data.jahr ?? jahrVon(heute), heute));
    })
    .get("/offen", (c) => {
      const freigeben = darf(c.get("rolle"), "abwesenheiten:freigeben");
      const gesundheit = darf(c.get("rolle"), "abwesenheiten:gesundheit");
      if (!freigeben && !gesundheit) return c.json({ fehler: "keine_berechtigung" }, 403);
      const betriebId = c.get("betriebId");
      const heute = tagInBerlin(jetzt());
      const antraege = freigeben
        ? abwesenheitenIn(db, betriebId, {
            von: "0000-01-01",
            bis: "9999-12-31",
            status: ["beantragt"],
          })
        : [];
      const erinnerungen = gesundheit ? erinnerungenVon(db, betriebId, heute) : [];
      const namen = namenVon(
        db,
        [...antraege, ...erinnerungen].map((e) => e.nutzerId),
      );
      return c.json({
        antraege: antraege.map((zeile) => ({
          ...sicht(zeile, siehtGesundheit(c, zeile.nutzerId), heute),
          name: namen.get(zeile.nutzerId) ?? "",
          urlaubHalbtage: urlaubstageVon(sollGrundlagen(db, betriebId, zeile.nutzerId), zeile),
        })),
        erinnerungen: erinnerungen.map((e) => ({ ...e, name: namen.get(e.nutzerId) ?? "" })),
      });
    })
    .get("/team", (c) => {
      const eingabe = teamSchema.safeParse(c.req.query());
      if (!eingabe.success) return c.json({ fehler: "ungueltig" }, 400);
      const { von, bis } = eingabe.data;
      if (bis < von || tageZwischen(von, bis) >= TEAM_TAGE)
        return c.json({ fehler: "ungueltig" }, 400);
      if (!darf(c.get("rolle"), "stempeln") && !darf(c.get("rolle"), "zeiten:alle"))
        return c.json({ fehler: "keine_berechtigung" }, 403);
      return c.json(teamkalender(db, c, { von, bis }, tagInBerlin(jetzt())));
    });
