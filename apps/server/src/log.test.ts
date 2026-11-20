import { describe, expect, it } from "vitest";
import { redactUrl } from "./log.ts";

describe("redactUrl", () => {
  it("keeps a path without query as it is", () => {
    expect(redactUrl("http://x.test/api/v1/stempelungen")).toBe("/api/v1/stempelungen");
  });

  it("replaces every query value and keeps each key once", () => {
    expect(redactUrl("http://x.test/ics?token=abc&token=def&x=1")).toBe("/ics?token=…&x=…");
  });

  it("takes a path without host", () => {
    expect(redactUrl("/feed.ics?token=abc")).toBe("/feed.ics?token=…");
  });

  it("leaves out a query without key and value pair, such as a bare token", () => {
    expect(redactUrl("/feed.ics?sk-geheim-123")).toBe("/feed.ics?…");
  });

  it("leaves out a key that only shows a value once decoded", () => {
    expect(redactUrl("/feed.ics?token%3Dgeheim=1&x=2")).toBe("/feed.ics?…&x=…");
  });
});
