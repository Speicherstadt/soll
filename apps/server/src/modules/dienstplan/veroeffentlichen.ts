import { planWoche, type Tag } from "@soll/arbeitszeit";
import { darf } from "../../auth/rollen.ts";
import type { Db, SchreibDb } from "../../db/oeffnen.ts";
import { type Kontext, schreiben } from "../audit/index.ts";
import { benachrichtigen, type Kanal, type ZustellDeps } from "../erinnerungen/index.ts";
import { mitgliedschaftVon } from "../mitglieder/index.ts";
import { type Meldung, veroeffentlichungsMeldungen } from "./meldungen.ts";
import { schichtenZwischen } from "./schichten.ts";
import { meldungTag, meldungText, meldungZiel } from "./texte.ts";

/*
 * Publishing the plan (S-503): the drafts of a week at a site become what the people read, see in
 * their calendar and are told about. The moment is the notice of § 12 TzBfG (S-502).
 */

/**
 * Publishes every draft of the week around `tag` at a site in one transaction, each through the
 * audit chain; drafts of other weeks and sites stay drafts. The messages tell each person with a
 * newly published shift once.
 */
export const wocheVeroeffentlichen = (
  db: Db,
  schreibDb: SchreibDb,
  kontext: Kontext,
  standortId: string,
  tag: Tag,
): { anzahl: number; meldungen: Meldung[] } => {
  const { tage, kw } = planWoche(tag);
  const montag = tage[0] ?? tag;
  const entwuerfe = schichtenZwischen(
    db,
    kontext.betriebId,
    standortId,
    montag,
    tage[6] ?? tag,
  ).filter((schicht) => schicht.veroeffentlichtAm === null);
  if (entwuerfe.length > 0)
    schreiben(schreibDb, kontext, (s) => {
      for (const { schichtId } of entwuerfe)
        s.aendern("schichten", { schichtId }, { veroeffentlichtAm: kontext.jetzt });
    });
  return {
    anzahl: entwuerfe.length,
    meldungen: veroeffentlichungsMeldungen(entwuerfe, { standortId, tag: montag, kw: kw.nummer }),
  };
};

/**
 * Tells the people of the messages over Web Push, else mail (S-307); not the one who made the change,
 * and nobody who no longer reads the plan of the business. Without a way to send, nobody.
 */
export const planMelden = async (
  deps: ZustellDeps | null,
  kontext: Kontext,
  meldungen: readonly Meldung[],
): Promise<{ nutzerId: string; kanal: Kanal }[]> => {
  if (deps === null) return [];
  const an = meldungen.filter((meldung) => {
    if (meldung.nutzerId === kontext.akteur) return false;
    const mitglied = mitgliedschaftVon(deps.db, kontext.betriebId, meldung.nutzerId);
    return mitglied !== undefined && darf(mitglied.rolle, "plan:lesen");
  });
  return Promise.all(
    an.map(async (meldung) => ({
      nutzerId: meldung.nutzerId,
      kanal: await benachrichtigen(deps, kontext, meldung.nutzerId, {
        text: (sprache) => meldungText(meldung, sprache),
        ziel: meldungZiel(meldung),
        tag: meldungTag(meldung),
      }),
    })),
  );
};
