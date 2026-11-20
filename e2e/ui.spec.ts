import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// The pattern page of packages/ui (apps/web/muster.html), in both themes (BAULISTE.md S-301)
for (const theme of ["light", "dark"] as const) {
  test(`axe finds nothing on the components in ${theme} @phone`, async ({ page }) => {
    await page.goto(`/muster.html?theme=${theme}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

const oeffnen = async (page: Page, query = "") => {
  await page.goto(`/muster.html${query}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

test("Button: reachable with Tab, an icon button has its name", async ({ page }) => {
  await oeffnen(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Kommen" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Einstellungen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gesperrt" })).toBeDisabled();
});

test("Input: label, hint and error are linked", async ({ page }) => {
  await oeffnen(page);
  await expect(page.getByLabel("Beginn")).toHaveAccessibleDescription("Etwa 7:30");
  const pause = page.getByLabel("Pause");
  await expect(pause).toHaveAttribute("aria-invalid", "true");
  await expect(pause).toHaveAccessibleDescription(/§ 4 ArbZG/);
});

test("Dialog: opens with the keyboard, moves focus inside, closes with Esc", async ({ page }) => {
  await oeffnen(page);
  const knopf = page.getByRole("button", { name: "Dialog öffnen" });
  await knopf.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Monat bestätigen" });
  await expect(dialog).toBeVisible();
  // showModal() puts focus on the first control inside; the browser keeps it in the modal
  await expect(dialog.getByRole("button", { name: "Bestätigen" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Dialog öffnen" })).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(knopf).toBeFocused();
});

test("Dialog: a selection dragged out onto the backdrop does not close it", async ({ page }) => {
  await oeffnen(page);
  await page.getByRole("button", { name: "Dialog öffnen" }).click();
  const dialog = page.getByRole("dialog", { name: "Monat bestätigen" });
  const text = await dialog.getByText("Der Monat wird danach gesperrt.").boundingBox();
  if (!text) throw new Error("dialog text not laid out");
  // press inside, release on the backdrop: the click lands on the dialog, but it began inside
  await page.mouse.move(text.x + 5, text.y + text.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  // a click that begins and ends on the backdrop still closes it
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
});

test("Popover: Enter opens, Esc closes", async ({ page }) => {
  await oeffnen(page);
  await page.getByRole("button", { name: "Details" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Soll 8:00, Ist 7:45")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Soll 8:00, Ist 7:45")).toBeHidden();
});

test("Menu: arrows move, Enter chooses, Esc returns focus @phone", async ({ page }) => {
  await oeffnen(page);
  const knopf = page.getByRole("button", { name: "Aktionen" });
  await knopf.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Bearbeiten" })).toBeFocused();
  await expect(knopf).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Kopieren" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Löschen" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Bearbeiten" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(knopf).toBeFocused();
  await page.keyboard.press("Enter");
  // the toggle event that moves focus into the menu comes after the key press
  await expect(page.getByRole("menuitem", { name: "Bearbeiten" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("menu-wahl")).toHaveText("Kopieren");
});

test("Tooltip: shows on focus, Esc hides it", async ({ page }) => {
  await oeffnen(page);
  const uhr = page.getByRole("button", { name: "Uhr" });
  await uhr.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(uhr).toHaveAccessibleDescription("Laufende Zeit");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();
});

test("Toast: announced in a polite live region", async ({ page }) => {
  await oeffnen(page);
  await page.getByRole("button", { name: "Toast zeigen" }).click();
  const bereich = page.getByRole("region", { name: "Meldungen" });
  await expect(bereich).toHaveAttribute("aria-live", "polite");
  await expect(bereich.getByRole("status")).toHaveText("Gespeichert");
});

test("Combobox: typing filters, arrows mark, Enter chooses, Esc closes", async ({ page }) => {
  await oeffnen(page);
  const feld = page.getByRole("combobox", { name: "Person" });
  await feld.fill("a");
  await expect(page.getByRole("option")).toHaveCount(3);
  await feld.fill("an");
  await expect(page.getByRole("option")).toHaveText(["Anna", "Sandra"]);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Sandra" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(feld).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("combobox-wahl")).toHaveText("sandra");
  await expect(feld).toHaveValue("Sandra");
  await feld.fill("xyz");
  await expect(page.getByText("Niemand gefunden")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(feld).toHaveAttribute("aria-expanded", "false");
});

test("Combobox: Up Arrow with nothing marked marks the last option", async ({ page }) => {
  await oeffnen(page);
  await page.getByRole("combobox", { name: "Person" }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("option", { name: "Sandra" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("Combobox: axe finds nothing while the list shows no match", async ({ page }) => {
  await oeffnen(page);
  await page.getByRole("combobox", { name: "Person" }).fill("xyz");
  await expect(page.getByText("Niemand gefunden")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("Tabs: one tab stop, arrows choose, the panel follows", async ({ page }) => {
  await oeffnen(page);
  const tag = page.getByRole("tab", { name: "Tag" });
  await tag.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Woche" })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveText("Diese Woche");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Monat" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Tag" })).toHaveAttribute("tabindex", "-1");
});

test("Tabs: arrows are mirrored in right-to-left text", async ({ page }) => {
  await oeffnen(page, "?dir=rtl");
  await page.getByRole("tab", { name: "Tag" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Woche" })).toBeFocused();
});

test("Table: a named table with column headers", async ({ page }) => {
  await oeffnen(page);
  const tabelle = page.getByRole("table", { name: "Zeiten" });
  await expect(tabelle.getByRole("columnheader")).toHaveText(["Tag", "Dauer"]);
  // the attributes a part accepts reach the element, e.g. the sort order of a column
  await expect(tabelle.getByRole("columnheader", { name: "Tag" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("fields and tabs reached by keyboard show their focus", async ({ page }) => {
  await oeffnen(page);
  const ziele = [
    page.getByLabel("Beginn"),
    page.getByRole("combobox", { name: "Person" }),
    page.getByRole("tab", { name: "Tag" }),
  ];
  for (const ziel of ziele) {
    await ziel.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(ziel).toBeFocused();
    const stil = await ziel.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(stil).not.toBe("none");
  }
});
