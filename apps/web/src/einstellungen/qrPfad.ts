import { encode } from "uqr";

/**
 * The dark modules of a QR code (ISO/IEC 18004, encoded by uqr) as one SVG path in module units,
 * with the quiet zone of four modules the standard asks for; error correction M, so a creased card
 * still reads
 */
export const qrPfad = (wert: string): { groesse: number; pfad: string } => {
  const { data, size } = encode(wert, { ecc: "M", border: 4 });
  const teile: string[] = [];
  data.forEach((zeile, y) => {
    zeile.forEach((dunkel, x) => {
      if (dunkel) teile.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return { groesse: size, pfad: teile.join("") };
};
