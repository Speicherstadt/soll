import type { HinweisPosten, Monat, Tag, Urlaubstopf } from "@soll/arbeitszeit";

/** Why the server shows no balance: a value is missing, or months were removed (S-901) */
export type Luecke = { ok: false; grund: "nicht_hinterlegt" | "ausgesondert"; monate: Monat[] };

/** The leave account; without the right to see sickness only what is left of another person */
export type Urlaub =
  | {
      ok: true;
      restHalbtage: number;
      geplantHalbtage: number;
      startJahr?: number;
      toepfe?: Urlaubstopf[];
    }
  | Luecke;

export type Ueberstunden =
  | {
      ok: true;
      saldoMinuten: number;
      /** only for whoever sees everything of the person: the months would show a payout */
      verlauf?: { monat: Monat; saldoMinuten: number }[];
      luecken: Monat[];
    }
  | Luecke;

export type Anpassungsart =
  | "startsaldo"
  | "auszahlung"
  | "korrektur"
  | "urlaub_start"
  | "urlaub_korrektur"
  | "urlaub_stichtag";

export type Anpassung = {
  anpassungId: string;
  art: Anpassungsart;
  monat: Monat | null;
  jahr: number | null;
  minuten: number | null;
  halbtage: number | null;
  grund: string;
  erstelltAm: number;
};

export type Hinweis = { hinweisId: string; tag: Tag; inhalt: HinweisPosten[]; erstelltAm: number };

/** GET /api/v1/arbeitszeit/konten */
export type Konten = {
  nutzerId: string;
  name: string;
  heute: Tag;
  rechte: { pflegen: boolean };
  urlaub: Urlaub;
  ueberstunden: Ueberstunden;
  hinweise: Hinweis[];
  anpassungen: Anpassung[];
};
