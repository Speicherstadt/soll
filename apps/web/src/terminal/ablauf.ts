import type { Stempelart } from "@soll/arbeitszeit";
import { skipToken, useQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, onSettled, snapshot } from "solid-js";
import { PFAD } from "../abfragen/schluessel.ts";
import { api } from "../api.ts";
import {
  kioskAnfrage,
  kopplungLesen,
  kopplungMerken,
  kopplungVergessen,
  speicher,
} from "./geraet.ts";
import { entkoppelt, type Meldung, meldungAus } from "./meldung.ts";
import type { NfcKarte } from "./nfc.ts";
import {
  direktInWarteschlange,
  nachErkennenOhneAntwort,
  nachStempelnOhneAntwort,
  type OfflineAusweis,
  offlineAusweis,
} from "./offline/schlange.ts";
import { kioskWarteschlange } from "./offline/warteschlange.ts";
import type { Ausweis, Erkannt, Gestempelt, KioskStand, Kopplung } from "./typen.ts";

/** How long a recognised person may choose before the kiosk goes back to the clock */
export const ERKANNT_MS = 15_000;
/** How long the confirmation stays (DESIGN.md, "Terminal": back after 5 seconds) */
export const GESTEMPELT_MS = 5_000;
const TAKT_MS = 250;
/**
 * How often a locked kiosk asks the server for its state: nobody can tap it, yet the owner may
 * lift the lock or revoke the tablet (docs/plan.md, "Sperre am Terminal")
 */
export const GESPERRT_FRAGEN_MS = 15_000;

/** Web NFC at the kiosk: none in this browser, listening, or waiting for a tap to allow it */
export type Nfc = "aus" | "an" | "erlauben";

export type Ansicht =
  | { art: "koppeln" }
  | { art: "bereit" }
  | { art: "scannen" }
  | { art: "erkannt"; daten: Erkannt; ausweis: Ausweis; bis: number }
  | { art: "gestempelt"; daten: Gestempelt; bis: number }
  /** no network: the person chooses without their state, the stamp waits on the tablet (S-803) */
  | { art: "offline"; ausweis: OfflineAusweis; bis: number }
  | { art: "gespeichert"; stempelart: Stempelart; zeitpunkt: number; bis: number };

/** The signals of the kiosk: its pairing, what it shows, the last message, the clock */
const kioskZustand = () => {
  const ablage = speicher();
  const gemerkt = kopplungLesen(ablage);
  const [kopplung, setKopplung] = createSignal<Kopplung | null>(gemerkt);
  const [ansicht, setAnsicht] = createSignal<Ansicht>(
    gemerkt ? { art: "bereit" } : { art: "koppeln" },
  );
  const [meldung, setMeldung] = createSignal<Meldung | null>(null);
  const [jetzt, setJetzt] = createSignal(Date.now());
  const [beschaeftigt, setBeschaeftigt] = createSignal(false);
  /** A plain card held to the tablet, waiting for its person's PIN (S-802) */
  const [karte, setKarte] = createSignal<{ uid: string; bis: number } | null>(null);
  const [nfc, setNfc] = createSignal<Nfc>("aus");
  const zurueck = () => {
    setKarte(null);
    setAnsicht(kopplung() ? { art: "bereit" } : { art: "koppeln" });
  };
  const vergessen = () => {
    kopplungVergessen(ablage);
    setKopplung(null);
    setAnsicht({ art: "koppeln" });
  };
  const gekoppelt = (neu: Kopplung) => {
    kopplungMerken(ablage, neu);
    setKopplung(neu);
    setMeldung(null);
    setAnsicht({ art: "bereit" });
  };
  const schlange = kioskWarteschlange(kopplung, vergessen);
  /**
   * A refusal: a revoked tablet goes back to pairing, anything else becomes a message; no network
   * is no message where stamps can wait (the clock shows the state, S-803)
   */
  const abgelehnt = (antwort: Parameters<typeof meldungAus>[0], bereit = schlange.bereit()) => {
    zurueck();
    if (entkoppelt(antwort)) return vergessen();
    const ohneNetz = !antwort.ok && antwort.status === 0;
    if (ohneNetz) schlange.netz(0);
    setMeldung(ohneNetz && bereit ? null : meldungAus(antwort));
  };
  return {
    kopplung,
    ansicht,
    setAnsicht,
    meldung,
    setMeldung,
    jetzt,
    setJetzt,
    beschaeftigt,
    setBeschaeftigt,
    karte,
    setKarte,
    nfc,
    setNfc,
    zurueck,
    gekoppelt,
    abgelehnt,
    schlange,
  };
};

type Zustand = ReturnType<typeof kioskZustand>;

