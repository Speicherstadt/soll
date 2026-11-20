import { describe, expect, it } from "vitest";
import { testServer } from "../test-server.ts";

const json = async (antwort: Response) => (await antwort.json()) as Record<string, unknown>;

describe("an owner with a second role", () => {
  it("still invites every role", async () => {
    const server = testServer();
    const weber = await server.inhaberMitBetrieb("Weber Haustechnik", "weber");
    const organisation = await json(
      await weber.anfrage(
        `/api/auth/organization/get-full-organization?organizationId=${weber.betriebId}`,
      ),
    );
    const eigene = (organisation.members as { id: string; userId: string }[]).find(
      (m) => m.userId === weber.nutzerId,
    );
    const wechsel = await weber.anfrage("/api/auth/organization/update-member-role", {
      body: {
        memberId: eigene?.id,
        role: ["inhaber", "mitarbeiter"],
        organizationId: weber.betriebId,
      },
    });
    expect(wechsel.status).toBe(200);
    const einladung = await weber.anfrage("/api/v1/einladungen", {
      body: { rolle: "lohnbuero", name: "Steuerbüro" },
    });
    expect(einladung.status).toBe(201);
  });
});
