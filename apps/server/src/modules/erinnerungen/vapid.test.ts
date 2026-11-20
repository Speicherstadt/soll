import { describe, expect, it } from "vitest";
import { testDatenbank } from "../../db/test-db.ts";
import { kettePruefen } from "../audit/index.ts";
import { INSTANZ, vapidLaden } from "./vapid.ts";

const schluessel = new Uint8Array(32).fill(3);

describe("VAPID keys of the instance", () => {
  it("creates the pair on the first start and loads the same one on the next", () => {
    const { db, schreibDb } = testDatenbank();
    const erst = vapidLaden(db, schreibDb, schluessel, 1);
    const dann = vapidLaden(db, schreibDb, schluessel, 2);
    expect(dann).toEqual(erst);
    expect(Buffer.from(erst.oeffentlich, "base64url")).toHaveLength(65);
  });

  it("keeps the private key nowhere in the database in plain text, and in the audit chain", () => {
    const { db, schreibDb, sqlite } = testDatenbank();
    const paar = vapidLaden(db, schreibDb, schluessel, 1);
    const alles = sqlite
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .flatMap(({ name }) => sqlite.query(`SELECT * FROM "${name}"`).all())
      .map((zeile) => JSON.stringify(zeile))
      .join("\n");
    expect(alles).toContain(paar.oeffentlich);
    expect(alles).not.toContain(paar.privat);
    expect(alles).not.toContain(Buffer.from(paar.privat, "base64url").toString("base64"));
    expect(kettePruefen(db, INSTANZ)).toEqual([]);
  });

  it("refuses to start with another SOLL_SECRET_KEY instead of making a new pair", () => {
    const { db, schreibDb } = testDatenbank();
    vapidLaden(db, schreibDb, schluessel, 1);
    expect(() => vapidLaden(db, schreibDb, new Uint8Array(32).fill(4), 2)).toThrow(
      /SOLL_SECRET_KEY/,
    );
  });
});
