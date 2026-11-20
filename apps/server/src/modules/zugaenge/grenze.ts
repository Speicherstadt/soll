/** Calls a token may make per window (docs/plan.md, "Grenze je Token") */
export const AUFRUFE_JE_MINUTE = 120;

const FENSTER_MS = 60_000;
/** Above this many tokens in memory the windows that have ended are dropped */
const AUFRAEUMEN_AB = 10_000;

export type GrenzErgebnis = { ok: true } | { ok: false; wartenSekunden: number };

type Fenster = { beginn: number; anzahl: number };

/**
 * A fixed window per token, kept in memory: a server is one process (`bun build --compile`), and a
 * restart that forgets the counts lets at most one window more through
 */
export const ratenGrenze = (grenze = AUFRUFE_JE_MINUTE, fensterMs = FENSTER_MS) => {
  const fenster = new Map<string, Fenster>();
  const aufraeumen = (jetzt: number) => {
    if (fenster.size < AUFRAEUMEN_AB) return;
    for (const [schluessel, f] of fenster)
      if (jetzt - f.beginn >= fensterMs) fenster.delete(schluessel);
  };
  return (schluessel: string, jetzt: number): GrenzErgebnis => {
    const bisher = fenster.get(schluessel);
    if (!bisher || jetzt - bisher.beginn >= fensterMs) {
      aufraeumen(jetzt);
      fenster.set(schluessel, { beginn: jetzt, anzahl: 1 });
      return { ok: true };
    }
    if (bisher.anzahl >= grenze)
      return { ok: false, wartenSekunden: Math.ceil((bisher.beginn + fensterMs - jetzt) / 1000) };
    bisher.anzahl += 1;
    return { ok: true };
  };
};

export type RatenGrenze = ReturnType<typeof ratenGrenze>;
