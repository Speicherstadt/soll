// Checked by `tsc -b`, not run: an icon button without aria-label must not compile (BAULISTE.md S-301)
import { Button } from "./button.tsx";
import { Menu } from "./menu.tsx";
import { Popover } from "./popover.tsx";

// @ts-expect-error aria-label is required for variant="icon"
export const ohneName = () => <Button variant="icon" />;

export const mitName = () => <Button variant="icon" aria-label="Menü" />;

export const popoverOhneName = () => (
  // @ts-expect-error a popover opened by an icon needs aria-label
  <Popover variant="icon" ausloeser={null}>
    x
  </Popover>
);

export const popoverMitName = () => (
  <Popover variant="icon" ausloeser={null} aria-label="Details">
    x
  </Popover>
);

// @ts-expect-error a menu opened by an icon needs aria-label
export const menuOhneName = () => <Menu variant="icon" ausloeser={null} eintraege={[]} />;

export const menuMitName = () => (
  <Menu variant="icon" ausloeser={null} aria-label="Aktionen" eintraege={[]} />
);
