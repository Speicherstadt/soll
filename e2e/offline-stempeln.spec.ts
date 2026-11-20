import { expect, type Page, test } from "@playwright/test";
import { weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string> = {}) =>
  Object.entries(werte).reduce(
    (text, [name, wert]) => text.replace(`{${name}}`, wert),
    de[key] ?? key,
  );

const knopf = (page: Page, key: string) => page.getByRole("button", { name: t(key), exact: true });
const liste = (page: Page) => page.getByRole("list", { name: t("stempelungen_titel") });
const wartend = (page: Page) => page.getByTestId("wartend");

/** Removes an entry from the device's queue, as if it got lost on the device (S-305) */
const eintragLoeschen = (page: Page, nummer: number) =>
  page.evaluate(
    (nr) =>
      new Promise<void>((fertig, fehler) => {
        const offen = indexedDB.open("soll-offline");
        offen.onerror = () => fehler(offen.error);
        offen.onsuccess = () => {
          const tx = offen.result.transaction("eintraege", "readwrite");
          const zeiger = tx.objectStore("eintraege").openCursor();
          zeiger.onsuccess = () => {
            const eintrag = zeiger.result;
            if (!eintrag) return;
            if ((eintrag.value as { nummer: number }).nummer === nr) eintrag.delete();
            eintrag.continue();
          };
          tx.oncomplete = () => fertig();
          tx.onerror = () => fehler(tx.error);
        };
      }),
    nummer,
  );

test("stamps without a network, sends it when the network is back and marks it offline @phone", async ({
  page,
  context,
  browser,
}) => {
  await weberMitSandra(page, browser, test.info());
  await page.goto("/");
  await expect(knopf(page, "stempeln_kommen")).toBeVisible();

  await context.setOffline(true);
  await knopf(page, "stempeln_kommen").click();
  // Heute counts on with the waiting stamp: the state changes without the server
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit \d\d:\d\d$/);
  await expect(wartend(page)).toHaveText(t("offline_wartend", { anzahl: "1" }));
  await expect(page.getByText(t("offline_ohne_netz"))).toBeVisible();
  await knopf(page, "stempeln_pause_starten").click();
  await expect(page.getByTestId("zustand")).toHaveText(/^In Pause seit \d\d:\d\d$/);
  await expect(wartend(page)).toHaveText(t("offline_wartend", { anzahl: "2" }));
  await expect(liste(page).getByText(t("stempel_wartet"), { exact: true })).toHaveCount(2);
  // a stamp that is not on the server yet cannot be changed there
  await expect(liste(page).getByRole("button")).toHaveCount(0);

  await context.setOffline(false);
  await expect(wartend(page)).toBeHidden({ timeout: 40_000 });
  await expect(liste(page).getByRole("listitem")).toHaveCount(2);
  await expect(liste(page).getByText(t("stempel_offline"), { exact: true })).toHaveCount(2);
  await expect(page.getByTestId("zustand")).toHaveText(/^In Pause seit \d\d:\d\d$/);
  await expect(page.getByRole("heading", { name: t("luecke_titel") })).toBeHidden();

  // what the server has: two stamps of the device, numbered 1 and 2, marked offline
  const tag = await (await page.request.get("/api/v1/arbeitszeit/tag")).json();
  expect(
    tag.stempelungen.map((s: { art: string; offline: boolean; nummer: number }) => [
      s.art,
      s.offline,
      s.nummer,
    ]),
  ).toEqual([
    ["kommen", true, 1],
    ["pause_beginn", true, 2],
  ]);
  // online again, the next stamp goes live with the next number
  await knopf(page, "stempeln_pause_beenden").click();
  await expect(liste(page).getByRole("listitem")).toHaveCount(3);
  await expect(liste(page).getByText(t("stempel_offline"), { exact: true })).toHaveCount(2);
});

test("shows a gap in the numbers of a device to the person and to the owner @phone", async ({
  page,
  context,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  await page.goto("/");
  await expect(knopf(page, "stempeln_kommen")).toBeVisible();
  await context.setOffline(true);
  await knopf(page, "stempeln_kommen").click();
  await knopf(page, "stempeln_pause_starten").click();
  await knopf(page, "stempeln_pause_beenden").click();
  await expect(wartend(page)).toHaveText(t("offline_wartend", { anzahl: "3" }));
  // number 2 gets lost on the device before it went out
  await eintragLoeschen(page, 2);
  await context.setOffline(false);
  await expect(wartend(page)).toBeHidden({ timeout: 40_000 });

  const luecke = page.getByRole("region", { name: t("luecke_titel") });
  await expect(luecke).toBeVisible();
  await expect(luecke).toContainText(/Gerät [0-9a-f]{8}: Nr\. 2 fehlt/);
  await expect(luecke).toContainText("Hinweis · § 3 Abs. 2 Nr. 1 ArbSchG");

  await jonas.goto("/zeiten");
  await jonas.getByLabel(t("zeiten_person")).selectOption({ label: "Sandra Kühn" });
  const fuerJonas = jonas.getByRole("region", { name: t("luecke_titel") });
  await expect(fuerJonas).toContainText(/Gerät [0-9a-f]{8}: Nr\. 2 fehlt/);
});
