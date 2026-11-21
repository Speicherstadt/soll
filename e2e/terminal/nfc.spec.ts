import { expect, test } from "@playwright/test";
import { thema, uebergaengeFertig } from "../thema.ts";
import { axe, koppeln, pinSetzen, pinTippen, t, weberMitTerminal } from "./kiosk.ts";
import {
  GEFAELSCHT_URL,
  karteAuflegen,
  karteEintragen,
  kioskAufruf,
  NTAG,
  nfcTabletOeffnen,
  SUN_URL,
  UID_KARTE,
} from "./nfc.ts";

test.use({ locale: "de" });

test("a plain card with its person's PIN stamps; with another PIN it is refused @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  await pinSetzen(jonas, "Max Peters", "583920");
  await karteEintragen(jonas, { name: "Sandra Kühn", uid: UID_KARTE });
  await expect(jonas.getByRole("table", { name: t("terminal_karten_titel") })).toContainText(
    "Sandra Kühn",
  );
  const tablet = await nfcTabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  await expect(tablet.getByRole("region", { name: t("kiosk_uhr") })).toContainText(
    t("kiosk_hinweis_karte_qr"),
  );

  // Max's PIN does not go with Sandra's card
  await karteAuflegen(tablet, UID_KARTE);
  await expect(tablet.getByText(t("kiosk_karte_pin"))).toBeVisible();
  await pinTippen(tablet, "583920");
  await expect(tablet.getByText(t("kiosk_unbekannt", { rest: 4 }))).toBeVisible();

  await karteAuflegen(tablet, UID_KARTE);
  await expect(tablet.getByText(t("kiosk_karte_pin"))).toBeVisible();
  await pinTippen(tablet, "471100");
  await expect(
    tablet.getByRole("heading", { name: t("kiosk_hallo", { name: "Sandra Kühn" }) }),
  ).toBeVisible();
  await tablet.getByRole("button", { name: t("stempeln_kommen"), exact: true }).click();
  await expect(tablet.getByRole("status", { name: t("kiosk_gestempelt") })).toBeVisible();
});

test("a plain card without PIN recognises nobody @terminal", async ({ page: jonas, browser }) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  await karteEintragen(jonas, { name: "Sandra Kühn", uid: UID_KARTE });
  const tablet = await nfcTabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  await karteAuflegen(tablet, UID_KARTE);
  await expect(tablet.getByText(t("kiosk_karte_pin"))).toBeVisible();
  await expect(tablet.getByRole("heading", { name: /Sandra/ })).toBeHidden();
  // nor does the server take the card alone, whatever a tablet sends
  expect(await kioskAufruf(tablet, "/erkennen", { karte: UID_KARTE })).toBe(400);
  expect(
    await kioskAufruf(tablet, "/stempeln", { ausweis: { karte: UID_KARTE }, art: "kommen" }),
  ).toBe(400);
  await axe(tablet);
});

test("an NTAG 424 DNA: a forged SUN message is refused, a genuine one stamps, its replay is refused @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await karteEintragen(jonas, { name: "Max Peters", uid: NTAG.uid, ntag: NTAG });
  const tablet = await nfcTabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);

  await karteAuflegen(tablet, NTAG.uid, GEFAELSCHT_URL);
  await expect(tablet.getByText(t("kiosk_unbekannt", { rest: 4 }))).toBeVisible();

  await karteAuflegen(tablet, NTAG.uid, SUN_URL);
  await expect(
    tablet.getByRole("heading", { name: t("kiosk_hallo", { name: "Max Peters" }) }),
  ).toBeVisible();
  // the message counts once; the tap on Kommen stamps with the server's receipt
  await tablet.getByRole("button", { name: t("stempeln_kommen"), exact: true }).click();
  await expect(tablet.getByRole("status", { name: t("kiosk_gestempelt") })).toBeVisible();
  await expect(tablet.getByRole("region", { name: t("kiosk_pin_eingeben") })).toBeVisible({
    timeout: 10_000,
  });

  // the same message read again, e.g. copied by a phone held to the card: refused
  await karteAuflegen(tablet, NTAG.uid, SUN_URL);
  await expect(tablet.getByText(t("kiosk_unbekannt", { rest: 3 }))).toBeVisible();

  // the owner revokes the card
  await jonas.reload();
  await jonas
    .getByRole("button", { name: t("terminal_karte_entziehen_name", { name: "Max Peters" }) })
    .click();
  await expect(jonas.getByText(t("terminal_karten_keine"))).toBeVisible();
});

test("a tablet whose browser wants a tap for NFC offers a button for it @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  const tablet = await nfcTabletOeffnen(browser, test.info(), false);
  await koppeln(jonas, tablet);
  const uhr = tablet.getByRole("region", { name: t("kiosk_uhr") });
  await expect(uhr).toContainText(t("kiosk_hinweis"));
  await expect(uhr).not.toContainText(t("kiosk_hinweis_karte_qr"));
  await tablet.getByRole("button", { name: t("kiosk_nfc_erlauben") }).click();
  await expect(uhr).toContainText(t("kiosk_hinweis_karte_qr"));
  await expect(tablet.getByRole("button", { name: t("kiosk_nfc_erlauben") })).toBeHidden();
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on the cards in ${theme} @terminal`, async ({ page: jonas, browser }) => {
    await thema(jonas, theme);
    await weberMitTerminal(jonas, browser, test.info());
    await karteEintragen(jonas, { name: "Sandra Kühn", uid: UID_KARTE });
    await axe(jonas);
    await jonas.getByRole("button", { name: t("terminal_karte_eintragen") }).click();
    await jonas.getByRole("dialog").getByLabel(t("terminal_karte_art")).selectOption("ntag424");
    await uebergaengeFertig(jonas);
    await axe(jonas);
    await jonas.keyboard.press("Escape");
    await expect(jonas.getByRole("dialog")).toBeHidden();
    const tablet = await nfcTabletOeffnen(browser, test.info());
    await thema(tablet, theme);
    await koppeln(jonas, tablet);
    await karteAuflegen(tablet, UID_KARTE);
    await expect(tablet.getByText(t("kiosk_karte_pin"))).toBeVisible();
    await axe(tablet);
  });
}
