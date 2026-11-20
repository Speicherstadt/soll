/**
 * The roles of a business (BAULISTE.md S-106) and what each may do in Soll. Better Auth stores the
 * role at the member; the rights are checked here, on the server, for every route.
 */
export const ROLLEN = [
  "inhaber",
  "planer",
  "mitarbeiter",
  "lohnbuero",
  "betriebsrat",
  "extern",
  "geraet",
] as const;

export type Rolle = (typeof ROLLEN)[number];

export const RECHTE = [
  "betrieb:lesen",
  "betrieb:module",
  "betrieb:einrichten",
  "modelle:lesen",
  "mitglieder:lesen",
  "mitglieder:einladen",
  "mitglieder:rolle",
  "pin:setzen",
  "pin:pruefen",
  "stempeln",
  "zeiten:alle",
  "zeiten:korrigieren",
  "modelle:zuordnen",
  "monat:abschliessen",
  "abwesenheiten:freigeben",
  "abwesenheiten:gesundheit",
  "abwesenheiten:einstellen",
  "plan:lesen",
  "plan:planen",
] as const;

export type Recht = (typeof RECHTE)[number];

const RECHTE_JE_ROLLE: Record<Rolle, readonly Recht[]> = {
  inhaber: [
    "betrieb:lesen",
    "betrieb:module",
    "betrieb:einrichten",
    "modelle:lesen",
    "mitglieder:lesen",
    "mitglieder:einladen",
    "mitglieder:rolle",
    "pin:setzen",
    "stempeln",
    "zeiten:alle",
    "zeiten:korrigieren",
    "modelle:zuordnen",
    // the business confirms and closes a month: the owner, who answers for the records (S-306)
    "monat:abschliessen",
    // S-401: approves leave, sees sickness (it pays it, § 3 EntgFG) and sets when a certificate is due
    "abwesenheiten:freigeben",
    "abwesenheiten:gesundheit",
    "abwesenheiten:einstellen",
    "plan:lesen",
    "plan:planen",
  ],
  // the member list with e-mail addresses: for managing people, payroll and the works council
  // (BetrVG § 80 Abs. 2); employees and external staff see their own data (docs/plan.md)
  // planners correct times with a reason (docs/plan.md, "Änderungen an Stempelungen")
  planer: [
    "betrieb:lesen",
    "mitglieder:lesen",
    "mitglieder:einladen",
    "stempeln",
    "zeiten:alle",
    "zeiten:korrigieren",
    // planners approve leave for the plan, but see sickness only as "abwesend" (Art. 9 DSGVO)
    "abwesenheiten:freigeben",
    // the draft of the plan is for owner and planner until it is published (S-501, S-503)
    "plan:lesen",
    "plan:planen",
  ],
  // everyone who works for the business stamps, and sees and corrects their own times (S-304);
  // the plan they read once it is published (S-503)
  mitarbeiter: ["betrieb:lesen", "stempeln", "plan:lesen"],
  // wages in the working-time models: for the owner and payroll only (Art. 5 Abs. 1 lit. c DSGVO)
  // payroll sees sickness: continued pay and the eAU go through its program (§ 109 SGB IV)
  lohnbuero: [
    "betrieb:lesen",
    "mitglieder:lesen",
    "modelle:lesen",
    "stempeln",
    "zeiten:alle",
    "abwesenheiten:gesundheit",
    "plan:lesen",
  ],
  betriebsrat: ["betrieb:lesen", "mitglieder:lesen", "stempeln", "plan:lesen"],
  extern: ["betrieb:lesen"],
  // the terminal checks PINs and nothing else (S-801)
  geraet: ["pin:pruefen"],
};

export const istRolle = (wert: unknown): wert is Rolle => ROLLEN.includes(wert as Rolle);

/** The roles of one member: Better Auth stores several joined by commas (its parseRoles) */
export const rollenVon = (rolle: string): string[] => rolle.split(",").map((teil) => teil.trim());

/** A member with several roles has the rights of each */
export const darf = (rolle: string, recht: Recht): boolean =>
  rollenVon(rolle).some((teil) => istRolle(teil) && RECHTE_JE_ROLLE[teil].includes(recht));

/**
 * Roles of people who work for the business: while one of them is a member, working time cannot be
 * switched off (docs/plan.md, "Module"). The owner alone, external staff and devices are not.
 */
export const BESCHAEFTIGT: readonly Rolle[] = ["planer", "mitarbeiter", "lohnbuero", "betriebsrat"];

/**
 * Whether a stored role names someone who works for the business. Better Auth stores several roles of
 * one member joined by commas (its parseRoles), so each of them counts.
 */
export const istBeschaeftigt = (rolle: string): boolean =>
  rollenVon(rolle).some((teil) => BESCHAEFTIGT.includes(teil as Rolle));
