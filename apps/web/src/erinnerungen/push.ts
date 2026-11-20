import type { Antwort } from "../api.ts";

/*
 * Web Push on this device (S-307): the browser's subscription for the server's VAPID key, sent to
 * the server and taken back. The browser comes in as a dependency, so the tests use a stand-in.
 */

/** What PushSubscription offers that the app uses */
export type Abo = {
  endpoint: string;
  toJSON: () => { endpoint?: string; keys?: Record<string, string> };
  unsubscribe: () => Promise<boolean>;
};

export type Umgebung = {
  /** the service worker's registration, null where there is none (no PWA build, no support) */
  registrierung: () => Promise<{
    pushManager: {
      getSubscription: () => Promise<Abo | null>;
      subscribe: (optionen: {
        userVisibleOnly: boolean;
        applicationServerKey: Uint8Array<ArrayBuffer>;
      }) => Promise<Abo>;
    };
  } | null>;
  /** Notification.requestPermission */
  erlaubnis: () => Promise<"granted" | "denied" | "default">;
  api: (pfad: string, init: { method?: string; body?: unknown }) => Promise<Antwort<unknown>>;
};

export type Stand = "nicht_verfuegbar" | "aus" | "an";
export type Ergebnis =
  | { ok: true }
  | { ok: false; grund: "nicht_verfuegbar" | "abgelehnt" | "server" };

export const PFAD = "/api/v1/arbeitszeit/erinnerungen";

/** The VAPID key as the browser takes it (base64url to bytes) */
export const schluesselBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
  const text = atob(base64url.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(text, (zeichen) => zeichen.charCodeAt(0));
};

/** Whether this device receives reminders now */
export const standLesen = async (u: Umgebung): Promise<Stand> => {
  const registrierung = await u.registrierung().catch(() => null);
  if (!registrierung) return "nicht_verfuegbar";
  const abo = await registrierung.pushManager.getSubscription().catch(() => null);
  return abo ? "an" : "aus";
};

/** Asks the browser for permission, subscribes and registers the device with the server */
export const einschalten = async (
  u: Umgebung,
  vapidSchluessel: string,
  sprache: string,
): Promise<Ergebnis> => {
  const registrierung = await u.registrierung().catch(() => null);
  if (!registrierung) return { ok: false, grund: "nicht_verfuegbar" };
  if ((await u.erlaubnis()) !== "granted") return { ok: false, grund: "abgelehnt" };
  let abo: Abo;
  try {
    abo = await registrierung.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: schluesselBytes(vapidSchluessel),
    });
  } catch {
    return { ok: false, grund: "abgelehnt" };
  }
  const { endpoint, keys } = abo.toJSON();
  const antwort = await u.api(`${PFAD}/abos`, {
    body: { endpoint, keys: { p256dh: keys?.p256dh, auth: keys?.auth }, sprache },
  });
  if (antwort.ok) return { ok: true };
  // a subscription the server did not take would only pretend to work
  await abo.unsubscribe().catch(() => false);
  return { ok: false, grund: "server" };
};

/** Unregisters the device with the server, then ends the browser's subscription */
export const ausschalten = async (u: Umgebung): Promise<Ergebnis> => {
  const registrierung = await u.registrierung().catch(() => null);
  const abo = await registrierung?.pushManager.getSubscription().catch(() => null);
  if (!abo) return { ok: true };
  const antwort = await u.api(`${PFAD}/abos`, {
    method: "DELETE",
    body: { endpoint: abo.endpoint },
  });
  // 404: the server no longer knows it (removed after a 410, or on another business)
  if (!antwort.ok && antwort.status !== 404) return { ok: false, grund: "server" };
  await abo.unsubscribe().catch(() => false);
  return { ok: true };
};

/** The browser itself: the service worker of the PWA build and the Notification API */
export const browserUmgebung = (api: Umgebung["api"]): Umgebung => ({
  registrierung: async () =>
    "serviceWorker" in navigator && "PushManager" in window
      ? ((await navigator.serviceWorker.getRegistration()) ?? null)
      : null,
  erlaubnis: () =>
    "Notification" in window ? Notification.requestPermission() : Promise.resolve("denied"),
  api,
});
