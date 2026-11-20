import { describe, expect, it, vi } from "vitest";
import { NEULADEN_NACH_FEHLER_MS, neuladenBeiFehler } from "./neuladen.ts";
import { qrLesen } from "./qr.ts";
import { bildschirmWachHalten } from "./wachhalten.ts";

const fenster = () => {
  const ziel = new EventTarget();
  return ziel as unknown as Window & EventTarget;
};

describe("reloading the kiosk", () => {
  it("says so after an error and reloads once, later", () => {
    const f = fenster();
    const neuladen = vi.fn();
    const melden = vi.fn();
    const geplant: [() => void, number][] = [];
    neuladenBeiFehler({ fenster: f, neuladen, melden, warten: (a, ms) => geplant.push([a, ms]) });
    f.dispatchEvent(new Event("error"));
    f.dispatchEvent(new Event("unhandledrejection"));
    expect(melden).toHaveBeenCalledTimes(1);
    expect(geplant.map(([, ms]) => ms)).toEqual([NEULADEN_NACH_FEHLER_MS]);
    expect(neuladen).not.toHaveBeenCalled();
    geplant[0]?.[0]();
    expect(neuladen).toHaveBeenCalledTimes(1);
  });

  it("reloads at once when the network comes back, and no more after cleanup", () => {
    const f = fenster();
    const neuladen = vi.fn();
    const weg = neuladenBeiFehler({ fenster: f, neuladen, melden: vi.fn(), warten: vi.fn() });
    f.dispatchEvent(new Event("online"));
    expect(neuladen).toHaveBeenCalledTimes(1);
    weg();
    f.dispatchEvent(new Event("online"));
    expect(neuladen).toHaveBeenCalledTimes(1);
  });
});

describe("the wake lock", () => {
  const dokument = (sichtbar: { wert: DocumentVisibilityState }) => {
    const ziel = new EventTarget();
    Object.defineProperty(ziel, "visibilityState", { get: () => sichtbar.wert });
    return ziel as unknown as Document;
  };

  it("asks for the screen and again each time the page shows", async () => {
    const sichtbar = { wert: "visible" as DocumentVisibilityState };
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release }));
    const d = dokument(sichtbar);
    const weg = bildschirmWachHalten({ request }, d);
    expect(request).toHaveBeenCalledWith("screen");
    sichtbar.wert = "hidden";
    d.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(1);
    sichtbar.wert = "visible";
    d.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    weg();
    expect(release).toHaveBeenCalled();
  });

  it("does without on a device that has none or refuses", () => {
    const d = dokument({ wert: "visible" });
    expect(() => bildschirmWachHalten(undefined, d)()).not.toThrow();
    const abgelehnt = { request: () => Promise.reject(new Error("NotAllowedError")) };
    expect(() => bildschirmWachHalten(abgelehnt, d)).not.toThrow();
  });
});

describe("reading a QR code", () => {
  const spur = { stop: vi.fn() };
  const strom = { getTracks: () => [spur] } as unknown as MediaStream;
  const video = () =>
    ({ srcObject: null, play: async () => undefined }) as unknown as HTMLVideoElement;

  it("gives the decoded text only and stops the camera", async () => {
    const antworten = [[], [{ rawValue: "soll-ausweis:abc" }]];
    class Detector {
      detect = async () => antworten.shift() ?? [];
    }
    const v = video();
    const wert = await qrLesen(v, new AbortController().signal, {
      kamera: { getUserMedia: async () => strom },
      Detector,
      takt: 1,
    });
    expect(wert).toBe("soll-ausweis:abc");
    expect(spur.stop).toHaveBeenCalled();
    expect(v.srcObject).toBeNull();
  });

  it("stops when cancelled", async () => {
    class Detector {
      detect = async () => [];
    }
    const abbruch = new AbortController();
    const lesen = qrLesen(video(), abbruch.signal, {
      kamera: { getUserMedia: async () => strom },
      Detector,
      takt: 1,
    });
    abbruch.abort();
    expect(await lesen).toBeNull();
  });
});
