import type { Stueck } from "../arbeitstag/schichten.ts";
import type { Befund } from "../befund.ts";
import type { Tag } from "../kalender/tag.ts";
import type { Branche } from "../pruefung/grenzen.ts";
import { type RuhezeitBefund, ruheEndend } from "../pruefung/ruhezeit.ts";
import { sortiert } from "../pruefung/typen.ts";
import { bereitschaftGrenzenAm } from "./grenzen.ts";
import type { BereitschaftsSchicht, BereitschaftsTag } from "./typen.ts";

/**
 * R-12: after a call-out in Rufbereitschaft the rest before the next shift is shorter than allowed.
 * The rest is measured from the end of the call-out (`einsatz`), as R-05 measures it (`ruhe`,
 * `mindestens`, `fehlt`, the norm of § 5 Abs. 1 or, in the industries of Abs. 2, Abs. 2 ArbZG).
 */
export type EinsatzRuhezeitBefund = Befund<"ruhezeit_durch_einsatz_unterbrochen"> & {
  ruhe: Stueck;
  mindestens: number;
  fehlt: number;
  einsatz: Stueck;
};

/**
 * R-12, § 5 Abs. 3 ArbZG: in hospitals and care, call-outs that take no more than half of the rest
 * do not interrupt it; their `minuten` are to be balanced at other times.
 */
export type EinsatzAusgleichBefund = Befund<"einsatz_ausgleich"> & {
  einsaetze: Stueck[];
  minuten: number;
};

/**
 * A block of work in time order: a call-out, or other work (an open shift from its start);
 * `ersteDerSchicht` for a block that ends the rest before it (`ruheEndend`)
 */
type Stelle = { tag: Tag; block: Stueck; einsatz: boolean; ersteDerSchicht: boolean };

const istEinsatz = (einsaetze: readonly Stueck[], block: Stueck): boolean =>
  einsaetze.some((einsatz) => einsatz.beginn === block.beginn && einsatz.ende === block.ende);

const bloeckeDer = (schicht: BereitschaftsSchicht): Stelle[] => {
  const bloecke = schicht.bloecke.map((block) => ({
    block,
    einsatz: istEinsatz(schicht.einsaetze, block),
  }));
  const endend = ruheEndend(bloecke);
  return bloecke.map((teil, index) => ({
    tag: schicht.tag,
    block: teil.block,
    einsatz: teil.einsatz,
    ersteDerSchicht: endend.has(index),
  }));
};

const stellenAus = (tage: readonly BereitschaftsTag[]): Stelle[] =>
  tage
    .flatMap((tag) =>
      tag.schichten.flatMap((schicht): Stelle[] =>
        schicht.ende === null
          ? [
              {
                tag: schicht.tag,
                block: alsMarke(schicht.beginn),
                einsatz: false,
                ersteDerSchicht: true,
              },
            ]
          : bloeckeDer(schicht),
      ),
    )
    .sort((a, b) => a.block.beginn - b.block.beginn);

const alsMarke = (zeitpunkt: number): Stueck => ({
  beginn: zeitpunkt,
  ende: zeitpunkt,
  minuten: 0,
});

/**
 * The call-outs between two working days, with the day whose rest they fall in and the one before;
 * `amTag` when more work of the day before follows them (a rest between two shifts of one day)
 */
type Gruppe = { einsaetze: Stelle[]; bis: Tag; vorher: Tag | null; amTag: boolean };

/**
 * The call-outs that fall into a rest: after the last other work and before the first work of the
 * next working day or of a shift of its own on the same day, or after the last work of all (the rest
 * still running). Call-outs between two pieces of the same shift lie in no rest.
 */
