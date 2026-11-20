import type { Bruch } from "./grundlohn.ts";
import type { Satzpaar } from "./saetze.ts";

/**
 * Amounts while a day is summed: exact, in units of one cent ÷ (nenner × 600 000), so that hourly
 * wage × basis points × minutes is a whole number (÷ 10 000 for the basis points, ÷ 60 for the
 * minutes). Only the sum of a day is rounded to whole cents.
 */
export type Teil = { gezahlt: bigint; steuerfrei: bigint };

export const KEIN_TEIL: Teil = { gezahlt: 0n, steuerfrei: 0n };

export const plus = (a: Teil, b: Teil): Teil => ({
  gezahlt: a.gezahlt + b.gezahlt,
  steuerfrei: a.steuerfrei + b.steuerfrei,
});

export const einheitenJeCent = (stundenlohn: Bruch): bigint => stundenlohn.nenner * 600_000n;

const kleiner = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/**
 * The paid surcharge of a stretch split into its tax-free part and the rest, for the night and the
 * day. Each is tax-free up to its own limit first; what one pays above it is tax-free as far as the
 * other leaves room, since the rates add up „auch dann …, wenn nur ein Zuschlag gezahlt wird“
 * (R 3b Abs. 3 LStR). The paid part is on the full hourly wage, the limit on the capped one.
 */
export const teileVon = (
  minuten: number,
  stundenlohn: Bruch,
  gedeckelt: Bruch,
  gezahlt: Satzpaar,
  steuerfrei: Satzpaar,
): { nacht: Teil; tag: Teil } => {
  const betrag = (lohn: Bruch, satz: number) => lohn.zaehler * BigInt(satz) * BigInt(minuten);
  const zahlungNacht = betrag(stundenlohn, gezahlt.nacht);
  const zahlungTag = betrag(stundenlohn, gezahlt.tag);
  const grenzeNacht = betrag(gedeckelt, steuerfrei.nacht);
  const grenzeTag = betrag(gedeckelt, steuerfrei.tag);
  const eigenNacht = kleiner(zahlungNacht, grenzeNacht);
  const eigenTag = kleiner(zahlungTag, grenzeTag);
  return {
    nacht: {
      gezahlt: zahlungNacht,
      steuerfrei: eigenNacht + kleiner(zahlungNacht - eigenNacht, grenzeTag - eigenTag),
    },
    tag: {
      gezahlt: zahlungTag,
      steuerfrei: eigenTag + kleiner(zahlungTag - eigenTag, grenzeNacht - eigenNacht),
    },
  };
};

/** A surcharge of a day in whole cents: its tax-free part and the taxable rest */
export type Betrag = { gezahltCent: number; steuerfreiCent: number; steuerpflichtigCent: number };

/**
 * A day's sum in whole cents. The paid amount is rounded up, never to the employee's disadvantage;
 * the tax-free part is rounded down, since one cent over the limit of § 3b EStG is taxable.
 */
export const inCent = (teil: Teil, einheiten: bigint): Betrag => {
  const gezahltCent = Number((teil.gezahlt + einheiten - 1n) / einheiten);
  const steuerfreiCent = Math.min(gezahltCent, Number(teil.steuerfrei / einheiten));
  return { gezahltCent, steuerfreiCent, steuerpflichtigCent: gezahltCent - steuerfreiCent };
};
