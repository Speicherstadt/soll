import { habenErsatz } from "../haben-ersatz.ts";
import { json, PZ } from "./projektzeit-testhilfen.ts";
import type { Person } from "./stoppuhr-testhilfen.ts";
import { baustelle } from "./stundennachweis-testhilfen.ts";

/** Helpers for the tests of the link to Haben (S-606), against the stand-in of docs/api.md */

export const HB = `${PZ}/haben`;

/** The contacts in Weber's Haben: the customer Elbhof, a supplier and an archived customer */
export const ELBHOF = "8b0c2f4e-1d7a-4c3b-9e5f-0a1b2c3d4e5f";
export const LIEFERANT = "3c1d0e9f-2a4b-4c5d-8e6f-7a8b9c0d1e2f";
export const HAFEN = "5e2f1a0b-3c4d-4e5f-9a6b-7c8d9e0f1a2b";

export const neuesHaben = () =>
  habenErsatz({
    kontakte: [
      {
        id: ELBHOF,
        name: "Elbhof Immobilien GmbH",
        kundennummer: "K-1001",
        hourlyRateCents: 7_000,
      },
      { id: LIEFERANT, name: "Großhandel Nord", kundennummer: null, isCustomer: false },
      { id: HAFEN, name: "Hafenfest e. V.", kundennummer: "K-2001" },
    ],
  });

/** Keeps the stand-in's address and token as the business's access, failing loudly */
export const zugangSetzen = async (person: Person, haben: ReturnType<typeof neuesHaben>) => {
  const antwort = await person.anfrage(`${HB}/zugang`, {
    method: "PUT",
    body: { adresse: haben.basis, token: haben.token },
  });
  if (antwort.status !== 200) throw new Error(`zugang ${antwort.status}: ${await antwort.text()}`);
  return json(antwort);
};

/**
 * Weber's site (20.11.2026: Sandra's Montage 8:00–11:30 and Jonas's Fahrt on "Bad Elbhof") with a
 * Haben behind it; the access is kept and the customer Elbhof linked unless `verbunden` is false
 */
export const mitHaben = async (
  optionen: {
    verbunden?: boolean;
    /** wraps the stand-in's fetch, e.g. to lose an answer on its way back */
    holen?: (haben: ReturnType<typeof neuesHaben>) => typeof fetch;
  } = {},
) => {
  const haben = neuesHaben();
  const w = await baustelle({ habenFetch: optionen.holen?.(haben) ?? haben.fetch });
  if (optionen.verbunden !== false) {
    await zugangSetzen(w.weber, haben);
    const verbunden = await w.weber.anfrage(`${HB}/kontakte/${ELBHOF}`, {
      body: { kundeId: w.kunde.kundeId },
    });
    if (verbunden.status !== 200) throw new Error(`verbinden ${verbunden.status}`);
  }
  return { ...w, haben };
};

export const uebergeben = (person: Person, buchungIds: unknown[]) =>
  person.anfrage(`${HB}/uebergabe`, { body: { buchungIds } });

export const liste = async (person: Person, projektId: string) =>
  person.anfrage(
    `${HB}/buchungen?${new URLSearchParams({ projektId, von: "2026-11-01", bis: "2026-11-30" })}`,
  );
