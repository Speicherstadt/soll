import type { Db } from "../../db/oeffnen.ts";
import { betriebLesen } from "../betrieb/index.ts";
import { namenVon } from "../mitglieder/index.ts";
import { type Arbeitsteil, arbeitsteil } from "./arbeit.ts";
import { type Erinnerungsteil, erinnerungsteil } from "./erinnerungen.ts";
import { type EigeneZeilen, kettenteil, pruefwerteJeAbschluss } from "./kette.ts";
import { type Projektteil, projektteil } from "./projektzeit.ts";

export { warMitglied } from "./kette.ts";
export { ABDECKUNG, INHABERKOPIE } from "./tabellen.ts";

import { kopieFuerInhaber } from "./inhaber.ts";
import { kontoteil } from "./konto.ts";
import { iso } from "./zeit.ts";

/*
 * The Auskunft under Art. 15 DSGVO (S-309): everything Soll keeps about a person in one business,
 * as JSON, without other people's data. It reads the tables of the other modules directly, read
 * only: it is the one place that has to see all of them, and auskunft.test.ts fails for a table it
 * neither covers nor names as excepted.
 */

/** Art. 15 Abs. 1 lit. a to h DSGVO: what the copy is accompanied by (docs/auskunft.md) */
const HINWEISE = {
  zwecke:
    "Erfassung der Arbeitszeit (§ 3 Abs. 2 Nr. 1 ArbSchG, BAG 1 ABR 22/21, § 16 Abs. 2 ArbZG, § 17 MiLoG), Prüfung nach dem Arbeitszeitgesetz, Monatsabschluss und Lohnabrechnung, Dienstplan.",
  rechtsgrundlage: "Art. 6 Abs. 1 lit. b und c DSGVO, Art. 88 DSGVO mit § 26 BDSG.",
  empfaenger:
    "Im Betrieb, wer nach seiner Rolle Zeiten sehen darf (Inhaber, Planer, Lohnbüro); außerhalb nur, wohin der Betrieb exportiert (Lohnbuchhaltung, Behörden auf Verlangen).",
  speicherdauer:
    "Aufzeichnungen der Arbeitszeit mindestens zwei Jahre (§ 16 Abs. 2 ArbZG, § 17 Abs. 1 MiLoG), Unterlagen der Lohnabrechnung bis zu zehn Jahre (§ 147 AO, § 41 EStG); danach werden die Inhalte entfernt, die Kette behält nur ihre Hashes.",
  rechte:
    "Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Widerspruch (Art. 21) beim Betrieb; Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO).",
  herkunft:
    "Von dir selbst (Stempelungen, Konto) und vom Betrieb (Änderungen mit Grund, Modelle, Dienstplan, Abschluss).",
  automatisierteEntscheidung:
    "Keine. Soll prüft Regeln und zeigt Befunde, entscheidet aber nichts über dich (Art. 22 DSGVO).",
};

const zeilenVon = (
  nutzerId: string,
  arbeit: Arbeitsteil,
  erinnerung: Erinnerungsteil,
  projekt: Projektteil,
  einladungen: { einladungId: string }[],
) =>
  ({
    pushAbos: erinnerung.pushAbos.map(({ aboId }) => ({ aboId })),
    erinnerungen: erinnerung.erinnerungen.map(({ erinnerungId }) => ({ erinnerungId })),
    erinnerungseinstellungen: [{ nutzerId }],
    stempelungen: arbeit.stempelungen.map(({ stempelId }) => ({ stempelId })),
    korrekturen: arbeit.gegeneintraege.map(({ korrekturId }) => ({ korrekturId })),
    monatsabschluesse: arbeit.monatsabschluesse.map(({ abschlussId }) => ({ abschlussId })),
    modellzuordnungen: arbeit.arbeitszeitmodelle.map(({ gueltigAb }) => ({ nutzerId, gueltigAb })),
    schichten: arbeit.schichten.map(({ schichtId }) => ({ schichtId })),
    geraete: arbeit.geraete.map(({ geraetId }) => ({ geraetId })),
    mitgliedschaften: [{ nutzerId }],
    pins: [{ nutzerId }],
    einladungen: einladungen.map(({ einladungId }) => ({ einladungId })),
    stundensaetze: projekt.stundensaetze.map(({ satzId }) => ({ satzId })),
    projektzeiten: projekt.projektzeiten.map(({ buchungId }) => ({ buchungId })),
  }) satisfies EigeneZeilen;

/** The names of who made an entry; the sign-in itself and a deleted account by what they are */
const namensgeber = (db: Db) => {
  const namen = new Map<string, string>();
  return (nutzerId: string) => {
    if (!namen.has(nutzerId))
      namen.set(nutzerId, namenVon(db, [nutzerId]).get(nutzerId) ?? "nicht mehr vorhanden");
    return namen.get(nutzerId) ?? "";
  };
};

/** The person's own copy: complete, everything Soll keeps about them in this business */
const eigeneAuskunft = (db: Db, betriebId: string, nutzerId: string, jetzt: number) => {
  const name = namensgeber(db);
  const konto = kontoteil(db, betriebId, nutzerId);
  const arbeit = arbeitsteil(db, betriebId, nutzerId, name);
  const erinnerung = erinnerungsteil(db, betriebId, nutzerId);
  const projekt = projektteil(db, betriebId, nutzerId);
  const kette = kettenteil(
    db,
    betriebId,
    nutzerId,
    zeilenVon(nutzerId, arbeit, erinnerung, projekt, konto.einladungen),
    name,
    iso,
  );
  const pruefwerte = pruefwerteJeAbschluss(kette.glieder);
  return {
    art: "Auskunft nach Art. 15 DSGVO",
    fassung: 1,
    erstelltAm: iso(jetzt),
    verantwortlicher: { betrieb: betriebLesen(db, betriebId)?.name ?? "", betriebId },
    person: { nutzerId, name: konto.konto?.name ?? "" },
    hinweise: HINWEISE,
    ...konto,
    ...arbeit,
    ...erinnerung,
    ...projekt,
    monatsabschluesse: arbeit.monatsabschluesse.map((abschluss) => ({
      ...abschluss,
      pruefwert:
        abschluss.schritt === "abgeschlossen"
          ? (pruefwerte.get(abschluss.abschlussId) ?? null)
          : null,
    })),
    auditKette: kette.teil,
  };
};

export type Auskunft = ReturnType<typeof eigeneAuskunft>;

/**
 * `fuerSich`: the person's own copy, complete; false when the owner gives it for someone else, then
 * only the parts on the owner's allowlist (inhaber.ts, tabellen.ts)
 */
export const auskunftVon = (
  db: Db,
  betriebId: string,
  nutzerId: string,
  angaben: { jetzt: number; fuerSich: boolean },
) => {
  const eigen = eigeneAuskunft(db, betriebId, nutzerId, angaben.jetzt);
  return angaben.fuerSich ? eigen : kopieFuerInhaber(eigen);
};
