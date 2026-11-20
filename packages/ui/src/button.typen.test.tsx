// Checked by `tsc -b`, not run: an icon button without aria-label must not compile (BAULISTE.md S-301)
import { Button } from "./button.tsx";

// @ts-expect-error aria-label is required for variant="icon"
export const ohneName = () => <Button variant="icon" />;

export const mitName = () => <Button variant="icon" aria-label="Menü" />;