const inRuhezeiten = (stellen: readonly Stelle[]): Gruppe[] => {
  const gruppen: Gruppe[] = [];
  const begonnen = new Set<Tag>();
  let offen: Stelle[] = [];
  let vorher: Tag | null = null;
  for (const stelle of stellen) {
    if (stelle.einsatz) {
      offen.push(stelle);
      continue;
    }
    const ersteDesTags = !begonnen.has(stelle.tag);
    begonnen.add(stelle.tag);
    if (offen.length > 0 && (ersteDesTags || stelle.ersteDerSchicht))
      gruppen.push({ einsaetze: offen, bis: stelle.tag, vorher, amTag: stelle.tag === vorher });
    offen = [];
    vorher = stelle.tag;
  }
  const erste = offen[0];
  if (erste !== undefined) gruppen.push({ einsaetze: offen, bis: erste.tag, vorher, amTag: false });
  return gruppen;
};

const minutenDer = (stellen: readonly Stelle[]): number =>
  stellen.reduce((summe, stelle) => summe + stelle.block.minuten, 0);

/**
 * § 5 Abs. 3 ArbZG: in the industries of the rule version (hospitals and care) the call-outs of a
 * rest that take no more than half of it do not interrupt it; each such rest is a Hinweis with the
 * minutes to balance, and its call-outs come back in `frei` for the check of the rest to leave out.
 * A rest after a working day of more than 12 hours under § 7 Abs. 9 ArbZG (`ohneAusgleich`, the day
 * before it) must follow „im unmittelbaren Anschluss“ to the end of that day's work, so its call-outs
 * interrupt it; a rest between two shifts of that day lies before the end and keeps § 5 Abs. 3.
 */
export const einsatzAusgleich = (
  tage: readonly BereitschaftsTag[],
  branche: Branche,
  ohneAusgleich: ReadonlySet<Tag>,
): { befunde: EinsatzAusgleichBefund[]; frei: Stueck[] } => {
  const befunde: EinsatzAusgleichBefund[] = [];
  for (const gruppe of inRuhezeiten(stellenAus(tage))) {
    const grenzen = bereitschaftGrenzenAm(gruppe.bis);
    const minuten = minutenDer(gruppe.einsaetze);
    if (
      grenzen === null ||
      !grenzen.einsatzAusgleich.includes(branche) ||
      minuten > grenzen.einsatzAusgleichHoechstens ||
      (gruppe.vorher !== null && !gruppe.amTag && ohneAusgleich.has(gruppe.vorher))
    )
      continue;
    befunde.push({
      regel: "R-12",
      norm: "§ 5 Abs. 3 ArbZG",
      schwere: "hinweis",
      art: "einsatz_ausgleich",
      tage: sortiert(gruppe.einsaetze.map((stelle) => stelle.tag)),
      einsaetze: gruppe.einsaetze.map((stelle) => stelle.block),
      minuten,
    });
  }
  return { befunde, frei: befunde.flatMap((befund) => befund.einsaetze) };
};

/**
 * R-12: a rest of R-05 that is too short and begins at the end of a call-out is the finding „Ruhezeit
 * durch Einsatz unterbrochen“; every other finding of R-05 stays as it is
 */
export const nachEinsatz = (
  befunde: readonly RuhezeitBefund[],
  tage: readonly BereitschaftsTag[],
): (RuhezeitBefund | EinsatzRuhezeitBefund)[] => {
  const einsatzEnden = new Map(
    stellenAus(tage)
      .filter((stelle) => stelle.einsatz)
      .map((stelle) => [stelle.block.ende, stelle.block] as const),
  );
  return befunde.map((befund) => {
    const einsatz = einsatzEnden.get(befund.ruhe.beginn);
    if (befund.art !== "ruhezeit_zu_kurz" || einsatz === undefined) return befund;
    return {
      regel: "R-12",
      norm: befund.norm,
      schwere: "verstoss",
      art: "ruhezeit_durch_einsatz_unterbrochen",
      tage: befund.tage,
      ruhe: befund.ruhe,
      mindestens: befund.mindestens,
      fehlt: befund.fehlt,
      einsatz,
    };
  });
};
