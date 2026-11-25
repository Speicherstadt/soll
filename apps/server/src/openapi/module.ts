import type { z } from "zod";
import * as dienstplan from "../routes/dienstplan.ts";
import * as kalender from "../routes/dienstplan-kalender.ts";
import * as tausch from "../routes/dienstplan-tausch.ts";
import * as kunden from "../routes/kunden.ts";
import * as projekte from "../routes/projekte.ts";
import * as saetze from "../routes/saetze.ts";
import * as taetigkeiten from "../routes/taetigkeiten.ts";
import type { Operation } from "./dokument.ts";

export type Kurz = Omit<Operation, "bereich">;

export const unter = (basis: string, bereich: string, operationen: Kurz[]): Operation[] =>
  operationen.map((op) => ({ ...op, pfad: `${basis}${op.pfad}`, bereich }));

export const STATUS: Kurz = {
  methode: "get",
  pfad: "/status",
  zusammenfassung: "Ob das Modul eingeschaltet ist",
};

/** A list of the business with create, change and delete, as the module project time has it */
const liste = (
  pfad: string,
  id: string,
  wort: { viele: string; eins: string },
  schemas: { neu: z.ZodType; aenderung: z.ZodType },
): Kurz[] => [
  { methode: "get", pfad, zusammenfassung: `Die ${wort.viele} des Betriebs` },
  { methode: "post", pfad, zusammenfassung: `${wort.eins} anlegen`, koerper: schemas.neu },
  {
    methode: "patch",
    pfad: `${pfad}/:${id}`,
    zusammenfassung: `${wort.eins} ändern oder archivieren`,
    koerper: schemas.aenderung,
  },
  { methode: "delete", pfad: `${pfad}/:${id}`, zusammenfassung: `${wort.eins} entfernen` },
];

/** The shift plan: week, templates, demand, shifts, publishing and the own calendar feed */
export const DIENSTPLAN: readonly Operation[] = unter("/api/v1/dienstplan", "Dienstplan", [
  STATUS,
  {
    methode: "get",
    pfad: "/woche",
    zusammenfassung: "Eine Woche des Plans an einem Standort",
    abfrage: dienstplan.wocheSchema,
  },
  { methode: "get", pfad: "/vorlagen", zusammenfassung: "Die Schichtvorlagen" },
  {
    methode: "post",
    pfad: "/vorlagen",
    zusammenfassung: "Eine Schichtvorlage anlegen",
    koerper: dienstplan.vorlageSchema,
  },
  {
    methode: "put",
    pfad: "/vorlagen/:vorlageId",
    zusammenfassung: "Eine Schichtvorlage ändern",
    koerper: dienstplan.vorlageSchema,
  },
  {
    methode: "delete",
    pfad: "/vorlagen/:vorlageId",
    zusammenfassung: "Eine Schichtvorlage entfernen",
  },
  {
    methode: "get",
    pfad: "/bedarf",
    zusammenfassung: "Der Bedarf je Rolle an einem Standort",
    abfrage: dienstplan.standortFrage,
  },
  {
    methode: "post",
    pfad: "/bedarf",
    zusammenfassung: "Einen Bedarf anlegen",
    koerper: dienstplan.bedarfSchema,
  },
  { methode: "delete", pfad: "/bedarf/:bedarfId", zusammenfassung: "Einen Bedarf entfernen" },
  {
    methode: "post",
    pfad: "/schichten",
    zusammenfassung: "Eine Schicht planen",
    koerper: dienstplan.schichtSchema,
  },
  {
    methode: "patch",
    pfad: "/schichten/:schichtId",
    zusammenfassung: "Eine Schicht ändern oder verschieben",
    koerper: dienstplan.aenderungSchema,
  },
  { methode: "delete", pfad: "/schichten/:schichtId", zusammenfassung: "Eine Schicht entfernen" },
  {
    methode: "post",
    pfad: "/veroeffentlichen",
    zusammenfassung: "Die Entwürfe einer Woche an einem Standort veröffentlichen",
    koerper: dienstplan.veroeffentlichenSchema,
  },
  { methode: "get", pfad: "/kalender", zusammenfassung: "Ob der eigene Kalender-Feed besteht" },
  {
    methode: "post",
    pfad: "/kalender",
    zusammenfassung: "Den eigenen Kalender-Feed (neu) ausstellen, nur mit Sitzung",
    koerper: kalender.kalenderSchema,
  },
  {
    methode: "delete",
    pfad: "/kalender",
    zusammenfassung: "Den eigenen Kalender-Feed widerrufen, nur mit Sitzung",
  },
  { methode: "get", pfad: "/tausch", zusammenfassung: "Die Tausche von Schichten, die man sieht" },
  {
    methode: "post",
    pfad: "/tausch",
    zusammenfassung: "Eine eigene veröffentlichte Schicht zum Tausch anbieten",
    koerper: tausch.angebotSchema,
  },
  {
    methode: "put",
    pfad: "/tausch/regel",
    zusammenfassung: "Ob ein Tausch ohne Freigabe gilt (Inhaber)",
    koerper: tausch.tauschregelSchema,
  },
  {
    methode: "post",
    pfad: "/tausch/:tauschId/uebernehmen",
    zusammenfassung: "Ein Angebot übernehmen",
  },
  {
    methode: "post",
    pfad: "/tausch/:tauschId/freigeben",
    zusammenfassung: "Einen übernommenen Tausch freigeben",
  },
  {
    methode: "post",
    pfad: "/tausch/:tauschId/ablehnen",
    zusammenfassung: "Einen offenen Tausch mit Grund ablehnen",
    koerper: tausch.ablehnungSchema,
  },
  {
    methode: "delete",
    pfad: "/tausch/:tauschId",
    zusammenfassung: "Ein eigenes Angebot zurückziehen",
  },
]);

/** Project time: customers, orders, activities, hourly rates */
export const PROJEKTZEIT: readonly Operation[] = unter("/api/v1/projektzeit", "Projektzeit", [
  STATUS,
  ...liste(
    "/kunden",
    "kundeId",
    { viele: "Kunden", eins: "Einen Kunden" },
    {
      neu: kunden.neuSchema,
      aenderung: kunden.aenderungSchema,
    },
  ),
  ...liste(
    "/projekte",
    "projektId",
    { viele: "Aufträge", eins: "Einen Auftrag" },
    {
      neu: projekte.neuSchema,
      aenderung: projekte.aenderungSchema,
    },
  ),
  ...liste(
    "/taetigkeiten",
    "taetigkeitId",
    { viele: "Tätigkeiten", eins: "Eine Tätigkeit" },
    {
      neu: taetigkeiten.neuSchema,
      aenderung: taetigkeiten.aenderungSchema,
    },
  ),
  { methode: "get", pfad: "/saetze", zusammenfassung: "Die Stundensätze (Inhaber, Planer)" },
  {
    methode: "get",
    pfad: "/saetze/personen",
    zusammenfassung: "Die Personen, für die ein Satz gelten kann",
  },
  {
    methode: "get",
    pfad: "/saetze/gilt",
    zusammenfassung: "Der Satz, der an einem Tag gilt",
    abfrage: saetze.giltSchema,
  },
  {
    methode: "post",
    pfad: "/saetze",
    zusammenfassung: "Einen Stundensatz anlegen",
    koerper: saetze.neuSchema,
  },
  { methode: "delete", pfad: "/saetze/:satzId", zusammenfassung: "Einen Stundensatz entfernen" },
]);
