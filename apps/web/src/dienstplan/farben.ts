import { plusTage, type Tag } from "@soll/arbeitszeit";
import type { Schicht, Vorlage } from "./typen.ts";

export type PlanAnsicht = "tag" | "woche" | "monat";

export type SchichtFarbe = {
  /** Left accent stripe + subtle tinted background for cards and bars */
  karte: string;
  /** Compact colored pill for month calendar cells */
  pill: string;
  /** Small legend / template dot */
  punkt: string;
};

const PALETTE: readonly [SchichtFarbe, ...SchichtFarbe[]] = [
  {
    karte: "border-s-[3px] border-s-sky-500 bg-sky-500/10 hover:bg-sky-500/15",
    pill: "border-s-2 border-s-sky-500 bg-sky-500/15 text-foreground hover:bg-sky-500/25",
    punkt: "bg-sky-500",
  },
  {
    karte: "border-s-[3px] border-s-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/15",
    pill: "border-s-2 border-s-emerald-500 bg-emerald-500/15 text-foreground hover:bg-emerald-500/25",
    punkt: "bg-emerald-500",
  },
  {
    karte: "border-s-[3px] border-s-amber-500 bg-amber-500/10 hover:bg-amber-500/15",
    pill: "border-s-2 border-s-amber-500 bg-amber-500/15 text-foreground hover:bg-amber-500/25",
    punkt: "bg-amber-500",
  },
  {
    karte: "border-s-[3px] border-s-violet-500 bg-violet-500/10 hover:bg-violet-500/15",
    pill: "border-s-2 border-s-violet-500 bg-violet-500/15 text-foreground hover:bg-violet-500/25",
    punkt: "bg-violet-500",
  },
  {
    karte: "border-s-[3px] border-s-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/15",
    pill: "border-s-2 border-s-cyan-500 bg-cyan-500/15 text-foreground hover:bg-cyan-500/25",
    punkt: "bg-cyan-500",
  },
  {
    karte: "border-s-[3px] border-s-rose-500 bg-rose-500/10 hover:bg-rose-500/15",
    pill: "border-s-2 border-s-rose-500 bg-rose-500/15 text-foreground hover:bg-rose-500/25",
    punkt: "bg-rose-500",
  },
];

const OFFEN_FARBE: SchichtFarbe = {
  karte: "border border-dashed border-amber-500/70 bg-amber-500/5 hover:bg-amber-500/10",
  pill: "border border-dashed border-amber-500/70 bg-amber-500/10 text-foreground hover:bg-amber-500/20",
  punkt: "bg-amber-500",
};

const hashIndex = (schluessel: string): number => {
  let h = 0;
  for (let i = 0; i < schluessel.length; i++) {
    h = (h * 31 + schluessel.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE.length;
};

/** Deterministic calm color for a template or role */
export const vorlageFarbe = (
  vorlage: Pick<Vorlage, "vorlageId" | "rolle">,
  index?: number,
): SchichtFarbe => {
  const idx =
    index !== undefined ? index % PALETTE.length : hashIndex(vorlage.vorlageId || vorlage.rolle);
  return PALETTE[idx] ?? PALETTE[0];
};

/** Deterministic calm color for a shift (consistent with its template, or hashed by role) */
export const schichtFarbe = (schicht: Schicht, vorlagen: readonly Vorlage[]): SchichtFarbe => {
  if (schicht.nutzerId === null) return OFFEN_FARBE;
  if (schicht.vorlageId) {
    const idx = vorlagen.findIndex((v) => v.vorlageId === schicht.vorlageId);
    if (idx >= 0) return PALETTE[idx % PALETTE.length] ?? PALETTE[0];
  }
  return PALETTE[hashIndex(schicht.rolle || schicht.vorlageId || schicht.schichtId)] ?? PALETTE[0];
};

const berlinUhr = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Berlin clock minutes since midnight (0..1440) for a UTC millisecond timestamp */
export const tagMinuten = (ms: number): number => {
  const teile = berlinUhr.formatToParts(ms);
  const h = Number(teile.find((t) => t.type === "hour")?.value ?? 0) % 24;
  const m = Number(teile.find((t) => t.type === "minute")?.value ?? 0);
  return h * 60 + m;
};

/** Shifts a YYYY-MM-DD tag by delta months (landing on the 1st of the target month) */
export const plusMonatTag = (tag: Tag, schritt: -1 | 1): Tag => {
  const [jText, mText] = tag.split("-");
  const d = new Date(Date.UTC(Number(jText), Number(mText) - 1 + schritt, 1, 12));
  return d.toISOString().slice(0, 10);
};

export type MonatKalender = {
  monat: string;
  /** All 35 or 42 days (Mon..Sun) covering the month */
  tage: Tag[];
  /** Monday of each week row to fetch via GET /api/v1/dienstplan/woche */
  montage: Tag[];
};

/** Builds the Mon..Sun calendar grid covering the month of `tag` */
export const monatKalenderTage = (tag: Tag): MonatKalender => {
  const monat = tag.slice(0, 7);
  const erster = new Date(`${monat}-01T12:00:00Z`);
  const wochentag = erster.getUTCDay() || 7;
  const start = plusTage(`${monat}-01`, -(wochentag - 1));
  const naechsterErster = plusMonatTag(`${monat}-01`, 1);
  const letzter = plusTage(naechsterErster, -1);
  const letzterWt = new Date(`${letzter}T12:00:00Z`).getUTCDay() || 7;
  const ende = plusTage(letzter, 7 - letzterWt);

  const tage: Tag[] = [];
  const montage: Tag[] = [];
  for (let cur = start; cur <= ende; cur = plusTage(cur, 1)) {
    if (tage.length % 7 === 0) montage.push(cur);
    tage.push(cur);
  }
  return { monat, tage, montage };
};
