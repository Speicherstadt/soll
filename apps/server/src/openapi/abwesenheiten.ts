import * as abwesenheiten from "../routes/abwesenheiten.ts";
import * as lesen from "../routes/abwesenheiten-lesen.ts";
import * as konten from "../routes/konten.ts";
import type { Operation } from "./dokument.ts";

const ABW = "/api/v1/arbeitszeit/abwesenheiten";
const bereich = "Abwesenheiten";

type Kurz = Omit<Operation, "bereich" | "pfad"> & { pfad: string };

/**
 * Absences in the module working time (S-401): requests, sickness, decisions and the certificate;
 * who sees the kind of another person's absence follows docs/abwesenheiten.md ("Wer sieht krank")
 */
export const ABWESENHEITEN: readonly Operation[] = (
  [
    {
      methode: "get",
      pfad: "",
      zusammenfassung: "Die Abwesenheiten einer Person im Jahr mit Resturlaub und Kind krank",
      abfrage: lesen.listeSchema,
    },
    {
      methode: "get",
      pfad: "/offen",
      zusammenfassung: "Offene Anträge zur Entscheidung und fällige Bescheinigungen",
    },
    {
      methode: "get",
      pfad: "/team",
      zusammenfassung: "Wer im Zeitraum abwesend ist, ohne Art, mit den Feiertagen eines Standorts",
      abfrage: lesen.teamSchema,
    },
    {
      methode: "post",
      pfad: "/antrag",
      zusammenfassung: "Urlaub, Sonderurlaub oder Überstundenabbau beantragen",
      koerper: abwesenheiten.antragSchema,
    },
    {
      methode: "post",
      pfad: "/krank",
      zusammenfassung: "Sich oder ein Kind ab heute krank melden, ohne Diagnose",
      koerper: abwesenheiten.krankSchema,
    },
    {
      methode: "post",
      pfad: "/:id/freigeben",
      zusammenfassung: "Einen Antrag freigeben (Inhaber, Planer)",
      koerper: abwesenheiten.leerSchema,
    },
    {
      methode: "post",
      pfad: "/:id/ablehnen",
      zusammenfassung: "Einen Antrag mit Grund ablehnen (Inhaber, Planer)",
      koerper: abwesenheiten.grundSchema,
    },
    {
      methode: "post",
      pfad: "/:id/zurueckziehen",
      zusammenfassung: "Den eigenen offenen Antrag zurückziehen",
      koerper: abwesenheiten.leerSchema,
    },
    {
      methode: "post",
      pfad: "/:id/stornieren",
      zusammenfassung: "Eine genehmigte Abwesenheit mit Grund stornieren",
      koerper: abwesenheiten.grundSchema,
    },
    {
      methode: "post",
      pfad: "/:id/bescheinigung",
      zusammenfassung: "Markieren, dass die Bescheinigung vorliegt (eAU oder Papier)",
      koerper: abwesenheiten.bescheinigungSchema,
    },
    {
      methode: "post",
      pfad: "/:id/beenden",
      zusammenfassung: "Den letzten Tag einer Krankheit eintragen",
      koerper: abwesenheiten.beendenSchema,
    },
    {
      methode: "put",
      pfad: "/einstellungen",
      zusammenfassung: "Ab welchem Krankheitstag die Bescheinigung fällig ist (Inhaber)",
      koerper: abwesenheiten.einstellungSchema,
    },
  ] satisfies Kurz[]
).map((op) => ({ ...op, pfad: `${ABW}${op.pfad}`, bereich }));

const KONTEN = "/api/v1/arbeitszeit/konten";

/**
 * The accounts of a person (S-402): leave with carry-over and expiry, overtime, the changes by hand
 * and the notices on leave expiring
 */
export const KONTEN_OPERATIONEN: readonly Operation[] = (
  [
    {
      methode: "get",
      pfad: "",
      zusammenfassung: "Resturlaub mit Verfall und Überstundenkonto einer Person",
      abfrage: konten.kontoSchema,
    },
    {
      methode: "post",
      pfad: "/:nutzerId/anpassungen",
      zusammenfassung: "Startsaldo, Auszahlung oder Korrektur eines Kontos eintragen (Inhaber)",
      koerper: konten.anpassungSchema,
    },
    {
      methode: "post",
      pfad: "/:nutzerId/hinweise",
      zusammenfassung: "Den Tag des Hinweises auf den Verfall von Urlaub festhalten (Inhaber)",
      koerper: konten.hinweisSchema,
    },
  ] satisfies Kurz[]
).map((op) => ({ ...op, pfad: `${KONTEN}${op.pfad}`, bereich: "Konten" }));
