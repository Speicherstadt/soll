import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { PASSWORT } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// The setup for four businesses, each ending with the navigation of its modules (BAULISTE.md S-303)
test.use({ locale: "de" });
const de = messagesOf("de");
const t = (key: string, werte: Record<string, string | number> = {}) =>
  Object.entries(werte).reduce(
    (text, [k, v]) => text.replaceAll(`{${k}}`, String(v)),
    de[key] ?? key,
  );

type Fall = {
  inhaber: string;
  betrieb: string;
  land: string;
  /** Beschäftigte, then (with employees) Schichten, Kunden, Stempelort */
  antworten: boolean[];
  standorte?: { name: string; adresse: string; land?: string; region?: string }[];
  modelle?: { vorlage: string; lohn: string; erwartet: string }[];
  csv?: string;
  personen?: number;
  /** The sidebar, the tab bar and "Mehr" on a phone, by message key */
  navigation: string[];
  tabs: string[];
  mehr: string[];
  module: Record<
    "modul_arbeitszeit" | "modul_dienstplan" | "modul_projektzeit" | "modul_terminal",
    boolean
  >;
};

const axe = async (page: Page) => {
  const ergebnis = await new AxeBuilder({ page }).analyze();
  expect(ergebnis.violations).toEqual([]);
};

const registrieren = async (page: Page, name: string) => {
  await page.goto("/");
  await expect(page).toHaveURL("/anmelden");
  await page.getByRole("link", { name: t("registrieren_titel") }).click();
  await page.getByLabel(t("registrieren_name")).fill(name);
  await page.getByLabel(t("registrieren_email")).fill(`${crypto.randomUUID()}@betrieb.test`);
  await page.getByLabel(t("passwort_label")).fill(PASSWORT);
  await page.getByRole("button", { name: t("registrieren_knopf") }).click();
  await expect(page).toHaveURL("/einrichtung");
};

const FRAGEN = ["frage_beschaeftigte", "frage_schichten", "frage_kunden", "frage_stempelort"];

const betriebSchritt = async (page: Page, fall: Fall, pruefen: boolean) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("betrieb_titel"));
  await page.getByLabel(t("betrieb_name")).fill(fall.betrieb);
  await page.getByLabel(t("betrieb_land")).selectOption({ label: fall.land });
  for (const [index, antwort] of fall.antworten.entries())
    await page
      .getByRole("group", { name: t(FRAGEN[index] ?? "") })
      .getByLabel(t(antwort ? "ja" : "nein"))
      .check();
  if (fall.antworten[0] === false)
    await expect(page.getByRole("group", { name: t("frage_schichten") })).toHaveCount(0);
  if (pruefen) await axe(page);
};

const standorteSchritt = async (page: Page, fall: Fall, pruefen: boolean) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("standorte_titel"));
  // "Weiter" without a site names what is missing
  await page.getByRole("button", { name: t("einrichtung_weiter") }).click();
  await expect(page.getByRole("alert")).toHaveText(t("standort_fehlt"));
  for (const standort of fall.standorte ?? []) {
    await page.getByLabel(t("standort_name"), { exact: true }).fill(standort.name);
    await page.getByLabel(t("standort_adresse")).fill(standort.adresse);
    if (standort.land)
      await page.getByLabel(t("betrieb_land")).selectOption({ label: standort.land });
    if (standort.region) await page.getByLabel(standort.region).check();
    await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
    await expect(page.getByRole("list", { name: t("standorte_liste") })).toContainText(
      standort.name,
    );
  }
  if (pruefen) await axe(page);
};

const modelleSchritt = async (page: Page, fall: Fall, pruefen: boolean) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("modelle_titel"));
  for (const modell of fall.modelle ?? []) {
    const karte = page.getByRole("form", { name: modell.vorlage });
    await karte.getByRole("textbox").last().fill(modell.lohn);
    await karte
      .getByRole("button", { name: t("modell_uebernehmen", { name: modell.vorlage }) })
      .click();
    await expect(page.getByRole("list", { name: t("modelle_liste") })).toContainText(
      modell.erwartet,
    );
  }
  if (pruefen) await axe(page);
};

