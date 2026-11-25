import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/oeffnen.ts";
import { auditGlieder, schichttausche } from "../../db/schema.ts";

/*
 * Which links of the person's chain belong to a shift swap (S-504), whose other people the Auskunft
 * withholds (Art. 15 Abs. 4 DSGVO): every link on `schichttausche`, and the change of a shift's
 * person a swap writes. An approval writes the shift, then the swap, in one transaction
 * (dienstplan/tauschen.ts, `umschreiben`): the shift's link is followed by a change of a swap of that
 * shift, by the same actor at the same instant. Ordinary planning of the shift keeps its name.
 */

type Glied = typeof auditGlieder.$inferSelect;

/** The first key of the row a link names: the shift or the swap */
const ersteId = (glied: Glied): string => (JSON.parse(glied.zeile) as string[])[0] ?? "";

/** The sequence numbers of the links among `glieder` that a swap wrote */
export const tauschGlieder = (
  db: Db,
  betriebId: string,
  glieder: readonly Glied[],
): Set<number> => {
  const eigene = glieder.filter((g) => g.tabelle === "schichttausche").map((g) => g.seq);
  const schichtGlieder = glieder.filter((g) => g.tabelle === "schichten");
  if (schichtGlieder.length === 0) return new Set(eigene);
  const folgende = db
    .select()
    .from(auditGlieder)
    .where(
      and(
        eq(auditGlieder.betriebId, betriebId),
        eq(auditGlieder.tabelle, "schichttausche"),
        eq(auditGlieder.aktion, "aendern"),
        inArray(
          auditGlieder.seq,
          schichtGlieder.map((g) => g.seq + 1),
        ),
      ),
    )
    .all();
  const nachSeq = new Map(folgende.map((g) => [g.seq, g]));
  const tauschIds = folgende.map(ersteId);
  const schichtJeTausch = new Map(
    tauschIds.length === 0
      ? []
      : db
          .select({ tauschId: schichttausche.tauschId, schichtId: schichttausche.schichtId })
          .from(schichttausche)
          .where(
            and(
              eq(schichttausche.betriebId, betriebId),
              inArray(schichttausche.tauschId, tauschIds),
            ),
          )
          .all()
          .map((t) => [t.tauschId, t.schichtId]),
  );
  const imTausch = schichtGlieder.filter((g) => {
    const tausch = nachSeq.get(g.seq + 1);
    return (
      tausch !== undefined &&
      tausch.akteur === g.akteur &&
      tausch.zeitpunkt === g.zeitpunkt &&
      schichtJeTausch.get(ersteId(tausch)) === ersteId(g)
    );
  });
  return new Set([...eigene, ...imTausch.map((g) => g.seq)]);
};
