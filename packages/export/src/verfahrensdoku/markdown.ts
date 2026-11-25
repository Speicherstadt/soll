import type { Verfahrensdoku } from "./modell.ts";

/*
 * Markdown (CommonMark) from the data model, as a download. Text from the business's statements is
 * escaped, so a star in a name or a "#" at the start of a line does not become formatting and no
 * HTML gets through. Copied from firsttris/haben, packages/gobd-kern/src/verfahrensdoku/markdown.ts
 * (AGPL-3.0, same author); the Stand also names the Prüfwert in Soll.
 */

/**
 * Characters with a meaning in CommonMark, < and > against HTML, and & against entity references
 * ("&amp;" would show as "&", CommonMark 0.31, 2.5)
 */
const MARKDOWN = /[\\`*_{}[\]<>#|!~&]/g;

export const markdownText = (text: string): string =>
  // "1." or "-" at the start of a line would become a list, "---" or "===" below a line a heading.
  // Line breaks stay as hard breaks, empty lines separate paragraphs.
  text
    .replace(MARKDOWN, (zeichen) => `\\${zeichen}`)
    .split(/\r?\n/)
    .map((zeile) =>
      zeile
        .trim()
        .replace(/^(\d+)([.)])/, "$1\\$2")
        .replace(/^([-+=])/, "\\$1"),
    )
    .filter((zeile, i, alle) => zeile !== "" || (i > 0 && alle[i - 1] !== ""))
    .join("  \n")
    .replace(/( {2}\n){2,}/g, "\n\n")
    .trim();

export const standText = (doku: Verfahrensdoku): string => {
  const stand = `Stand: ${doku.stand.datum} · ${doku.stand.programm} ${doku.stand.version}`;
  if (doku.vollstaendig) return `${stand} · vollständig`;
  const fehlen = doku.luecken === 1 ? "1 Angabe fehlt" : `${doku.luecken} Angaben fehlen`;
  return `${stand} · unvollständig, ${fehlen}`;
};

export const pruefwertText = (doku: Verfahrensdoku): string =>
  doku.stand.pruefwert
    ? `Prüfwert der Audit-Kette beim Erzeugen: ${doku.stand.pruefwert}`
    : "Die Audit-Kette des Betriebs hat beim Erzeugen noch kein Glied.";

const einzug = (text: string) => markdownText(text).replace(/\n\n/g, "  \n");

export const alsMarkdown = (doku: Verfahrensdoku): string => {
  const teile = [
    `# ${markdownText(doku.titel)}`,
    markdownText(standText(doku)),
    markdownText(pruefwertText(doku)),
  ];
  for (const a of doku.abschnitte) {
    teile.push(`## ${markdownText(a.titel)}`);
    for (const absatz of a.absaetze) teile.push(markdownText(absatz));
    if (a.liste?.length) teile.push(a.liste.map((eintrag) => `- ${einzug(eintrag)}`).join("\n"));
    if (a.luecken?.length)
      teile.push(a.luecken.map((luecke) => `> **Fehlt:** ${einzug(luecke)}`).join("\n>\n"));
  }
  return `${teile.join("\n\n")}\n`;
};
