import type { Browser, Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { t, tabletOeffnen } from "./kiosk.ts";

declare global {
  interface Window {
    __nfcLeser: EventTarget[];
    __karteAuflegen: (serialNumber: string, url?: string) => void;
  }
}

/** Sandra's plain card and Max's NTAG 424 DNA with the keys it was personalised with */
export const UID_KARTE = "04:a1:b2:c3:d4:e5:f6";
export const NTAG = {
  uid: "04:1d:3c:8a:2d:6b:80",
  meta: "42AFF114F2CB3B6141BE6DC95DFC5416",
  datei: "B62A9BAF092439BD43C62AEE96B970C5",
};
/**
 * A genuine SUN message of that card at read 5, made with sunErzeugen
 * (apps/server/src/modules/terminal/sun-erzeugen.ts; sun.test.ts verifies it)
 */
export const SUN_URL = "https://soll.test/k?e=8A38BAD78521637B55C86468ECA62085&c=2BE17FD093495F7D";
/** The same message with the last digit of its MAC changed */
export const GEFAELSCHT_URL =
  "https://soll.test/k?e=8A38BAD78521637B55C86468ECA62085&c=2BE17FD093495F7E";

/**
 * What Chrome on Android provides, replaced (CLAUDE.md): `NDEFReader` listens once `scan()` is
 * called; a card "held to the tablet" is a `reading` event with its serial number and, for an
 * NTAG 424 DNA, the URL record it mirrors the SUN message into. With `erlaubt` false the first scan
 * is refused, as Chrome refuses one without a tap before the permission is granted; the next, from
 * the tap on the kiosk's button, goes through.
 */
const ersatzFuerNfc = (anfangsErlaubt: boolean) => {
  let erlaubt = anfangsErlaubt;
  window.__nfcLeser = [];
  class NDEFReader extends EventTarget {
    async scan(optionen?: { signal?: AbortSignal }) {
      if (!erlaubt) {
        erlaubt = true;
        throw new DOMException("no permission", "NotAllowedError");
      }
      window.__nfcLeser.push(this);
      optionen?.signal?.addEventListener("abort", () => {
        window.__nfcLeser = window.__nfcLeser.filter((leser) => leser !== this);
      });
    }
  }
  Object.defineProperty(window, "NDEFReader", { configurable: true, value: NDEFReader });
  window.__karteAuflegen = (serialNumber, url) => {
    const records = url
      ? [{ recordType: "url", data: new DataView(new TextEncoder().encode(url).buffer) }]
      : [];
    for (const leser of window.__nfcLeser) {
      const ereignis = Object.assign(new Event("reading"), {
        serialNumber,
        message: { records },
      });
      leser.dispatchEvent(ereignis);
    }
  };
};

/** A tablet that reads NFC cards */
export const nfcTabletOeffnen = async (browser: Browser, info: TestInfo, erlaubt = true) => {
  const tablet = await tabletOeffnen(browser, info);
  await tablet.addInitScript(ersatzFuerNfc, erlaubt);
  return tablet;
};

export const karteAuflegen = (tablet: Page, uid: string, url?: string) =>
  tablet.evaluate(([karte, adresse]) => window.__karteAuflegen(karte, adresse), [
    uid,
    url,
  ] as const);

/** The owner enters a card in the dialog under Einstellungen */
export const karteEintragen = async (
  jonas: Page,
  karte: { name: string; uid: string; ntag?: { meta: string; datei: string } },
) => {
  await jonas.getByRole("button", { name: t("terminal_karte_eintragen") }).click();
  const dialog = jonas.getByRole("dialog");
  await dialog.getByLabel(t("terminal_karte_person")).selectOption({ label: karte.name });
  if (karte.ntag)
    await dialog.getByLabel(t("terminal_karte_art")).selectOption({ value: "ntag424" });
  await dialog.getByLabel(t("terminal_karte_uid")).fill(karte.uid);
  if (karte.ntag) {
    await dialog.getByLabel(t("terminal_karte_meta")).fill(karte.ntag.meta);
    await dialog.getByLabel(t("terminal_karte_datei")).fill(karte.ntag.datei);
  }
  await dialog.getByRole("button", { name: t("terminal_speichern") }).click();
  await expect(dialog).toBeHidden();
};

/** A call of the kiosk's API with the tablet's own device token, as a forged kiosk would make it */
export const kioskAufruf = (tablet: Page, pfad: string, body: unknown) =>
  tablet.evaluate(
    async ([ziel, inhalt]) => {
      const { token } = JSON.parse(localStorage.getItem("soll.kiosk") ?? "{}") as { token: string };
      const antwort = await fetch(`/api/v1/kiosk${ziel}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(inhalt),
      });
      return antwort.status;
    },
    [pfad, body] as const,
  );
