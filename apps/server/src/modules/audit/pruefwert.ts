/*
 * Copied from firsttris/haben, packages/gobd-kern/src/pruefwert.ts (AGPL-3.0, same author), as
 * CLAUDE.md asks: no dependency on gobd-kern. The format is the same in both apps.
 */

/** Prüfwert as it stands on the time sheet and in the interface: „Nr. 1234 · <SHA-256>“ */
export function formatPruefwert(head: { seq: number; hash: string }): string {
  return `Nr. ${head.seq} · ${head.hash}`;
}

/** Reads a Prüfwert back; tolerant of spaces, line breaks and capital letters */
export function parsePruefwert(text: string): { seq: number; hash: string } | null {
  const match = /(\d{1,15})\D+?([0-9a-f]{64})(?![0-9a-f])/i.exec(text.replace(/\s+/g, " "));
  if (!match) return null;
  return { seq: Number(match[1]), hash: (match[2] ?? "").toLowerCase() };
}
