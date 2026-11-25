import {
  ausweisVerschluesseln,
  ausweisZusatz,
  base64url,
  type Stempelart,
  terminalNachricht,
} from "@soll/arbeitszeit";
import type { Antwort } from "../../api.ts";
import type { KioskAblage, KioskGeraet, Schluessel } from "./ablage.ts";
import {
  folge,
  type KioskEintrag,
  koerperFuer,
  nachNummer,
  type OfflineAusweis,
} from "./schlange.ts";

/**
 * The tablet's offline queue at work (S-803): the key pair is made once per pairing and its public
 * half registered; an entry gets the next number, its credential is encrypted to the server and the
 * whole entry signed before it is stored; the queue then sends what waits in the order of the
 * numbers and stops at the first entry that cannot go now. Every effect comes in as a dependency,
 * so the tests run it with a map for IndexedDB and a stand-in for the API.
 */
export type KioskAbhaengigkeiten = {
  ablage: KioskAblage;
  subtle: SubtleCrypto;
  api: (
    pfad: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> },
  ) => Promise<Antwort<unknown>>;
  /** the tablet's clock */
  jetzt: () => number;
  /** runs `arbeit` alone across the tablet's tabs (Web Locks), so no number is given twice */
  sperre: <T>(arbeit: () => Promise<T>) => Promise<T>;
};

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;

/** A new key pair whose private half WebCrypto never hands out (extractable: false) */
const geraetErzeugen = async (abh: KioskAbhaengigkeiten, terminalId: string) => {
  const paar = await abh.subtle.generateKey(ECDSA, false, ["sign", "verify"]);
  const jwk = await abh.subtle.exportKey("jwk", paar.publicKey);
  const geraet: KioskGeraet = {
    terminalId,
    privat: paar.privateKey,
    schluessel: { kty: "EC", crv: "P-256", x: jwk.x ?? "", y: jwk.y ?? "" },
    letzteNummer: 0,
    angemeldet: "nein",
    server: null,
    zuletzt: null,
  };
  return geraet;
};

const mitToken = (token: string) => ({ authorization: `Bearer ${token}` });

/**
 * How long a call may take before the queue counts it as no network: a server out of reach behind
 * a working Wi-Fi leaves `fetch` pending for minutes
 */
export const FRIST_MS = 15_000;

const mitFrist = (antwort: Promise<Antwort<unknown>>): Promise<Antwort<unknown>> =>
  Promise.race([
    antwort,
    new Promise<Antwort<unknown>>((fertig) =>
      setTimeout(() => fertig({ ok: false, status: 0, fehler: "netz" }), FRIST_MS),
    ),
  ]);

/**
 * Changes the stored record of the tablet under the lock, from its latest state: the network calls
 * run outside the lock, so a stamp taken meanwhile is never held up by them (review of S-803)
 */
const geraetAendern = (
  abh: KioskAbhaengigkeiten,
  terminalId: string,
  aenderung: (geraet: KioskGeraet) => KioskGeraet,
) =>
  abh.sperre(async () => {
    const geraet = await abh.ablage.geraet(terminalId);
    if (geraet) await abh.ablage.geraetSetzen(aenderung(geraet));
  });

/** Registers the tablet's public key; a key the server already has for another pair stays refused */
const anmelden = async (
  abh: KioskAbhaengigkeiten,
  token: string,
  geraet: KioskGeraet,
): Promise<KioskGeraet["angemeldet"]> => {
  if (geraet.angemeldet !== "nein") return geraet.angemeldet;
  const antwort = await mitFrist(
    abh.api("/api/v1/kiosk/schluessel", {
      method: "PUT",
      body: { schluessel: geraet.schluessel },
      headers: mitToken(token),
    }),
  );
  const angemeldet = antwort.ok ? "ja" : antwort.status === 409 ? "vergeben" : "nein";
  if (angemeldet !== "nein")
    await geraetAendern(abh, geraet.terminalId, (g) => ({ ...g, angemeldet }));
  return angemeldet;
};

export type Versand = {
  /** entries the server took or refused for good: they left the tablet */
  erledigt: number;
  /** entries still waiting */
  wartend: number;
  /** the terminal was revoked: nothing goes any more */
  entkoppelt: boolean;
};

