import { describe, expect, it } from "vitest";
import {
  alsStempel,
  anfrageFuer,
  type Eintrag,
  folge,
  kontoSchluessel,
  wartende,
} from "./warteschlange.ts";

const um = (zeit: string) => Date.parse(`2026-11-20T${zeit}+01:00`);
const eintrag = (nummer: number, abgelehnt: string | null = null): Eintrag => ({
  konto: "elbblick/tom",
  geraetId: "g",
  nummer,
  art: "kommen",
  geraetZeitpunkt: um("07:58") + nummer,
  signatur: "s",
  abgelehnt,
});

describe("the queue as data (S-305)", () => {
  it("names the queue of a person in a business", () => {
    expect(kontoSchluessel({ betriebId: "elbblick", nutzerId: "tom" })).toBe("elbblick/tom");
  });

  it("sends what waits in the order of the numbers, without what the server refused", () => {
    expect(wartende([eintrag(3), eintrag(1), eintrag(2, "doppelt")]).map((e) => e.nummer)).toEqual([
      1, 3,
    ]);
  });

  it("sends a live stamp without and an offline entry with the time of sending", () => {
    expect(anfrageFuer(eintrag(1), true, um("09:00"))).toEqual({
      pfad: "/api/v1/arbeitszeit/stempelungen",
      body: {
        art: "kommen",
        geraetZeitpunkt: um("07:58") + 1,
        geraet: { geraetId: "g", nummer: 1, signatur: "s" },
      },
    });
    expect(anfrageFuer(eintrag(1), false, um("09:00"))).toEqual({
      pfad: "/api/v1/arbeitszeit/stempelungen/offline",
      body: {
        art: "kommen",
        geraetZeitpunkt: um("07:58") + 1,
        gesendetAm: um("09:00"),
        geraet: { geraetId: "g", nummer: 1, signatur: "s" },
      },
    });
  });

  it("tries again later without a network or session and when the server fails, else gives up", () => {
    const nurStatus = (status: number) => folge(status);
    expect([200, 201].map(nurStatus)).toEqual(["uebertragen", "uebertragen"]);
    expect([0, 401, 403, 408, 429, 500, 503].map(nurStatus)).toEqual(Array(7).fill("spaeter"));
    expect([400, 404, 409, 422].map(nurStatus)).toEqual(Array(4).fill("abgelehnt"));
  });

  it("keeps an entry whose device the session does not know: another person or business signed in meanwhile", () => {
    expect(folge(404, "geraet_unbekannt")).toBe("spaeter");
    expect(folge(404, "unbekannt")).toBe("abgelehnt");
  });

  it("shows a waiting entry on Heute at the device's time moved to the server's clock", () => {
    const [stempel] = alsStempel([eintrag(1), eintrag(2, "doppelt")], "tom", -60_000);
    expect(alsStempel([eintrag(2, "doppelt")], "tom", 0)).toEqual([]);
    expect(stempel).toEqual({
      stempelId: "wartend-g-1",
      nutzerId: "tom",
      art: "kommen",
      zeitpunkt: um("07:58") + 1 - 60_000,
      geraetZeitpunkt: um("07:58") + 1,
      quelle: "app",
      offline: true,
      nummer: 1,
      korrigiert: false,
      wartend: true,
    });
  });
});
