import { type Stempelart, stempelNachricht } from "@soll/arbeitszeit";
import type { Antwort } from "../api.ts";
import type { Ablage, Geraet } from "./ablage.ts";
import { anfrageFuer, type Eintrag, folge, kontoSchluessel, wartende } from "./warteschlange.ts";

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

/**
 * Whether the session is the person the device belongs to: a tab left open on a shared browser may
 * already send under the next person's session, and a key registered there would make the previous
 * person's stamps that person's
 */
const sitzungVon = async (abh: Abhaengigkeiten, konto: string): Promise<boolean> => {
  const antwort = await abh.api("/api/v1/betrieb", { method: "GET" });
  if (!antwort.ok) return false;
  const sitzung = antwort.daten as { betriebId?: unknown; nutzerId?: unknown } | null;
  return (
    typeof sitzung?.betriebId === "string" &&
    typeof sitzung.nutzerId === "string" &&
    kontoSchluessel({ betriebId: sitzung.betriebId, nutzerId: sitzung.nutzerId }) === konto
  );
};

/**
 * Registers the device's public key for its own person; false while the server cannot take it or
 * someone else is signed in
 */
const anmelden = async (abh: Abhaengigkeiten, geraet: Geraet): Promise<boolean> => {
  if (geraet.angemeldet) return true;
  if (!(await sitzungVon(abh, geraet.konto))) return false;
  const antwort = await abh.api(`/api/v1/arbeitszeit/geraete/${geraet.geraetId}`, {
    method: "PUT",
    body: { schluessel: geraet.schluessel },
  });
  if (!antwort.ok) return false;
  await abh.ablage.geraetSetzen({ ...geraet, angemeldet: true });
  return true;
};

/**
 * Registers the device again after the server answered that it does not know it: either the server
 * lost it (e.g. its database went back to a backup taken before the device registered), then the
 * stamps go out again, or someone else is signed in, then anmelden refuses and the entries wait for
 * their person
 */
const neuAnmelden = async (abh: Abhaengigkeiten, konto: string): Promise<boolean> => {
  const geraet = await abh.ablage.geraet(konto);
  if (!geraet) return false;
  const neu = { ...geraet, angemeldet: false };
  await abh.ablage.geraetSetzen(neu);
  return anmelden(abh, neu);
};

/**
 * How long after the tap the entry just stamped may still go live: later (older entries hung on a
 * slow network) the server's clock at receipt would be late, and the device's time with the time of
 * sending is the better one (docs/plan.md, "Offline-Stempeln")
 */
export const LIVE_MS = 10_000;

const liveNoch = (eintrag: Eintrag, live: number | null, jetzt: number): boolean =>
  eintrag.nummer === live && jetzt - eintrag.geraetZeitpunkt <= LIVE_MS;

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
  const aufnehmen = (konto: string, art: Stempelart): Promise<Eintrag> => {
    // the time of the tap, before waiting for the lock: a send on a slow network may hold it
    const geraetZeitpunkt = abh.jetzt();
    return abh.sperre(async () => {
      const geraet = (await abh.ablage.geraet(konto)) ?? (await geraetErzeugen(abh, konto));
      const ohneSignatur = {
        konto,
        geraetId: geraet.geraetId,
        nummer: geraet.letzteNummer + 1,
        art,
        geraetZeitpunkt,
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
  };

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
      const senden = (eintrag: Eintrag) => {
        const jetzt = abh.jetzt();
        const { pfad, body } = anfrageFuer(eintrag, liveNoch(eintrag, live, jetzt), jetzt);
        return abh.api(pfad, { body });
      };
      let uebertragen = 0;
      for (const [index, eintrag] of offen.entries()) {
        let antwort = await senden(eintrag);
        if (!antwort.ok && antwort.fehler === "geraet_unbekannt" && (await neuAnmelden(abh, konto)))
          antwort = await senden(eintrag);
        const was = folge(antwort.status, antwort.ok ? "" : antwort.fehler);
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
