import type { Befund } from "../befund.ts";
import { monatsfristEnde, volleMonate } from "../kalender/fristen.ts";
import { istTag, jahrVon, plusTage, type Tag, tageZwischen } from "../kalender/tag.ts";
import { inSpanne, type Tagesspanne } from "../pruefung-mutterschutz/typen.ts";
import { arbeitstageJeWoche, modellAm, modelleGueltig } from "../soll/modell.ts";
import type { Beschaeftigung, Modellabschnitt } from "../soll/typen.ts";
import { type Elternzeit, type ElternzeitBefund, elternzeitKuerzung } from "./elternzeit.ts";
import { type Halbtage, halbtageAufgerundet, halbtageAufHalbeAufgerundet } from "./halbtage.ts";
import {
  gesetzlicherUrlaub,
  gesetzlicherZusatzurlaub,
  type MindesturlaubBefund,
  mindesturlaub,
} from "./mindesturlaub.ts";

export type UrlaubsEingaben = {
  jahr: number;
  modelle: readonly Modellabschnitt[];
  beschaeftigung: Pick<Beschaeftigung, "eintritt" | "austritt">;
  /** the spans of severe disability (§ 2 Abs. 2 SGB IX); only the span, nothing more */
  schwerbehinderung?: readonly Tagesspanne[];
  /** additional leave entered by the business, in half days; below the law the law applies */
  zusatzurlaubHalbtage?: number | null;
  elternzeit?: readonly Elternzeit[];
  /** the twelfths the business declared to take off for parental leave; null: not decided */
  elternzeitKuerzungZwoelftel?: number | null;
};

/**
 * § 5 Abs. 1 BUrlG: the full leave, or a twelfth per full month because the Wartezeit is not
 * fulfilled in the year (a), the person leaves before it is (b) or leaves in the first half of the
 * year after it (c); none in a year without employment
 */
export type Urlaubsart = "voll" | "teil_a" | "teil_b" | "teil_c" | "keiner";

/** R-25: the additional leave entered is under the law */
export type ZusatzurlaubBefund = Befund<"zusatzurlaub_unter_gesetz"> & {
  eingetragenHalbtage: number;
  gesetzlichHalbtage: number;
};

export type UrlaubsBefund = MindesturlaubBefund | ZusatzurlaubBefund | ElternzeitBefund;

export type Urlaubsanspruch = {
  jahr: number;
  art: Urlaubsart;
  /** the twelfths of the year's leave the person earns: 12 for the full leave */
  zwoelftel: number;
  /** the leave after a declared reduction for parental leave */
  grundHalbtage: Halbtage;
  /** § 208 SGB IX, added to the leave (§ 208 Abs. 2 Satz 3); not reduced for parental leave */
  zusatzHalbtage: Halbtage;
  elternzeit: { volleMonate: string[]; kuerzungZwoelftel: number; kuerzungHalbtage: Halbtage };
  gesamtHalbtage: Halbtage;
  befunde: UrlaubsBefund[];
};

export type UrlaubsanspruchErgebnis =
  | { ok: true; wert: Urlaubsanspruch }
  | { ok: false; grund: "nicht_hinterlegt" | "ungueltig" };

/** The days of the year in the employment, both included; null in a year without employment */
type Spanne = { von: Tag; bis: Tag };

/** One model's share of the year: its weekly working days, its yearly leave and its days */
type Anteil = { arbeitstage: number; urlaub: Halbtage; tage: number };

/** The later and the earlier of two days (text, so not Math.max) */
const spaeter = (a: Tag, b: Tag): Tag => (a < b ? b : a);
const frueher = (a: Tag, b: Tag): Tag => (a < b ? a : b);

const spanneIm = (jahr: number, beschaeftigung: UrlaubsEingaben["beschaeftigung"]) => {
  const jahrText = String(jahr).padStart(4, "0");
  const von = spaeter(beschaeftigung.eintritt, `${jahrText}-01-01`);
  const bis = frueher(beschaeftigung.austritt ?? "9999-12-31", `${jahrText}-12-31`);
  return von <= bis ? { von, bis } : null;
};

/** § 5 Abs. 1 BUrlG with § 4: the Wartezeit of six months ends as §§ 187, 188 BGB count it */
const urlaubsart = (
  jahr: number,
  beschaeftigung: UrlaubsEingaben["beschaeftigung"],
): Urlaubsart => {
  const wartezeitEnde = monatsfristEnde(beschaeftigung.eintritt, 6);
  const austritt = beschaeftigung.austritt ?? null;
  if (austritt !== null && austritt < wartezeitEnde) return "teil_b";
  if (jahrVon(wartezeitEnde) > jahr) return "teil_a";
  if (austritt !== null && jahrVon(austritt) === jahr && austritt.slice(5) <= "06-30")
    return "teil_c";
  return "voll";
};

