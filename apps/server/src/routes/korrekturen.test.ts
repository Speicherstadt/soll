import { describe, expect, it, vi } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

const abschluss = vi.hoisted(() => ({ geschlossen: false }));
vi.mock("../modules/arbeitszeit/abschluss.ts", () => ({
  monatAbgeschlossen: () => abschluss.geschlossen,
}));

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;
const um = (text: string) => Date.parse(`${text}+01:00`);
const JETZT = um("2026-11-20T09:00:00");

/** Weber Haustechnik with Sandra (fitter), Anna (planner) and the payroll office */
const weber = async () => {
  abschluss.geschlossen = false;
  const server = testServer();
  server.stelleUhr(JETZT);
  const jonas = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
  const sandra = await server.eingeladen(jonas, "mitarbeiter", "sandra");
  const max = await server.eingeladen(jonas, "mitarbeiter", "max");
  const anna = await server.eingeladen(jonas, "planer", "anna");
  const lohn = await server.eingeladen(jonas, "lohnbuero", "lohnbuero");
  return { server, jonas, sandra, max, anna, lohn };
};

type Person = { anfrage: Awaited<ReturnType<typeof weber>>["sandra"]["anfrage"] };

const nachtrag = (wer: Person, body: Record<string, unknown>) =>
  wer.anfrage("/api/v1/arbeitszeit/stempelungen/nachtrag", { body });

const tagVon = async (wer: Person, datum: string, nutzerId?: string) =>
  json(
    await wer.anfrage(
      `/api/v1/arbeitszeit/tag?datum=${datum}${nutzerId ? `&nutzerId=${nutzerId}` : ""}`,
    ),
  );

describe("adding a stamp by hand (Nachtragen)", () => {
  it("needs a reason, and refuses a blank one", async () => {
    const { sandra } = await weber();
    for (const grund of [undefined, "", "   "]) {
      const antwort = await nachtrag(sandra, {
        art: "kommen",
        zeitpunkt: um("2026-11-19T07:00:00"),
        grund,
      });
      expect(antwort.status, String(grund)).toBe(400);
    }
  });

  it("refuses an instant in the future and a fraction of a millisecond", async () => {
    const { sandra } = await weber();
    const zukunft = await nachtrag(sandra, {
      art: "gehen",
      zeitpunkt: JETZT + 60_000,
      grund: "früher",
    });
    expect(zukunft.status).toBe(422);
    const bruch = await nachtrag(sandra, { art: "gehen", zeitpunkt: JETZT - 0.5, grund: "x" });
    expect(bruch.status).toBe(400);
  });

  it("lets a person add their own day, which then counts with its findings", async () => {
    const { sandra } = await weber();
    for (const [art, zeit] of [
      ["kommen", "07:00"],
      ["gehen", "14:30"],
    ] as const) {
      const antwort = await nachtrag(sandra, {
        art,
        zeitpunkt: um(`2026-11-19T${zeit}:00`),
        grund: "Handy war leer",
      });
      expect(antwort.status).toBe(201);
      expect(await json(antwort)).toMatchObject({ korrigiert: true, nutzerId: sandra.nutzerId });
    }
    const tag = await tagVon(sandra, "2026-11-19");
    expect(tag.stand).toMatchObject({ istMinuten: 450 });
    const befunde = (tag.stand as { befunde: { art: string; norm: string }[] }).befunde;
    expect(befunde.map((b) => [b.art, b.norm])).toEqual([
      ["pause_fehlt", "§ 4 Satz 1 ArbZG"],
      ["ohne_pause", "§ 4 Satz 3 ArbZG"],
    ]);
    expect(tag.aenderungen).toEqual([
      expect.objectContaining({
        aktion: "nachgetragen",
        vorher: null,
        grund: "Handy war leer",
        vonName: "sandra",
      }),
      expect.objectContaining({
        aktion: "nachgetragen",
        nachher: { art: "gehen", zeitpunkt: um("2026-11-19T14:30:00") },
      }),
    ]);
  });

  it("lets owner and planner add for another person, but no employee and not payroll", async () => {
    const { jonas, sandra, max, anna, lohn } = await weber();
    const body = {
      nutzerId: sandra.nutzerId,
      art: "kommen",
      zeitpunkt: um("2026-11-19T07:00:00"),
      grund: "Terminal aus",
    };
    expect((await nachtrag(jonas, body)).status).toBe(201);
    expect((await nachtrag(anna, body)).status).toBe(201);
    expect((await nachtrag(max, body)).status).toBe(403);
    expect((await nachtrag(lohn, body)).status).toBe(403);
  });

  it("adds nothing for external staff, who do not stamp here (docs/plan.md)", async () => {
    const { server, jonas, anna } = await weber();
    const extern = await server.eingeladen(jonas, "extern", "freelancer");
    const body = {
      nutzerId: extern.nutzerId,
      art: "kommen",
      zeitpunkt: um("2026-11-19T07:00:00"),
      grund: "Baustelle",
    };
    expect((await nachtrag(jonas, body)).status).toBe(404);
    expect((await nachtrag(anna, body)).status).toBe(404);
    expect(server.sqlite.query("SELECT art FROM stempelungen").all()).toEqual([]);
  });
});

