import type { TagAnsicht } from "../zeiten/typen.ts";
import type { Eintrag } from "./warteschlange.ts";

/**
 * Where the device keeps its key, its queue and the day last seen (S-305): IndexedDB in the browser,
 * a map in the tests. The private key is a non-extractable CryptoKey; IndexedDB stores it as it is
 * (structured clone), so its bytes never reach JavaScript.
 */

/** The key pair of a device for one person in one business */
export type Geraet = {
  konto: string;
  geraetId: string;
  privat: CryptoKey;
  /** the public key as JWK, for the server */
  schluessel: JsonWebKey;
  /** the last number given; the next entry gets the one after it */
  letzteNummer: number;
  /** whether the server has the public key */
  angemeldet: boolean;
};

/** The person's day as last loaded, with the distance of the device's clock to the server's */
export type GemerkterTag = { ansicht: TagAnsicht; abstand: number };

export type Ablage = {
  geraet: (konto: string) => Promise<Geraet | undefined>;
  geraetSetzen: (geraet: Geraet) => Promise<void>;
  /** the entry and the device's new last number together, or neither */
  aufnehmen: (geraet: Geraet, eintrag: Eintrag) => Promise<void>;
  eintraege: (konto: string) => Promise<Eintrag[]>;
  eintragSetzen: (eintrag: Eintrag) => Promise<void>;
  eintragEntfernen: (eintrag: Eintrag) => Promise<void>;
  /** the day of one person in one business (`kontoSchluessel`), never another person's */
  tag: (konto: string) => Promise<GemerkterTag | undefined>;
  tagSetzen: (konto: string, tag: GemerkterTag) => Promise<void>;
};

const eintragId = (eintrag: Eintrag) => `${eintrag.geraetId}/${eintrag.nummer}`;

/** The same in memory, for the tests (IndexedDB exists only in the browser) */
export const ablageImSpeicher = (): Ablage => {
  const geraete = new Map<string, Geraet>();
  const eintraege = new Map<string, Eintrag>();
  const tage = new Map<string, GemerkterTag>();
  return {
    geraet: async (konto) => geraete.get(konto),
    geraetSetzen: async (geraet) => void geraete.set(geraet.konto, geraet),
    aufnehmen: async (geraet, eintrag) => {
      eintraege.set(eintragId(eintrag), eintrag);
      geraete.set(geraet.konto, geraet);
    },
    eintraege: async (konto) => [...eintraege.values()].filter((e) => e.konto === konto),
    eintragSetzen: async (eintrag) => void eintraege.set(eintragId(eintrag), eintrag),
    eintragEntfernen: async (eintrag) => void eintraege.delete(eintragId(eintrag)),
    tag: async (konto) => tage.get(konto),
    tagSetzen: async (konto, tag) => void tage.set(konto, tag),
  };
};

const DATENBANK = "soll-offline";
const GERAETE = "geraete";
const EINTRAEGE = "eintraege";
const TAGE = "tage";

const alsVersprechen = <T>(anfrage: IDBRequest<T>): Promise<T> =>
  new Promise((fertig, fehler) => {
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });

const oeffnen = (): Promise<IDBDatabase> => {
  const anfrage = indexedDB.open(DATENBANK, 1);
  anfrage.onupgradeneeded = () => {
    const db = anfrage.result;
    db.createObjectStore(GERAETE, { keyPath: "konto" });
    db.createObjectStore(EINTRAEGE, { keyPath: ["geraetId", "nummer"] }).createIndex(
      "konto",
      "konto",
    );
    db.createObjectStore(TAGE);
  };
  return alsVersprechen(anfrage);
};

const abgeschlossen = (tx: IDBTransaction): Promise<void> =>
  new Promise((fertig, fehler) => {
    tx.oncomplete = () => fertig();
    tx.onerror = () => fehler(tx.error);
    tx.onabort = () => fehler(tx.error);
  });

/** The device's storage in the browser: one IndexedDB database for key, queue and the last day */
export const indexedDbAblage = (): Ablage => {
  let verbindung: Promise<IDBDatabase> | null = null;
  const db = () => {
    verbindung ??= oeffnen();
    return verbindung;
  };
  const lesen = async <T>(speicher: string, schluessel: IDBValidKey): Promise<T | undefined> =>
    alsVersprechen((await db()).transaction(speicher).objectStore(speicher).get(schluessel));
  const schreiben = async (speicher: string, wert: unknown, schluessel?: IDBValidKey) => {
    const tx = (await db()).transaction(speicher, "readwrite");
    tx.objectStore(speicher).put(wert, schluessel);
    await abgeschlossen(tx);
  };
  return {
    geraet: (konto) => lesen<Geraet>(GERAETE, konto),
    geraetSetzen: (geraet) => schreiben(GERAETE, geraet),
    aufnehmen: async (geraet, eintrag) => {
      const tx = (await db()).transaction([GERAETE, EINTRAEGE], "readwrite");
      tx.objectStore(EINTRAEGE).put(eintrag);
      tx.objectStore(GERAETE).put(geraet);
      await abgeschlossen(tx);
    },
    eintraege: async (konto) =>
      alsVersprechen(
        (await db()).transaction(EINTRAEGE).objectStore(EINTRAEGE).index("konto").getAll(konto),
      ),
    eintragSetzen: (eintrag) => schreiben(EINTRAEGE, eintrag),
    eintragEntfernen: async (eintrag) => {
      const tx = (await db()).transaction(EINTRAEGE, "readwrite");
      tx.objectStore(EINTRAEGE).delete([eintrag.geraetId, eintrag.nummer]);
      await abgeschlossen(tx);
    },
    tag: (konto) => lesen<GemerkterTag>(TAGE, konto),
    tagSetzen: (konto, tag) => schreiben(TAGE, tag, konto),
  };
};
