/*
 * What only the business can state for its Verfahrensdokumentation, no program: the fields, their
 * label in the document, what stands as a gap when one is empty and its basis. Copied from
 * firsttris/haben, packages/gobd-kern/src/verfahrensdoku/angaben.ts (AGPL-3.0, same author) and cut
 * to what Soll does not know itself: the name of the business is its own, paper receipts are not
 * Soll's, and the free "Ergänzungen" became sections of their own with a title.
 *
 * Basis: GoBD, BMF-Schreiben vom 28.11.2019 (Rz. 100 to 106 internes Kontrollsystem and data
 * security, Rz. 151 to 155 Verfahrensdokumentation) and § 146 Abs. 2 to 2b AO (place of keeping).
 */

export type AngabeFeld = {
  /** The label in the document */
  label: string;
  /** What stands in the document as a gap while the field is empty */
  luecke: string;
  max: number;
  /** Basis in the GoBD or the law */
  quelle: string;
};

export const ANGABEN_FELDER = {
  rechtsform: {
    label: "Rechtsform",
    luecke: "Rechtsform des Betriebs",
    max: 100,
    quelle: "GoBD Rz. 153 (allgemeine Beschreibung)",
  },
  anschrift: {
    label: "Anschrift",
    luecke: "Anschrift des Betriebs",
    max: 1000,
    quelle: "GoBD Rz. 153 (allgemeine Beschreibung)",
  },
  verantwortlich: {
    label: "Verantwortlich",
    luecke: "wer für die Aufzeichnung der Arbeitszeit und ihre Aufbewahrung verantwortlich ist",
    max: 1000,
    quelle: "GoBD Rz. 100 und 102 (internes Kontrollsystem)",
  },
  aufbewahrungsort: {
    label: "Ort der Aufbewahrung",
    luecke: "Ort der Aufbewahrung von Daten und Sicherungen",
    max: 2000,
    quelle: "§ 146 Abs. 2 bis 2b AO",
  },
  serverbetrieb: {
    label: "Betrieb des Servers",
    luecke: "wer den Server betreibt und Updates einspielt",
    max: 5000,
    quelle: "GoBD Rz. 101 und 153 (Betriebsdokumentation)",
  },
  datensicherung: {
    label: "Datensicherung",
    luecke:
      "Beschreibung der Datensicherung (wie, wohin, wie oft, wer die Wiederherstellung prüft)",
    max: 5000,
    quelle: "GoBD Rz. 103 bis 106 (Datensicherheit)",
  },
  schluesselablage: {
    label: "Ablage von Schlüsseln und Passwörtern",
    luecke: "wo SOLL_SECRET_KEY, Passwörter und Zertifikate verwahrt werden (nur der Ort)",
    max: 2000,
    quelle: "GoBD Rz. 103",
  },
} as const satisfies Record<string, AngabeFeld>;

export type AngabeName = keyof typeof ANGABEN_FELDER;

export const ANGABE_NAMEN = Object.keys(ANGABEN_FELDER) as AngabeName[];

/** A section the business writes itself, after the generated ones */
export type EigenerAbschnitt = { titel: string; text: string };

export const EIGENE_ABSCHNITTE = { anzahl: 20, titel: 200, text: 20000 } as const;

export type Angaben = { [N in AngabeName]: string } & { eigene: EigenerAbschnitt[] };

export const LEERE_ANGABEN: Angaben = {
  ...(Object.fromEntries(ANGABE_NAMEN.map((name) => [name, ""])) as { [N in AngabeName]: string }),
  eigene: [],
};

/** The gaps of the given fields, in their order; a field of blanks counts as empty */
export const fehlendeAngaben = (
  angaben: Partial<Angaben>,
  felder: readonly AngabeName[] = ANGABE_NAMEN,
): string[] =>
  felder.filter((name) => !angaben[name]?.trim()).map((name) => ANGABEN_FELDER[name].luecke);

/** The statements of `felder` as paragraphs "Label: text" and the gaps of the empty ones */
export const angabenAbsaetze = (
  angaben: Partial<Angaben>,
  felder: readonly AngabeName[],
): { absaetze: string[]; luecken: string[] } => ({
  absaetze: felder.flatMap((name) => {
    const wert = angaben[name]?.trim();
    return wert ? [`${ANGABEN_FELDER[name].label}: ${wert}`] : [];
  }),
  luecken: fehlendeAngaben(angaben, felder),
});
