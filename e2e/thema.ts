import type { Page } from "@playwright/test";

/**
 * Switches the colour scheme in the middle of a test and waits until the colours have arrived:
 * buttons fade their colours (`transition-colors`), and axe measuring during the fade reads the grey
 * in between as a contrast of 1.3. `getAnimations()` brings the styles up to date first, so the fades
 * the switch starts are among them; spinners and other endless animations are not transitions.
 */
export const thema = async (page: Page, farben: "light" | "dark"): Promise<void> => {
  await page.emulateMedia({ colorScheme: farben });
  await uebergaengeFertig(page);
};

/** Waits for every CSS transition running now, such as a button fading after a click */
export const uebergaengeFertig = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    const laufend = document.getAnimations().filter((a) => a instanceof CSSTransition);
    await Promise.all(laufend.map((a) => a.finished.catch(() => undefined)));
  });
