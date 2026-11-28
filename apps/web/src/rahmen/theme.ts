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

/** Browser theme-color for an explicit theme choice, or null when the device decides */
export const themeFarbe = (thema: Thema): string | null =>
  thema === "dunkel" ? "#09090b" : thema === "hell" ? "#ffffff" : null;

const THEME_META = 'meta[name="theme-color"][data-soll-theme-color]';

/** Sets data-theme on <html> and syncs <meta name="theme-color"> for manual overrides */
export const wendeThemaAn = (root: HTMLElement, thema: Thema): void => {
  if (thema === "system") delete root.dataset.theme;
  else root.dataset.theme = thema === "dunkel" ? "dark" : "light";
  const doc = root.ownerDocument;
  if (!doc?.head) return;
  const farbe = themeFarbe(thema);
  const vorhanden = doc.head.querySelector<HTMLMetaElement>(THEME_META);
  if (!farbe) {
    vorhanden?.remove();
    return;
  }
  const meta = vorhanden ?? doc.createElement("meta");
  meta.name = "theme-color";
  meta.dataset.sollThemeColor = "";
  meta.content = farbe;
  if (!vorhanden) doc.head.append(meta);
};
