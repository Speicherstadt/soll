import { afterEach, describe, expect, it, vi } from "vitest";
import type { GemerkterTag } from "../offline/ablage.ts";
import { type Geladen, tagHolen } from "./holen.ts";
import type { TagAnsicht } from "./typen.ts";

const tag = (jetzt: number, name = "Tom"): TagAnsicht =>
  ({ nutzerId: "tom", name, tag: "2026-11-20", jetzt }) as TagAnsicht;

const antwortet = (status: number, body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
const ohneNetz = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );

const offline = (gemerkt?: GemerkterTag) => ({
  wartende: () => [],
  merken: vi.fn(async () => {}),
  gemerkt: async () => gemerkt,
});

afterEach(() => vi.unstubAllGlobals());

describe("tagHolen", () => {
  it("keeps the day and its distance to the server's clock, and stores it on the device", async () => {
    const jetzt = Date.now() + 60_000;
    antwortet(200, tag(jetzt));
    const geraet = offline();
    const neu = await tagHolen("/api/v1/arbeitszeit/tag", geraet, undefined);
    expect(neu.ansicht?.jetzt).toBe(jetzt);
    expect(neu.abstand).toBeGreaterThan(50_000);
    expect(neu).toMatchObject({ fehler: "", ohneNetz: false });
    expect(geraet.merken).toHaveBeenCalledWith({ ansicht: tag(jetzt), abstand: neu.abstand });
  });

  it("keeps the day shown when the network is gone, without an error", async () => {
    ohneNetz();
    const vorher: Geladen = { ansicht: tag(1), abstand: 5, fehler: "", ohneNetz: false };
    expect(await tagHolen("/x", offline(), vorher)).toEqual({ ...vorher, ohneNetz: true });
  });

  it("brings back the day kept on the device when nothing is shown yet and there is no network", async () => {
    ohneNetz();
    const gemerkt = { ansicht: tag(2, "gemerkt"), abstand: 7 };
    expect(await tagHolen("/x", offline(gemerkt), undefined)).toEqual({
      ansicht: gemerkt.ansicht,
      abstand: 7,
      fehler: "",
      ohneNetz: true,
    });
  });

  it("names a refusal and keeps what was shown", async () => {
    antwortet(403, { fehler: "keine_berechtigung" });
    const vorher: Geladen = { ansicht: tag(1), abstand: 5, fehler: "", ohneNetz: false };
    expect(await tagHolen("/x", undefined, vorher)).toEqual({
      ...vorher,
      fehler: "keine_berechtigung",
    });
    expect(await tagHolen("/x", undefined, undefined)).toEqual({
      ansicht: null,
      abstand: 0,
      fehler: "keine_berechtigung",
      ohneNetz: false,
    });
  });
});
