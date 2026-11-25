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
  "konten:pflegen",
  "projekte:lesen",
  "projekte:verwalten",
  "erinnerungen:regeln",
  "plan:lesen",
  "plan:planen",
  "personen:angaben",
  "terminal:verwalten",
  "lohn:datev",
  "auskunft:erteilen",
  "api:zugang",
  "verfahrensdoku:verwalten",
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
    // S-402: changes the accounts by hand (start, payout, correction) and records the notice on
    // leave expiring, which is the employer's duty (§ 7 Abs. 3 BUrlG, BAG 9 AZR 541/15)
    "konten:pflegen",
    // customers, orders, activities and hourly rates (S-601)
    "projekte:lesen",
    "projekte:verwalten",
    // the times of the reminders hold for the whole business (S-307)
    "erinnerungen:regeln",
    "plan:lesen",
    "plan:planen",
    // birth date, Mutterschutz and the like are the employer's records, read and kept by the owner;
    // whoever plans sees only the findings they lead to (Art. 5 Abs. 1 lit. c, Art. 9 DSGVO; S-502)
    "personen:angaben",
    // pairs and revokes terminals, issues QR codes (S-801): the owner, who also sets the PINs
    "terminal:verwalten",
    // the DATEV payroll export: mapping and file (S-308)
    "lohn:datev",
    // personal access tokens for the REST API and MCP, with the rights of one's role (S-607)
    "api:zugang",
    // the business answers an Art. 15 request, also of someone who left and has no access any more;
    // the Auskunft holds health data, which only the owner and payroll see (R-31)
    "auskunft:erteilen",
    // the Verfahrensdokumentation: the business answers for its procedure (GoBD Rz. 151 ff., S-902)
    "verfahrensdoku:verwalten",
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
    // the office keeps customers, orders and rates (docs/plan.md, "Wer Stundensätze sieht")
    "projekte:lesen",
    "projekte:verwalten",
    // the draft of the plan is for owner and planner until it is published (S-501, S-503)
    "plan:lesen",
    "plan:planen",
    "api:zugang",
  ],
  // everyone who works for the business stamps, and sees and corrects their own times (S-304);
  // whoever books project time reads the orders and activities, without rates and money (S-601);
  // the plan they read once it is published (S-503)
  mitarbeiter: ["betrieb:lesen", "stempeln", "projekte:lesen", "plan:lesen", "api:zugang"],
  // wages in the working-time models: for the owner and payroll only (Art. 5 Abs. 1 lit. c DSGVO)
  // payroll sees sickness: continued pay and the eAU go through its program (§ 109 SGB IV)
  lohnbuero: [
    "betrieb:lesen",
    "mitglieder:lesen",
    "modelle:lesen",
    "stempeln",
    "zeiten:alle",
    "abwesenheiten:gesundheit",
    "projekte:lesen",
    "plan:lesen",
    // the payroll office chooses the wage types with the business and takes the file (S-308)
    "lohn:datev",
    "api:zugang",
  ],
  betriebsrat: [
    "betrieb:lesen",
    "mitglieder:lesen",
    "stempeln",
    "projekte:lesen",
    "plan:lesen",
    "api:zugang",
  ],
  extern: ["betrieb:lesen", "projekte:lesen", "api:zugang"],
  // the terminal checks PINs and nothing else (S-801); a device has no tokens (S-607)
  geraet: ["pin:pruefen"],
};

/** The rights of one role, for the Verfahrensdokumentation (S-902) */
export const rechteDerRolle = (rolle: Rolle): readonly Recht[] => RECHTE_JE_ROLLE[rolle];

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
