import type { Stempelart, Tag, Tagesstand } from "@soll/arbeitszeit";

/** A stamp in force as GET /api/v1/arbeitszeit/tag returns it */
export type Stempel = {
  stempelId: string;
  nutzerId: string;
  art: Stempelart;
  zeitpunkt: number;
  geraetZeitpunkt: number | null;
  quelle: "app" | "terminal";
  korrigiert: boolean;
};

/** A change by hand: who, when, what before and after, and why */
export type Aenderung = {
  stempelId: string;
  aktion: "nachgetragen" | "geaendert" | "entfernt";
  vorher: { art: Stempelart; zeitpunkt: number } | null;
  nachher: { art: Stempelart; zeitpunkt: number } | null;
  grund: string;
  von: string;
  vonName: string;
  am: number;
};

/** A working day of one person (apps/server, modules/arbeitszeit/tag.ts) */
export type TagAnsicht = {
  nutzerId: string;
  name: string;
  tag: Tag;
  jetzt: number;
  sollMinuten: number | null;
  stand: Tagesstand;
  stempelungen: Stempel[];
  umfeld: Stempel[];
  aenderungen: Aenderung[];
};

export type Person = { nutzerId: string; name: string; rolle: string; modellId: string | null };
