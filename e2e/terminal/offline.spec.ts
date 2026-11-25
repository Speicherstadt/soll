import { expect, type Page, test } from "@playwright/test";
import { axe, koppeln, pinSetzen, pinTippen, t, tabletOeffnen, weberMitTerminal } from "./kiosk.ts";
import { karteAuflegen, karteEintragen, NTAG, nfcTabletOeffnen, SUN_URL } from "./nfc.ts";

test.use({ locale: "de" });

/**
 * Whether the tablet registered the key of its offline queue (IndexedDB "soll-kiosk", S-803); the
 * database is opened only once the kiosk made it, as opening creates an empty one
 */
const schluesselAngemeldet = (tablet: Page) =>
  tablet.evaluate(
    async () =>
      (await indexedDB.databases()).some((db) => db.name === "soll-kiosk") &&
      new Promise<boolean>((fertig) => {
        const offen = indexedDB.open("soll-kiosk");
        offen.onerror = () => fertig(false);
        offen.onsuccess = () => {
          const db = offen.result;
          if (!db.objectStoreNames.contains("geraete")) return fertig(false);
          const alle = db.transaction("geraete").objectStore("geraete").getAll();
          alle.onsuccess = () =>
            fertig((alle.result as { angemeldet: string }[]).some((g) => g.angemeldet === "ja"));
          alle.onerror = () => fertig(false);
        };
      }),
  );

const ohneNetzBereit = async (tablet: Page) => {
  await expect.poll(() => schluesselAngemeldet(tablet), { timeout: 15_000 }).toBe(true);
  await tablet.context().setOffline(true);
  await expect(tablet.getByTestId("netz")).toContainText(t("kiosk_netz_aus"));
};

/** A credential given without a network: the choice without a state, then the stamp kept */
const ohneNetzStempeln = async (tablet: Page, knopf: string, art: string, wartend: number) => {
  await expect(tablet.getByRole("heading", { name: t("kiosk_offline_titel") })).toBeVisible();
  await tablet.getByRole("button", { name: t(knopf), exact: true }).click();
  await expect(tablet.getByRole("status", { name: t("kiosk_gespeichert") })).toContainText(
    new RegExp(`^${art} um \\d\\d:\\d\\d gespeichert`),
  );
  await expect(tablet.getByTestId("wartend")).toHaveText(t("kiosk_wartend", { anzahl: wartend }));
  await expect(tablet.getByRole("region", { name: t("kiosk_pin_eingeben") })).toBeVisible({
    timeout: 10_000,
  });
};

const nutzerIdVon = (jonas: Page, name: string) =>
  jonas.evaluate(async (gesucht) => {
    const antwort = await fetch("/api/v1/terminal/personen");
    const { personen } = (await antwort.json()) as {
      personen: { nutzerId: string; name: string }[];
    };
    return personen.find((p) => p.name === gesucht)?.nutzerId ?? "";
  }, name);

const stempelVon = async (jonas: Page, name: string) => {
  const nutzerId = await nutzerIdVon(jonas, name);
  const tag = (await (
    await jonas.request.get(`/api/v1/arbeitszeit/tag?nutzerId=${nutzerId}`)
  ).json()) as { stempelungen: { art: string; quelle: string; offline: boolean }[] };
  return tag.stempelungen.map((s) => [s.art, s.quelle, s.offline]);
};

