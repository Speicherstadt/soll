import type { Befund } from "../befund.ts";
import { kinderkrankentage } from "../jahreswerte/jahreswerte.ts";
import { istTag, jahrVon, type Tag } from "../kalender/tag.ts";

/** A working day with Kind krank for one child; the child by an id, nothing more about it */
export type KindKrankTag = { tag: Tag; kind: string };

/**
 * R-28: the days with sickness benefit are used up on this day (`anspruch_erreicht`), or these days
 * lie beyond them (`ueber_anspruch`): the business need not refuse, but the benefit ends
 */
export type KinderkrankBefund = Befund<"anspruch_erreicht" | "ueber_anspruch"> & { kind: string };

export type Kinderkrankstand = {
  jahr: number;
  /** the days counted per child */
  jeKind: Record<string, number>;
  gesamt: number;
  anspruchJeKind: number;
  hoechstens: number;
  befunde: KinderkrankBefund[];
};

export type KinderkrankErgebnis =
  | { ok: true; wert: Kinderkrankstand }
  | { ok: false; grund: "nicht_hinterlegt" | "ungueltig" };

/** The norm of the year's value, as its source names it: § 45 Abs. 2a Satz 1 SGB V for 2026 */
const normAus = (quelle: string): string =>
  `${/^§ 45 Abs\. \S+ Satz 1/.exec(quelle)?.[0] ?? "§ 45 Abs. 2"} SGB V`;

/**
 * Counts the days of Kind krank of one year per child against the days of sickness benefit of that
 * year (§ 45 Abs. 2 and 2a SGB V, a Jahreswert of S-104, docs/regeln.md R-28): per child, and all
 * children together up to the maximum. Each working day counts once, a half one too: the benefit is
 * paid per day of release. A year without the value is "nicht hinterlegt", never another year's.
 */
export const kinderkrankZaehlen = (
  jahr: number,
  tage: readonly KindKrankTag[],
  alleinerziehend = false,
): KinderkrankErgebnis => {
  if (!tage.every((eintrag) => istTag(eintrag.tag) && jahrVon(eintrag.tag) === jahr))
    return { ok: false, grund: "ungueltig" };
  const wert = kinderkrankentage(jahr);
  if (!wert.ok) return { ok: false, grund: "nicht_hinterlegt" };
  const anspruchJeKind = alleinerziehend ? wert.wert.jeKindAlleinerziehend : wert.wert.jeKind;
  const hoechstens = alleinerziehend ? wert.wert.hoechstensAlleinerziehend : wert.wert.hoechstens;
  const jeKind: Record<string, number> = {};
  const erreicht = new Map<string, Tag>();
  const ueber = new Map<string, Tag[]>();
  let gesamt = 0;
  const einmal = [...new Map(tage.map((t) => [`${t.kind} ${t.tag}`, t] as const)).values()];
  for (const { tag, kind } of einmal.sort((a, b) => a.tag.localeCompare(b.tag))) {
    jeKind[kind] = (jeKind[kind] ?? 0) + 1;
    gesamt += 1;
    if (jeKind[kind] > anspruchJeKind || gesamt > hoechstens)
      ueber.set(kind, [...(ueber.get(kind) ?? []), tag]);
    else if (jeKind[kind] === anspruchJeKind || gesamt === hoechstens) erreicht.set(kind, tag);
  }
  const norm = normAus(wert.quelle);
  const befund = (art: KinderkrankBefund["art"], kind: string, am: Tag[]): KinderkrankBefund => ({
    regel: "R-28",
    norm,
    schwere: "hinweis",
    art,
    tage: am,
    kind,
  });
  const befunde = Object.keys(jeKind).flatMap((kind) => {
    const darueber = ueber.get(kind);
    if (darueber !== undefined) return [befund("ueber_anspruch", kind, darueber)];
    const am = erreicht.get(kind);
    return am === undefined ? [] : [befund("anspruch_erreicht", kind, [am])];
  });
  return { ok: true, wert: { jahr, jeKind, gesamt, anspruchJeKind, hoechstens, befunde } };
};
