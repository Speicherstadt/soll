/**
 * Values the setup reads and writes: euros as cents and hours as minutes, whole numbers only
 * (CLAUDE.md, "Never": no floats for money or time). Digits are read as text, never as a fraction.
 */

const DEUTSCH_MIT_PUNKTEN = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
const DEUTSCH = /^(\d{1,9})(?:,(\d{1,2}))?$/;
const MIT_PUNKT = /^(\d{1,9})\.(\d{1,2})$/;

/** Cents of an amount in euros ("3.200,50", "13,90", "13.90"), or null if it is none */
export const centAus = (text: string): number | null => {
  const rein = text.replace(/€/g, "").trim();
  const teile = DEUTSCH_MIT_PUNKTEN.exec(rein) ?? DEUTSCH.exec(rein) ?? MIT_PUNKT.exec(rein);
  if (!teile) return null;
  const euro = Number((teile[1] ?? "").replaceAll(".", ""));
  const cent = Number((teile[2] ?? "").padEnd(2, "0"));
  return euro * 100 + cent;
};

/** Minutes of a duration written as hours ("40") or hours and minutes ("19:30"), up to a week */
export const minutenAus = (text: string): number | null => {
  const teile = /^(\d{1,3})(?::([0-5]\d))?$/.exec(text.trim());
  if (!teile) return null;
  const minuten = Number(teile[1]) * 60 + Number(teile[2] ?? "0");
  return minuten <= 7 * 24 * 60 ? minuten : null;
};

/** Weekly minutes spread over the chosen days, Monday to Sunday; the remainder goes to the first days */
export const verteilen = (wochenMinuten: number, tage: readonly boolean[]): number[] => {
  const anzahl = tage.filter(Boolean).length;
  if (anzahl === 0) return tage.map(() => 0);
  const basis = Math.floor(wochenMinuten / anzahl);
  let rest = wochenMinuten - basis * anzahl;
  return tage.map((tag) => {
    if (!tag) return 0;
    const extra = rest > 0 ? 1 : 0;
    rest -= extra;
    return basis + extra;
  });
};

/** A duration as 7:30 (DESIGN.md, "Schrift und Maße") */
export const dauerText = (minuten: number): string =>
  `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;

/** Cents as euros in the language; Intl reads the amount as decimal text, so no fraction is made */
export const euroText = (cent: number, locale: string): string => {
  const rest = cent % 100;
  const euro = (cent - rest) / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
    `${euro}.${String(rest).padStart(2, "0")}` as unknown as number,
  );
};

const UMLAUTE: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** The short name Better Auth needs for an organization: the business name in plain letters, made unique */
export const slugAus = (name: string, zufall: string): string => {
  const basis = name
    .toLowerCase()
    .replace(/[äöüß]/g, (zeichen) => UMLAUTE[zeichen] ?? zeichen)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${basis || "betrieb"}-${zufall}`;
};
