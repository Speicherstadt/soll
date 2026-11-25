import type { PlanBefund, Tag } from "@soll/arbeitszeit";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { darf } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { schichten, tauschregeln } from "../../db/schema.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { namenVon } from "../mitglieder/index.ts";
import { tauschBefunde } from "./pruefung.ts";
import type { Schicht } from "./schichten.ts";
import { istOffen, sichtbarFuer, type Tausch, type TauschStatus } from "./tausch.ts";
import { kannUebernehmen, kommendeTausche, ohneFreigabe, uebernehmende } from "./tauschdaten.ts";

/* What a person reads of the shift swaps (S-504), and the business's setting on approval */

type Person = { nutzerId: string; name: string };

type Schichtkopf = {
  schichtId: string;
  standortId: string;
  tag: Tag;
  beginn: number;
  ende: number;
  pauseMinuten: number;
  rolle: string;
};

export type TauschAnsicht = {
  tauschId: string;
  status: TauschStatus;
  schicht: Schichtkopf;
  anbieter: Person;
  an: Person | null;
  uebernehmer: Person | null;
  grund: string | null;
  angebotenAm: number;
  /** the findings for whoever took it, while it waits for approval; only for whoever plans */
  befunde: PlanBefund[] | null;
};

export type Tauschbuch = {
  tausche: TauschAnsicht[];
  /** the own published shifts that have not begun and are not on offer */
  anbietbar: Schichtkopf[];
  /** who can take a shift over, by name, without the person reading */
  kollegen: Person[];
  ohneFreigabe: boolean;
};

const kopf = (schicht: Schicht): Schichtkopf => ({
  schichtId: schicht.schichtId,
  standortId: schicht.standortId,
  tag: schicht.tag,
  beginn: schicht.beginn,
  ende: schicht.ende,
  pauseMinuten: schicht.pauseMinuten,
  rolle: schicht.rolle,
});

const eigeneKommende = (db: Db, betriebId: string, nutzerId: string, jetzt: number) =>
  db
    .select()
    .from(schichten)
    .where(
      and(
        eq(schichten.betriebId, betriebId),
        eq(schichten.nutzerId, nutzerId),
        isNotNull(schichten.veroeffentlichtAm),
        gt(schichten.beginn, jetzt),
      ),
    )
    .orderBy(schichten.beginn)
    .all();

/**
 * The swaps of the shifts that have not begun: whoever plans reads all, with the findings for the
 * person taking a shift; everyone else the swaps they are a party of and the offers meant for them,
 * without findings (Art. 9 DSGVO)
 */
export const tauschbuch = (
  db: Db,
  betriebId: string,
  leser: { nutzerId: string; rolle: string },
  jetzt: number,
): Tauschbuch => {
  const planer = darf(leser.rolle, "plan:planen");
  const kann = kannUebernehmen(db, betriebId, leser.nutzerId);
  const alle = kommendeTausche(db, betriebId, jetzt).filter(
    ({ tausch }) => planer || sichtbarFuer(tausch, leser.nutzerId, kann),
  );
  const namen = namenVon(
    db,
    alle.flatMap(({ tausch }) =>
      [tausch.anbieterId, tausch.anNutzerId, tausch.uebernehmerId].filter(
        (id): id is string => id !== null,
      ),
    ),
  );
  const person = (nutzerId: string | null): Person | null =>
    nutzerId === null ? null : { nutzerId, name: namen.get(nutzerId) ?? "" };
  const angeboten = new Set(
    alle.filter(({ tausch }) => istOffen(tausch)).map(({ schicht }) => schicht.schichtId),
  );
  return {
    tausche: alle.map(({ tausch, schicht }) =>
      ansicht(db, betriebId, tausch, schicht, person, planer, jetzt),
    ),
    anbietbar: eigeneKommende(db, betriebId, leser.nutzerId, jetzt)
      .filter((schicht) => !angeboten.has(schicht.schichtId))
      .map(kopf),
    kollegen: uebernehmende(db, betriebId).filter(({ nutzerId }) => nutzerId !== leser.nutzerId),
    ohneFreigabe: ohneFreigabe(db, betriebId),
  };
};

const ansicht = (
  db: Db,
  betriebId: string,
  tausch: Tausch,
  schicht: Schicht,
  person: (nutzerId: string | null) => Person | null,
  planer: boolean,
  jetzt: number,
): TauschAnsicht => ({
  tauschId: tausch.tauschId,
  status: tausch.status,
  schicht: kopf(schicht),
  anbieter: person(tausch.anbieterId) ?? { nutzerId: tausch.anbieterId, name: "" },
  an: person(tausch.anNutzerId),
  uebernehmer: person(tausch.uebernehmerId),
  grund: tausch.grund,
  angebotenAm: tausch.angebotenAm,
  befunde:
    planer && tausch.status === "uebernommen" && tausch.uebernehmerId !== null
      ? tauschBefunde(db, betriebId, schicht, tausch.uebernehmerId, jetzt)
      : null,
});

/** The owner sets whether a takeover holds without approval (S-504), through the audit chain */
export const tauschregelSetzen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  ohne: boolean,
): void => {
  const vorhanden =
    db.select().from(tauschregeln).where(eq(tauschregeln.betriebId, kontext.betriebId)).get() !==
    undefined;
  schreiben(schreibDb, kontext, (s) =>
    vorhanden
      ? s.aendern("tauschregeln", { betriebId: kontext.betriebId }, { ohneFreigabe: ohne })
      : s.einfuegen("tauschregeln", { betriebId: kontext.betriebId, ohneFreigabe: ohne }),
  );
};
