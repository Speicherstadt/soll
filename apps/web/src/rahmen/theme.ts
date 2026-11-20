/** Light, dark or like the device; kept per browser (a convenience, not shared state) */
export const THEMEN = ["system", "hell", "dunkel"] as const;
export type Thema = (typeof THEMEN)[number];

const SCHLUESSEL = "soll-thema";

export type Ablage = Pick<Storage, "getItem" | "setItem">;

/** The stored theme, or "system" when none is stored or storage is blocked */
export const liesThema = (ablage: Ablage | undefined): Thema => {
  try {
    const wert = ablage?.getItem(SCHLUESSEL);
    return THEMEN.find((thema) => thema === wert) ?? "system";
  } catch {
    return "system";
  }
};

export const speichereThema = (ablage: Ablage | undefined, thema: Thema): void => {
  try {
    ablage?.setItem(SCHLUESSEL, thema);
  } catch {
    // private windows may refuse storage; the theme then holds until the page reloads
  }
};

/** Sets data-theme on <html>, which packages/ui/src/styles.css reads; "system" removes it */
export const wendeThemaAn = (root: HTMLElement, thema: Thema): void => {
  if (thema === "system") delete root.dataset.theme;
  else root.dataset.theme = thema === "dunkel" ? "dark" : "light";
};
