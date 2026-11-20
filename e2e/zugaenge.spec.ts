import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";
import { thema } from "./thema.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

/** A program with the token: no cookie is needed, the Bearer header decides (S-607) */
const mitToken = (page: Page, token: string) => ({
  betrieb: () =>
    page.request.get("/api/v1/betrieb", { headers: { authorization: `Bearer ${token}` } }),
  mcp: (body: unknown) =>
    page.request.post("/mcp", {
      data: body,
      headers: {
        authorization: `Bearer ${token}`,
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": "betrieb_lesen",
      },
    }),
});

test("a person creates a token, a program uses it, she revokes it @phone", async ({ page }) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await expect(page.getByRole("heading", { level: 2, name: t("zugaenge_titel") })).toBeVisible();
  await expect(page.getByText(t("zugaenge_leer"))).toBeVisible();

  await page.getByLabel(t("zugang_name"), { exact: true }).fill("Tabelle");
  await page
    .getByLabel(t("zugang_gueltigkeit"))
    .selectOption({ label: t("zugang_tage", { tage: "30" }) });
  await page.getByRole("button", { name: t("zugang_anlegen") }).click();
  await expect(page.getByText(t("zugang_neu"))).toBeVisible();
  const feld = page.getByLabel(t("zugang_token", { name: "Tabelle" }));
  const token = await feld.inputValue();
  expect(token).toMatch(/^soll_/);
  const zeile = page.getByRole("row", { name: /Tabelle/ });
  await expect(zeile).toContainText(token.slice(0, 9));
  await expect(zeile).toContainText(t("zugang_nie"));

  for (const theme of ["light", "dark"] as const) {
    await thema(page, theme);
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }

  const programm = mitToken(page, token);
  const betrieb = await programm.betrieb();
  expect(betrieb.status()).toBe(200);
  expect(await betrieb.json()).toMatchObject({ name: "Weber Haustechnik" });
  const werkzeug = await programm.mcp({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "betrieb_lesen",
      arguments: {},
      _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
    },
  });
  expect(werkzeug.status()).toBe(200);
  expect((await werkzeug.json()).result).toMatchObject({
    isError: false,
    structuredContent: { name: "Weber Haustechnik" },
  });

  // after a reload the token is gone from the page, the row with the day of its use stays
  await page.reload();
  await expect(page.getByText(t("zugang_neu"))).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Tabelle/ })).not.toContainText(t("zugang_nie"));

  await page.getByRole("button", { name: t("zugang_widerrufen", { name: "Tabelle" }) }).click();
  await expect(page.getByText(t("zugaenge_leer"))).toBeVisible();
  expect((await programm.betrieb()).status()).toBe(401);
});
