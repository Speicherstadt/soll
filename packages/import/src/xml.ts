/*
 * A small XML reader for the parts of an Excel workbook (BAULISTE.md S-702): it walks the text once
 * and hands each start tag, end tag and run of text to a handler. It knows no DTD: a document with
 * `<!DOCTYPE` or `<!ENTITY` is refused, so no entity is ever expanded ("billion laughs") and nothing
 * outside the file is read (XXE). Only the five predefined entities and character references are
 * resolved (XML 1.0, sections 4.1 and 4.6). Names lose their namespace prefix (`x:row` is `row`).
 * Every search goes forward with `indexOf` or a single loop, so the time is linear in the text.
 */

export type Merkmale = Record<string, string>;

export type XmlHandler = {
  start?: (name: string, merkmale: Merkmale, leer: boolean) => void;
  ende?: (name: string) => void;
  /** raw text between tags; `textAus` resolves its entities */
  text?: (roh: string) => void;
};

const ENTITAETEN: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

const zeichen = (code: number): string | null =>
  Number.isInteger(code) && code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
    ? String.fromCodePoint(code)
    : null;

const referenz = (name: string): string | null => {
  if (name.startsWith("#x")) return zeichen(Number.parseInt(name.slice(2), 16));
  if (name.startsWith("#")) return zeichen(Number.parseInt(name.slice(1), 10));
  return ENTITAETEN[name] ?? null;
};

/** Text with its entities resolved; an unknown one stays as written */
export const textAus = (roh: string): string => {
  if (!roh.includes("&")) return roh;
  let aus = "";
  let i = 0;
  while (i < roh.length) {
    const amp = roh.indexOf("&", i);
    // a reference is short: looking only a few characters ahead keeps "&&&…" linear
    const nah = amp < 0 ? -1 : roh.slice(amp, amp + 12).indexOf(";");
    const semi = nah < 0 ? -1 : amp + nah;
    if (amp < 0 || semi < 0) {
      aus += roh.slice(i, amp < 0 ? undefined : amp + 1);
      i = amp < 0 ? roh.length : amp + 1;
      continue;
    }
    const ersatz = referenz(roh.slice(amp + 1, semi));
    aus += roh.slice(i, amp) + (ersatz ?? roh.slice(amp, semi + 1));
    i = semi + 1;
  }
  return aus;
};

const lokal = (name: string): string => name.slice(name.indexOf(":") + 1);

const istLeer = (z: string | undefined): boolean =>
  z === " " || z === "\t" || z === "\n" || z === "\r";

/** The attributes inside a start tag, in one pass; a broken one ends the list */
export const merkmaleAus = (innen: string): Merkmale => {
  const merkmale: Merkmale = {};
  let i = 0;
  while (i < innen.length) {
    while (istLeer(innen[i])) i++;
    const gleich = innen.indexOf("=", i);
    if (gleich < 0) break;
    const name = innen.slice(i, gleich).trim();
    let k = gleich + 1;
    while (istLeer(innen[k])) k++;
    const quote = innen[k];
    if (quote !== '"' && quote !== "'") break;
    const schluss = innen.indexOf(quote, k + 1);
    if (schluss < 0) break;
    merkmale[name] = textAus(innen.slice(k + 1, schluss));
    i = schluss + 1;
  }
  return merkmale;
};

/** The `>` that closes the tag opened at `start`, past `>` inside quoted values */
const tagEnde = (xml: string, start: number): number => {
  let quote = "";
  for (let i = start + 1; i < xml.length; i++) {
    const z = xml[i];
    if (quote !== "") {
      if (z === quote) quote = "";
    } else if (z === '"' || z === "'") quote = z;
    else if (z === ">") return i;
  }
  return -1;
};

/** Where a comment, CDATA section or processing instruction ends, or -1 */
const ueberspringen = (xml: string, lt: number, auf: XmlHandler): number | null => {
  const bloecke: [string, string][] = [
    ["<!--", "-->"],
    ["<![CDATA[", "]]>"],
    ["<?", "?>"],
  ];
  for (const [anfang, schluss] of bloecke) {
    if (!xml.startsWith(anfang, lt)) continue;
    const ende = xml.indexOf(schluss, lt + anfang.length);
    if (ende >= 0 && anfang === "<![CDATA[")
      auf.text?.(xml.slice(lt + anfang.length, ende).replace(/&/g, "&amp;"));
    return ende < 0 ? -1 : ende + schluss.length;
  }
  return null;
};

const tag = (xml: string, lt: number, gt: number, auf: XmlHandler): void => {
  const innen = xml.slice(lt + 1, gt);
  if (innen.startsWith("/")) {
    auf.ende?.(lokal(innen.slice(1).trim()));
    return;
  }
  const leer = innen.endsWith("/");
  const koerper = leer ? innen.slice(0, -1) : innen;
  let n = 0;
  while (n < koerper.length && !istLeer(koerper[n])) n++;
  const name = lokal(koerper.slice(0, n));
  auf.start?.(name, merkmaleAus(koerper.slice(n)), leer);
  if (leer) auf.ende?.(name);
};

/** Walks a document; false when it is not well formed enough to read or has a DTD */
export const xmlDurchlaufen = (xml: string, auf: XmlHandler): boolean => {
  if (xml.includes("<!DOCTYPE") || xml.includes("<!ENTITY")) return false;
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i) auf.text?.(xml.slice(i, lt));
    const weiter = ueberspringen(xml, lt, auf);
    if (weiter === -1) return false;
    if (weiter !== null) {
      i = weiter;
      continue;
    }
    if (xml.startsWith("<!", lt)) return false;
    const gt = tagEnde(xml, lt);
    if (gt < 0) return false;
    tag(xml, lt, gt, auf);
    i = gt + 1;
  }
  return true;
};
