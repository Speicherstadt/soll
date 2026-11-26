import { expect, type Page, test } from "@playwright/test";
import { betriebAnlegen, senden } from "./betrieb.ts";
import { messagesOf } from "./locales.ts";

// tdd-review findings for PR #103 (feat/zeiten-redesign)

const gesternBerlin = () => {
  const jetzt = new Date();
  jetzt.setDate(jetzt.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(jetzt);
};

const berlinMs = (tag: string, hm: string) => {
  // Parse wall-clock time in Europe/Berlin using a UTC probe and its Berlin offset
  const probe = new Date(`${tag}T${hm}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(probe)
      .map((p) => [p.type, p.value]),
  );
  const berlinAsUtc = Date.parse(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`,
  );
  return probe.getTime() - (berlinAsUtc - probe.getTime());
};

const stempelNachtragen = async (
  page: Page,
  nutzerId: string,
  tag: string,
  stempel: { art: "kommen" | "gehen" | "pause_beginn" | "pause_ende"; hm: string }[],
) => {
  for (const s of stempel) {
    await senden(page, "POST", "/api/v1/arbeitszeit/stempelungen/nachtrag", {
      nutzerId,
      art: s.art,
      zeitpunkt: berlinMs(tag, s.hm),
      grund: "Review test",
    });
  }
};

const nutzerIdVon = async (page: Page) => {
  const res = await page.request.get("/api/v1/arbeitszeit/tag");
  const body = (await res.json()) as { nutzerId: string };
  return body.nutzerId;
};

test.describe("in ar (RTL)", () => {
  test.use({ locale: "ar", timezoneId: "Europe/Berlin" });
  const ar = messagesOf("ar");
  const t = (key: string) => ar[key] ?? key;

  // Finding 5: zeitstrahl.tsx positions segments with physical `left: ${links()}%`, while the
  // start/end time labels below sit in a `flex justify-between` row that flips in RTL (`dir="rtl"`).
  // In Arabic, the start time (08:00) is on the right while the first segment (08:00–12:00) is on
  // the left, inverting the timeline relative to its axis labels.
  test("TagesZeitstrahl aligns the first segment with the start-time label in RTL", async ({
    page,
  }) => {
    await betriebAnlegen(page);
    const nutzerId = await nutzerIdVon(page);
    const tag = gesternBerlin();
    await stempelNachtragen(page, nutzerId, tag, [
      { art: "kommen", hm: "08:00" },
      { art: "pause_beginn", hm: "12:00" },
      { art: "pause_ende", hm: "12:30" },
      { art: "gehen", hm: "16:30" },
    ]);

    await page.goto("/zeiten");
    const datumFeld = page.getByLabel(t("zeiten_datum"), { exact: true });
    await datumFeld.fill(tag);
    await datumFeld.dispatchEvent("change");

    const zeitstrahl = page.getByRole("region", { name: t("tag_zeitstrahl") });
    await expect(zeitstrahl).toBeVisible();
    const firstBtn = zeitstrahl.getByRole("button").first();
    const lastBtn = zeitstrahl.getByRole("button").last();
    const startLabel = zeitstrahl.getByText("08:00", { exact: true });
    const endLabel = zeitstrahl.getByText("16:30", { exact: true });

    const firstBox = await firstBtn.boundingBox();
    const lastBox = await lastBtn.boundingBox();
    const startBox = await startLabel.boundingBox();
    const endBox = await endLabel.boundingBox();
    expect(firstBox).not.toBeNull();
    expect(lastBox).not.toBeNull();
    expect(startBox).not.toBeNull();
    expect(endBox).not.toBeNull();
    if (firstBox && lastBox && startBox && endBox) {
      // In RTL, 08:00 is to the right of 16:30; the first segment must also be to the right of the last.
      expect(startBox.x).toBeGreaterThan(endBox.x);
      expect(firstBox.x).toBeGreaterThan(lastBox.x);
    }
  });
});

test.describe("timeline geometry and touch targets", () => {
  test.use({ locale: "de", timezoneId: "Europe/Berlin" });
  const de = messagesOf("de");
  const t = (key: string) => de[key] ?? key;

  // Finding 6: zeitstrahl.tsx enforces a 1.5% minimum width without clamping `left` + `width` to
  // 100%, so a short segment at the end of a long day overflows past the right edge of the track.
  test("short trailing segment stays within the timeline track bounds", async ({ page }) => {
    await betriebAnlegen(page);
    const nutzerId = await nutzerIdVon(page);
    const tag = gesternBerlin();
    await stempelNachtragen(page, nutzerId, tag, [
      { art: "kommen", hm: "08:00" },
      { art: "gehen", hm: "12:00" },
      { art: "kommen", hm: "17:59" },
      { art: "gehen", hm: "18:00" },
    ]);

    await page.goto("/zeiten");
    const datumFeld = page.getByLabel(t("zeiten_datum"), { exact: true });
    await datumFeld.fill(tag);
    await datumFeld.dispatchEvent("change");

    const zeitstrahl = page.getByRole("region", { name: t("tag_zeitstrahl") });
    await expect(zeitstrahl).toBeVisible();
    const lastBtn = zeitstrahl.getByRole("button").last();
    const track = lastBtn.locator("..");
    const trackBox = await track.boundingBox();
    const btnBox = await lastBtn.boundingBox();
    expect(trackBox).not.toBeNull();
    expect(btnBox).not.toBeNull();
    if (trackBox && btnBox) {
      expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(trackBox.x + trackBox.width + 0.5);
    }
  });

  // Finding 7: DESIGN.md ("Handy (unter md): Berührungsziele mindestens 44 px") requires >= 44px
  // touch targets on phones. Interactive timeline segment buttons in zeitstrahl.tsx are only 20px
  // tall (`h-7` track with `top-1 bottom-1`).
  test("TagesZeitstrahl segment buttons keep at least 44px touch target height @phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await betriebAnlegen(page);
    const nutzerId = await nutzerIdVon(page);
    const tag = gesternBerlin();
    await stempelNachtragen(page, nutzerId, tag, [
      { art: "kommen", hm: "08:00" },
      { art: "gehen", hm: "16:00" },
    ]);

    await page.goto("/zeiten");
    const datumFeld = page.getByLabel(t("zeiten_datum"), { exact: true });
    await datumFeld.fill(tag);
    await datumFeld.dispatchEvent("change");

    const zeitstrahl = page.getByRole("region", { name: t("tag_zeitstrahl") });
    const btn = zeitstrahl.getByRole("button").first();
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
