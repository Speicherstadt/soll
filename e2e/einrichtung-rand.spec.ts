import { expect, type Page, test } from "@playwright/test";
import { ALLE_MODULE, betriebAnlegen } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// Edge cases of the setup assistant's own logic (BAULISTE.md S-303): going back and forth, double
// clicks, a failing last step, and what a form shows after it was sent
test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string | number> = {}) =>
  Object.entries(werte).reduce(
    (text, [k, v]) => text.replaceAll(`{${k}}`, String(v)),
    de[key] ?? key,
  );

const weiter = (page: Page) => page.getByRole("button", { name: t("einrichtung_weiter") }).click();

/** An owner whose business is saved but not set up, on the first step of the assistant */
const amAnfang = async (page: Page, fragen = ALLE_MODULE) => {
  await betriebAnlegen(page, fragen, false);
  await page.goto("/einrichtung");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("betrieb_titel"));
};

/** From the first step to the invitations, with one site, one model and the given people */
const bisZuDenEinladungen = async (page: Page, csv: string) => {
  await amAnfang(page);
  await weiter(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText("Werkstatt");
  await weiter(page);
  await page.getByRole("form", { name: "Vollzeit" }).getByRole("button").click();
  await expect(page.getByRole("list", { name: t("modelle_liste") })).toBeVisible();
  await weiter(page);
  await page.getByLabel(t("csv_text")).fill(csv);
  await page.getByRole("button", { name: t("csv_uebernehmen") }).click();
  await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("einladungen_titel"));
};

test("the invitation links stay after going back a step and on again", async ({ page }) => {
  await bisZuDenEinladungen(page, "Name\nSandra Kühn\nMax Brandt");
  await page.getByRole("button", { name: t("einladungen_erstellen") }).click();
  const links = page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox");
  await expect(links).toHaveCount(2);
  const vorher = await links.evaluateAll((felder) =>
    felder.map((feld) => (feld as HTMLInputElement).value),
  );
  await page.getByRole("button", { name: t("einrichtung_zurueck") }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("mitarbeiter_titel"));
  await weiter(page);
  // the links are shown once only: lost here, the people could never be given theirs
  await expect(links).toHaveCount(2);
  expect(
    await links.evaluateAll((felder) => felder.map((feld) => (feld as HTMLInputElement).value)),
  ).toEqual(vorher);
});

test("a double click on creating the links invites each person once", async ({ page }) => {
  await bisZuDenEinladungen(page, "Name\nSandra Kühn\nMax Brandt");
  let anfragen = 0;
  page.on("request", (anfrage) => {
    if (anfrage.url().endsWith("/api/v1/einladungen/liste")) anfragen += 1;
  });
  await page.getByRole("button", { name: t("einladungen_erstellen") }).dblclick();
  const links = page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox");
  await expect(links).toHaveCount(2);
  await page.waitForLoadState("networkidle");
  expect(anfragen).toBe(1);
  await expect(links).toHaveCount(2);
});

test("after a site is added, the Land shown is the Land the next site gets", async ({ page }) => {
  await amAnfang(page);
  await weiter(page);
  const land = page.getByLabel(t("betrieb_land"));
  await expect(land).toHaveValue("HH");
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText("Werkstatt");
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Lager");
  const shown = await land.inputValue();
  const gesendet = page.waitForRequest(
    (anfrage) => anfrage.url().endsWith("/api/v1/standorte") && anfrage.method() === "POST",
  );
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  expect((await gesendet).postDataJSON().land).toBe(shown);
});

test("finishing the setup fails: the step says so and stays", async ({ page }) => {
  await amAnfang(page, { ...ALLE_MODULE, beschaeftigte: false });
  await page.route("**/api/v1/einrichtung/abschliessen", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"fehler":"x"}' }),
  );
  await page.getByRole("button", { name: t("einrichtung_abschliessen") }).click();
  await expect(page.getByRole("alert")).toHaveText(t("fehler_speichern"));
  await expect(page).toHaveURL("/einrichtung");
});

test("a name of only spaces joins no list, so it cannot block the invitations of the others", async ({
  page,
}) => {
  await bisZuDenEinladungen(page, "Name\nSandra Kühn");
  await page.getByRole("button", { name: t("einrichtung_zurueck") }).click();
  await page.getByLabel(t("person_name"), { exact: true }).fill("   ");
  await page.getByRole("button", { name: t("person_hinzufuegen") }).click();
  await expect(
    page.getByRole("list", { name: t("mitarbeiter_liste") }).getByRole("listitem"),
  ).toHaveCount(1);
  await weiter(page);
  await page.getByRole("button", { name: t("einladungen_erstellen") }).click();
  await expect(
    page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox"),
  ).toHaveCount(1);
});

test("a list longer than one request takes is invited whole", async ({ page }) => {
  const csv = ["Name", ...Array.from({ length: 200 }, (_, i) => `Person ${i + 1}`)].join("\n");
  await bisZuDenEinladungen(page, csv);
  await page.getByRole("button", { name: t("einrichtung_zurueck") }).click();
  await page.getByLabel(t("person_name"), { exact: true }).fill("Leon Brandt");
  await page.getByRole("button", { name: t("person_hinzufuegen") }).click();
  await weiter(page);
  await expect(page.getByText(t("einladungen_offen", { anzahl: 201 }))).toBeVisible();
  await page.getByRole("button", { name: t("einladungen_erstellen") }).click();
  await expect(
    page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox"),
  ).toHaveCount(201);
});

test("38,5 hours a week are stored as whole minutes that sum to the week", async ({ page }) => {
  await amAnfang(page);
  await weiter(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Werkstatt");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText("Werkstatt");
  await weiter(page);
  const vollzeit = page.getByRole("form", { name: "Vollzeit" });
  await vollzeit.getByLabel(t("modell_stunden")).fill("38,5");
  const gesendet = page.waitForRequest(
    (a) => a.url().endsWith("/api/v1/arbeitszeit/modelle") && a.method() === "POST",
  );
  await vollzeit.getByRole("button").click();
  expect((await gesendet).postDataJSON().sollMinuten).toEqual([462, 462, 462, 462, 462, 0, 0]);
  await expect(page.getByRole("list", { name: t("modelle_liste") })).toContainText("38:30");
});
