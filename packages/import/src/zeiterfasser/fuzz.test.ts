import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_DATENSAETZE } from "../modell.ts";
import { inZeit } from "../zeit-testhilfen.ts";
import {
  CLOCKIFY_FORMAT,
  clockifyAbzugText,
  clockifyLesen,
  TOGGL_FORMAT,
  togglAbzugText,
  togglLesen,
} from "./index.ts";

/*
 * Fuzzing of Toggl Track and Clockify CSV and JSONL readers (BAULISTE.md S-707):
 * no input throws or exceeds 1 s, and every error names a line and a reason.
 */

const lesenToggl = (text: string) => togglLesen(new TextEncoder().encode(text));
const lesenClockify = (text: string) => clockifyLesen(new TextEncoder().encode(text));

const pruefen = (text: string, lesen: (t: string) => ReturnType<typeof togglLesen>) => {
  const gelesen = inZeit(() => lesen(text));
  const zeilen = text.split("\n").length;
  for (const fehler of gelesen.fehler) {
    expect(fehler.zeile).toBeGreaterThanOrEqual(1);
    expect(fehler.zeile).toBeLessThanOrEqual(Math.max(zeilen, MAX_DATENSAETZE + 2));
    expect(typeof fehler.grund).toBe("string");
  }
};

const wert = fc.oneof(fc.string(), fc.integer(), fc.double(), fc.boolean(), fc.constant(null));
const kennung = fc.oneof(fc.integer({ min: -2, max: 30 }), fc.string(), fc.constant(null));
const feld = fc.oneof(
  fc.constantFrom(
    "Lina Petersen",
    "2026-09-01",
    "01.09.2026",
    "09/01/2026",
    "09:00",
    "11:30 AM",
    "09:00 - 11:30",
    "",
  ),
  fc.string({ maxLength: 40 }),
);

describe("zeiterfasser under fuzzing", () => {
  it("never throws on arbitrary text for Toggl and Clockify", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (text) => {
        pruefen(text, lesenToggl);
        pruefen(text, lesenClockify);
      }),
      { numRuns: 200 },
    );
  });

  it("never throws on CSV lines of valid and broken fields", () => {
    const kopfToggl = "User,Client,Project,Task,Start date,Start time,End date,End time";
    const kopfMitglied = "Member,Client,Project,Task,Date,Start and stop time";
    const kopfClockify = "Project,Client,Task,User,Start Date,Start Time,End Date,End Time";
    fc.assert(
      fc.property(
        fc.constantFrom(
          [kopfToggl, lesenToggl] as const,
          [kopfMitglied, lesenToggl] as const,
          [kopfClockify, lesenClockify] as const,
        ),
        fc.array(fc.array(feld, { minLength: 1, maxLength: 10 }), { maxLength: 40 }),
        ([kopf, lesen], zeilen) => {
          const text = [kopf, ...zeilen.map((z) => z.map((f) => JSON.stringify(f)).join(","))].join(
            "\n",
          );
          pruefen(text, lesen);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("never throws on JSONL fetch lines of valid and broken records", () => {
    const satz = fc.oneof(
      fc.record({ kind: fc.constant("user"), id: kennung, fullname: wert, name: wert }),
      fc.record({ kind: fc.constant("client"), id: kennung, name: wert }),
      fc.record({
        kind: fc.constant("project"),
        id: kennung,
        client_id: kennung,
        clientId: kennung,
        name: wert,
      }),
      fc.record({
        kind: fc.constant("task"),
        id: kennung,
        project_id: kennung,
        projectId: kennung,
        name: wert,
      }),
      fc.record({
        kind: fc.constant("time_entry"),
        id: kennung,
        user_id: kennung,
        userId: kennung,
        project_id: kennung,
        projectId: kennung,
        task_id: kennung,
        taskId: kennung,
        type: fc.oneof(fc.constantFrom("REGULAR", "BREAK", "HOLIDAY", "TIME_OFF"), wert),
        start: wert,
        stop: wert,
        timeInterval: fc.oneof(fc.record({ start: wert, end: wert }), wert),
      }),
      fc.dictionary(fc.string(), wert),
    );
    const kopfToggl = JSON.stringify({ format: TOGGL_FORMAT, version: 1 });
    const kopfClockify = JSON.stringify({ format: CLOCKIFY_FORMAT, version: 1 });
    fc.assert(
      fc.property(fc.array(satz, { maxLength: 50 }), (saetze) => {
        const body = saetze.map((s) => JSON.stringify(s)).join("\n");
        pruefen(`${kopfToggl}\n${body}`, lesenToggl);
        pruefen(`${kopfClockify}\n${body}`, lesenClockify);
      }),
      { numRuns: 200 },
    );
  });

  it("never throws on abzug transformation of arbitrary records", () => {
    fc.assert(
      fc.property(fc.array(fc.anything(), { maxLength: 20 }), (liste) => {
        pruefen(
          togglAbzugText({
            von: "2026-09-01",
            bis: "2026-09-30",
            user: liste,
            client: liste,
            project: liste,
            task: liste,
            time_entry: liste,
          }),
          lesenToggl,
        );
        pruefen(
          clockifyAbzugText({
            von: "2026-09-01",
            bis: "2026-09-30",
            user: liste,
            client: liste,
            project: liste,
            task: liste,
            time_entry: liste,
          }),
          lesenClockify,
        );
      }),
      { numRuns: 150 },
    );
  });
});
