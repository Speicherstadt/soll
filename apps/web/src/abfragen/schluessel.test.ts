import { describe, expect, it } from "vitest";
import { alle, PFAD, ressourcen } from "./schluessel.ts";

describe("ressourcen", () => {
  it("keys a resource by its path, so a write invalidates every variant", () => {
    const monat = ressourcen.monat({ monat: "2026-10", nutzerId: "u1" });
    expect(monat.pfad).toBe("/api/v1/arbeitszeit/monat?monat=2026-10&nutzerId=u1");
    expect(monat.schluessel).toEqual([PFAD.monat, { monat: "2026-10", nutzerId: "u1" }]);
    expect(alle(PFAD.monat)).toEqual(monat.schluessel.slice(0, 1));
  });

  it("leaves a parameter not chosen out of the path and the key", () => {
    const tag = ressourcen.tag({ datum: "2026-11-20", nutzerId: undefined });
    expect(tag.pfad).toBe("/api/v1/arbeitszeit/tag?datum=2026-11-20");
    expect(tag.schluessel).toEqual([PFAD.tag, { datum: "2026-11-20" }]);
    expect(ressourcen.tag({}).pfad).toBe(PFAD.tag);
  });

  it("keys the team's absences by their span, under the path every step invalidates", () => {
    const team = ressourcen.abwesenheitenTeam({ von: "2026-11-20", bis: "2026-12-17" });
    expect(team.pfad).toBe("/api/v1/arbeitszeit/abwesenheiten/team?von=2026-11-20&bis=2026-12-17");
    expect(alle(PFAD.abwesenheitenTeam)).toEqual(team.schluessel.slice(0, 1));
    expect(ressourcen.abwesenheiten().schluessel).toEqual([PFAD.abwesenheiten]);
  });

  it("encodes values in the path", () => {
    expect(ressourcen.bedarf("a b&c").pfad).toBe("/api/v1/dienstplan/bedarf?standortId=a+b%26c");
  });
});
