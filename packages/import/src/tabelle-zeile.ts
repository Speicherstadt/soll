import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { type ImportZeit, type LeseFehler, type LeseGrund, MAX_TEXT } from "./modell.ts";
import {
  dauerFrei,
  dauerGenau,
  dauerPasst,
  minutenVon,
  pauseFrei,
  type Spanne,
  tagFrei,
  uhrSekunden,
} from "./tabelle-werte.ts";

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

const SEKUNDEN_PRO_TAG = 24 * 60 * 60;

/** The span between two clock times in seconds; an end at or before the begin is the next day */
const sekundenZwischen = (beginn: number, ende: number): number =>
  ende > beginn ? ende - beginn : ende + SEKUNDEN_PRO_TAG - beginn;

/**
 * The end in whole minutes from its seconds: rounded up, unless that would put it on the begin's
 * minute or past it while the end lies on the next day (`07:00:30` to `07:00:15`): such a span has
 * no whole minutes that are neither longer by a phantom day nor shorter, so it is refused
 */
const endeInMinuten = (beginn: number, ende: number): number | null => {
  if (ende === beginn) return null;
  const minuten = minutenVon(ende, "auf");
  const anfang = minutenVon(beginn, "ab");
  const naechsterTag = ende < beginn;
  return minuten === anfang || (naechsterTag && minuten > anfang) ? null : minuten;
};

/** The end from its column, or from begin, duration and break; both given must agree */
const endeVon = (z: TabelleZeile, beginn: number, pause: number): number | Fehler => {
  const dauer = z.werte.dauer === "" ? null : dauerGenau(z.werte.dauer);
  const spanne: Spanne | null = z.werte.dauer === "" ? null : dauerFrei(z.werte.dauer);
  if (z.werte.dauer !== "" && (dauer === null || spanne === null || spanne.auf === 0))
    return fehler(z, "dauer", "dauer_ungueltig");
  if (z.werte.ende === "") {
    if (spanne === null) return fehler(z, "ende", "zeit_ungueltig");
    // the longer of the two whole minutes, in the person's favour
    const anfang = minutenVon(beginn, "ab");
    if (spanne.auf + pause >= MINUTEN_PRO_TAG) return fehler(z, "dauer", "dauer_ungueltig");
    return (anfang + spanne.auf + pause) % MINUTEN_PRO_TAG;
  }
  const ende = uhrSekunden(z.werte.ende);
  const minuten = ende === null ? null : endeInMinuten(beginn, ende);
  if (ende === null || minuten === null) return fehler(z, "ende", "zeit_ungueltig");
  // compared in seconds, as written: a duration off by more than its own rounding is refused
  if (dauer !== null && !dauerPasst(sekundenZwischen(beginn, ende) - pause * 60, dauer))
    return fehler(z, "dauer", "dauer_abweichend");
  return minuten;
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
  // begin and end in seconds as written, so durations and spans compare exactly
  const sekunden = uhrSekunden(z.werte.beginn);
  if (sekunden === null) return fehler(z, "beginn", "zeit_ungueltig");
  const beginn = minutenVon(sekunden, "ab");
  const pause = pauseFrei(z.werte.pause);
  if (pause === null) return fehler(z, "pause", "pause_ungueltig");
  const ende = endeVon(z, sekunden, pause);
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
