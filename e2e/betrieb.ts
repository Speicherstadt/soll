import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";

/** The four answers of the setup (packages/arbeitszeit, module/module.ts) */
export type Fragen = {
  beschaeftigte: boolean;
  schichten: boolean;
  kunden: boolean;
  stempelort: boolean;
};

export const ALLE_MODULE: Fragen = {
  beschaeftigte: true,
  schichten: true,
  kunden: true,
  stempelort: true,
};

// The origin of the app (playwright.config.ts): Better Auth checks it on every write with a cookie
const ORIGIN = "http://localhost:5178";
export const PASSWORT = "geheim-geheim-123";

export const senden = async (page: Page, method: "POST" | "PUT", pfad: string, data: unknown) => {
  const antwort = await page.request.fetch(pfad, { method, data, headers: { origin: ORIGIN } });
  expect(antwort.ok(), `${method} ${pfad}: ${antwort.status()} ${await antwort.text()}`).toBe(true);
  return antwort.json();
};

/** A fresh account, unique per test, signed in in the page's browser context (cookies shared) */
export const kontoAnlegen = async (page: Page, name = "Jonas Weber") => {
  const email = `${crypto.randomUUID()}@betrieb.test`;
  await senden(page, "POST", "/api/auth/sign-up/email", { email, password: PASSWORT, name });
  return email;
};

/**
 * An owner signed in with a business set up through the API, as the setup leaves it: "Weber
 * Haustechnik" in Hamburg with the modules of the answers (all by default)
 */
export const betriebAnlegen = async (page: Page, fragen: Fragen = ALLE_MODULE, fertig = true) => {
  await kontoAnlegen(page);
  const slug = `weber-${crypto.randomUUID().slice(0, 8)}`;
  const { id } = await senden(page, "POST", "/api/auth/organization/create", {
    name: "Weber Haustechnik",
    slug,
  });
  await senden(page, "PUT", "/api/v1/einrichtung/betrieb", {
    name: "Weber Haustechnik",
    land: "HH",
    fragen,
  });
  if (fertig) await senden(page, "POST", "/api/v1/einrichtung/abschliessen", {});
  return { betriebId: id as string };
};

/** An invitation link of the signed-in owner's business */
export const einladungsLink = async (
  page: Page,
  name: string,
  rolle = "mitarbeiter",
): Promise<string> => {
  const { link } = await senden(page, "POST", "/api/v1/einladungen", { name, rolle });
  return new URL(link).pathname;
};

/** Signs the page's browser context out, as a guest who got a link */
export const abmelden = async (page: Page) => {
  await senden(page, "POST", "/api/auth/sign-out", {});
};

/**
 * A second person's browser with the device of the test's project (desktop or phone), for two
 * people at once: the owner here, the employee there
 */
export const zweiterBrowser = async (browser: Browser, info: TestInfo): Promise<Page> => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, baseURL } =
    info.project.use;
  const context = await browser.newContext({
    ...(viewport ? { viewport } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile ? { isMobile } : {}),
    ...(hasTouch ? { hasTouch } : {}),
    locale: locale ?? "de",
    baseURL: baseURL ?? ORIGIN,
  });
  return context.newPage();
};

/**
 * Lets a person accept an invitation of the owner's business in their own browser and signs them in
 * with a username, as on their phone; returns their account id
 */
export const einladungAnnehmen = async (
  owner: Page,
  person: Page,
  name: string,
  rolle = "mitarbeiter",
): Promise<string> => {
  const token = (await einladungsLink(owner, name, rolle)).split("/").pop() ?? "";
  const benutzername = `${name.toLowerCase().replace(/[^a-z]/g, "")}${crypto.randomUUID().slice(0, 6)}`;
  const passwort = "lange-genug-123";
  const { nutzerId } = await senden(person, "POST", `/api/v1/einladung/${token}/annehmen`, {
    benutzername,
    passwort,
  });
  await senden(person, "POST", "/api/auth/sign-in/username", {
    username: benutzername,
    password: passwort,
  });
  const { betriebId } = (await (await owner.request.get("/api/v1/betrieb")).json()) as {
    betriebId: string;
  };
  await senden(person, "POST", "/api/auth/organization/set-active", { organizationId: betriebId });
  return nutzerId as string;
};
