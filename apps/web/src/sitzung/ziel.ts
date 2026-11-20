import type { Module } from "@soll/arbeitszeit";
import { sichtbar } from "../rahmen/module.ts";

/** The business of the session as GET /api/v1/betrieb returns it */
export type Betrieb = {
  betriebId: string;
  name: string;
  land: string | null;
  eingerichtet: boolean;
  rolle: string;
  module: Module;
};

/** What the app knows of the person in front of it */
export type Zustand =
  | { art: "abgemeldet" }
  | { art: "ohne_betrieb" }
  | { art: "bereit"; betrieb: Betrieb }
  /** The server cannot be reached; the business as last seen on this device, if any */
  | { art: "offline"; betrieb: Betrieb | null };

/** Pages for people without a session */
export const OFFEN = ["/anmelden", "/registrieren"];
export const EINRICHTUNG = "/einrichtung";
const istEinladung = (pfad: string) => pfad.startsWith("/einladung/");
/** The check page of a Prüfwert: for everyone, signed in or not (S-306) */
export const PRUEFSEITE = "/pruefen";

/** Better Auth joins several roles by commas (its parseRoles) */
export const istInhaber = (betrieb: Betrieb): boolean =>
  betrieb.rolle.split(",").some((rolle) => rolle.trim() === "inhaber");

const imBetrieb = (betrieb: Betrieb, pfad: string): string | null => {
  if (istInhaber(betrieb) && !betrieb.eingerichtet)
    return pfad === EINRICHTUNG ? null : EINRICHTUNG;
  if (OFFEN.includes(pfad) || pfad === EINRICHTUNG) return "/";
  return sichtbar(betrieb.module, pfad) ? null : "/";
};

/** The page to go to instead of `pfad`, or null to stay (pure, so the router only asks) */
export const zielFuer = (zustand: Zustand, pfad: string): string | null => {
  if (zustand.art === "offline" || istEinladung(pfad) || pfad === PRUEFSEITE) return null;
  if (zustand.art === "abgemeldet") return OFFEN.includes(pfad) ? null : "/anmelden";
  if (zustand.art === "ohne_betrieb") return pfad === EINRICHTUNG ? null : EINRICHTUNG;
  return imBetrieb(zustand.betrieb, pfad);
};
