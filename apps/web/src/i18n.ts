import { getLocale, getTextDirection } from "./paraglide/runtime.js";

/**
 * Puts the locale Paraglide chose on <html>: `lang` for screen readers and hyphenation, `dir` so the
 * layout mirrors for Arabic (DESIGN.md, "Texte").
 */
export const applyLocale = (root: HTMLElement = document.documentElement): void => {
  const locale = getLocale();
  root.lang = locale;
  root.dir = getTextDirection(locale);
};