describe("changing a stamp", () => {
  const mitTag = async () => {
    const welt = await weber();
    const kommen = await json(
      await nachtrag(welt.sandra, {
        art: "kommen",
        zeitpunkt: um("2026-11-19T07:00:00"),
        grund: "vergessen",
      }),
    );
    const gehen = await json(
      await nachtrag(welt.sandra, {
        art: "gehen",
        zeitpunkt: um("2026-11-19T15:00:00"),
        grund: "vergessen",
      }),
    );
    return { ...welt, kommen, gehen };
  };

  it("appends a new row and leaves the original as it was, both in the audit chain", async () => {
    const { server, jonas, gehen } = await mitTag();
    server.stelleUhr(JETZT + 60_000);
    const antwort = await jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${gehen.stempelId}`, {
      method: "PATCH",
      body: {
        art: "gehen",
        zeitpunkt: um("2026-11-19T13:00:00"),
        grund: "früher gegangen, Arzttermin",
      },
    });
    expect(antwort.status).toBe(201);
    const neu = await json(antwort);
    expect(neu.stempelId).not.toBe(gehen.stempelId);
    const zeilen = server.sqlite
      .query(
        "SELECT stempel_id, zeitpunkt, ersetzt, grund FROM stempelungen WHERE art = 'gehen' ORDER BY erstellt_am",
      )
      .all();
    expect(zeilen).toEqual([
      {
        stempel_id: gehen.stempelId,
        zeitpunkt: um("2026-11-19T15:00:00"),
        ersetzt: null,
        grund: "vergessen",
      },
      {
        stempel_id: neu.stempelId,
        zeitpunkt: um("2026-11-19T13:00:00"),
        ersetzt: gehen.stempelId,
        grund: "früher gegangen, Arzttermin",
      },
    ]);
    expect(kettePruefen(server.db, jonas.betriebId)).toEqual([]);
    const glieder = server.sqlite
      .query("SELECT aktion FROM audit_glieder WHERE tabelle = 'stempelungen'")
      .all();
    expect(glieder).toEqual([
      { aktion: "einfuegen" },
      { aktion: "einfuegen" },
      { aktion: "einfuegen" },
    ]);
  });

  it("shows the employee who changed what, when and why", async () => {
    const { server, jonas, sandra, gehen } = await mitTag();
    server.stelleUhr(JETZT + 60_000);
    await jonas.anfrage(`/api/v1/arbeitszeit/stempelungen/${gehen.stempelId}`, {
      method: "PATCH",
      body: { art: "gehen", zeitpunkt: um("2026-11-19T13:00:00"), grund: "Arzttermin" },
    });
    const tag = await tagVon(sandra, "2026-11-19");
    expect(tag.stempelungen).toEqual([
      expect.objectContaining({ art: "kommen", zeitpunkt: um("2026-11-19T07:00:00") }),
      expect.objectContaining({
        art: "gehen",
        zeitpunkt: um("2026-11-19T13:00:00"),
        korrigiert: true,
      }),
    ]);
    expect((tag.aenderungen as unknown[]).at(-1)).toEqual({
      stempelId: expect.any(String),
      aktion: "geaendert",
      vorher: { art: "gehen", zeitpunkt: um("2026-11-19T15:00:00") },
      nachher: { art: "gehen", zeitpunkt: um("2026-11-19T13:00:00") },
      grund: "Arzttermin",
      von: jonas.nutzerId,
      vonName: "Inhaber Weber Haustechnik",
      am: JETZT + 60_000,
    });
  });

  it("changes only the version in force: a replaced one is gone", async () => {
    const { jonas, gehen } = await mitTag();
    const body = { art: "gehen", zeitpunkt: um("2026-11-19T13:00:00"), grund: "Arzttermin" };
    const pfad = `/api/v1/arbeitszeit/stempelungen/${gehen.stempelId}`;
    expect((await jonas.anfrage(pfad, { method: "PATCH", body })).status).toBe(201);
    expect((await jonas.anfrage(pfad, { method: "PATCH", body })).status).toBe(404);
  });

  it("needs a reason, lets a person change their own, and only owner and planner another's", async () => {
    const { sandra, max, anna, lohn, kommen } = await mitTag();
    const pfad = `/api/v1/arbeitszeit/stempelungen/${kommen.stempelId}`;
    const body = { art: "kommen", zeitpunkt: um("2026-11-19T06:45:00"), grund: "früher da" };
    expect(
      (await sandra.anfrage(pfad, { method: "PATCH", body: { ...body, grund: "" } })).status,
    ).toBe(400);
    expect((await max.anfrage(pfad, { method: "PATCH", body })).status).toBe(403);
    expect((await lohn.anfrage(pfad, { method: "PATCH", body })).status).toBe(403);
    const eigen = await json(await sandra.anfrage(pfad, { method: "PATCH", body }));
    const weiter = await anna.anfrage(`/api/v1/arbeitszeit/stempelungen/${eigen.stempelId}`, {
      method: "PATCH",
      body: { ...body, zeitpunkt: um("2026-11-19T06:50:00"), grund: "laut Dienstplan" },
    });
    expect(weiter.status).toBe(201);
  });

  it("removes a stamp with a reason, appending a removal and keeping the original", async () => {
    const { server, jonas, sandra, gehen } = await mitTag();
    const pfad = `/api/v1/arbeitszeit/stempelungen/${gehen.stempelId}/entfernen`;
    expect((await jonas.anfrage(pfad, { body: {} })).status).toBe(400);
    expect((await jonas.anfrage(pfad, { body: { grund: "doppelt erfasst" } })).status).toBe(201);
    const tag = await tagVon(sandra, "2026-11-19");
    expect(tag.stempelungen).toEqual([expect.objectContaining({ art: "kommen" })]);
    expect((tag.aenderungen as unknown[]).at(-1)).toMatchObject({
      aktion: "entfernt",
      vorher: { art: "gehen", zeitpunkt: um("2026-11-19T15:00:00") },
      nachher: null,
      grund: "doppelt erfasst",
    });
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get()).toEqual({ n: 3 });
  });

  it("refuses every change in a closed month (S-306 decides; asked before each write)", async () => {
    const { server, jonas, sandra, kommen } = await mitTag();
    abschluss.geschlossen = true;
    const vorher = server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get();
    const pfad = `/api/v1/arbeitszeit/stempelungen/${kommen.stempelId}`;
    const antworten = [
      await jonas.anfrage(pfad, {
        method: "PATCH",
        body: { art: "kommen", zeitpunkt: um("2026-11-19T06:00:00"), grund: "x" },
      }),
      await jonas.anfrage(`${pfad}/entfernen`, { body: { grund: "x" } }),
      await nachtrag(sandra, { art: "gehen", zeitpunkt: um("2026-11-19T16:00:00"), grund: "x" }),
      await sandra.anfrage("/api/v1/arbeitszeit/stempelungen", { body: { art: "kommen" } }),
    ];
    for (const antwort of antworten) {
      expect(antwort.status).toBe(409);
      expect(await json(antwort)).toEqual({ fehler: "abgeschlossen" });
    }
    expect(server.sqlite.query("SELECT COUNT(*) AS n FROM stempelungen").get()).toEqual(vorher);
  });
});

describe("reading the times of a day", () => {
  it("shows a person their own times only, and others' to owner, planner and payroll", async () => {
    const { jonas, sandra, max, anna, lohn } = await weber();
    await nachtrag(sandra, {
      art: "kommen",
      zeitpunkt: um("2026-11-19T07:00:00"),
      grund: "vergessen",
    });
    const fremd = await max.anfrage(
      `/api/v1/arbeitszeit/tag?datum=2026-11-19&nutzerId=${sandra.nutzerId}`,
    );
    expect(fremd.status).toBe(403);
    for (const wer of [jonas, anna, lohn]) {
      const tag = await tagVon(wer, "2026-11-19", sandra.nutzerId);
      expect(tag.stempelungen).toHaveLength(1);
      expect(tag.name).toBe("sandra");
    }
  });

  it("lists the people who stamp for those who may see their times", async () => {
    const { jonas, max } = await weber();
    const personen = (await json(await jonas.anfrage("/api/v1/arbeitszeit/personen"))).personen;
    expect((personen as { name: string }[]).map((p) => p.name).sort()).toEqual([
      "Inhaber Weber Haustechnik",
      "anna",
      "lohnbuero",
      "max",
      "sandra",
    ]);
    expect((await max.anfrage("/api/v1/arbeitszeit/personen")).status).toBe(403);
  });

  it("refuses a day that is none", async () => {
    const { sandra } = await weber();
    expect((await sandra.anfrage("/api/v1/arbeitszeit/tag?datum=2026-02-30")).status).toBe(400);
  });
});

describe("assigning a model", () => {
  it("is for the owner, keeps the model while assigned and gives the target per weekday", async () => {
    const { jonas, sandra, anna } = await weber();
    const modell = await json(
      await jonas.anfrage("/api/v1/arbeitszeit/modelle", {
        body: {
          name: "Teilzeit",
          sollMinuten: [300, 300, 300, 300, 300, 0, 0],
          lohnArt: "stunde",
          lohnCent: 1500,
          minijob: false,
          gueltigAb: "2026-11-01",
        },
      }),
    );
    const pfad = `/api/v1/arbeitszeit/personen/${sandra.nutzerId}/modell`;
    expect(
      (await anna.anfrage(pfad, { method: "PUT", body: { modellId: modell.modellId } })).status,
    ).toBe(403);
    expect((await jonas.anfrage(pfad, { method: "PUT", body: { modellId: "keins" } })).status).toBe(
      404,
    );
    expect(
      (
        await jonas.anfrage(pfad, {
          method: "PUT",
          body: { modellId: modell.modellId, gueltigAb: "2026-11-16" },
        })
      ).status,
    ).toBe(200);
    expect((await tagVon(sandra, "2026-11-19")).sollMinuten).toBe(300);
    expect((await tagVon(sandra, "2026-11-21")).sollMinuten).toBe(0);
    expect((await tagVon(sandra, "2026-11-13")).sollMinuten).toBeNull();
    const weg = await jonas.anfrage(`/api/v1/arbeitszeit/modelle/${modell.modellId}`, {
      method: "DELETE",
    });
    expect(weg.status).toBe(409);
  });
});

describe("the history of a person who no longer stamps (review of PR #14)", () => {
  /** Sandra's day on 19.11., then her membership changes as `danach` does */
  const mitVergangenemTag = async (
    danach: (welt: Awaited<ReturnType<typeof weber>>) => Promise<void>,
  ) => {
    const welt = await weber();
    for (const [art, zeit] of [
      ["kommen", "07:00"],
      ["gehen", "15:00"],
    ] as const)
      await nachtrag(welt.sandra, {
        art,
        zeitpunkt: um(`2026-11-19T${zeit}:00`),
        grund: "vergessen",
      });
    await danach(welt);
    return welt;
  };

  const mitgliedId = async (welt: Awaited<ReturnType<typeof weber>>) => {
    const organisation = await json(
      await welt.jonas.anfrage(
        `/api/auth/organization/get-full-organization?organizationId=${welt.jonas.betriebId}`,
      ),
    );
    return (organisation.members as { id: string; userId: string }[]).find(
      (m) => m.userId === welt.sandra.nutzerId,
    )?.id;
  };

  // § 16 Abs. 2 ArbZG: the records are kept two years, whatever the person's role is now
  it("still shows the owner the days of a member who became external staff", async () => {
    const { jonas, sandra } = await mitVergangenemTag(async (welt) => {
      const wechsel = await welt.jonas.anfrage("/api/auth/organization/update-member-role", {
        body: {
          memberId: await mitgliedId(welt),
          role: "extern",
          organizationId: welt.jonas.betriebId,
        },
      });
      expect(wechsel.status).toBe(200);
    });
    const antwort = await jonas.anfrage(
      `/api/v1/arbeitszeit/tag?datum=2026-11-19&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(200);
    expect((await json(antwort)).stempelungen).toHaveLength(2);
  });

  it("still shows the owner the days of a member who has left", async () => {
    const { jonas, sandra } = await mitVergangenemTag(async (welt) => {
      const weg = await welt.jonas.anfrage("/api/auth/organization/remove-member", {
        body: { memberIdOrEmail: await mitgliedId(welt), organizationId: welt.jonas.betriebId },
      });
      expect(weg.status).toBe(200);
    });
    const antwort = await jonas.anfrage(
      `/api/v1/arbeitszeit/tag?datum=2026-11-19&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(200);
    expect((await json(antwort)).stempelungen).toHaveLength(2);
  });

  it("shows another business nothing of a person who never stamped there", async () => {
    const { server, sandra } = await mitVergangenemTag(async () => {});
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const antwort = await mia.anfrage(
      `/api/v1/arbeitszeit/tag?datum=2026-11-19&nutzerId=${sandra.nutzerId}`,
    );
    expect(antwort.status).toBe(404);
  });
});

describe("a change to a night shift (review of PR #14)", () => {
  // CLAUDE.md: a working day is the day the shift starts; S-304: every change visible to the person
  it("shows the removal of a Gehen after midnight on the working day of the shift", async () => {
    const { jonas, sandra } = await weber();
    await nachtrag(sandra, {
      art: "kommen",
      zeitpunkt: um("2026-11-19T22:00:00"),
      grund: "vergessen",
    });
    const gehen = await json(
      await nachtrag(sandra, {
        art: "gehen",
        zeitpunkt: um("2026-11-20T02:00:00"),
        grund: "vergessen",
      }),
    );
    expect((await tagVon(sandra, "2026-11-19")).stempelungen).toHaveLength(2);
    const weg = await jonas.anfrage(
      `/api/v1/arbeitszeit/stempelungen/${gehen.stempelId}/entfernen`,
      {
        body: { grund: "doppelt erfasst" },
      },
    );
    expect(weg.status).toBe(201);
    const tag = await tagVon(sandra, "2026-11-19");
    expect(tag.aenderungen).toContainEqual(
      expect.objectContaining({
        aktion: "entfernt",
        vorher: { art: "gehen", zeitpunkt: um("2026-11-20T02:00:00") },
        grund: "doppelt erfasst",
      }),
    );
  });
});