const mitarbeiterSchritt = async (page: Page, fall: Fall, pruefen: boolean) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("mitarbeiter_titel"));
  await page.getByLabel(t("csv_text")).fill(fall.csv ?? "");
  await page.getByRole("button", { name: t("csv_uebernehmen") }).click();
  await expect(
    page.getByRole("list", { name: t("mitarbeiter_liste") }).getByRole("listitem"),
  ).toHaveCount(fall.personen ?? 0);
  if (pruefen) await axe(page);
};

/** Creates the links and returns the first, to be accepted by a guest */
const einladungenSchritt = async (page: Page, fall: Fall, pruefen: boolean): Promise<string> => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("einladungen_titel"));
  await page.getByRole("button", { name: t("einladungen_erstellen") }).click();
  const links = page.getByRole("list", { name: t("einladungen_liste") }).getByRole("textbox");
  await expect(links).toHaveCount(fall.personen ?? 0);
  await expect(links.first()).toHaveValue(/\/einladung\/[\w-]{43}$/);
  if (pruefen) await axe(page);
  return links.first().inputValue();
};

const weiter = (page: Page, letzter = false) =>
  page
    .getByRole("button", { name: t(letzter ? "einrichtung_abschliessen" : "einrichtung_weiter") })
    .click();

/** Goes through every step of the setup; returns the first invitation link, if any */
const einrichten = async (page: Page, fall: Fall, pruefen = false): Promise<string | null> => {
  await registrieren(page, fall.inhaber);
  if (pruefen) await axe(page);
  await betriebSchritt(page, fall, pruefen);
  if (fall.antworten[0] === false) {
    await expect(
      page.getByRole("list", { name: t("einrichtung_schritte") }).getByRole("listitem"),
    ).toHaveCount(1);
    await weiter(page, true);
    return null;
  }
  await weiter(page);
  await standorteSchritt(page, fall, pruefen);
  await weiter(page);
  await modelleSchritt(page, fall, pruefen);
  await weiter(page);
  await mitarbeiterSchritt(page, fall, pruefen);
  await weiter(page);
  const link = await einladungenSchritt(page, fall, pruefen);
  await weiter(page, true);
  return link;
};

/** The navigation of the modules: the sidebar at the desktop, the tab bar and "Mehr" on a phone */
const navigationPruefen = async (page: Page, fall: Fall, isMobile: boolean) => {
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("nav_heute"));
  const leiste = page.getByRole("navigation", { name: t("nav_bereiche") });
  await expect(leiste.getByRole("link")).toHaveText(
    (isMobile ? fall.tabs : fall.navigation).map((k) => t(k)),
  );
  if (!isMobile) return;
  await leiste.getByRole("link", { name: t("nav_mehr") }).click();
  await expect(page.getByRole("main").getByRole("link")).toHaveText(fall.mehr.map((k) => t(k)));
};

const modulePruefen = async (page: Page, fall: Fall) => {
  await page.goto("/einstellungen");
  for (const [modul, an] of Object.entries(fall.module)) {
    const schalter = page.getByRole("checkbox", { name: new RegExp(`^${t(modul)}`) });
    await expect(schalter).toBeChecked({ checked: an });
  }
};

const FREELANCER: Fall = {
  inhaber: "Lina Petersen",
  betrieb: "Lina Petersen Design",
  land: "Schleswig-Holstein",
  antworten: [false],
  navigation: ["nav_heute", "nav_projekte", "nav_auswertungen", "nav_einstellungen"],
  tabs: ["nav_heute", "nav_projekte", "nav_mehr"],
  mehr: ["nav_auswertungen", "nav_einstellungen"],
  module: {
    modul_arbeitszeit: false,
    modul_dienstplan: false,
    modul_projektzeit: true,
    modul_terminal: false,
  },
};