/** The models' shares of the days in the employment; null if a day has no model or no days a week */
const anteile = (modelle: readonly Modellabschnitt[], spanne: Spanne): Anteil[] | null => {
  const teile: Anteil[] = [];
  for (let tag = spanne.von; tag <= spanne.bis; ) {
    const modell = modellAm(modelle, tag);
    if (modell === null) return null;
    const naechster = modelle.filter((m) => m.ab > tag).sort((a, b) => a.ab.localeCompare(b.ab))[0];
    const ende =
      naechster === undefined || naechster.ab > spanne.bis
        ? spanne.bis
        : plusTage(naechster.ab, -1);
    const arbeitstage = arbeitstageJeWoche(modell);
    const gesetzlich = gesetzlicherUrlaub(arbeitstage);
    if (arbeitstage === 0 && modell.urlaubHalbtage == null) return null;
    teile.push({
      arbeitstage,
      urlaub: Math.max(gesetzlich, modell.urlaubHalbtage ?? 0),
      tage: tageZwischen(tag, ende) + 1,
    });
    tag = plusTage(ende, 1);
  }
  return teile;
};

/** How a share of leave is rounded: § 5 Abs. 2 BUrlG for twelfths, else only to a half day */
type Rundung = (zaehler: number, nenner: number) => Halbtage;

/** § 5 Abs. 2 BUrlG and § 208 Abs. 2 Satz 2 SGB IX apply to the twelfths they count, nothing else */
const rundungFuer = (zwoelftelNachGesetz: boolean): Rundung =>
  zwoelftelNachGesetz ? halbtageAufgerundet : halbtageAufHalbeAufgerundet;

/**
 * Leave of `zwoelftel` twelfths, the models weighted by their days in the employment (a change of the
 * weekly working days in the year counts each span with its own days, EuGH C-415/12 Brandes),
 * rounded once
 */
const anteilig = (
  teile: readonly Anteil[],
  wert: (teil: Anteil) => number,
  zwoelftel: number,
  runden: Rundung,
) => {
  const tage = teile.reduce((summe, teil) => summe + teil.tage, 0);
  const zaehler = teile.reduce((summe, teil) => summe + wert(teil) * teil.tage, 0);
  return runden(zaehler * zwoelftel, tage * 12);
};

/**
 * § 208 Abs. 2 SGB IX: a twelfth per full month of the disability in the employment; while it lasts
 * the whole employment of the year, the additional leave follows the leave (twelfths of § 5 BUrlG)
 */
const zusatzZwoelftel = (spannen: readonly Tagesspanne[], spanne: Spanne, zwoelftel: number) => {
  let ganz = true;
  for (let tag = spanne.von; tag <= spanne.bis && ganz; tag = plusTage(tag, 1))
    ganz = inSpanne(spannen, tag);
  if (ganz) return zwoelftel;
  const monate = spannen.reduce((summe, sb) => {
    const bis = sb.bis === null ? spanne.bis : frueher(sb.bis, spanne.bis);
    return summe + volleMonate(spaeter(sb.von, spanne.von), bis);
  }, 0);
  return Math.min(12, monate);
};

const spannenGueltig = (spannen: readonly Tagesspanne[]): boolean =>
  spannen.every((s) => istTag(s.von) && (s.bis === null || (istTag(s.bis) && s.von <= s.bis)));

const gueltig = (e: UrlaubsEingaben): boolean =>
  Number.isInteger(e.jahr) &&
  e.jahr >= 1 &&
  e.jahr <= 9999 &&
  modelleGueltig(e.modelle) &&
  istTag(e.beschaeftigung.eintritt) &&
  (e.beschaeftigung.austritt == null || istTag(e.beschaeftigung.austritt)) &&
  spannenGueltig(e.schwerbehinderung ?? []) &&
  spannenGueltig(e.elternzeit ?? []) &&
  [e.zusatzurlaubHalbtage, e.elternzeitKuerzungZwoelftel].every(
    (zahl) => zahl == null || (Number.isInteger(zahl) && zahl >= 0),
  );

const KEINER = (jahr: number): Urlaubsanspruch => ({
  jahr,
  art: "keiner",
  zwoelftel: 0,
  grundHalbtage: 0,
  zusatzHalbtage: 0,
  elternzeit: { volleMonate: [], kuerzungZwoelftel: 0, kuerzungHalbtage: 0 },
  gesamtHalbtage: 0,
  befunde: [],
});

