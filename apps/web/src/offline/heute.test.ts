import { describe, expect, it } from "vitest";
import type { Stempel, TagAnsicht } from "../zeiten/typen.ts";
import { mitWartenden } from "./heute.ts";

const um = (tag: string, zeit: string) => Date.parse(`${tag}T${zeit}+01:00`);

const stempel = (art: Stempel["art"], zeitpunkt: number, wartend = false): Stempel => ({
  stempelId: `${art}-${zeitpunkt}`,
  nutzerId: "tom",
  art,
  zeitpunkt,
  geraetZeitpunkt: null,
  quelle: "app",
  offline: wartend,
  nummer: null,
  korrigiert: false,
  ...(wartend ? { wartend: true as const } : {}),
});

const ansicht = (umfeld: Stempel[], tag = "2026-11-20"): TagAnsicht => ({
  nutzerId: "tom",
  name: "Tom",
  tag,
  jetzt: um("2026-11-20", "09:00"),
  sollMinuten: 480,
  stand: {} as TagAnsicht["stand"],
  stempelungen: umfeld,
  umfeld,
  aenderungen: [],
  luecken: [],
});

describe("Heute with the waiting stamps (S-305)", () => {
  it("leaves the day as the server sent it while nothing waits", () => {
    const tag = ansicht([stempel("kommen", um("2026-11-20", "07:58"))]);
    expect(mitWartenden(tag, [], um("2026-11-20", "09:00"))).toBe(tag);
  });

  it("adds a waiting stamp to the day in time order", () => {
    const kommen = stempel("kommen", um("2026-11-20", "07:58"));
    const pause = stempel("pause_beginn", um("2026-11-20", "12:00"), true);
    const neu = mitWartenden(ansicht([kommen]), [pause], um("2026-11-20", "11:59"));
    expect(neu.stempelungen).toEqual([kommen, pause]);
    expect(neu.jetzt).toBe(um("2026-11-20", "12:00"));
    expect(neu.sollMinuten).toBe(480);
  });

  it("starts the next day with a waiting Kommen after a closed day, without its target", () => {
    const gestern = [
      stempel("kommen", um("2026-11-19", "08:00")),
      stempel("gehen", um("2026-11-19", "16:00")),
    ];
    const kommen = stempel("kommen", um("2026-11-20", "07:58"), true);
    const neu = mitWartenden(ansicht(gestern, "2026-11-19"), [kommen], um("2026-11-20", "08:00"));
    expect(neu.tag).toBe("2026-11-20");
    expect(neu.stempelungen).toEqual([kommen]);
    expect(neu.sollMinuten).toBeNull();
  });
});
