import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de", viewport: { width: 1440, height: 1000 } });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

test("review: Month view renders 5-week months (e.g. December 2026) without hanging on unused query slots", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const { standorte } = (await (await page.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  const { nutzerId } = (await (await page.request.get("/api/v1/betrieb")).json()) as {
    nutzerId: string;
  };
  const standortId = standorte[0]?.standortId ?? "";
  await senden(page, "POST", "/api/v1/dienstplan/schichten", {
    standortId,
    tag: "2026-12-10",
    beginnMinute: 8 * 60,
    endeMinute: 16 * 60,
    pauseMinuten: 30,
    rolle: "Service",
    nutzerId,
  });

  // December 2026 spans 5 ISO weeks (35 days), leaving the 6th query slot (idx=5) with skipToken
  await page.goto("/dienstplan?tag=2026-12-01");
  const ansicht = page.getByRole("group", { name: t("plan_ansicht") });
  await ansicht.getByRole("button", { name: t("plan_ansicht_monat"), exact: true }).click();

  await expect(page.getByText("08:00")).toBeVisible({ timeout: 5000 });
});

test("review: Month view passes axe accessibility checks (including color-contrast) in light mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await betriebAnlegen(page);
  await senden(page, "POST", "/api/v1/standorte", { name: "Elbe", land: "HH" });
  const { standorte } = (await (await page.request.get("/api/v1/standorte")).json()) as {
    standorte: { standortId: string }[];
  };
  const { nutzerId } = (await (await page.request.get("/api/v1/betrieb")).json()) as {
    nutzerId: string;
  };
  const standortId = standorte[0]?.standortId ?? "";
  await senden(page, "POST", "/api/v1/dienstplan/schichten", {
    standortId,
    tag: "2026-11-23",
    beginnMinute: 7 * 60,
    endeMinute: 15 * 60,
    pauseMinuten: 30,
    rolle: "Service",
    nutzerId,
  });

  await page.goto("/dienstplan?tag=2026-11-23");
  const ansicht = page.getByRole("group", { name: t("plan_ansicht") });
  await ansicht.getByRole("button", { name: t("plan_ansicht_monat"), exact: true }).click();
  await expect(page.getByText("07:00")).toBeVisible();

  // Out-of-month day cells with opacity-45 fail WCAG 2 AA 4.5:1 contrast (3.18:1)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
