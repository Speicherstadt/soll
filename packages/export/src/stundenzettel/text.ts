import { inflateSync } from "node:zlib";

/**
 * The text a PDF of pdf-lib draws, for tests: its content streams inflated, the hex strings of the
 * text operators decoded as WinAnsi (the encoding of the standard fonts; Latin-1 for these letters)
 */
export const pdfText = (pdf: Uint8Array): string => {
  const roh = Buffer.from(pdf).toString("latin1");
  const stroeme = [...roh.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((treffer) => {
    const daten = Buffer.from(treffer[1] ?? "", "latin1");
    try {
      return inflateSync(daten).toString("latin1");
    } catch {
      return daten.toString("latin1");
    }
  });
  return stroeme
    .flatMap((strom) => [...strom.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)])
    .map((treffer) => Buffer.from(treffer[1] ?? "", "hex").toString("latin1"))
    .join("\n");
};
