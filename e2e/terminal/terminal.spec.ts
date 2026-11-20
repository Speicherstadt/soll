import { expect, test } from "@playwright/test";
import { axe, koppeln, pinSetzen, pinTippen, t, tabletOeffnen, weberMitTerminal } from "./kiosk.ts";

test.use({ locale: "de" });

test("pairs a tablet, recognises Sandra by PIN, stamps and goes back to the clock @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const tablet = await tabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  await expect(tablet.getByRole("region", { name: t("kiosk_uhr") })).toContainText(
    "Weber Haustechnik",
  );
  await expect(tablet.getByRole("region", { name: t("kiosk_uhr") })).toContainText("Eingang");
  // the screen stays on (Wake Lock)
  await expect.poll(() => tablet.evaluate(() => window.__wakeLock)).toBeGreaterThan(0);

  await pinTippen(tablet, "471100");
  await expect(
    tablet.getByRole("heading", { name: t("kiosk_hallo", { name: "Sandra Kühn" }) }),
  ).toBeVisible();
  await expect(tablet.getByTestId("zustand")).toHaveText(t("stempeln_zustand_aus"));
  await axe(tablet);
  await tablet.getByRole("button", { name: t("stempeln_kommen"), exact: true }).click();
  const bestaetigt = tablet.getByRole("status", { name: t("kiosk_gestempelt") });
  await expect(bestaetigt).toContainText(/Kommen um \d\d:\d\d gestempelt/);
  await axe(tablet);
  // back to the clock by itself after five seconds
  await expect(tablet.getByRole("region", { name: t("kiosk_pin_eingeben") })).toBeVisible({
    timeout: 10_000,
  });

  // the stamp is Sandra's, from the terminal; the next tap offers Pause and Gehen
  await pinTippen(tablet, "471100");
  await expect(tablet.getByTestId("zustand")).toHaveText(/^Eingestempelt seit \d\d:\d\d$/);
  await expect(tablet.getByRole("button", { name: t("stempeln_pause_starten") })).toBeVisible();
  await expect(tablet.getByRole("button", { name: t("stempeln_gehen") })).toBeVisible();
  await tablet.getByRole("button", { name: t("kiosk_fertig") }).click();
  await expect(tablet.getByRole("region", { name: t("kiosk_pin_eingeben") })).toBeVisible();
});

test("recognises Max by the QR code the owner printed @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  const ausgestellt = jonas.waitForResponse((antwort) =>
    antwort.url().includes("/api/v1/terminal/ausweise/"),
  );
  await jonas
    .getByRole("button", { name: t("terminal_qr_ausstellen_name", { name: "Max Peters" }) })
    .click();
  const { wert } = (await (await ausgestellt).json()) as { wert: string };
  const dialog = jonas.getByRole("dialog");
  await expect(
    dialog.getByRole("img", { name: t("terminal_qr_bild", { name: "Max Peters" }) }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: t("terminal_drucken") })).toBeVisible();
  await axe(jonas);
  await dialog.getByRole("button", { name: t("terminal_schliessen") }).click();

  const tablet = await tabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  await tablet.getByRole("button", { name: t("kiosk_qr_zeigen") }).click();
  await expect(tablet.getByText(t("kiosk_qr_text"))).toBeVisible();
  await tablet.evaluate((qr) => {
    window.__qr = qr;
  }, wert);
  await expect(
    tablet.getByRole("heading", { name: t("kiosk_hallo", { name: "Max Peters" }) }),
  ).toBeVisible();
  // the camera is off again once the code is read
  expect(await tablet.locator("video").count()).toBe(0);
  await tablet.getByRole("button", { name: t("stempeln_kommen"), exact: true }).click();
  await expect(tablet.getByRole("status", { name: t("kiosk_gestempelt") })).toBeVisible();

  const { nutzerId } = await jonas.evaluate(async () => {
    const antwort = await fetch("/api/v1/terminal/personen");
    const { personen } = (await antwort.json()) as {
      personen: { nutzerId: string; name: string }[];
    };
    return personen.find((p) => p.name === "Max Peters") ?? { nutzerId: "" };
  });
  const tag = (await (
    await jonas.request.get(`/api/v1/arbeitszeit/tag?nutzerId=${nutzerId}`)
  ).json()) as { stempelungen: { art: string; quelle: string }[] };
  expect(tag.stempelungen).toMatchObject([{ art: "kommen", quelle: "terminal" }]);
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on the terminal's clock in ${theme} @terminal`, async ({
    page: jonas,
    browser,
  }) => {
    await weberMitTerminal(jonas, browser, test.info());
    const tablet = await tabletOeffnen(browser, test.info());
    await tablet.emulateMedia({ colorScheme: theme });
    await koppeln(jonas, tablet);
    await axe(tablet);
    await pinTippen(tablet, "000000");
    await expect(tablet.getByText(t("kiosk_unbekannt", { rest: 4 }))).toBeVisible();
    await axe(tablet);
  });
}
