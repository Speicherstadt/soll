/**
 * Records of a CSV file after RFC 4180 (section 2): fields separated by one character, records by
 * CRLF or LF, a field in double quotes may hold the separator, line breaks and "" for one quote.
 * Excel in a German locale separates by semicolon, so the separator is passed in.
 */
export type CsvZeile = {
  zeile: number;
  felder: string[];
  /** The file ends inside a quote opened on this record: its fields cannot be told apart */
  offen?: true;
};

type Stand = {
  zeilen: CsvZeile[];
  felder: string[];
  feld: string;
  inAnfuehrung: boolean;
  zeile: number;
  start: number;
};

const zeileAbschliessen = (stand: Stand): void => {
  stand.felder.push(stand.feld);
  // a line with nothing on it is no record (an empty line at the end, a gap in the middle)
  if (stand.felder.length > 1 || stand.felder[0] !== "")
    stand.zeilen.push({ zeile: stand.start, felder: stand.felder });
  stand.felder = [];
  stand.feld = "";
};

/** One character outside quotes: a separator, a line break, the start of a quote, or text */
const ausserhalb = (stand: Stand, zeichen: string, trenner: string): void => {
  if (zeichen === '"' && stand.feld === "") stand.inAnfuehrung = true;
  else if (zeichen === trenner) {
    stand.felder.push(stand.feld);
    stand.feld = "";
  } else if (zeichen === "\n") {
    zeileAbschliessen(stand);
    stand.zeile += 1;
    stand.start = stand.zeile;
  } else if (zeichen !== "\r") stand.feld += zeichen;
};

export const csvZeilen = (text: string, trenner: string): CsvZeile[] => {
  const stand: Stand = {
    zeilen: [],
    felder: [],
    feld: "",
    inAnfuehrung: false,
    zeile: 1,
    start: 1,
  };
  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i] as string;
    if (!stand.inAnfuehrung) ausserhalb(stand, zeichen, trenner);
    else if (zeichen === '"' && text[i + 1] === '"') {
      stand.feld += '"';
      i++;
    } else if (zeichen === '"') stand.inAnfuehrung = false;
    else {
      if (zeichen === "\n") stand.zeile += 1;
      stand.feld += zeichen;
    }
  }
  const offen = stand.inAnfuehrung;
  zeileAbschliessen(stand);
  const letzte = stand.zeilen.at(-1);
  if (offen && letzte) letzte.offen = true;
  return stand.zeilen;
};

/**
 * The separator of a file: the one of semicolon, comma and tab found most often in its first line, or
 * "" (which matches no character) when it has none: a file of one column keeps "Weber, Jonas" whole
 */
export const trennzeichenVon = (text: string): string => {
  // one pass over the first line, so a line of millions of separators costs one count (S-701)
  const ende = text.indexOf("\n");
  const zahl: Record<string, number> = { ";": 0, "\t": 0, ",": 0 };
  for (let i = 0; i < (ende === -1 ? text.length : ende); i++) {
    const zeichen = text[i] as string;
    if (zeichen in zahl) zahl[zeichen] = (zahl[zeichen] as number) + 1;
  }
  return [";", "\t", ","].reduce(
    (best, zeichen) => ((zahl[zeichen] as number) > (zahl[best] ?? 0) ? zeichen : best),
    "",
  );
};
