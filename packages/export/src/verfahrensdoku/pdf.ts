import { PDFDocument } from "pdf-lib";
import { druckbar, metadaten, type Schreiber, schreiber, schriften } from "../pdf/schreiber.ts";
import { pruefwertText, standText } from "./markdown.ts";
import type { Verfahrensdoku, VerfahrensdokuAbschnitt } from "./modell.ts";

/*
 * The Verfahrensdokumentation as a PDF with pdf-lib (S-902): A4 portrait, the same content as the
 * Markdown. The date of the version is the only time in it, so the same document gives the same file.
 */

const EINZUG = 12;

const kopf = (s: Schreiber, doku: Verfahrensdoku) => {
  for (const teil of s.umbrechen(doku.titel, 0, { fett: true, groesse: 16 })) {
    s.platz(2);
    s.text(teil, 0, { fett: true, groesse: 16 });
    s.zeile(20);
  }
  s.absatz(standText(doku), { grau: true });
  s.absatz(pruefwertText(doku), { grau: true });
  s.zeile(10);
};

/** Items and gaps with a mark in front and their further lines indented */
const eingerueckt = (s: Schreiber, marke: string, text: string, fett = false) => {
  s.umbrechen(text, EINZUG, { fett }).forEach((teil, index) => {
    s.platz(1);
    if (index === 0) s.text(marke, 0, { fett });
    s.text(teil, EINZUG, { fett });
    s.zeile();
  });
};

const abschnittSchreiben = (s: Schreiber, a: VerfahrensdokuAbschnitt) => {
  s.platz(3);
  for (const teil of s.umbrechen(a.titel, 0, { fett: true, groesse: 11 })) {
    s.text(teil, 0, { fett: true, groesse: 11 });
    s.zeile(15);
  }
  for (const absatz of a.absaetze) {
    s.absatz(absatz);
    s.zeile(4);
  }
  for (const eintrag of a.liste ?? []) eingerueckt(s, "–", eintrag);
  for (const luecke of a.luecken ?? []) eingerueckt(s, "!", `Fehlt: ${luecke}`, true);
  s.zeile(10);
};

export const verfahrensdokuPdf = async (doku: Verfahrensdoku): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const schrift = await schriften(doc);
  metadaten(doc, {
    titel: druckbar(schrift.normal, doku.titel),
    betreff: "Verfahrensdokumentation nach GoBD, BMF-Schreiben vom 28.11.2019, Rz. 151 ff.",
    stand: Date.parse(`${doku.stand.datum}T00:00:00Z`),
  });
  const s = schreiber(doc, schrift);
  kopf(s, doku);
  for (const a of doku.abschnitte) abschnittSchreiben(s, a);
  return doc.save();
};
