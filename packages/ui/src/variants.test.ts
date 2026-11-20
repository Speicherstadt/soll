import { describe, expect, it } from "vitest";
import { variants } from "./variants.ts";

const knopf = variants({
  base: "inline-flex",
  variants: { art: { primary: "bg-primary", outline: "border" }, size: { sm: "h-8", md: "h-9" } },
  defaults: { art: "primary", size: "md" },
});

describe("variants", () => {
  it("takes the defaults", () => {
    expect(knopf()).toBe("inline-flex bg-primary h-9");
  });

  it("takes the chosen variants", () => {
    expect(knopf({ art: "outline", size: "sm" })).toBe("inline-flex border h-8");
  });
});