export const kioskSchlange = (abh: KioskAbhaengigkeiten) => {
  /**
   * Makes the key pair on the first start of a pairing, keeps the server's key for credentials and
   * registers the public key; an already paired tablet does this on its next start
   */
  const vorbereiten = async (token: string, terminalId: string, server: Schluessel) => {
    const geraet = await abh.sperre(async () => {
      const da = (await abh.ablage.geraet(terminalId)) ?? (await geraetErzeugen(abh, terminalId));
      const neu = { ...da, server };
      await abh.ablage.geraetSetzen(neu);
      return neu;
    });
    return { ...geraet, angemeldet: await anmelden(abh, token, geraet) };
  };

  /**
   * Whether the queue can take an entry: a key, the server's key, and a key the server does not
   * refuse (one registered later still works: the entry waits for it)
   */
  const bereit = async (terminalId: string): Promise<boolean> => {
    const geraet = await abh.ablage.geraet(terminalId).catch(() => undefined);
    return geraet !== undefined && geraet.server !== null && geraet.angemeldet !== "vergeben";
  };

  /**
   * Takes a stamp into the queue: the time of the tap, the next number, the credential encrypted to
   * the server for this terminal, the signature over all of it; null where the queue cannot
   */
  const aufnehmen = (terminalId: string, ausweis: OfflineAusweis, art: Stempelart) => {
    const geraetZeitpunkt = abh.jetzt();
    return abh.sperre(async (): Promise<KioskEintrag | null> => {
      const geraet = await abh.ablage.geraet(terminalId);
      if (!geraet?.server || geraet.angemeldet === "vergeben") return null;
      const bindung = { terminalId, nummer: geraet.letzteNummer + 1, art, geraetZeitpunkt };
      const ohne = {
        ...bindung,
        ausweis: await ausweisVerschluesseln(
          abh.subtle,
          geraet.server,
          JSON.stringify(ausweis),
          ausweisZusatz(bindung),
        ),
      };
      const signatur = await abh.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        geraet.privat,
        new TextEncoder().encode(terminalNachricht(ohne)),
      );
      const eintrag = { ...ohne, signatur: base64url(new Uint8Array(signatur)) };
      await abh.ablage.aufnehmen({ ...geraet, letzteNummer: eintrag.nummer }, eintrag);
      return eintrag;
    });
  };

  /** Sends the entries in order; the lock is taken only to change what is stored */
  const senden = async (token: string, terminalId: string): Promise<Versand> => {
    const offen = nachNummer(await abh.ablage.eintraege(terminalId));
    const geraet = await abh.ablage.geraet(terminalId);
    if (offen.length === 0 || !geraet || (await anmelden(abh, token, geraet)) !== "ja")
      return { erledigt: 0, wartend: offen.length, entkoppelt: false };
    let erledigt = 0;
    for (const [index, eintrag] of offen.entries()) {
      const antwort = await mitFrist(
        abh.api("/api/v1/kiosk/offline", {
          body: koerperFuer(eintrag, abh.jetzt()),
          headers: mitToken(token),
        }),
      );
      const was = folge(antwort.status, antwort.ok ? "" : antwort.fehler);
      if (was === "spaeter" || was === "entkoppelt")
        return { erledigt, wartend: offen.length - index, entkoppelt: was === "entkoppelt" };
      await abh.sperre(() => abh.ablage.eintragEntfernen(eintrag));
      erledigt += 1;
      if (was === "uebertragen")
        await geraetAendern(abh, terminalId, (g) => ({ ...g, zuletzt: abh.jetzt() }));
    }
    return { erledigt, wartend: 0, entkoppelt: false };
  };

  /** The run under way: one at a time, so no entry goes out twice at once */
  let laeuft: Promise<Versand> | null = null;

  /**
   * Sends what waits, oldest number first; an entry taken or refused for good leaves the tablet,
   * at the first that cannot go now the queue stops, so the numbers arrive in order. A call waits
   * for a run under way and then starts its own, so every entry stored before the call has had its
   * turn when it returns (before a SUN message goes online, review of S-803, round 3).
   */
  const uebertragen = async (token: string, terminalId: string): Promise<Versand> => {
    while (laeuft) await laeuft.catch(() => undefined);
    const lauf = senden(token, terminalId).finally(() => {
      laeuft = null;
    });
    laeuft = lauf;
    return lauf;
  };

  /** What the kiosk shows: how many entries wait and when the server last took one */
  const stand = async (terminalId: string) => ({
    wartend: (await abh.ablage.eintraege(terminalId)).length,
    zuletzt: (await abh.ablage.geraet(terminalId))?.zuletzt ?? null,
  });

  return { vorbereiten, bereit, aufnehmen, uebertragen, stand };
};