const CAFE: Fall = {
  inhaber: "Mia Lorenz",
  betrieb: "Café Elbblick",
  land: "Hamburg",
  antworten: [true, true, false, false],
  standorte: [{ name: "Café", adresse: "Övelgönne 3, 22605 Hamburg" }],
  modelle: [
    { vorlage: "Vollzeit", lohn: "2.900", erwartet: "40:00 h pro Woche · 2.900,00 € im Monat" },
    { vorlage: "Minijob", lohn: "13,90", erwartet: "Stunden nach Plan · 13,90 € je Stunde" },
  ],
  csv: "Name;Rolle\nTom Berger;Mitarbeiter\nLea Hansen;Mitarbeiterin\nYusuf Yılmaz;\nOlena Koval;Mitarbeiter\nPiotr Nowak;Mitarbeiter",
  personen: 5,
  navigation: [
    "nav_heute",
    "nav_zeiten",
    "nav_abwesenheiten",
    "nav_dienstplan",
    "nav_auswertungen",
    "nav_einstellungen",
  ],
  tabs: ["nav_heute", "nav_plan", "nav_abwesenheit", "nav_mehr"],
  mehr: ["nav_zeiten", "nav_auswertungen", "nav_einstellungen"],
  module: {
    modul_arbeitszeit: true,
    modul_dienstplan: true,
    modul_projektzeit: false,
    modul_terminal: false,
  },
};

const SHK: Fall = {
  inhaber: "Jonas Weber",
  betrieb: "Weber Haustechnik",
  land: "Hamburg",
  antworten: [true, false, true, true],
  standorte: [{ name: "Werkstatt", adresse: "Hafenstraße 12, 20459 Hamburg" }],
  modelle: [
    { vorlage: "Vollzeit", lohn: "3.400,00", erwartet: "40:00 h pro Woche · 3.400,00 € im Monat" },
  ],
  csv: "Vorname,Nachname,Rolle\nAnna,Schulz,Planerin\nSandra,Kühn,Mitarbeiterin\nMax,Brandt,Mitarbeiter\nLeon,Albers,Mitarbeiter",
  personen: 4,
  navigation: [
    "nav_heute",
    "nav_zeiten",
    "nav_abwesenheiten",
    "nav_projekte",
    "nav_auswertungen",
    "nav_einstellungen",
  ],
  tabs: ["nav_heute", "nav_abwesenheit", "nav_projekte", "nav_mehr"],
  mehr: ["nav_zeiten", "nav_auswertungen", "nav_einstellungen"],
  module: {
    modul_arbeitszeit: true,
    modul_dienstplan: false,
    modul_projektzeit: true,
    modul_terminal: true,
  },
};

const ALLE: Fall = {
  inhaber: "Kerstin Hansen",
  betrieb: "Hafen Catering",
  land: "Hamburg",
  antworten: [true, true, true, true],
  standorte: [
    { name: "Küche", adresse: "Große Elbstraße 40, 22767 Hamburg" },
    {
      name: "Messe Augsburg",
      adresse: "Am Messezentrum 5, 86159 Augsburg",
      land: "Bayern",
      region: "Stadt Augsburg (Friedensfest)",
    },
  ],
  modelle: [
    { vorlage: "Teilzeit", lohn: "15,50", erwartet: "20:00 h pro Woche · 15,50 € je Stunde" },
  ],
  csv: "Name\nTom Berger\nLea Hansen",
  personen: 2,
  navigation: [
    "nav_heute",
    "nav_zeiten",
    "nav_abwesenheiten",
    "nav_dienstplan",
    "nav_projekte",
    "nav_auswertungen",
    "nav_einstellungen",
  ],
  tabs: ["nav_heute", "nav_plan", "nav_abwesenheit", "nav_mehr"],
  mehr: ["nav_zeiten", "nav_projekte", "nav_auswertungen", "nav_einstellungen"],
  module: {
    modul_arbeitszeit: true,
    modul_dienstplan: true,
    modul_projektzeit: true,
    modul_terminal: true,
  },
};

