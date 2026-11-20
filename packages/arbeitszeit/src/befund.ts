import type { Tag } from "./kalender/tag.ts";

/** docs/regeln.md: a Hinweis is to be noted, a Verstoß is time the law does not allow */
export type Schwere = "hinweis" | "verstoss";

/**
 * A finding of a rule (BAULISTE.md, Phase 2): its rule, its norm in German in every language, its
 * severity and the days it concerns. Each rule names its own kinds in `art`.
 */
export type Befund<Art extends string = string> = {
  regel: string;
  norm: string;
  schwere: Schwere;
  art: Art;
  tage: Tag[];
};
