/** The rules on time sheet and Prüfexport, with the words of docs/regeln.md */
export const REGELN: Readonly<Record<string, string>> = {
  "R-01": "Stempelung unvollständig",
  "R-02": "Höchstarbeitszeit",
  "R-03": "Ausgleichszeitraum",
  "R-04": "Ruhepause",
  "R-05": "Ruhezeit",
  "R-24": "Krank im Urlaub ohne Bescheinigung",
};

/** "Verstoß: Ruhepause · § 4 ArbZG" */
export const befundText = (befund: {
  regel: string;
  norm: string;
  schwere: "hinweis" | "verstoss";
}): string =>
  `${befund.schwere === "verstoss" ? "Verstoß" : "Hinweis"}: ${REGELN[befund.regel] ?? befund.regel} · ${befund.norm}`;
