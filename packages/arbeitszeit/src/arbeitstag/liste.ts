/**
 * A list built from the front without copying (eighth review of PR #11): reading the stamps adds a
 * stretch or a finding per stamp and changes only the newest stretch, so each step stays constant
 * instead of copying everything read so far.
 */
export type Liste<T> = { kopf: T; rest: Liste<T> } | null;

export const vorne = <T>(liste: Liste<T>, kopf: T): Liste<T> => ({ kopf, rest: liste });

/** The elements in the order they were added, the oldest first */
export const alsArray = <T>(liste: Liste<T>): T[] => {
  const elemente: T[] = [];
  for (let teil = liste; teil !== null; teil = teil.rest) elemente.push(teil.kopf);
  return elemente.reverse();
};
