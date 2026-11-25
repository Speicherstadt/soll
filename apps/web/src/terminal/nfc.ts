/*
 * Reading NFC cards at the terminal with Web NFC (S-802; W3C Community Group draft "Web NFC",
 * `NDEFReader`). Chrome ships it on Android only, in a visible top-level page over HTTPS; the first
 * `scan()` asks for permission and needs a tap (transient activation), later ones do not. Where the
 * browser has no `NDEFReader`, the kiosk stays with PIN and QR code.
 */

/** A SUN message as the server checks it: PICCData and SDMMAC, hex */
export type Sun = { e: string; c: string };
/** A card held to the tablet: its serial number (UID), and the SUN message of an NTAG 424 DNA */
export type NfcKarte = { uid: string; sun: Sun | null };

/** What a `reading` event carries (NDEFReadingEvent), as far as the kiosk needs it */
export type Leseereignis = {
  serialNumber?: string;
  message?: { records: readonly { recordType: string; data?: DataView | undefined }[] };
};

export type NdefLeser = EventTarget & {
  scan: (optionen?: { signal?: AbortSignal }) => Promise<void>;
};
export type NdefLeserKlasse = new () => NdefLeser;

/** The NDEFReader of the browser, if it has one */
export const nfcLeser = (): NdefLeserKlasse | undefined =>
  (globalThis as { NDEFReader?: NdefLeserKlasse }).NDEFReader;

/** The parameter names of AN12196 (`e`, `c`) and of NXP's examples (`picc_data`, `cmac`) */
const PICC = ["e", "picc_data"];
const MAC = ["c", "cmac"];

const wert = (parameter: URLSearchParams, namen: string[], zeichen: number): string | null => {
  const muster = new RegExp(`^[0-9a-fA-F]{${zeichen}}$`);
  for (const name of namen) {
    const gefunden = parameter.get(name);
    if (gefunden && muster.test(gefunden)) return gefunden;
  }
  return null;
};

/** The SUN message in the URL an NTAG 424 DNA mirrors it into, or null */
export const sunAusUrl = (text: string): Sun | null => {
  if (!URL.canParse(text)) return null;
  const parameter = new URL(text).searchParams;
  const e = wert(parameter, PICC, 32);
  const c = wert(parameter, MAC, 16);
  return e && c ? { e, c } : null;
};

const dekodierer = new TextDecoder();

/** The card of a `reading` event: a URL record with a SUN message makes it an NTAG 424 DNA */
export const karteAus = (ereignis: Leseereignis): NfcKarte | null => {
  const sun =
    (ereignis.message?.records ?? [])
      .filter((record) => record.recordType === "url" && record.data)
      .map((record) => sunAusUrl(dekodierer.decode(record.data)))
      .find((gefunden) => gefunden !== null) ?? null;
  const uid = ereignis.serialNumber ?? "";
  return sun || uid ? { uid, sun } : null;
};

/**
 * Listens for cards until `signal` aborts. Rejects when the browser refuses (no permission yet, no
 * NFC on the device), so the kiosk can offer a button: a tap is what Chrome asks for.
 */
export const nfcLesen = async (
  Leser: NdefLeserKlasse,
  signal: AbortSignal,
  onKarte: (karte: NfcKarte) => void,
): Promise<void> => {
  const leser = new Leser();
  leser.addEventListener(
    "reading",
    (ereignis) => {
      const karte = karteAus(ereignis as unknown as Leseereignis);
      if (karte) onKarte(karte);
    },
    { signal },
  );
  await leser.scan({ signal });
};
