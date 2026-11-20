import { createSignal, onSettled } from "solid-js";
import { api } from "../api.ts";
import {
  kioskAnfrage,
  kopplungLesen,
  kopplungMerken,
  kopplungVergessen,
  speicher,
} from "./geraet.ts";
import { entkoppelt, type Meldung, meldungAus } from "./meldung.ts";
import type { Ausweis, Erkannt, Gestempelt, KioskStand, Kopplung } from "./typen.ts";

/** How long a recognised person may choose before the kiosk goes back to the clock */
export const ERKANNT_MS = 15_000;
/** How long the confirmation stays (DESIGN.md, "Terminal": back after 5 seconds) */
export const GESTEMPELT_MS = 5_000;
const TAKT_MS = 250;

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
  const [stand, setStand] = createSignal<KioskStand | null>(null);
  const [meldung, setMeldung] = createSignal<Meldung | null>(null);
  const [jetzt, setJetzt] = createSignal(Date.now());
  const [beschaeftigt, setBeschaeftigt] = createSignal(false);
  const zurueck = () => setAnsicht(kopplung() ? { art: "bereit" } : { art: "koppeln" });
  const vergessen = () => {
    kopplungVergessen(ablage);
    setKopplung(null);
    setStand(null);
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
    stand,
    setStand,
    meldung,
    setMeldung,
    jetzt,
    setJetzt,
    beschaeftigt,
    setBeschaeftigt,
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
  const laden = async () => {
    const k = z.kopplung();
    if (!k) return;
    const antwort = await kioskAnfrage<KioskStand>(k.token, "");
    if (!antwort.ok) return z.abgelehnt(antwort);
    z.setStand(antwort.daten);
    if (antwort.daten.gesperrtBis !== null)
      z.setMeldung({ art: "gesperrt", bis: antwort.daten.gesperrtBis });
  };
  const koppeln = async (code: string): Promise<Meldung | "code_ungueltig" | null> => {
    const antwort = await api<Kopplung>("/api/v1/kiosk/koppeln", { body: { code } });
    if (!antwort.ok)
      return antwort.fehler === "code_ungueltig" ? "code_ungueltig" : meldungAus(antwort);
    z.gekoppelt(antwort.daten);
    await laden();
    return null;
  };
  const erkennen = (ausweis: Ausweis) =>
    einmal(async (token) => {
      const antwort = await kioskAnfrage<Erkannt>(token, "/erkennen", ausweis);
      if (!antwort.ok) return z.abgelehnt(antwort);
      z.setMeldung(null);
      z.setAnsicht({ art: "erkannt", daten: antwort.daten, ausweis, bis: Date.now() + ERKANNT_MS });
    });
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
  return { laden, koppeln, erkennen, stempeln };
};

/**
 * The kiosk's states and calls (S-801): pairing, the clock with the number pad, reading a QR code,
 * a person recognised, a stamp confirmed. It goes back to the clock by itself, never stamps by
 * itself, and forgets the PIN or QR code it held as soon as it is back (CLAUDE.md).
 */
export const kioskAblauf = () => {
  const z = kioskZustand();
  const aufrufe = kioskAufrufe(z);
  onSettled(() => {
    void aufrufe.laden();
    const takt = setInterval(() => {
      const nun = Date.now();
      z.setJetzt(nun);
      const aktuell = z.ansicht();
      if ("bis" in aktuell && aktuell.bis <= nun) z.zurueck();
      const offen = z.meldung();
      if (offen?.art === "gesperrt" && offen.bis <= nun) z.setMeldung(null);
    }, TAKT_MS);
    return () => clearInterval(takt);
  });
  return {
    kopplung: z.kopplung,
    ansicht: z.ansicht,
    stand: z.stand,
    meldung: z.meldung,
    jetzt: z.jetzt,
    beschaeftigt: z.beschaeftigt,
    zurueck: z.zurueck,
    scannen: () => z.setAnsicht({ art: "scannen" }),
    ...aufrufe,
  };
};