test("takes stamps by PIN, QR code and NFC card without a network and sends them when it is back @terminal", async ({
  page: jonas,
  browser,
}) => {
  // three people in turn, each kiosk view going back to the clock after 5 s by design
  test.slow();
  const { sandra } = await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const ausgestellt = jonas.waitForResponse((antwort) =>
    antwort.url().includes("/api/v1/terminal/ausweise/"),
  );
  await jonas
    .getByRole("button", { name: t("terminal_qr_ausstellen_name", { name: "Max Peters" }) })
    .click();
  const { wert } = (await (await ausgestellt).json()) as { wert: string };
  await jonas
    .getByRole("dialog")
    .getByRole("button", { name: t("terminal_schliessen") })
    .click();
  await karteEintragen(jonas, { name: "Max Peters", uid: NTAG.uid, ntag: NTAG });

  const tablet = await nfcTabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  await expect(tablet.getByTestId("netz")).toContainText(t("kiosk_netz_an"));
  await ohneNetzBereit(tablet);

  // Sandra by PIN, Max by QR code and then by his NTAG 424 DNA, all without a network
  await pinTippen(tablet, "471100");
  await ohneNetzStempeln(tablet, "stempeln_kommen", "Kommen", 1);
  await tablet.getByRole("button", { name: t("kiosk_qr_zeigen") }).click();
  await tablet.evaluate((qr) => {
    window.__qr = qr;
  }, wert);
  await ohneNetzStempeln(tablet, "stempeln_kommen", "Kommen", 2);
  await karteAuflegen(tablet, NTAG.uid, SUN_URL);
  await ohneNetzStempeln(tablet, "stempeln_pause_starten", "Pause", 3);

  // the network comes back: the queue goes out and the counter goes
  await tablet.context().setOffline(false);
  await expect(tablet.getByTestId("wartend")).toBeHidden({ timeout: 40_000 });
  await expect(tablet.getByTestId("netz")).toContainText(t("kiosk_netz_an"));
  await expect(tablet.getByTestId("netz")).toContainText(/Zuletzt übertragen um \d\d:\d\d/);

  expect(await stempelVon(jonas, "Sandra Kühn")).toEqual([["kommen", "terminal", true]]);
  expect(await stempelVon(jonas, "Max Peters")).toEqual([
    ["kommen", "terminal", true],
    ["pause_beginn", "terminal", true],
  ]);
  // Sandra sees her stamp on Heute, marked as taken without a network
  await sandra.goto("/");
  await expect(sandra.getByTestId("zustand")).toHaveText(/^Eingestempelt seit \d\d:\d\d$/);
  await expect(sandra.getByText(t("stempel_offline"), { exact: true })).toBeVisible();
});

test("shows the owner an entry refused after the network came back @terminal", async ({
  page: jonas,
  browser,
}) => {
  await weberMitTerminal(jonas, browser, test.info());
  await pinSetzen(jonas, "Sandra Kühn", "471100");
  const tablet = await tabletOeffnen(browser, test.info());
  await koppeln(jonas, tablet);
  await ohneNetzBereit(tablet);
  // nobody has this PIN; without a network the tablet cannot know
  await pinTippen(tablet, "999999");
  await ohneNetzStempeln(tablet, "stempeln_kommen", "Kommen", 1);
  await tablet.context().setOffline(false);
  await expect(tablet.getByTestId("wartend")).toBeHidden({ timeout: 40_000 });
  await jonas.reload();
  await expect(jonas.getByText(/Ohne Netz nicht angenommen: Kommen um .*, Nr\. 1/)).toContainText(
    t("terminal_grund_ausweis_unbekannt"),
  );
});

for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on the terminal without a network in ${theme} @terminal`, async ({
    page: jonas,
    browser,
  }) => {
    await weberMitTerminal(jonas, browser, test.info());
    await pinSetzen(jonas, "Sandra Kühn", "471100");
    const tablet = await tabletOeffnen(browser, test.info());
    await tablet.emulateMedia({ colorScheme: theme });
    await koppeln(jonas, tablet);
    await ohneNetzBereit(tablet);
    await axe(tablet);
    await pinTippen(tablet, "471100");
    await expect(tablet.getByRole("heading", { name: t("kiosk_offline_titel") })).toBeVisible();
    await axe(tablet);
    await tablet.getByRole("button", { name: t("stempeln_gehen"), exact: true }).click();
    await expect(tablet.getByRole("status", { name: t("kiosk_gespeichert") })).toBeVisible();
    await axe(tablet);
  });
}
