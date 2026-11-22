import { expect, test } from "@playwright/test";
import { koppeln, pinSetzen, pinTippen, t, tabletOeffnen, weberMitTerminal } from "./kiosk.ts";

test.use({ locale: "de" });

test("waits after five wrong PINs and lets the right one through afterwards only @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const tablet = await tabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  for (let rest = 4; rest >= 1; rest--) {
    await pinTippen(tablet, "000000");
    await expect(tablet.getByText(t("kiosk_unbekannt", { rest }))).toBeVisible();
  }
  await pinTippen(tablet, "000000");
  await expect(
    tablet.getByText(/^Zu viele falsche Versuche\. Wieder möglich in \d+ s\.$/),
  ).toBeVisible();
  await expect(tablet.getByRole("button", { name: t("kiosk_ok") })).toBeDisabled();
  // the owner sees the lock at the terminal
  await jonas.reload();
  await expect(jonas.getByText(/^nach falschen Versuchen gesperrt bis \d\d:\d\d$/)).toBeVisible();
});

test("a PIN another person holds is refused @terminal", async ({ page: jonas, browser }) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  await jonas
    .getByRole("button", { name: t("terminal_pin_setzen_name", { name: "Max Peters" }) })
    .click();
  const dialog = jonas.getByRole("dialog");
  await dialog.getByLabel(t("terminal_pin_feld")).fill("471100");
  await dialog.getByRole("button", { name: t("terminal_speichern") }).click();
  await expect(dialog.getByText(t("terminal_pin_vergeben"))).toBeVisible();
});

test("a revoked tablet goes back to pairing @terminal", async ({ page: jonas, browser }) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const tablet = await tabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet, "Lager");
  await jonas.reload();
  await jonas
    .getByRole("button", { name: t("terminal_entkoppeln_name", { name: "Lager" }) })
    .click();
  await expect(jonas.getByText(t("terminal_keine"))).toBeVisible();
  await pinTippen(tablet, "471100");
  await expect(tablet.getByRole("heading", { name: t("kiosk_koppeln_titel") })).toBeVisible();
});

test("reloads after an error and when the network comes back @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  const tablet = await tabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  const markieren = () =>
    tablet.evaluate(() => {
      window.__marke = 1;
    });
  // while the page reloads there is nothing to ask: that counts as not yet reloaded
  const marke = () => tablet.evaluate(() => window.__marke ?? null).catch(() => "laedt" as const);

  await markieren();
  await tablet.evaluate(() => {
    setTimeout(() => {
      throw new Error("kaputt");
    });
  });
  await expect(tablet.getByRole("alert")).toHaveText(t("kiosk_neustart"));
  await expect.poll(marke, { timeout: 15_000 }).toBeNull();
  await expect(tablet.getByTestId("uhr")).toBeVisible();

  await markieren();
  await tablet.context().setOffline(true);
  await tablet.context().setOffline(false);
  await expect.poll(marke, { timeout: 15_000 }).toBeNull();
  await expect(tablet.getByTestId("uhr")).toBeVisible();
});

test("a locked tablet learns that it was revoked and goes back to pairing @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const tablet = await tabletOeffnen(browser, test.info());
  await tablet.clock.install();
  await koppeln(jonas, tablet, "Lager");
  for (let i = 0; i < 5; i++) await pinTippen(tablet, "000000");
  await expect(tablet.getByRole("button", { name: t("kiosk_ok") })).toBeDisabled();
  // the owner lifts the lock by pairing anew (docs/plan.md, "Sperre am Terminal"): first revoking
  await jonas.reload();
  await jonas
    .getByRole("button", { name: t("terminal_entkoppeln_name", { name: "Lager" }) })
    .click();
  await expect(jonas.getByText(t("terminal_keine"))).toBeVisible();
  // half a minute later the locked tablet, on which nobody can tap, knows
  await tablet.clock.fastForward("00:30");
  await expect(tablet.getByRole("heading", { name: t("kiosk_koppeln_titel") })).toBeVisible();
});

test("the owner unlocks a locked tablet from Einstellungen @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const tablet = await tabletOeffnen(browser, test.info());
  await tablet.clock.install();
  await koppeln(jonas, tablet, "Lager");
  for (let i = 0; i < 5; i++) await pinTippen(tablet, "000000");
  await expect(tablet.getByRole("button", { name: t("kiosk_ok") })).toBeDisabled();
  await jonas.reload();
  await jonas
    .getByRole("button", { name: t("terminal_entsperren_name", { name: "Lager" }) })
    .click();
  await expect(jonas.getByText(/^nach falschen Versuchen gesperrt bis/)).toBeHidden();
  await expect(
    jonas.getByRole("button", { name: t("terminal_entsperren_name", { name: "Lager" }) }),
  ).toBeHidden();
  await tablet.clock.fastForward("00:30");
  await expect(tablet.getByRole("button", { name: t("kiosk_ok") })).toBeEnabled();
  await pinTippen(tablet, "471100");
  await expect(tablet.getByText("Sandra Kühn")).toBeVisible();
});
