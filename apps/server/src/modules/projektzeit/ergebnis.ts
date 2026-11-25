/** Errors as values (CLAUDE.md): what a write of the module Projektzeit can answer */
export type Grund =
  | "unbekannt"
  | "verwendet"
  | "archiviert"
  | "fest"
  | "doppelt"
  | "kunde_unbekannt"
  | "projekt_unbekannt"
  | "taetigkeit_unbekannt"
  | "person_unbekannt"
  // S-602: the stopwatch and the bookings
  | "laeuft"
  | "laeuft_nicht"
  | "ueberschneidung"
  | "abgerechnet"
  | "spanne"
  // S-605: the Stundennachweis
  | "unterschrieben"
  | "abweichung"
  | "leer"
  // S-606: the transfer to Haben
  | "ohne_auftrag";

export type Ergebnis<T> = { ok: true; wert: T } | { ok: false; grund: Grund };

export const ok = <T>(wert: T): Ergebnis<T> => ({ ok: true, wert });
export const nein = <T>(grund: Grund): Ergebnis<T> => ({ ok: false, grund });

/** A reference to the row in another source (Haben, an import): both parts or neither */
export type Extern = { externQuelle?: string | undefined; externId?: string | undefined };

export const externWerte = (extern: Extern) => ({
  externQuelle: extern.externQuelle ?? null,
  externId: extern.externId ?? null,
});

/**
 * Runs a write that a unique index may refuse (a reference to another source, the same rate twice):
 * two requests at once both pass a check before the write, so the index decides
 */
export const eindeutig = <T>(schreiben: () => T): Ergebnis<T> => {
  try {
    return ok(schreiben());
  } catch (fehler) {
    if (fehler instanceof Error && /UNIQUE constraint failed/.test(fehler.message))
      return nein("doppelt");
    throw fehler;
  }
};

/** archiviert: true archives from now on, false restores, undefined leaves it */
export const archivWert = (archiviert: boolean | undefined, jetzt: number) =>
  archiviert === undefined ? {} : { archiviertAm: archiviert ? jetzt : null };

/** The fields a change names: a field left out (undefined) stays as it is */
export const gesetzt = <T extends object>(werte: T) =>
  Object.fromEntries(Object.entries(werte).filter(([, wert]) => wert !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
