import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { senden, weberMitSandra } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string) => de[key] ?? key;

/** A day some weeks ahead in Berlin, as YYYY-MM-DD */
const inTagen = (tage: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
    Date.now() + tage * 86_400_000,
  );

/** Sandra asks for leave in three weeks, in the card „Urlaub beantragen“ */
const beantragen = async (sandra: Page) => {
  await sandra.goto("/abwesenheiten");
  const karte = sandra.getByRole("region", { name: t("abw_antrag_titel") });
  await karte.getByLabel(t("abw_von"), { exact: true }).fill(inTagen(21));
  await karte.getByLabel(t("abw_bis"), { exact: true }).fill(inTagen(23));
  await karte.getByLabel(t("abw_letzter_halb")).check();
  await karte.getByRole("button", { name: t("abw_antrag_titel") }).click();
  // "Antrag gesendet: 2,5 Tage. …": the days it takes, without weekends and holidays
  await expect(sandra.getByRole("status")).toContainText(
    t("abw_antrag_gesendet_tage").split(":")[0] ?? "",
  );
  const meine = sandra.getByRole("region", { name: t("abw_meine_titel") });
  await expect(meine).toContainText(t("abw_status_beantragt"));
  return meine;
};

test("Sandra asks for leave and the owner approves it @phone", async ({ page, browser }) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  const meine = await beantragen(page);

  await jonas.goto("/abwesenheiten");
  const offen = jonas.getByRole("region", { name: t("abw_offen_titel") });
  await expect(offen).toContainText("Sandra Kühn");
  await offen.getByRole("button", { name: t("abw_freigeben") }).click();
  await expect(jonas.getByRole("status")).toHaveText(
    t("abw_freigegeben").replace("{name}", "Sandra Kühn"),
  );
  await expect(offen).toContainText(t("abw_offen_keine"));
  await expect(jonas.getByRole("region", { name: t("abw_team_titel") })).toContainText(
    `Sandra Kühn · ${t("abw_art_abwesend")}`,
  );

  await page.reload();
  await expect(meine).toContainText(t("abw_status_genehmigt"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("the owner declines a request with a reason, Sandra sees it", async ({ page, browser }) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  const meine = await beantragen(page);

  await jonas.goto("/abwesenheiten");
  const offen = jonas.getByRole("region", { name: t("abw_offen_titel") });
  await offen.getByRole("button", { name: t("abw_ablehnen") }).click();
  const dialog = jonas.getByRole("dialog", { name: t("abw_ablehnen_titel") });
  await dialog.getByRole("button", { name: t("abw_ablehnen") }).click();
  await expect(dialog.getByRole("alert")).toHaveText(t("monat_fehler_grund"));
  await dialog.getByLabel(t("korrektur_grund")).fill("zu wenig Besetzung");
  await dialog.getByRole("button", { name: t("abw_ablehnen") }).click();
  await expect(dialog).toBeHidden();
  await expect(offen).toContainText(t("abw_offen_keine"));

  await page.reload();
  await expect(meine).toContainText(t("abw_status_abgelehnt"));
  await expect(meine).toContainText("Grund: zu wenig Besetzung");
});

test("Sandra reports sick; the team sees only „abwesend“, the owner the eAU to fetch @phone", async ({
  page,
  browser,
}) => {
  const { jonas } = await weberMitSandra(page, browser, test.info());
  // the business wants the certificate from the first day (§ 5 Abs. 1 Satz 3 EntgFG)
  await senden(jonas, "PUT", "/api/v1/arbeitszeit/abwesenheiten/einstellungen", {
    bescheinigungAbTag: 1,
  });

  await page.goto("/abwesenheiten");
  const krank = page.getByRole("region", { name: t("abw_krank_titel") });
  await expect(krank).toContainText(t("abw_krank_text"));
  await krank.getByRole("button", { name: t("abw_krank_melden") }).click();
  await expect(page.getByRole("status")).toHaveText(t("abw_krank_gemeldet"));
  await expect(krank).toContainText(t("abw_frist_heute"));

  await jonas.goto("/abwesenheiten");
  const team = jonas.getByRole("region", { name: t("abw_team_titel") });
  await expect(team).toContainText(`Sandra Kühn · ${t("abw_art_abwesend")}`);
  await expect(team).not.toContainText(t("abw_art_krank"));
  await expect(jonas.getByRole("region", { name: t("abw_erinnerungen_titel") })).toContainText(
    "Sandra Kühn",
  );

  // Sandra marks the certificate as there: an eAU, no file
  await krank.getByLabel(t("abw_bescheinigung"), { exact: true }).selectOption({
    label: t("abw_bescheinigung_eau"),
  });
  await expect(krank).toContainText(t("abw_frist_liegt_vor"));
  await jonas.reload();
  await expect(jonas.getByRole("region", { name: t("abw_team_titel") })).toBeVisible();
  await expect(jonas.getByRole("region", { name: t("abw_erinnerungen_titel") })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
