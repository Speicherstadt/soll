import { type Antwort, api } from "../api.ts";
import { mitFrist } from "./frist.ts";
import type { Kopplung } from "./typen.ts";

/** Where the tablet keeps its pairing: one per browser, the kiosk has no other user */
const SCHLUESSEL = "soll.kiosk";

/** The browser's storage, or null where it is blocked (private mode, a policy) */
export const speicher = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

export const kopplungLesen = (s: Storage | null): Kopplung | null => {
  try {
    const wert = JSON.parse(s?.getItem(SCHLUESSEL) ?? "null") as Partial<Kopplung> | null;
    return wert?.token && wert.terminalId ? (wert as Kopplung) : null;
  } catch {
    return null;
  }
};

export const kopplungMerken = (s: Storage | null, kopplung: Kopplung): void => {
  s?.setItem(SCHLUESSEL, JSON.stringify(kopplung));
};

export const kopplungVergessen = (s: Storage | null): void => {
  s?.removeItem(SCHLUESSEL);
};

/**
 * A call of the kiosk's API with the device token, the only credential the tablet holds; a server
 * that does not answer within FRIST_MS counts as no network (S-803)
 */
export const kioskAnfrage = <T>(token: string, pfad: string, body?: unknown): Promise<Antwort<T>> =>
  mitFrist(
    api<T>(`/api/v1/kiosk${pfad}`, {
      ...(body === undefined ? {} : { body }),
      headers: { authorization: `Bearer ${token}` },
    }),
  );