test("a freelancer sets up project time only @phone", async ({ page, isMobile }) => {
  await einrichten(page, FREELANCER);
  await navigationPruefen(page, FREELANCER, isMobile);
  await modulePruefen(page, FREELANCER);
  // an area of a switched-off module leads back to Heute
  await page.goto("/zeiten");
  await expect(page).toHaveURL("/");
});

test("a café sets up working time and the rota, and a link leads to an account @phone", async ({
  page,
  browser,
  isMobile,
}) => {
  const link = await einrichten(page, CAFE);
  await navigationPruefen(page, CAFE, isMobile);
  await modulePruefen(page, CAFE);
  const gast = await browser.newPage({ locale: "de", isMobile, viewport: page.viewportSize() });
  await gast.goto(link ?? "");
  await expect(
    gast.getByText(
      t("einladung_text", {
        name: "Tom Berger",
        betrieb: "Café Elbblick",
        rolle: t("rolle_mitarbeiter"),
      }),
    ),
  ).toBeVisible();
  // usernames hold across the instance, and every project shares the e2e server
  await gast.getByLabel(t("einladung_benutzername")).fill(`tom.${crypto.randomUUID().slice(0, 8)}`);
  await gast.getByLabel(t("passwort_label")).fill(PASSWORT);
  await gast.getByRole("button", { name: t("einladung_knopf") }).click();
  await navigationPruefen(gast, CAFE, isMobile);
  await gast.close();
});

test("an SHK business sets up working time, project time and the terminal @phone", async ({
  page,
  isMobile,
}) => {
  await einrichten(page, SHK);
  await navigationPruefen(page, SHK, isMobile);
  await modulePruefen(page, SHK);
});

for (const theme of ["light", "dark"] as const) {
  test(`a business with every module sets up, axe green at every step in ${theme} @phone`, async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await einrichten(page, ALLE, true);
    await navigationPruefen(page, ALLE, isMobile);
    await modulePruefen(page, ALLE);
  });
}

test("the modules change later under Einstellungen, and the navigation follows", async ({
  page,
}) => {
  await einrichten(page, CAFE);
  await page.goto("/einstellungen");
  await page.getByRole("checkbox", { name: new RegExp(`^${t("modul_projektzeit")}`) }).check();
  const leiste = page.getByRole("navigation", { name: t("nav_bereiche") });
  await expect(leiste.getByRole("link", { name: t("nav_projekte") })).toBeVisible();
  // working time stays on while the business has employees: Tom accepted no link yet, so none
  await page.getByRole("checkbox", { name: new RegExp(`^${t("modul_dienstplan")}`) }).uncheck();
  await expect(leiste.getByRole("link", { name: t("nav_dienstplan") })).toHaveCount(0);
});

test("a CSV line the setup cannot read is named with its line, the rest is taken", async ({
  page,
}) => {
  await registrieren(page, "Mia Lorenz");
  await betriebSchritt(page, CAFE, false);
  await weiter(page);
  await page.getByLabel(t("standort_name"), { exact: true }).fill("Café");
  await page.getByRole("button", { name: t("standort_hinzufuegen") }).click();
  await weiter(page);
  await page.getByRole("form", { name: "Vollzeit" }).getByRole("button").click();
  await weiter(page);
  await page.getByLabel(t("csv_text")).fill("Name;Rolle\nTom Berger;Chef\nLea Hansen;");
  await page.getByRole("button", { name: t("csv_uebernehmen") }).click();
  await expect(page.getByRole("alert")).toHaveText(
    t("csv_rolle_unbekannt", { zeile: 2, wert: "Chef" }),
  );
  await expect(page.getByRole("list", { name: t("mitarbeiter_liste") })).toHaveText(/Lea Hansen/);
});
