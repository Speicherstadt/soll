import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { type ImportZeit, type LeseFehler, type LeseGrund, MAX_TEXT } from "./modell.ts";
import { dauerFrei, pauseFrei, type Spanne, tagFrei, uhrzeitFrei } from "./tabelle-werte.ts";

/*
 * One line of a spreadsheet with free columns read into a time of the import model (BAULISTE.md
 * S-702), or the first reason it cannot be, with the field and the header of its column.
 */

/** The fields of a spreadsheet, each in the column the owner chooses */
export const TABELLE_FELDER = [
  "kennung",
  "person",
  "datum",
  "beginn",
  "ende",
  "dauer",
  "pause",
  "projekt",
  "taetigkeit",
] as const;
export type TabelleFeld = (typeof TABELLE_FELDER)[number];

/** The values of a line by field ("" when empty or not mapped) and the header of each column */
export type TabelleZeile = {
  zeile: number;
  werte: Record<TabelleFeld, string>;
  spalten: Partial<Record<TabelleFeld, string>>;
};

type Fehler = Omit<LeseFehler, "zeile">;

const istFehler = (wert: unknown): wert is Fehler =>
  typeof wert === "object" && wert !== null && "grund" in wert;

const fehler = (z: TabelleZeile, feld: TabelleFeld, grund: LeseGrund): Fehler => {
  const spalte = z.spalten[feld];
  return {
    grund,
    feld,
    ...(z.werte[feld] === "" ? {} : { wert: z.werte[feld].slice(0, MAX_TEXT) }),
    ...(spalte === undefined ? {} : { spalte }),
  };
};

const text = (z: TabelleZeile, feld: TabelleFeld, fehlt?: LeseGrund): string | Fehler => {
  const wert = z.werte[feld];
  if (wert === "" && fehlt) return fehler(z, feld, fehlt);
  return wert.length > MAX_TEXT ? fehler(z, feld, "zu_lang") : wert;
};

const MINUTEN_PRO_TAG = 24 * 60;
const laenge = (beginn: number, ende: number): number =>
  ende > beginn ? ende - beginn : ende + MINUTEN_PRO_TAG - beginn;

/** The end from its column, or from begin, duration and break; both given must agree */
const endeVon = (z: TabelleZeile, beginn: number, pause: number): number | Fehler => {
  const dauer: Spanne | null = z.werte.dauer === "" ? null : dauerFrei(z.werte.dauer);
  if (z.werte.dauer !== "" && (dauer === null || dauer.auf === 0))
    return fehler(z, "dauer", "dauer_ungueltig");
  if (z.werte.ende === "") {
    if (dauer === null) return fehler(z, "ende", "zeit_ungueltig");
    // the longer of the two whole minutes, in the person's favour
    if (dauer.auf + pause >= MINUTEN_PRO_TAG) return fehler(z, "dauer", "dauer_ungueltig");
    return (beginn + dauer.auf + pause) % MINUTEN_PRO_TAG;
  }
  const ende = uhrzeitFrei(z.werte.ende, "auf");
  if (ende === null || ende === beginn) return fehler(z, "ende", "zeit_ungueltig");
  const netto = laenge(beginn, ende) - pause;
  if (dauer !== null && (netto < dauer.ab || netto > dauer.auf))
    return fehler(z, "dauer", "dauer_abweichend");
  return ende;
};

/** The id of a line without an id column: the SHA-256 of what the time says, not where it stands */
export const inhaltsKennung = (zeit: Omit<ImportZeit, "externalId" | "zeile">): string =>
  `inhalt-${bytesToHex(
    sha256(
      utf8ToBytes(
        [zeit.person, zeit.tag, zeit.beginn, zeit.ende, zeit.pauseMinuten].join("\u0000"),
      ),
    ),
  )}`;

const zeitteile = (z: TabelleZeile) => {
  const person = text(z, "person", "person_fehlt");
  if (istFehler(person)) return person;
  const tag = tagFrei(z.werte.datum);
  if (tag === null) return fehler(z, "datum", "datum_ungueltig");
  const beginn = uhrzeitFrei(z.werte.beginn, "ab");
  if (beginn === null) return fehler(z, "beginn", "zeit_ungueltig");
  const pause = pauseFrei(z.werte.pause);
  if (pause === null) return fehler(z, "pause", "pause_ungueltig");
  const ende = endeVon(z, beginn, pause);
  if (istFehler(ende)) return ende;
  if (pause >= laenge(beginn, ende)) return fehler(z, "pause", "pause_ungueltig");
  return { person, tag, beginn, ende, pauseMinuten: pause };
};

/** A line as a time with its project and activity as written, or the first reason it is none */
export const tabelleZeileLesen = (z: TabelleZeile): ImportZeit | LeseFehler => {
  const teile = zeitteile(z);
  if (istFehler(teile)) return { zeile: z.zeile, ...teile };
  const kennung = z.spalten.kennung === undefined ? inhaltsKennung(teile) : text(z, "kennung");
  if (istFehler(kennung)) return { zeile: z.zeile, ...kennung };
  if (kennung === "") return { zeile: z.zeile, ...fehler(z, "kennung", "kennung_fehlt") };
  const projekt = text(z, "projekt");
  if (istFehler(projekt)) return { zeile: z.zeile, ...projekt };
  const taetigkeit = text(z, "taetigkeit");
  if (istFehler(taetigkeit)) return { zeile: z.zeile, ...taetigkeit };
  return {
    externalId: kennung,
    zeile: z.zeile,
    ...teile,
    ...(projekt === "" ? {} : { projekt }),
    ...(taetigkeit === "" ? {} : { taetigkeit }),
  };
};
