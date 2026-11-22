import type { Auslastung, PersonAuslastung, TeamAuslastung } from "@soll/arbeitszeit";

/** The answers of /api/v1/projektzeit/auslastung (S-604) */
export type TeamAntwort = { monat: string; jePersonSeit: number | null; team: TeamAuslastung };
export type PersonenAntwort = {
  monat: string;
  jePersonSeit: number | null;
  personen: (PersonAuslastung & { name: string })[];
};
export type IchAntwort = { monat: string; jePersonSeit: number | null; eigene: PersonAuslastung };

export type { Auslastung };
