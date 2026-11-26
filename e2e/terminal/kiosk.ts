import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";
import { betriebAnlegen, einladungAnnehmen, zweiterBrowser } from "../betrieb.ts";
import { messagesOf } from "../locales.ts";

const de = messagesOf("de");
export const t = (key: string, werte: Record<string, string | number> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, String(wert)),
    de[key] ?? key,
  );

declare global {
  interface Window {
    __wakeLock: number;
    __qr: string | null;
    __marke?: number;
  }
}

/**
 * What the tablet's browser provides, replaced (CLAUDE.md): the Wake Lock counts its requests, the
 * camera gives a blank canvas stream, and BarcodeDetector "reads" whatever the test puts in
 * `window.__qr`; no picture is ever looked at
 */
const ersatzFuerDasTablet = () => {
  window.__wakeLock = 0;
  window.__qr = null;
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async () => {
        window.__wakeLock += 1;
        return { release: async () => undefined };
      },
    },
  });
  Object.defineProperty(window, "BarcodeDetector", {
    configurable: true,
    value: class {
      async detect() {
        return window.__qr ? [{ rawValue: window.__qr }] : [];
      }
    },
  });
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async () => {
      const leinwand = document.createElement("canvas");
      leinwand.width = 64;
      leinwand.height = 48;
      leinwand.getContext("2d")?.fillRect(0, 0, 64, 48);
      return leinwand.captureStream();
    },
  });
};

/** The tablet: a browser of its own in the test's project (1280 × 800), with the replacements */
export const tabletOeffnen = async (browser: Browser, info: TestInfo): Promise<Page> => {
  const tablet = await zweiterBrowser(browser, info);
  await tablet.addInitScript(ersatzFuerDasTablet);
  return tablet;
};

/** Weber Haustechnik with all modules, Sandra and Max as fitters, the owner on Einstellungen */
export const weberMitTerminal = async (jonas: Page, browser: Browser, info: TestInfo) => {
  await betriebAnlegen(jonas);
  const sandra = await zweiterBrowser(browser, info);
  const max = await zweiterBrowser(browser, info);
  await einladungAnnehmen(jonas, sandra, "Sandra Kühn");
  await einladungAnnehmen(jonas, max, "Max Peters");
  await jonas.goto("/einstellungen");
  await jonas.getByRole("tab", { name: t("einstellungen_tab_terminal") }).click();
  return { sandra, max };
};

/** The owner sets a PIN in the dialog of the person's row */
export const pinSetzen = async (jonas: Page, name: string, pin: string) => {
  await jonas.getByRole("button", { name: t("terminal_pin_setzen_name", { name }) }).click();
  const dialog = jonas.getByRole("dialog");
  await dialog.getByLabel(t("terminal_pin_feld")).fill(pin);
  await dialog.getByRole("button", { name: t("terminal_speichern") }).click();
  await expect(dialog).toBeHidden();
};

/** The owner creates a pairing code and the tablet takes it */
export const koppeln = async (jonas: Page, tablet: Page, name = "Eingang") => {
  await jonas.getByLabel(t("terminal_geraet_name")).fill(name);
  await jonas.getByRole("button", { name: t("terminal_koppeln") }).click();
  const code = (await jonas.getByTestId("code").textContent()) ?? "";
  expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
  await tablet.goto("/terminal");
  await tablet.getByLabel(t("kiosk_code")).fill(code.toLowerCase());
  await tablet.getByRole("button", { name: t("kiosk_koppeln") }).click();
  await expect(tablet.getByTestId("uhr")).toBeVisible();
};

/** Typing a PIN on the number pad and confirming it */
export const pinTippen = async (tablet: Page, pin: string) => {
  for (const ziffer of pin)
    await tablet.getByRole("button", { name: t("kiosk_ziffer", { ziffer }), exact: true }).click();
  await tablet.getByRole("button", { name: t("kiosk_ok") }).click();
};

export const axe = async (page: Page) => {
  const ergebnis = await new AxeBuilder({ page }).analyze();
  expect(ergebnis.violations).toEqual([]);
};
