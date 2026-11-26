import type { Stempelart, Tag, Tagesstand } from "@soll/arbeitszeit";

/** A stamp in force as GET /api/v1/arbeitszeit/tag returns it */
export type Stempel = {
  stempelId: string;
  nutzerId: string;
  art: Stempelart;
  zeitpunkt: number;
  geraetZeitpunkt: number | null;
  quelle: "app" | "terminal" | "api" | "import";
  /** came late from a device's offline queue: the instant is the device's (S-305) */
  offline: boolean;
  /** the number on the device that signed it */
  nummer: number | null;
  korrigiert: boolean;
  /** the tool an import took it over from (its id in packages/import, S-701) */
  uebernommenAus?: string;
  /** still in this device's queue, not on the server yet */
  wartend?: true;
};

/** Numbers missing from a device of the person (S-305) */
export type Luecke = { geraetId: string; von: number; bis: number };

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
  pausenabzug?: boolean;
  stand: Tagesstand;
  stempelungen: Stempel[];
  umfeld: Stempel[];
  aenderungen: Aenderung[];
  luecken: Luecke[];
};

export type Person = { nutzerId: string; name: string; rolle: string; modellId: string | null };
