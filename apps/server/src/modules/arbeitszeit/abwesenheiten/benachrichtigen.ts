import type { Abwesenheitsart, Tag } from "@soll/arbeitszeit";
import { datumText } from "@soll/export";
import { darf, type Recht } from "../../../auth/rollen.ts";
import type { Db } from "../../../db/oeffnen.ts";
import { type Mailer, zustellbar } from "../../mail/index.ts";
import { adresseVon, mitgliederMitNamen, namenVon } from "../../mitglieder/index.ts";
import type { AbwesenheitZeile } from "./lesen.ts";
import type { GeplanteSchicht } from "./plan.ts";

/*
 * Mails about absences (S-401) over the mail module of S-306, plain German text like the time sheet
 * (docs/plan.md, "Sprache des Stundenzettels"). Without mail or address nothing is sent; the app
 * shows the same in its lists. Planners read a sickness only as „abwesend“ (Art. 9 DSGVO).
 */

const ART: Record<Abwesenheitsart, string> = {
  urlaub: "Urlaub",
  krank: "krank",
  kind_krank: "Kind krank",
  sonderurlaub: "Sonderurlaub",
  ueberstundenabbau: "Überstundenabbau",
};

const zeitraum = (zeile: Pick<AbwesenheitZeile, "von" | "bis">): string =>
  zeile.bis === null
    ? `ab ${datumText(zeile.von)}`
    : zeile.bis === zeile.von
      ? `am ${datumText(zeile.von)}`
      : `vom ${datumText(zeile.von)} bis ${datumText(zeile.bis)}`;

const senden = async (
  mail: Mailer | null,
  an: readonly string[],
  betreff: string,
  text: string,
) => {
  if (mail === null) return;
  for (const adresse of an) await mail({ an: adresse, betreff, text: `${text}\n` });
};

/** The addresses of the members with a right, except the person the absence is of */
const adressenMit = (db: Db, betriebId: string, recht: Recht, ausser: string): string[] =>
  mitgliederMitNamen(db, betriebId)
    .filter((m) => m.nutzerId !== ausser && darf(m.rolle, recht))
    .map((m) => adresseVon(db, m.nutzerId))
    .filter(zustellbar);

const nameVon = (db: Db, nutzerId: string) => namenVon(db, [nutzerId]).get(nutzerId) ?? "";

/** A new request, to whoever decides on it */
export const antragMelden = async (db: Db, mail: Mailer | null, zeile: AbwesenheitZeile) => {
  const name = nameVon(db, zeile.nutzerId);
  await senden(
    mail,
    adressenMit(db, zeile.betriebId, "abwesenheiten:freigeben", zeile.nutzerId),
    `Antrag: ${ART[zeile.art]} von ${name}`,
    `${name} beantragt ${ART[zeile.art]} ${zeitraum(zeile)}. Du kannst den Antrag in Soll unter Abwesenheiten freigeben oder ablehnen.`,
  );
};

const ENTSCHIEDEN: Partial<Record<AbwesenheitZeile["status"], string>> = {
  genehmigt: "genehmigt",
  abgelehnt: "abgelehnt",
  storniert: "storniert",
};

/** A decision of the business, to the person */
export const entscheidungMelden = async (db: Db, mail: Mailer | null, zeile: AbwesenheitZeile) => {
  const wort = ENTSCHIEDEN[zeile.status];
  const an = adresseVon(db, zeile.nutzerId);
  if (wort === undefined || zeile.entschiedenVon === zeile.nutzerId || !zustellbar(an)) return;
  const von = nameVon(db, zeile.entschiedenVon ?? "");
  await senden(
    mail,
    [an],
    `${ART[zeile.art]} ${zeitraum(zeile)}: ${wort}`,
    [
      `${von} hat deine Abwesenheit (${ART[zeile.art]} ${zeitraum(zeile)}) ${wort}.`,
      ...(zeile.grund ? [`Grund: ${zeile.grund}`] : []),
    ].join("\n"),
  );
};

/** The line of the open shifts, drafts marked; nothing without shifts */
const schichtZeilen = (offen: readonly GeplanteSchicht[]): string[] =>
  offen.length === 0
    ? []
    : [
        `Offene Schichten: ${offen.map((s) => `${datumText(s.tag)} ${s.bezeichnung}${s.entwurf ? " (Entwurf)" : ""}`).join(", ")}`,
      ];

/**
 * A sickness, to the business: whoever may see sickness reads the kind and when the certificate is
 * due, with the reminder to fetch the eAU; whoever plans reads „abwesend“. Each reads the open
 * shifts, the drafts among them only whoever plans (S-503).
 */
export const krankheitMelden = async (
  db: Db,
  mail: Mailer | null,
  zeile: AbwesenheitZeile,
  angaben: { faelligAm: Tag | null; offeneSchichten: readonly GeplanteSchicht[] },
) => {
  const name = nameVon(db, zeile.nutzerId);
  const gesundheit = adressenMit(db, zeile.betriebId, "abwesenheiten:gesundheit", zeile.nutzerId);
  const planer = adressenMit(db, zeile.betriebId, "abwesenheiten:freigeben", zeile.nutzerId).filter(
    (adresse) => !gesundheit.includes(adresse),
  );
  const planend = adressenMit(db, zeile.betriebId, "plan:planen", zeile.nutzerId);
  const veroeffentlicht = angaben.offeneSchichten.filter((schicht) => !schicht.entwurf);
  /** Sends to each address the shifts it may know of */
  const jeSicht = async (an: readonly string[], betreff: string, zeilen: readonly string[]) => {
    const mitEntwurf = an.filter((adresse) => planend.includes(adresse));
    const ohneEntwurf = an.filter((adresse) => !planend.includes(adresse));
    const text = (offen: readonly GeplanteSchicht[]) =>
      [...zeilen, ...schichtZeilen(offen)].join("\n");
    await senden(mail, mitEntwurf, betreff, text(angaben.offeneSchichten));
    await senden(mail, ohneEntwurf, betreff, text(veroeffentlicht));
  };
  const frist =
    angaben.faelligAm === null
      ? []
      : [
          `Die Bescheinigung ist am ${datumText(angaben.faelligAm)} fällig (§ 5 EntgFG). Bei gesetzlich Versicherten rufst du die eAU dann über dein Lohnprogramm bei der Krankenkasse ab (§ 109 SGB IV).`,
        ];
  await jeSicht(gesundheit, `${name}: ${ART[zeile.art]} ${zeitraum(zeile)}`, [
    `${name} hat sich ${zeitraum(zeile)} ${ART[zeile.art]} gemeldet.`,
    ...frist,
  ]);
  await jeSicht(planer, `${name}: abwesend ${zeitraum(zeile)}`, [
    `${name} ist ${zeitraum(zeile)} abwesend.`,
  ]);
};
