import { expect, type Page, test } from "@playwright/test";
import { einladungAnnehmen, weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const knopf = (page: Page, key: string) => page.getByRole("button", { name: t(key), exact: true });

/** Calls to the API that never reach the server, as on a phone that just lost its network */
const ohneNetz = (page: Page, pfad: string) =>
  page.route(
    (url) => url.pathname.startsWith(pfad),
    (route) => route.abort("internetdisconnected"),
  );

/** What waits in the device's queue, of every person (S-305) */
const eintraegeAufDemGeraet = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ nummer: number; abgelehnt: string | null }[]>((fertig, fehler) => {
        const offen = indexedDB.open("soll-offline");
        offen.onerror = () => fehler(offen.error);
        offen.onsuccess = () => {
          const alle = offen.result.transaction("eintraege").objectStore("eintraege").getAll();
          alle.onsuccess = () =>
            fertig(
              (alle.result as { nummer: number; abgelehnt: string | null }[]).map(
                ({ nummer, abgelehnt }) => ({ nummer, abgelehnt }),
              ),
            );
          alle.onerror = () => fehler(alle.error);
        };
      }),
  );

/**
 * A shared browser (S-305, DSGVO): the day and the queue kept on the device belong to the person who
 * stamped, not to the business, so the next person signed in here never sees them, offline included,
 * and never stamps into them
 */
test("the next person on a shared browser never sees the previous person's day or waiting stamps @phone", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  await page.goto("/");
  await knopf(page, "stempeln_kommen").click();
  await expect(page.getByTestId("zustand")).toHaveText(/^Eingestempelt seit/);
  // the next stamp cannot reach the server: it waits in the queue of this device
  await ohneNetz(page, "/api/v1/arbeitszeit/stempelungen");
  await knopf(page, "stempeln_pause_starten").click();
  await expect(page.getByTestId("wartend")).toBeVisible();
  await page.unrouteAll();

  // Sandra signs out; Max signs in on the same browser, and the network drops before his day loads
  await page.goto("/einstellungen");
  await page.getByRole("button", { name: t("abmelden") }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  await einladungAnnehmen(jonas, page, "Max Brandt");
  await ohneNetz(page, "/api/v1/arbeitszeit/tag");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("zustand")).toHaveCount(0);
  await expect(page.getByTestId("wartend")).toHaveCount(0);
  await expect(knopf(page, "stempeln_pause_starten")).toHaveCount(0);

  // back online: Max starts his own day, Sandra's waiting stamp was neither sent as his nor refused
  await page.unrouteAll();
  await page.reload();
  await expect(knopf(page, "stempeln_kommen")).toBeVisible();
  await expect(page.getByRole("heading", { name: t("offline_abgelehnt_titel") })).toHaveCount(0);
  const tag = await (await page.request.get("/api/v1/arbeitszeit/tag")).json();
  expect(tag.stempelungen).toEqual([]);
  expect(await eintraegeAufDemGeraet(page)).toEqual([{ nummer: 2, abgelehnt: null }]);
});
