import { createHash } from "node:crypto";

/** A value as Soll stores it: no floats (CLAUDE.md), so JSON is exact */
export type Wert =
  | string
  | number
  | boolean
  | null
  | readonly Wert[]
  | { readonly [key: string]: Wert };

/** JSON with sorted keys, so the same content always gives the same text and hash */
export const kanonisch = (wert: unknown): string => JSON.stringify(sortiert(wert));

const sortiert = (wert: unknown): unknown => {
  if (Array.isArray(wert)) return wert.map(sortiert);
  if (wert !== null && typeof wert === "object") {
    return Object.fromEntries(
      Object.keys(wert)
        .sort()
        .map((key) => [key, sortiert((wert as Record<string, unknown>)[key])]),
    );
  }
  if (typeof wert === "number" && !Number.isSafeInteger(wert)) {
    throw new Error(`no whole number: ${wert}`);
  }
  return wert === undefined ? null : wert;
};

export const sha256 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

/** The hash before the first link of a chain */
export const GENESIS = "0".repeat(64);

export type GliedKern = {
  betriebId: string;
  seq: number;
  zeitpunkt: number;
  akteur: string;
  tabelle: string;
  zeile: string;
  aktion: "einfuegen" | "aendern" | "loeschen";
  inhaltHash: string;
};

/** The hash of a link: its predecessor's hash and every field, the content only as its hash */
export const gliedHash = (vorgaengerHash: string, glied: GliedKern): string =>
  sha256(
    `${vorgaengerHash}\n${kanonisch([
      glied.betriebId,
      glied.seq,
      glied.zeitpunkt,
      glied.akteur,
      glied.tabelle,
      glied.zeile,
      glied.aktion,
      glied.inhaltHash,
    ])}`,
  );
