/** A class value as Solid's `class` attribute takes it in pieces: strings, nothing, or conditions. */
export type ClassValue = string | false | null | undefined;

/**
 * Joins class names and drops the empty ones, so a condition can be written inline:
 * `cn("px-3", active && "bg-accent")`. No merging of Tailwind conflicts: the components keep their
 * classes apart instead (DESIGN.md, as in Kennwort).
 */
export const cn = (...values: ClassValue[]): string =>
  values.filter((value): value is string => typeof value === "string" && value !== "").join(" ");
