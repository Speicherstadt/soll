import { skipToken, useQuery } from "@tanstack/solid-query";
import { createEffect, createSignal, onSettled } from "solid-js";
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
  | { art: "gestempelt"; daten: Gestempelt; bis: number };

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
  /** A refusal: a revoked tablet goes back to pairing, anything else becomes a message */
  const abgelehnt = (antwort: Parameters<typeof meldungAus>[0]) => {
    zurueck();
    if (entkoppelt(antwort)) return vergessen();
    setMeldung(meldungAus(antwort));
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
  const erkennen = (ausweis: Ausweis) =>
    einmal(async (token) => {
      const antwort = await kioskAnfrage<Erkannt>(token, "/erkennen", ausweis);
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
  const stempeln = (art: string) =>
    einmal(async (token) => {
      const aktuell = z.ansicht();
      if (aktuell.art !== "erkannt") return;
      const antwort = await kioskAnfrage<Gestempelt>(token, "/stempeln", {
        ausweis: aktuell.ausweis,
        art,
        geraetZeitpunkt: Date.now(),
      });
      if (!antwort.ok) return z.abgelehnt(antwort);
      z.setAnsicht({ art: "gestempelt", daten: antwort.daten, bis: Date.now() + GESTEMPELT_MS });
    });
  return { koppeln, erkennen, pin, karteGelesen, stempeln };
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
  // every answer counts, also one like the last: a lock lifted answers as it did before the lock
  createEffect(
    () => (abfrage.isSuccess ? { antwort: abfrage.data, am: abfrage.dataUpdatedAt } : null),
    (neu) => {
      if (!neu) return;
      const { antwort } = neu;
      if (!antwort.ok) return z.abgelehnt(antwort);
      if (antwort.daten.gesperrtBis !== null)
        z.setMeldung({ art: "gesperrt", bis: antwort.daten.gesperrtBis });
      else if (z.meldung()?.art === "gesperrt") z.setMeldung(null);
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
    zurueck: z.zurueck,
    scannen: () => z.setAnsicht({ art: "scannen" }),
    ...aufrufe,
  };
};
