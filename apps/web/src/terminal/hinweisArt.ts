export type HinweisArt = "nfc" | "qr" | "pin";

/** Match the kiosk prompt icon to the active identification hardware (#118) */
export const hinweisArt = (mitNfc: boolean, mitQr: boolean): HinweisArt => {
  if (mitNfc) return "nfc";
  return mitQr ? "qr" : "pin";
};
