import { type Stempelart, stempelNachricht } from "@soll/arbeitszeit";
import type { Antwort } from "../api.ts";
import type { Ablage, Geraet } from "./ablage.ts";
import { anfrageFuer, type Eintrag, folge, wartende } from "./warteschlange.ts";

/**
 * The offline queue at work (S-305): an entry is numbered and signed on the device and stored before
 * anything goes out; the queue then sends what waits, in the order of the numbers, and stops at the
 * first entry that cannot go now. Every effect comes in as a dependency, so the tests run it with a
 * map for IndexedDB and a stand-in for the API.
 */
export type Abhaengigkeiten = {
  ablage: Ablage;
  subtle: SubtleCrypto;
  api: (pfad: string, init: { method?: string; body?: unknown }) => Promise<Antwort<unknown>>;
  /** the device's clock */
  jetzt: () => number;
  /** runs `arbeit` alone across the app's tabs (Web Locks), so no number is given twice */
  sperre: <T>(arbeit: () => Promise<T>) => Promise<T>;
  neueId: () => string;
};

const ALGORITHMUS = { name: "ECDSA", namedCurve: "P-256" } as const;

const base64url = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

/** A new key pair whose private half WebCrypto never hands out (extractable: false) */
const geraetErzeugen = async (abh: Abhaengigkeiten, konto: string): Promise<Geraet> => {
  const paar = await abh.subtle.generateKey(ALGORITHMUS, false, ["sign", "verify"]);
  const jwk = await abh.subtle.exportKey("jwk", paar.publicKey);
  return {
    konto,
    geraetId: abh.neueId(),
    privat: paar.privateKey,
    // only what names the key: the server takes kty, crv, x and y
    schluessel: { kty: jwk.kty ?? "EC", crv: jwk.crv ?? "P-256", x: jwk.x ?? "", y: jwk.y ?? "" },
    letzteNummer: 0,
    angemeldet: false,
  };
};

const signieren = async (abh: Abhaengigkeiten, privat: CryptoKey, eintrag: Eintrag) =>
  base64url(
    await abh.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privat,
      new TextEncoder().encode(stempelNachricht(eintrag)),
    ),
  );

/** Registers the device's public key once; false while the server cannot take it */
const anmelden = async (abh: Abhaengigkeiten, geraet: Geraet): Promise<boolean> => {
  if (geraet.angemeldet) return true;
  const antwort = await abh.api(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
    method: "PUT",
    body: { schluessel: geraet.schluessel },
  });
  if (!antwort.ok) return false;
  await abh.ablage.geraetSetzen({ ...geraet, angemeldet: true });
  return true;
};

export type Versand = {
  /** entries the server took */
  uebertragen: number;
  /** entries still waiting (no network, or the server could not take them now) */
  wartend: number;
};

export const warteschlange = (abh: Abhaengigkeiten) => {
  /**
   * Takes a stamp into the queue: the next number of the device, signed with its key, stored with
   * the device's new last number in one step. Makes the device's key on the first stamp.
   */
  const aufnehmen = (konto: string, art: Stempelart): Promise<Eintrag> =>
    abh.sperre(async () => {
      const geraet = (await abh.ablage.geraet(konto)) ?? (await geraetErzeugen(abh, konto));
      const ohneSignatur = {
        konto,
        geraetId: geraet.geraetId,
        nummer: geraet.letzteNummer + 1,
        art,
        geraetZeitpunkt: abh.jetzt(),
        signatur: "",
        abgelehnt: null,
      };
      const eintrag = {
        ...ohneSignatur,
        signatur: await signieren(abh, geraet.privat, ohneSignatur),
      };
      await abh.ablage.aufnehmen({ ...geraet, letzteNummer: eintrag.nummer }, eintrag);
      return eintrag;
    });

  /**
   * Sends what waits for the person, oldest number first; `live` names the entry just stamped, which
   * goes live when its turn comes. An entry the server took leaves the queue; one it refused stays,
   * marked; at the first that cannot go now the queue stops, so the numbers arrive in order.
   */
  const uebertragen = (konto: string, live: number | null = null): Promise<Versand> =>
    abh.sperre(async () => {
      const offen = wartende(await abh.ablage.eintraege(konto));
      const geraet = await abh.ablage.geraet(konto);
      if (offen.length === 0 || !geraet || !(await anmelden(abh, geraet)))
        return { uebertragen: 0, wartend: offen.length };
      let uebertragen = 0;
      for (const [index, eintrag] of offen.entries()) {
        const { pfad, body } = anfrageFuer(eintrag, eintrag.nummer === live, abh.jetzt());
        const antwort = await abh.api(pfad, { body });
        const was = folge(antwort.status);
        if (was === "spaeter") return { uebertragen, wartend: offen.length - index };
        if (was === "uebertragen") await abh.ablage.eintragEntfernen(eintrag);
        else
          await abh.ablage.eintragSetzen({
            ...eintrag,
            abgelehnt: antwort.ok ? "" : antwort.fehler,
          });
        uebertragen += was === "uebertragen" ? 1 : 0;
      }
      return { uebertragen, wartend: 0 };
    });

  return { aufnehmen, uebertragen, eintraege: (konto: string) => abh.ablage.eintraege(konto) };
};
