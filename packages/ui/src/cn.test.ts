import { describe, expect, it } from "vitest";
import { cn } from "./cn.ts";

describe("cn", () => {
  it("joins the class names in order", () => {
    expect(cn("px-3", "py-2")).toBe("px-3 py-2");
  });

  it("drops false, null, undefined and empty strings", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("returns an empty string for no classes", () => {
    expect(cn()).toBe("");
  });
});
