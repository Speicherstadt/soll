/**
 * The list a step loaded from the server, joined with what was added on the page before that
 * answer came: a slow first load must not take back an entry the server already holds
 */
export const ergaenzt = <T>(geladen: T[], hier: T[], schluessel: (eintrag: T) => string): T[] => {
  const bekannt = new Set(geladen.map(schluessel));
  return [...geladen, ...hier.filter((eintrag) => !bekannt.has(schluessel(eintrag)))];
};
