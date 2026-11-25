import { describe, expect, it } from "vitest";
import {
  direktInWarteschlange,
  nachErkennenOhneAntwort,
  nachStempelnOhneAntwort,
} from "./schlange.ts";

const SUN = { sun: { e: "8A38BAD78521637B55C86468ECA62085", c: "2BE17FD093495F7D" } };
const PIN = { pin: "471100" };

describe("a SUN message without an answer (review of S-803, round 3)", () => {
  it("asks for a new tap after /erkennen went unanswered: the server may already have its counter", () => {
    expect(nachErkennenOhneAntwort(SUN, true)).toBe("nochmal");
  });

  it("says there is no network where the queue is not ready: a new tap would not help", () => {
    expect(nachErkennenOhneAntwort(SUN, false)).toBe("meldung");
  });

  it("lets a PIN, a QR code or a card with PIN wait, as it can be checked again", () => {
    expect(nachErkennenOhneAntwort(PIN, true)).toBe("warteschlange");
    expect(nachErkennenOhneAntwort({ qr: "soll-ausweis:x" }, true)).toBe("warteschlange");
    expect(nachErkennenOhneAntwort({ karte: "04A1B2C3D4E5F6", pin: "471100" }, true)).toBe(
      "warteschlange",
    );
    expect(nachErkennenOhneAntwort(PIN, false)).toBe("meldung");
    expect(nachErkennenOhneAntwort({ beleg: "x" }, true)).toBe("meldung");
  });

  it("puts a SUN message straight into the queue while the kiosk knows it has no network", () => {
    expect(direktInWarteschlange(SUN, { ohneNetz: true, bereit: true })).toBe(true);
    expect(direktInWarteschlange(SUN, { ohneNetz: false, bereit: true })).toBe(false);
    expect(direktInWarteschlange(SUN, { ohneNetz: true, bereit: false })).toBe(false);
    expect(direktInWarteschlange(PIN, { ohneNetz: true, bereit: true })).toBe(false);
  });

  it("after /stempeln went unanswered: a PIN or QR code waits, a receipt says it is unclear", () => {
    expect(nachStempelnOhneAntwort(PIN, true)).toBe("warteschlange");
    expect(nachStempelnOhneAntwort({ qr: "soll-ausweis:x" }, true)).toBe("warteschlange");
    expect(nachStempelnOhneAntwort(PIN, false)).toBe("meldung");
    // the receipt holds 20 seconds and the stamp may be on the server: the person is told
    expect(nachStempelnOhneAntwort({ beleg: "x" }, true)).toBe("unklar");
    expect(nachStempelnOhneAntwort({ beleg: "x" }, false)).toBe("unklar");
  });
});
