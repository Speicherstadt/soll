/** Keyboard movement in a list of items (menu, tabs, combobox), as the ARIA Authoring Practices ask */
export type Richtung = "vertikal" | "horizontal";

/**
 * The index to move to for a key, or undefined when the key does not move. Arrows wrap around; in a
 * horizontal list right and left swap in right-to-left text (Arabic), so "next" stays in reading order.
 */
export const naechsterIndex = (
  taste: string,
  index: number,
  anzahl: number,
  richtung: Richtung,
  rtl = false,
): number | undefined => {
  if (anzahl === 0) return undefined;
  const vor = richtung === "vertikal" ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
  const zurueck = richtung === "vertikal" ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
  if (taste === vor) return (index + 1 + anzahl) % anzahl;
  // with nothing marked yet (-1), back starts at the last item, not one before it
  if (taste === zurueck) return index < 0 ? anzahl - 1 : (index - 1 + anzahl) % anzahl;
  if (taste === "Home") return 0;
  if (taste === "End") return anzahl - 1;
  return undefined;
};

/** True if the element sits in right-to-left text */
export const istRtl = (element: Element): boolean => getComputedStyle(element).direction === "rtl";
