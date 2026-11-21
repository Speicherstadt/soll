import { sunErzeugen } from "../modules/terminal/sun-erzeugen.ts";
import { json, type Server } from "./terminal-testhilfen.ts";

type Person = Awaited<ReturnType<Server["inhaberMitBetrieb"]>>;

/** A plain card and an NTAG 424 DNA with keys of its own (S-802) */
export const UID_KARTE = "04:a1:b2:c3:d4:e5:f6";
export const NTAG_UID = "041D3C8A2D6B80";
export const NTAG_SCHLUESSEL = {
  meta: "42AFF114F2CB3B6141BE6DC95DFC5416",
  datei: "B62A9BAF092439BD43C62AEE96B970C5",
};

/** A SUN message as the NTAG 424 DNA puts it into its URL at read number `zaehler` */
export const sun = (zaehler: number, schluessel = NTAG_SCHLUESSEL, uid = NTAG_UID) =>
  sunErzeugen(
    { meta: Buffer.from(schluessel.meta, "hex"), datei: Buffer.from(schluessel.datei, "hex") },
    uid,
    zaehler,
  );

export const karteEintragen = (inhaber: Person, body: Record<string, unknown>) =>
  inhaber.anfrage("/api/v1/terminal/karten", { body });

export const uidKarte = async (inhaber: Person, nutzerId: string, uid = UID_KARTE) =>
  (await json(await karteEintragen(inhaber, { nutzerId, art: "uid", uid }))) as { karteId: string };

export const ntagKarte = async (inhaber: Person, nutzerId: string, uid = NTAG_UID) =>
  (await json(
    await karteEintragen(inhaber, { nutzerId, art: "ntag424", uid, ...NTAG_SCHLUESSEL }),
  )) as { karteId: string };
