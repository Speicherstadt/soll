import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

const setup = () => {
  const lines: string[] = [];
  let clock = 1_000;
  const app = createApp({
    log: (line) => lines.push(line),
    now: () => (clock += 5),
    version: "1.2.3",
  });
  return { app, lines };
};

describe("GET /health", () => {
  it("answers ok with the version", async () => {
    const { app } = setup();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", version: "1.2.3" });
  });
});

describe("request log", () => {
  it("writes one line per request with method, path, status and duration", async () => {
    const { app, lines } = setup();
    await app.request("/health");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      method: "GET",
      path: "/health",
      status: 200,
      ms: 5,
    });
  });

  it("leaves out query values, the Authorization header and cookies", async () => {
    const { app, lines } = setup();
    await app.request("/health?token=geheim-123&pin=4711", {
      headers: { Authorization: "Bearer sk-geheim", Cookie: "session=geheim-cookie" },
    });
    const line = lines.join("\n");
    expect(line).not.toContain("geheim");
    expect(line).not.toContain("4711");
    expect(JSON.parse(lines[0] ?? "").path).toBe("/health?…");
  });
});
