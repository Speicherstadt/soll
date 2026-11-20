import { expect, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";

// An area of a switched-off module leads to Heute (BAULISTE.md S-303), however its path is written
test("an area of a switched-off module leads to Heute also with a trailing slash", async ({
  page,
}) => {
  await betriebAnlegen(page, {
    beschaeftigte: true,
    schichten: true,
    kunden: false,
    stempelort: false,
  });
  await page.goto("/projekte/");
  await expect(page).toHaveURL(/localhost:5178\/$/);
});
