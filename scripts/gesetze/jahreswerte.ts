/*
 * Yearly values that Soll still lacks: the current year at any time, the next one from 1 October
 * (the minimum wage commission decides by 30 June, the ordinance follows in autumn; § 9 MiLoG). Until
 * a value is stored Soll says "nicht hinterlegt" and never takes another year's (CLAUDE.md, "Never").
 * Also watches for a new Mindestlohnanpassungsverordnung on gesetze-im-internet.de, which keeps each
 * ordinance at /milov<n>/ (MiLoV4, MiLoV5); one that does not exist yet answers 404.
 */
import type { Jahreswert } from "../../packages/arbeitszeit/src/jahreswerte/index.ts";
import { abrufen, type Befund, beschreibe, type Ergebnis, type Holen, text } from "./abruf.ts";
import { DOKU } from "./normen.ts";

export type Jahreswerte = {
  mindestlohnAm: (tag: string) => Jahreswert<number>;
  minijobGrenzeAm: (tag: string) => Jahreswert<number>;
  kinderkrankentage: (jahr: number) => Jahreswert<unknown>;
};

const WERTE_TS = "packages/arbeitszeit/src/jahreswerte/werte.ts";
const TAG_MS = 86_400_000;

/** Every calendar day of a year as `YYYY-MM-DD` */
const tageDesJahres = (jahr: number): string[] => {
  const tage: string[] = [];
  for (let t = Date.UTC(jahr, 0, 1); new Date(t).getUTCFullYear() === jahr; t += TAG_MS)
    tage.push(new Date(t).toISOString().slice(0, 10));
  return tage;
};

type Wert = { kennung: string; name: string; quelle: string; fehlt: (jahr: number) => boolean };

const werte = (j: Jahreswerte): Wert[] => [
  {
    kennung: "mindestlohn",
    name: "Mindestlohn",
    quelle:
      "§ 1 Abs. 2 MiLoG mit der Mindestlohnanpassungsverordnung des Jahres (gesetze-im-internet.de, Bundesgesetzblatt)",
    fehlt: (jahr) => tageDesJahres(jahr).some((tag) => !j.mindestlohnAm(tag).ok),
  },
  {
    kennung: "minijob-grenze",
    name: "Minijob-Grenze",
    quelle:
      "§ 8 Abs. 1a SGB IV aus dem Mindestlohn des Jahres (Mindestlohn × 130 ÷ 3, auf volle Euro aufgerundet), bekannt gemacht vom BMAS im Bundesanzeiger",
    fehlt: (jahr) => tageDesJahres(jahr).some((tag) => !j.minijobGrenzeAm(tag).ok),
  },
  {
    kennung: "kinderkrankentage",
    name: "Kinderkrankentage",
    quelle: "§ 45 Abs. 2 und 2a SGB V",
    fehlt: (jahr) => !j.kinderkrankentage(jahr).ok,
  },
];

const fehlend = (wert: Wert, jahr: number): Befund => ({
  schluessel: `jahreswert-${wert.kennung}-${jahr}`,
  titel: `${wert.name} ${jahr} nicht hinterlegt`,
  text: `Für ${jahr} fehlt der Jahreswert ${wert.name} in \`${WERTE_TS}\`; bis er eingetragen ist, zeigt Soll „nicht hinterlegt“. Quelle: ${wert.quelle}. Zu tun: den Wert mit Gültigkeit und Fundstelle als neuen Eintrag anlegen, Tests ergänzen. Schritte: ${DOKU}`,
});

/** The current year always, the next from 1 October; `heute` is a Berlin calendar day */
export const fehlendeJahreswerte = (heute: string, j: Jahreswerte): Befund[] => {
  const jahr = Number(heute.slice(0, 4));
  const jahre = heute.slice(5) >= "10-01" ? [jahr, jahr + 1] : [jahr];
  return jahre.flatMap((J) =>
    werte(j)
      .filter((w) => w.fehlt(J))
      .map((w) => fehlend(w, J)),
  );
};

/** The number of the newest Mindestlohnanpassungsverordnung the yearly values cite */
export const hoechsteMiLoV = (eintraege: readonly { quelle: string }[]): number =>
  Math.max(
    0,
    ...eintraege.flatMap((e) => [...e.quelle.matchAll(/\/milov(\d+)\//g)].map((m) => Number(m[1]))),
  );

const miLoVUrl = (n: number) => `https://www.gesetze-im-internet.de/milov${n}/`;

async function neueMiLoV(bekannt: number, holen: Holen): Promise<Ergebnis> {
  const n = bekannt + 1;
  const url = miLoVUrl(n);
  const a = await abrufen(holen, url);
  if (a.art === "antwort" && a.status === 404) return { befunde: [], warnungen: [] };
  if (a.art === "fehler" || a.status !== 200)
    return { befunde: [], warnungen: [`MiLoV${n}: ${url} nicht erreichbar (${beschreibe(a)})`] };
  if (!new RegExp(`<title>\\s*MiLoV${n}\\b`).test(text(a)))
    return { befunde: [], warnungen: [`MiLoV${n}: ${url} ist nicht die erwartete Verordnung`] };
  const befund: Befund = {
    schluessel: `milov${n}`,
    titel: `Neue Mindestlohnanpassungsverordnung: MiLoV${n}`,
    text: `Auf gesetze-im-internet.de steht die ${n}. Mindestlohnanpassungsverordnung: ${url}. Zu tun: die neuen Beträge mit Gültigkeit und Fundstelle in \`${WERTE_TS}\` eintragen (Mindestlohn und die Minijob-Grenze daraus), § 1 MiLoV${n} in scripts/gesetze/normen.json aufnehmen. Schritte: ${DOKU}`,
  };
  return { befunde: [befund], warnungen: [] };
}

/** Missing yearly values and a new minimum wage ordinance after the one numbered `bekannteMiLoV` */
export async function pruefeJahreswerte(
  heute: string,
  j: Jahreswerte,
  bekannteMiLoV: number,
  holen: Holen,
): Promise<Ergebnis> {
  const neu = await neueMiLoV(bekannteMiLoV, holen);
  return { befunde: [...fehlendeJahreswerte(heute, j), ...neu.befunde], warnungen: neu.warnungen };
}