/**
 * The models' shares of the days with the disability in the employment: § 208 Abs. 2 SGB IX gives
 * twelfths of the additional leave of Abs. 1 for the months with it, so only their working days count
 * (EuGH C-415/12, Brandes); empty while the disability lies outside the employment
 */
const anteileMitSchwerbehinderung = (
  modelle: readonly Modellabschnitt[],
  spannen: readonly Tagesspanne[],
  spanne: Spanne,
): Anteil[] =>
  spannen.flatMap((sb) => {
    const von = spaeter(sb.von, spanne.von);
    const bis = sb.bis === null ? spanne.bis : frueher(sb.bis, spanne.bis);
    return von <= bis ? (anteile(modelle, { von, bis }) ?? []) : [];
  });

/** R-25 against what the business entered: below the law the law applies */
const zusatzurlaub = (e: UrlaubsEingaben, spanne: Spanne, zwoelftel: number) => {
  const sb = e.schwerbehinderung ?? [];
  const sbZwoelftel = zusatzZwoelftel(sb, spanne, zwoelftel);
  const teile = anteileMitSchwerbehinderung(e.modelle, sb, spanne);
  const gesetzlich =
    sbZwoelftel === 0 || teile.length === 0
      ? 0
      : anteilig(
          teile,
          (t) => gesetzlicherZusatzurlaub(t.arbeitstage),
          sbZwoelftel,
          rundungFuer(sbZwoelftel < 12),
        );
  const eingetragen = e.zusatzurlaubHalbtage ?? null;
  const befunde: ZusatzurlaubBefund[] =
    eingetragen !== null && eingetragen < gesetzlich
      ? [
          {
            regel: "R-25",
            norm: "§ 208 Abs. 1 Satz 1 SGB IX",
            schwere: "hinweis",
            art: "zusatzurlaub_unter_gesetz",
            tage: [spanne.von],
            eingetragenHalbtage: eingetragen,
            gesetzlichHalbtage: gesetzlich,
          },
        ]
      : [];
  return { halbtage: Math.max(gesetzlich, eingetragen ?? 0), befunde };
};

/**
 * The leave of one year (BAULISTE.md S-208, docs/regeln.md R-23, R-25, R-26), in half days: the
 * model's leave, at least the statutory minimum (§ 3 Abs. 1 BUrlG), a twelfth per full month where
 * § 5 Abs. 1 BUrlG says so, less a declared reduction for parental leave (§ 17 Abs. 1 BEEG), plus the
 * additional leave of § 208 SGB IX. A day of the employment without a model is "nicht hinterlegt".
 */
export const urlaubsanspruch = (e: UrlaubsEingaben): UrlaubsanspruchErgebnis => {
  if (!gueltig(e)) return { ok: false, grund: "ungueltig" };
  const spanne = spanneIm(e.jahr, e.beschaeftigung);
  if (spanne === null) return { ok: true, wert: KEINER(e.jahr) };
  const teile = anteile(e.modelle, spanne);
  if (teile === null) return { ok: false, grund: "nicht_hinterlegt" };
  const art = urlaubsart(e.jahr, e.beschaeftigung);
  const zwoelftel = art === "voll" ? 12 : volleMonate(spanne.von, spanne.bis);
  const kuerzung = elternzeitKuerzung(
    e.jahr,
    e.elternzeit ?? [],
    e.elternzeitKuerzungZwoelftel ?? null,
  );
  const runden = rundungFuer(art !== "voll");
  const ohneKuerzung = anteilig(teile, (t) => t.urlaub, zwoelftel, runden);
  const grund = anteilig(
    teile,
    (t) => t.urlaub,
    Math.max(0, zwoelftel - kuerzung.kuerzungZwoelftel),
    runden,
  );
  const zusatz = zusatzurlaub(e, spanne, zwoelftel);
  const modelle = e.modelle.filter(
    (m) => m.ab <= spanne.bis && modellAm(e.modelle, spaeter(m.ab, spanne.von)) === m,
  );
  return {
    ok: true,
    wert: {
      jahr: e.jahr,
      art,
      zwoelftel,
      grundHalbtage: grund,
      zusatzHalbtage: zusatz.halbtage,
      elternzeit: {
        volleMonate: kuerzung.volleMonate,
        kuerzungZwoelftel: kuerzung.kuerzungZwoelftel,
        kuerzungHalbtage: ohneKuerzung - grund,
      },
      gesamtHalbtage: grund + zusatz.halbtage,
      befunde: [
        ...modelle.flatMap((m) => mindesturlaub(m, spaeter(m.ab, spanne.von)) ?? []),
        ...zusatz.befunde,
        ...kuerzung.befunde,
      ],
    },
  };
};
