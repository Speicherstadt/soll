import { describe, expect, it } from "vitest";
import { type Abgerechnet, leistungAus } from "./leistung.ts";

const KONTAKT = "8b0c2f4e-1d7a-4c3b-9e5f-0a1b2c3d4e5f";

const montage: Abgerechnet = {
  buchungId: "b-1",
  tag: "2026-11-20",
  minuten: 210,
  taetigkeit: "Montage",
  notiz: "Vorwand gesetzt",
  abrechenbar: true,
  centProStunde: 8_500,
  projekt: { name: "Bad Elbhof", nummer: "A-17" },
  kontaktId: KONTAKT,
  nachweisNummer: null,
};

describe("a billed booking as a Leistung for Haben (docs/api.md, POST /leistungen)", () => {
  it("names customer, working day, whole minutes, text, rate, order, source and id", () => {
    expect(leistungAus(montage)).toEqual({
      contactId: KONTAKT,
      workedOn: "2026-11-20",
      minutes: 210,
      description: "Montage: Vorwand gesetzt",
      hourlyRateCents: 8_500,
      nonBillable: false,
      project: "A-17 Bad Elbhof",
      source: "soll",
      externalId: "b-1",
    });
  });

  it("leaves the rate out when none is kept, so Haben takes the customer's", () => {
    const ohne = leistungAus({ ...montage, centProStunde: null });
    expect(ohne).not.toHaveProperty("hourlyRateCents");
    expect(ohne.nonBillable).toBe(false);
  });

  it("sends an activity the business does not bill as nonBillable, without a rate", () => {
    const fahrt = leistungAus({ ...montage, taetigkeit: "Fahrt", notiz: "", abrechenbar: false });
    expect(fahrt).toMatchObject({ description: "Fahrt", nonBillable: true });
    expect(fahrt).not.toHaveProperty("hourlyRateCents");
  });

  it("names the signed Stundennachweis in the text, and the order without a number by name", () => {
    const leistung = leistungAus({
      ...montage,
      nachweisNummer: 3,
      projekt: { name: "Bad Elbhof", nummer: "" },
    });
    expect(leistung.description).toBe("Montage: Vorwand gesetzt (Stundennachweis Nr. 3)");
    expect(leistung.project).toBe("Bad Elbhof");
  });

  it("keeps within Haben's limits: text 2,000 characters", () => {
    const lang = leistungAus({ ...montage, notiz: "x".repeat(3_000) });
    expect(lang.description).toHaveLength(2_000);
  });
});