/** The calls of the kiosk's API, one at a time: a second tap on its way does nothing */
const kioskAufrufe = (z: Zustand) => {
  const einmal = async (aufgabe: (token: string) => Promise<void>) => {
    const k = z.kopplung();
    if (!k || z.beschaeftigt()) return;
    z.setBeschaeftigt(true);
    try {
      await aufgabe(k.token);
    } finally {
      z.setBeschaeftigt(false);
    }
  };
  const koppeln = async (code: string): Promise<Meldung | "code_ungueltig" | null> => {
    const antwort = await api<Kopplung>("/api/v1/kiosk/koppeln", { body: { code } });
    if (!antwort.ok)
      return antwort.fehler === "code_ungueltig" ? "code_ungueltig" : meldungAus(antwort);
    // the new pairing asks for its state by itself (standAbfrage)
    z.gekoppelt(antwort.daten);
    return null;
  };
  const offline = ohneNetzAufrufe(z);
  const erkennen = (ausweis: Ausweis) =>
    einmal(async (token) => {
      const lage = { ohneNetz: z.schlange.ohneNetz(), bereit: z.schlange.bereit() };
      if (direktInWarteschlange(ausweis, lage)) return offline.ohneStand(ausweis);
      // a card's older SUN message waiting on the tablet goes first: once the card is read online
      // with a higher counter, the server refuses it (docs/plan.md, "SUN-Nachricht aus der
      // Warteschlange")
      if ("sun" in ausweis) await z.schlange.zuerstSenden();
      const antwort = await kioskAnfrage<Erkannt>(token, "/erkennen", ausweis);
      z.schlange.netz(antwort.status);
      if (!antwort.ok && antwort.status === 0) return offline.ohneAntwort(ausweis);
      if (!antwort.ok) return z.abgelehnt(antwort);
      z.setMeldung(null);
      // a SUN message counts once: the next tap stamps with the server's receipt (S-802)
      const weiter = antwort.daten.beleg ? { beleg: antwort.daten.beleg } : ausweis;
      z.setAnsicht({
        art: "erkannt",
        daten: antwort.daten,
        ausweis: weiter,
        bis: Date.now() + ERKANNT_MS,
      });
    });
  /** A PIN typed: with a plain card waiting, the two go together */
  const pin = (eingabe: string) => {
    const gehalten = z.karte();
    z.setKarte(null);
    return erkennen(gehalten ? { karte: gehalten.uid, pin: eingabe } : { pin: eingabe });
  };
  /**
   * A card held to the tablet while it shows the clock: an NTAG 424 DNA is recognised by its SUN
   * message alone, a plain card waits for the PIN of its person (S-802)
   */
  const karteGelesen = (karte: NfcKarte) => {
    if (z.ansicht().art !== "bereit" || z.beschaeftigt() || z.meldung()?.art === "gesperrt") return;
    if (karte.sun) return erkennen({ sun: karte.sun });
    z.setMeldung(null);
    z.setKarte({ uid: karte.uid, bis: Date.now() + ERKANNT_MS });
  };
  const stempeln = (art: Stempelart) =>
    einmal(async (token) => {
      const aktuell = z.ansicht();
      if (aktuell.art === "offline") return offline.speichern(aktuell.ausweis, art);
      if (aktuell.art !== "erkannt") return;
      const antwort = await kioskAnfrage<Gestempelt>(token, "/stempeln", {
        ausweis: aktuell.ausweis,
        art,
        geraetZeitpunkt: Date.now(),
      });
      z.schlange.netz(antwort.status);
      if (!antwort.ok && antwort.status === 0)
        return offline.stempelnOhneAntwort(aktuell.ausweis, art);
      if (!antwort.ok) return z.abgelehnt(antwort);
      z.setAnsicht({ art: "gestempelt", daten: antwort.daten, bis: Date.now() + GESTEMPELT_MS });
    });
  return { koppeln, erkennen, pin, karteGelesen, stempeln };
};

/**
 * Without a network (S-803): the person is not recognised, as only the server can; the kiosk offers
 * Kommen, Pause and Gehen and keeps the stamp with the credential encrypted, to be sent later. Soll
 * never stamps by itself: only what the person taps waits.
 */
