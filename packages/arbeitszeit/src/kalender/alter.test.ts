import { describe, expect, it } from "vitest";
import { alterAm } from "./alter.ts";
import { wochenbeginn } from "./tag.ts";

describe("alterAm", () => {
  it("is 17 on the day before the 18th birthday and 18 on the birthday (§ 187 Abs. 2 Satz 2 BGB)", () => {
    expect(alterAm("2008-06-16", "2026-06-15")).toBe(17);
    expect(alterAm("2008-06-16", "2026-06-16")).toBe(18);
  });

  it("makes a person born on 29 February a year older on 1 March without a leap day (§ 188 Abs. 3 BGB)", () => {
    expect(alterAm("2008-02-29", "2026-02-28")).toBe(17);
    expect(alterAm("2008-02-29", "2026-03-01")).toBe(18);
    expect(alterAm("2008-02-29", "2028-02-28")).toBe(19);
    expect(alterAm("2008-02-29", "2028-02-29")).toBe(20);
  });

  it("counts across the turn of the year", () => {
    expect(alterAm("2008-12-31", "2026-12-30")).toBe(17);
    expect(alterAm("2008-12-31", "2026-12-31")).toBe(18);
    expect(alterAm("2009-01-01", "2026-12-31")).toBe(17);
  });
});

describe("wochenbeginn", () => {
  it("is the Monday of the week, Sunday being its last day", () => {
    expect(wochenbeginn("2026-11-16")).toBe("2026-11-16");
    expect(wochenbeginn("2026-11-22")).toBe("2026-11-16");
    expect(wochenbeginn("2026-11-21")).toBe("2026-11-16");
    expect(wochenbeginn("2027-01-01")).toBe("2026-12-28");
  });
});
