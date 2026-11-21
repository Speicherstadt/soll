/*
 * The text of a single norm on gesetze-im-internet.de, normalised so that its SHA-256 changes only
 * with the wording. A norm is at /<law>/__<paragraph>.html: heading (div.jnheader), text (div.jnhtml
 * with div.jurAbsatz) and footnotes (div.jnfussnote), then the footer (div#fusszeile). The text runs
 * from the heading to the footer, without tags, with entities resolved and white space collapsed;
 * navigation ("zurück", "weiter"), logos, anchors and the footer stay out. Copied from
 * firsttris/haben, scripts/jahreswerte/normen.ts (`normText`), so a hash in Haben and in Soll agree.
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sect: "§",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  euro: "€",
  ndash: "–",
  mdash: "—",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
};

const entities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz, e: string) => {
    if (e[0] !== "#") return ENTITIES[e] ?? ganz;
    const hex = e[1] === "x" || e[1] === "X";
    return String.fromCodePoint(hex ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)));
  });

/** The norm's text without navigation and footer, or null when the page is no single norm */
export function normText(html: string): string | null {
  const start = html.indexOf('<div class="jnheader">');
  const ende = html.indexOf('<div id="fusszeile">', start);
  if (start < 0 || ende < 0) return null;
  const ohneTags = html
    .slice(start, ende)
    .replace(/<a\s[^>]*>\s*Nichtamtliches Inhaltsverzeichnis\s*<\/a>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return entities(ohneTags).replace(/\s+/g, " ").trim();
}
