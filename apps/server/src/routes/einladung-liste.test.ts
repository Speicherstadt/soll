import { describe, expect, it } from "vitest";
import { kettePruefen } from "../modules/audit/index.ts";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

const PERSONEN = [
  { name: "Tom Berger", rolle: "mitarbeiter" },
  { name: "Lea Hansen", rolle: "mitarbeiter" },
  { name: "Olena Koval", rolle: "mitarbeiter" },
];

describe("POST /api/v1/einladungen/liste", () => {
  it("makes one link per person in one go, each working once", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const antwort = await mia.anfrage("/api/v1/einladungen/liste", {
      body: { personen: PERSONEN },
    });
    expect(antwort.status).toBe(201);
    const { einladungen } = (await antwort.json()) as {
      einladungen: { name: string; rolle: string; link: string; gueltigBis: number }[];
    };
    expect(einladungen.map(({ name, rolle }) => ({ name, rolle }))).toEqual(PERSONEN);
    expect(new Set(einladungen.map((e) => e.link)).size).toBe(3);
    for (const einladung of einladungen) {
      const token = einladung.link.split("/einladung/")[1];
      expect(await json(await server.browser().anfrage(`/api/v1/einladung/${token}`))).toEqual({
        betrieb: "Café Elbblick",
        name: einladung.name,
        rolle: "mitarbeiter",
      });
    }
    expect(kettePruefen(server.db, mia.betriebId)).toEqual([]);
  });

  it("refuses an empty list, more than 200 people and an unknown role", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const viele = Array.from({ length: 201 }, (_, i) => ({
      name: `Person ${i}`,
      rolle: "mitarbeiter",
    }));
    for (const personen of [[], viele, [{ name: "Tom", rolle: "chef" }]])
      expect((await mia.anfrage("/api/v1/einladungen/liste", { body: { personen } })).status).toBe(
        400,
      );
  });

  it("lets a planner invite employees but no planner, and then invites no one", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const tom = await server.eingeladen(mia, "planer", "tom");
    const vorher = server.sqlite.query("SELECT count(*) AS n FROM einladungen").get();
    const antwort = await tom.anfrage("/api/v1/einladungen/liste", {
      body: { personen: [...PERSONEN, { name: "Yusuf", rolle: "planer" }] },
    });
    expect(antwort.status).toBe(403);
    expect(server.sqlite.query("SELECT count(*) AS n FROM einladungen").get()).toEqual(vorher);
    expect(
      (await tom.anfrage("/api/v1/einladungen/liste", { body: { personen: PERSONEN } })).status,
    ).toBe(201);
  });

  it("is refused to employees", async () => {
    const server = testServer();
    const mia = await server.inhaberMitBetrieb("Café Elbblick", "elbblick");
    const lea = await server.eingeladen(mia, "mitarbeiter", "lea");
    expect(
      (await lea.anfrage("/api/v1/einladungen/liste", { body: { personen: PERSONEN } })).status,
    ).toBe(403);
  });
});
