import { createECDH, randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;
const PFAD = "/api/v1/arbeitszeit/erinnerungen";

/**
 * A stand-in for the browser's push service (CLAUDE.md: what the browser provides is replaced in
 * tests): a service worker registration whose PushManager hands out a subscription with a real
 * P-256 key, and notifications allowed. The dev server has no service worker of its own.
 */
const pushErsatz = async (page: Page) => {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const abo = {
    endpoint: `https://push.example.test/${crypto.randomUUID()}`,
    keys: {
      p256dh: ua.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  await page.addInitScript((json) => {
    // the browser keeps a subscription across reloads; so does the stand-in, in the tab's storage
    const MERKER = "push-ersatz";
    const subscription = {
      endpoint: json.endpoint,
      toJSON: () => json,
      unsubscribe: async () => {
        sessionStorage.removeItem(MERKER);
        return true;
      },
    };
    const registrierung = {
      pushManager: {
        getSubscription: async () => (sessionStorage.getItem(MERKER) ? subscription : null),
        subscribe: async () => {
          sessionStorage.setItem(MERKER, "1");
          return subscription;
        },
      },
    };
    Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration: async () => registrierung, register: async () => registrierung },
      configurable: true,
    });
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: async () => "granted" },
      configurable: true,
    });
  }, abo);
  return abo;
};

const ansicht = async (page: Page) => (await page.request.get(PFAD)).json();

test("subscribes this device, chooses reminders and sets the business's times @phone", async ({
  page,
}) => {
  await pushErsatz(page);
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { name: t("erinnerungen_titel") })).toBeVisible();
  await expect(page.getByText(t("erinnerungen_geraet_aus"))).toBeVisible();
  await page.getByRole("button", { name: t("erinnerungen_einschalten") }).click();
  await expect(page.getByText(t("erinnerungen_geraet_an"))).toBeVisible();
  expect((await ansicht(page)).geraete).toBe(1);

  const pause = page.getByRole("checkbox", { name: t("erinnerungen_pause") });
  await expect(pause).toBeChecked();
  await pause.uncheck();
  await expect.poll(async () => (await ansicht(page)).wuensche.pause).toBe(false);
  // without SMTP on the e2e server no mail can go, and the box says so
  await expect(page.getByRole("checkbox", { name: t("erinnerungen_mail") })).toBeDisabled();

  await page.getByLabel(t("erinnerungen_regeln_gehen")).fill("9");
  await page.getByLabel(t("erinnerungen_regeln_monat")).fill("3");
  await page.getByRole("button", { name: t("erinnerungen_regeln_speichern") }).click();
  await expect(page.getByText(t("erinnerungen_regeln_gespeichert"))).toBeVisible();
  expect((await ansicht(page)).regeln).toEqual({
    gehenMinuten: 540,
    pauseVorlauf: 15,
    monatTag: 3,
  });

  await page.reload();
  await expect(page.getByRole("checkbox", { name: t("erinnerungen_pause") })).not.toBeChecked();
  await expect(page.getByLabel(t("erinnerungen_regeln_gehen"))).toHaveValue("9");

  await page.getByRole("button", { name: t("erinnerungen_ausschalten") }).click();
  await expect(page.getByText(t("erinnerungen_geraet_aus"))).toBeVisible();
  expect((await ansicht(page)).geraete).toBe(0);
});

test("refuses times out of their limits @phone", async ({ page }) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await page.getByLabel(t("erinnerungen_regeln_gehen")).fill("20");
  await page.getByRole("button", { name: t("erinnerungen_regeln_speichern") }).click();
  await expect(page.getByRole("alert")).toHaveText(t("erinnerungen_regeln_ungueltig"));
  expect((await ansicht(page)).regeln.gehenMinuten).toBe(600);
});

test("says where a device cannot receive notifications", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistration: async () => undefined },
      configurable: true,
    });
  });
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await expect(page.getByText(t("erinnerungen_geraet_nicht_verfuegbar"))).toBeVisible();
  await expect(page.getByRole("button", { name: t("erinnerungen_einschalten") })).toHaveCount(0);
});
