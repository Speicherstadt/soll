/**
 * The list a step loaded from the server, joined with what was added on the page before that
 * answer came: a slow first load must not take back an entry the server already holds, nor bring
 * back one removed on the page meanwhile (the load may have been read between the add and the
 * removal)
 */
export const ergaenzt = <T>(
  geladen: T[],
  hier: T[],
  schluessel: (eintrag: T) => string,
  entfernt: ReadonlySet<string> = new Set(),
): T[] => {
  const bekannt = new Set(geladen.map(schluessel));
  return [
    ...geladen.filter((eintrag) => !entfernt.has(schluessel(eintrag))),
    ...hier.filter((eintrag) => !bekannt.has(schluessel(eintrag))),
  ];
};
