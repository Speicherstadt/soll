/** What the Screen Wake Lock API gives (W3C Screen Wake Lock), as far as the kiosk needs it */
export type WakeLock = { request: (art: "screen") => Promise<{ release: () => Promise<void> }> };

type Dokument = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

/**
 * Keeps the tablet's screen on while the kiosk shows (Wake Lock). The browser drops the lock when
 * the page is hidden, so it is asked for again each time the page shows. A device without the API
 * or a refusal leaves the screen to the device's own settings; nothing else depends on it.
 * Returns the cleanup.
 */
export const bildschirmWachHalten = (wakeLock: WakeLock | undefined, dokument: Dokument) => {
  let sperre: { release: () => Promise<void> } | null = null;
  const anfordern = () => {
    if (!wakeLock || dokument.visibilityState !== "visible") return;
    wakeLock.request("screen").then(
      (neu) => {
        sperre = neu;
      },
      () => undefined,
    );
  };
  dokument.addEventListener("visibilitychange", anfordern);
  anfordern();
  return () => {
    dokument.removeEventListener("visibilitychange", anfordern);
    sperre?.release().catch(() => undefined);
  };
};
