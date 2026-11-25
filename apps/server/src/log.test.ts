import { describe, expect, it } from "vitest";
import { redactUrl } from "./log.ts";

describe("redactUrl", () => {
  it("keeps a path without query as it is", () => {
    expect(redactUrl("http://x.test/api/v1/stempelungen")).toBe("/api/v1/stempelungen");
  });

  it("marks a query without logging any part of it", () => {
    expect(redactUrl("http://x.test/ics?token=abc&token=def&x=1")).toBe("/ics?…");
  });

  it("leaves an empty query out", () => {
    expect(redactUrl("/health?")).toBe("/health");
  });

  it("takes a path without host", () => {
    expect(redactUrl("/feed.ics?token=abc")).toBe("/feed.ics?…");
  });

  it("leaves out a query without key and value pair, such as a bare token", () => {
    expect(redactUrl("/feed.ics?sk-geheim-123")).toBe("/feed.ics?…");
  });

  it("leaves out a key that only shows a value once decoded", () => {
    expect(redactUrl("/feed.ics?token%3Dgeheim=1&x=2")).toBe("/feed.ics?…");
  });
});

describe("redactUrl with a secret in the path", () => {
  it("leaves out the token of a calendar feed (S-503), also with an encoded segment", () => {
    expect(redactUrl("http://x.test/api/v1/ics/soll_ics_geheim.ics")).toBe("/api/v1/ics/…");
    expect(redactUrl("/api/v1/%69cs/soll_ics_geheim.ics")).toBe("/api/v1/%69cs/…");
  });

  it("leaves out the token of an invitation link", () => {
    expect(redactUrl("/api/v1/einladung/geheim/annehmen")).toBe("/api/v1/einladung/…/annehmen");
  });
});

describe("redactUrl with a padded base64 token", () => {
  it("leaves out a bare token that ends in base64 padding", () => {
    expect(redactUrl("/feed.ics?c2stZ2VoZWltLTEyMw==")).toBe("/feed.ics?…");
    expect(redactUrl("/feed.ics?c2stZ2VoZWltLTE=")).toBe("/feed.ics?…");
  });
});
