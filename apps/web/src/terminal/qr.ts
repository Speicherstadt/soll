/** What the Shape Detection API gives (WICG, BarcodeDetector), as far as the kiosk needs it */
export type Detector = { detect: (quelle: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
export type DetectorKlasse = new (optionen: { formats: string[] }) => Detector;

export type Kamera = {
  getUserMedia: (vorgaben: MediaStreamConstraints) => Promise<MediaStream>;
};

/** How often the camera picture is looked at for a code */
export const QR_TAKT_MS = 250;

/** The BarcodeDetector of the browser, if it has one that reads QR codes */
export const qrDetector = (): DetectorKlasse | undefined =>
  (globalThis as { BarcodeDetector?: DetectorKlasse }).BarcodeDetector;

const warten = (ms: number) => new Promise((fertig) => setTimeout(fertig, ms));

/**
 * Reads one QR code from the front camera (S-801). Only the decoded text leaves this function:
 * no picture is kept, drawn or sent, and the camera stops as soon as a code is read or the reading
 * is cancelled (CLAUDE.md: no photos at clock-in). Null when cancelled.
 */
export const qrLesen = async (
  video: HTMLVideoElement,
  signal: AbortSignal,
  deps: { kamera: Kamera; Detector: DetectorKlasse; takt?: number },
): Promise<string | null> => {
  const strom = await deps.kamera.getUserMedia({ video: { facingMode: "user" }, audio: false });
  try {
    video.srcObject = strom;
    await video.play().catch(() => undefined);
    const detector = new deps.Detector({ formats: ["qr_code"] });
    while (!signal.aborted) {
      const gefunden = (await detector.detect(video).catch(() => []))[0]?.rawValue;
      if (gefunden) return gefunden;
      await warten(deps.takt ?? QR_TAKT_MS);
    }
    return null;
  } finally {
    for (const spur of strom.getTracks()) spur.stop();
    video.srcObject = null;
  }
};