const ohneNetzAufrufe = (z: Zustand) => {
  /** goes on without the person's state, the credential to wait in the queue */
  const ohneStand = (ausweis: Ausweis) => {
    const wartet = offlineAusweis(ausweis);
    if (!wartet) return;
    z.setMeldung(null);
    z.setKarte(null);
    z.setAnsicht({ art: "offline", ausweis: wartet, bis: Date.now() + ERKANNT_MS });
  };
  /** keeps the stamp in the queue and confirms it as saved */
  const speichern = async (ausweis: OfflineAusweis, art: Stempelart) => {
    const eintrag = await z.schlange.aufnehmen(ausweis, art);
    if (!eintrag) {
      z.zurueck();
      z.setMeldung({ art: "fehler" });
      return;
    }
    z.setAnsicht({
      art: "gespeichert",
      stempelart: art,
      zeitpunkt: eintrag.geraetZeitpunkt,
      bis: Date.now() + GESTEMPELT_MS,
    });
  };
  /** after no answer: back to the clock with a message */
  const melden = (meldung: Meldung) => {
    z.zurueck();
    z.setMeldung(meldung);
  };
  return {
    ohneStand,
    speichern,
    /** /erkennen went unanswered: wait, ask for a new tap of the card, or say there is no network */
    ohneAntwort: (ausweis: Ausweis) => {
      const weiter = nachErkennenOhneAntwort(ausweis, z.schlange.bereit());
      if (weiter === "warteschlange") return ohneStand(ausweis);
      melden(weiter === "nochmal" ? { art: "nochmal" } : { art: "netz" });
    },
    /**
     * /stempeln went unanswered (the network went between recognising and stamping, or the server
     * is silent): the stamp waits, the person learns it is unclear, or there is no network
     */
    stempelnOhneAntwort: (ausweis: Ausweis, art: Stempelart) => {
      const weiter = nachStempelnOhneAntwort(ausweis, z.schlange.bereit());
      const wartet = offlineAusweis(ausweis);
      if (weiter === "warteschlange" && wartet) return speichern(wartet, art);
      melden(weiter === "unklar" ? { art: "unklar" } : { art: "netz" });
    },
  };
};

/**
 * The kiosk's state as a query (docs/entwicklung.md, "Daten laden"), asked with the device token on
 * pairing and, while locked, every GESPERRT_FRAGEN_MS: nobody can tap a locked tablet, yet the owner
 * may lift the lock or revoke it (docs/plan.md, "Sperre am Terminal")
 */
const kioskStand = (z: Zustand) => {
  const abfrage = useQuery(() => {
    const k = z.kopplung();
    return {
      queryKey: [PFAD.kiosk, k?.terminalId ?? "-"],
      queryFn: k ? () => kioskAnfrage<KioskStand>(k.token, "") : skipToken,
      refetchInterval: z.meldung()?.art === "gesperrt" ? GESPERRT_FRAGEN_MS : false,
    };
  });
  // every answer counts, also one like the last (dataUpdatedAt): a lock lifted answers as it did
  // before the lock. The compute takes plain values out of the query; the apply reads nothing
  // reactive (docs/solid-2.0/CHEATSHEET.md, "Strict read untracked")
  createEffect(
    () => {
      if (!abfrage.isSuccess) return null;
      const antwort = abfrage.data;
      const am = abfrage.dataUpdatedAt;
      const kopplung = z.kopplung();
      return antwort.ok
        ? {
            am,
            gesperrtBis: antwort.daten.gesperrtBis,
            ausweisSchluessel: snapshot(antwort.daten.ausweisSchluessel),
            kopplung,
          }
        : { am, abgelehnt: snapshot(antwort), bereit: z.schlange.bereit() };
    },
    (neu) => {
      if (!neu) return;
      if ("abgelehnt" in neu) return z.abgelehnt(neu.abgelehnt, neu.bereit);
      z.schlange.netz(200);
      // the key pair of the offline queue, registered on the first start of a pairing (S-803)
      if (neu.ausweisSchluessel && neu.kopplung)
        void z.schlange.vorbereiten(neu.kopplung, neu.ausweisSchluessel);
      const bis = neu.gesperrtBis;
      if (bis !== null) z.setMeldung({ art: "gesperrt", bis });
      // only a lock the server no longer knows goes; any other message stays
      else z.setMeldung((alt) => (alt?.art === "gesperrt" ? null : alt));
    },
  );
  return (): KioskStand | null => {
    if (!abfrage.isSuccess) return null;
    const antwort = abfrage.data;
    return antwort.ok ? antwort.daten : null;
  };
};

/**
 * The kiosk's states and calls (S-801, S-802): pairing, the clock with the number pad, reading a QR
 * code or an NFC card, a person recognised, a stamp confirmed. It goes back to the clock by itself, never stamps by
 * itself, and forgets the PIN or QR code it held as soon as it is back (CLAUDE.md).
 */
export const kioskAblauf = () => {
  const z = kioskZustand();
  const aufrufe = kioskAufrufe(z);
  const stand = kioskStand(z);
  onSettled(() => {
    const takt = setInterval(() => {
      const nun = Date.now();
      z.setJetzt(nun);
      const aktuell = z.ansicht();
      if ("bis" in aktuell && aktuell.bis <= nun) z.zurueck();
      if ((z.karte()?.bis ?? nun) < nun) z.setKarte(null);
      const offen = z.meldung();
      if (offen?.art === "gesperrt" && offen.bis <= nun) z.setMeldung(null);
    }, TAKT_MS);
    return () => clearInterval(takt);
  });
  return {
    kopplung: z.kopplung,
    ansicht: z.ansicht,
    stand,
    meldung: z.meldung,
    jetzt: z.jetzt,
    beschaeftigt: z.beschaeftigt,
    karte: z.karte,
    nfc: z.nfc,
    setNfc: z.setNfc,
    schlange: z.schlange,
    zurueck: z.zurueck,
    scannen: () => z.setAnsicht({ art: "scannen" }),
    ...aufrufe,
  };
};
