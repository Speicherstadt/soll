import * as ruf from "../routes/dienstplan-rufdienste.ts";
import * as einsaetze from "../routes/einsaetze.ts";
import { unter } from "./module.ts";

/** Rufbereitschaft in the plan, call-outs from it and the Soll from the plan (S-505) */
export const RUFBEREITSCHAFT = [
  ...unter("/api/v1/dienstplan", "Dienstplan", [
    {
      methode: "post",
      pfad: "/rufdienste",
      zusammenfassung: "Eine Rufbereitschaft planen",
      koerper: ruf.rufdienstSchema,
    },
    {
      methode: "patch",
      pfad: "/rufdienste/:rufdienstId",
      zusammenfassung: "Eine Rufbereitschaft ändern",
      koerper: ruf.rufAenderungSchema,
    },
    {
      methode: "delete",
      pfad: "/rufdienste/:rufdienstId",
      zusammenfassung: "Eine Rufbereitschaft entfernen",
    },
  ]),
  ...unter("/api/v1/arbeitszeit", "Arbeitszeit", [
    {
      methode: "get",
      pfad: "/einsaetze",
      zusammenfassung:
        "Die Einsätze eines Monats, die laufende Rufbereitschaft und der laufende Einsatz",
      abfrage: einsaetze.frageSchema,
    },
    {
      methode: "post",
      pfad: "/einsaetze/beginnen",
      zusammenfassung: "Einen Einsatz jetzt beginnen",
    },
    {
      methode: "post",
      pfad: "/einsaetze/beenden",
      zusammenfassung: "Den laufenden Einsatz beenden",
    },
    {
      methode: "post",
      pfad: "/einsaetze",
      zusammenfassung: "Einen Einsatz mit Grund nachtragen",
      koerper: einsaetze.nachtragSchema,
    },
    {
      methode: "post",
      pfad: "/einsaetze/:einsatzId/entfernen",
      zusammenfassung: "Einen Einsatz mit Grund entfernen",
      koerper: einsaetze.entfernenSchema,
    },
    {
      methode: "get",
      pfad: "/sollquellen",
      zusammenfassung: "Woher das Soll kommt, ab welchem Tag",
    },
    {
      methode: "put",
      pfad: "/sollquellen",
      zusammenfassung: "Das Soll ab einem Tag aus dem Modell oder dem Plan nehmen (Inhaber)",
      koerper: einsaetze.quelleSchema,
    },
  ]),
];
