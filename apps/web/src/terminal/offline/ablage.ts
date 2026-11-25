import type { KioskEintrag } from "./schlange.ts";

/**
 * Where the tablet keeps its key and its queue (S-803): IndexedDB in the browser, a map in the
 * tests. The private key is a non-extractable CryptoKey that IndexedDB stores as it is, so its bytes
 * never reach JavaScript; a credential is stored only encrypted to the server.
 */

/** A public key of P-256 as JWK */
export type Schluessel = { kty: string; crv: string; x: string; y: string };

/** The key pair of the tablet for one terminal (one pairing) and what it knows of the server */
export type KioskGeraet = {
  terminalId: string;
  privat: CryptoKey;
  schluessel: Schluessel;
  /** the last number given; the next entry gets the one after it */
  letzteNummer: number;
  /** whether the server has the public key; "vergeben": it has another one for this terminal */
  angemeldet: "nein" | "ja" | "vergeben";
  /** the server's key for credentials, from GET /api/v1/kiosk */
  server: Schluessel | null;
  /** when the server last took an entry, by the tablet's clock */
  zuletzt: number | null;
};

export type KioskAblage = {
  geraet: (terminalId: string) => Promise<KioskGeraet | undefined>;
  geraetSetzen: (geraet: KioskGeraet) => Promise<void>;
  /** the entry and the tablet's new last number together, or neither */
  aufnehmen: (geraet: KioskGeraet, eintrag: KioskEintrag) => Promise<void>;
  eintraege: (terminalId: string) => Promise<KioskEintrag[]>;
  eintragEntfernen: (eintrag: KioskEintrag) => Promise<void>;
};

const eintragId = (eintrag: KioskEintrag) => `${eintrag.terminalId}/${eintrag.nummer}`;

/** The same in memory, for the tests (IndexedDB exists only in the browser) */
export const kioskAblageImSpeicher = (): KioskAblage => {
  const geraete = new Map<string, KioskGeraet>();
  const eintraege = new Map<string, KioskEintrag>();
  return {
    geraet: async (terminalId) => geraete.get(terminalId),
    geraetSetzen: async (geraet) => void geraete.set(geraet.terminalId, geraet),
    aufnehmen: async (geraet, eintrag) => {
      eintraege.set(eintragId(eintrag), eintrag);
      geraete.set(geraet.terminalId, geraet);
    },
    eintraege: async (terminalId) =>
      [...eintraege.values()].filter((e) => e.terminalId === terminalId),
    eintragEntfernen: async (eintrag) => void eintraege.delete(eintragId(eintrag)),
  };
};

const DATENBANK = "soll-kiosk";
const GERAETE = "geraete";
const EINTRAEGE = "eintraege";

const alsVersprechen = <T>(anfrage: IDBRequest<T>): Promise<T> =>
  new Promise((fertig, fehler) => {
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });

const oeffnen = (): Promise<IDBDatabase> => {
  const anfrage = indexedDB.open(DATENBANK, 1);
  anfrage.onupgradeneeded = () => {
    const db = anfrage.result;
    db.createObjectStore(GERAETE, { keyPath: "terminalId" });
    db.createObjectStore(EINTRAEGE, { keyPath: ["terminalId", "nummer"] }).createIndex(
      "terminalId",
      "terminalId",
    );
  };
  return alsVersprechen(anfrage);
};

const abgeschlossen = (tx: IDBTransaction): Promise<void> =>
  new Promise((fertig, fehler) => {
    tx.oncomplete = () => fertig();
    tx.onerror = () => fehler(tx.error);
    tx.onabort = () => fehler(tx.error);
  });

/** The tablet's storage in the browser: its own IndexedDB database, apart from the app's queue */
export const kioskIndexedDb = (): KioskAblage => {
  let verbindung: Promise<IDBDatabase> | null = null;
  const db = () => {
    verbindung ??= oeffnen();
    return verbindung;
  };
  const schreiben = async (speicher: string[], arbeit: (tx: IDBTransaction) => void) => {
    const tx = (await db()).transaction(speicher, "readwrite");
    arbeit(tx);
    await abgeschlossen(tx);
  };
  return {
    geraet: async (terminalId) =>
      alsVersprechen((await db()).transaction(GERAETE).objectStore(GERAETE).get(terminalId)),
    geraetSetzen: (geraet) => schreiben([GERAETE], (tx) => tx.objectStore(GERAETE).put(geraet)),
    aufnehmen: (geraet, eintrag) =>
      schreiben([GERAETE, EINTRAEGE], (tx) => {
        tx.objectStore(EINTRAEGE).put(eintrag);
        tx.objectStore(GERAETE).put(geraet);
      }),
    eintraege: async (terminalId) =>
      alsVersprechen(
        (await db())
          .transaction(EINTRAEGE)
          .objectStore(EINTRAEGE)
          .index("terminalId")
          .getAll(terminalId),
      ),
    eintragEntfernen: (eintrag) =>
      schreiben([EINTRAEGE], (tx) =>
        tx.objectStore(EINTRAEGE).delete([eintrag.terminalId, eintrag.nummer]),
      ),
  };
};
