import type { Tag } from "./tag.ts";

/**
 * The completed years of life on a day. The day of birth counts (§ 187 Abs. 2 Satz 2 BGB), so a year
 * is completed at the end of the day before the birthday (§ 188 Abs. 2 BGB) and the birthday is the
 * first day of the new age. Born on 29 February, a person is a year older on 1 March in a year
 * without that day (§ 188 Abs. 3 BGB): comparing month and day as text gives exactly that.
 */
export const alterAm = (geburtsdatum: Tag, tag: Tag): number => {
  const jahre = Number(tag.slice(0, 4)) - Number(geburtsdatum.slice(0, 4));
  return tag.slice(5) < geburtsdatum.slice(5) ? jahre - 1 : jahre;
};
