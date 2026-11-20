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
  "mitglieder:lesen",
  "mitglieder:einladen",
  "mitglieder:rolle",
  "pin:setzen",
  "pin:pruefen",
] as const;

export type Recht = (typeof RECHTE)[number];

const RECHTE_JE_ROLLE: Record<Rolle, readonly Recht[]> = {
  inhaber: [
    "betrieb:lesen",
    "betrieb:module",
    "mitglieder:lesen",
    "mitglieder:einladen",
    "mitglieder:rolle",
    "pin:setzen",
  ],
  // the member list with e-mail addresses: for managing people, payroll and the works council
  // (BetrVG § 80 Abs. 2); employees and external staff see their own data (docs/plan.md)
  planer: ["betrieb:lesen", "mitglieder:lesen", "mitglieder:einladen"],
  mitarbeiter: ["betrieb:lesen"],
  lohnbuero: ["betrieb:lesen", "mitglieder:lesen"],
  betriebsrat: ["betrieb:lesen", "mitglieder:lesen"],
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
