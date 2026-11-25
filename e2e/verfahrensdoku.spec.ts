import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

const herunterladen = async (page: Page, name: string) => {
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name }).click();
  const datei = await download;
  return { name: datei.suggestedFilename(), inhalt: await readFile((await datei.path()) ?? "") };
};

/** The whole loaded page, with its gaps or without, in both themes */
const axe = async (page: Page) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    // the buttons fade to the new colors (transition-colors); axe reads the colors once they arrived
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
};

/** Fills every statement the business makes, so the document becomes complete */
const angabenEintragen = async (page: Page) => {
  const werte: Record<string, string> = {
    verfahrensdoku_rechtsform: "Einzelunternehmen",
    verfahrensdoku_anschrift: "Wandsbeker Chaussee 1, 22089 Hamburg",
    verfahrensdoku_verantwortlich: "Jonas Weber",
    verfahrensdoku_aufbewahrungsort: "Büro in Hamburg",
    verfahrensdoku_serverbetrieb: "Jonas Weber spielt Updates ein",
    verfahrensdoku_datensicherung: "Täglich mit soll backup auf das NAS",
    verfahrensdoku_schluesselablage: "Tresor im Büro",
  };
  for (const [key, wert] of Object.entries(werte))
    await page.getByLabel(t(key), { exact: true }).fill(wert);
};

test("the owner fills in the statements and downloads the Verfahrensdokumentation", async ({
  page,
}) => {
  await betriebAnlegen(page);
  await page.goto("/einstellungen");
  await page.getByRole("link", { name: t("verfahrensdoku_oeffnen") }).click();
  await expect(page).toHaveURL("/verfahrensdoku");
  await expect(
    page.getByText(t("verfahrensdoku_unvollstaendig").replace("{anzahl}", "7")),
  ).toBeVisible();
  await axe(page);

  await angabenEintragen(page);
  await page.getByRole("button", { name: t("verfahrensdoku_abschnitt_neu") }).click();
  await page
    .getByLabel(t("verfahrensdoku_abschnitt_titel").replace("{nummer}", "1"))
    .fill("Papier vor Soll");
  await page
    .getByLabel(t("verfahrensdoku_abschnitt_text").replace("{nummer}", "1"))
    .fill("Die Zettel liegen im Büro.");
  await page.getByRole("button", { name: t("verfahrensdoku_speichern") }).click();
  await expect(page.getByRole("status")).toHaveText(t("verfahrensdoku_gespeichert"));
  await expect(page.getByText(t("verfahrensdoku_vollstaendig"), { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "12. Papier vor Soll" })).toBeVisible();
  await axe(page);

  const md = await herunterladen(page, t("verfahrensdoku_markdown"));
  expect(md.name).toMatch(/^verfahrensdokumentation-\d{4}-\d{2}-\d{2}\.md$/);
  const text = md.inhalt.toString("utf8");
  expect(text.startsWith("# Verfahrensdokumentation Weber Haustechnik\n")).toBe(true);
  expect(text).toContain("vollständig");
  expect(text).toContain("Rechtsform: Einzelunternehmen");
  expect(text).toContain("## 12\\. Papier vor Soll");

  const pdf = await herunterladen(page, t("verfahrensdoku_pdf"));
  expect(pdf.name).toMatch(/^verfahrensdokumentation-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(pdf.inhalt.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  // what was saved comes back after a reload, the section included
  await page.reload();
  await expect(page.getByLabel(t("verfahrensdoku_rechtsform"), { exact: true })).toHaveValue(
    "Einzelunternehmen",
  );
  await expect(
    page.getByLabel(t("verfahrensdoku_abschnitt_titel").replace("{nummer}", "1")),
  ).toHaveValue("Papier vor Soll");
});
