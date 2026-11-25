import type { KimaiDaten } from "./kimai-ersatz.ts";

/*
 * Weber Haustechnik in Kimai (CLAUDE.md, test data): the records as Kimai's collections serialise
 * them (github.com/kimai/kimai 2.73.0, tests/API/APIControllerBaseTestCase.php, UserCollection to
 * TimesheetCollection), with the fields Soll leaves out (description, rates, tags, e-mail) so a
 * test can show they stay out.
 */

const ts = (
  id: number,
  user: number,
  begin: string,
  end: string | null,
  extra: Record<string, unknown> = {},
) => ({
  id,
  begin,
  end,
  duration: null,
  description: "Rohre verlegt, Kunde zufrieden",
  rate: 240.0,
  internalRate: 180.0,
  activity: 1,
  project: 1,
  tags: ["Baustelle"],
  user,
  metaFields: [],
  exported: false,
  billable: true,
  break: 0,
  ...extra,
});

const benutzer = (id: number, username: string, alias: string | null) => ({
  id,
  username,
  alias,
  email: `${username}@weber-haustechnik.test`,
  enabled: true,
  title: null,
  timezone: "Europe/Berlin",
});

/**
 * Jonas (the token's user), Sandra and Max; Elbhof with a bath and a hidden bakery; Montage for all
 * projects and Rohinstallation for the bath; September 2026: Sandra a day with a break of 30 min
 * and a day of two timesheets that touch, Max a morning on the bakery and a timesheet still running
 */
export const WEBER_IN_KIMAI: KimaiDaten = {
  users: [
    benutzer(1, "jonas", "Jonas Weber"),
    benutzer(2, "sandra", "Sandra Kühn"),
    benutzer(3, "max", "Max Brandt"),
  ],
  customers: [
    { id: 1, name: "Elbhof Immobilien", number: "K-1001", visible: true, comment: "Tor 3" },
    { id: 2, name: "Bäckerei Hansen", number: null, visible: false, comment: null },
  ],
  projects: [
    { id: 1, customer: 1, name: "Bad Elbhof", number: "A-17", visible: true, end: null },
    {
      id: 2,
      customer: 2,
      name: "Backstube",
      number: null,
      visible: true,
      end: "2026-09-30T23:59:59+0200",
    },
  ],
  activities: [
    { id: 1, project: null, name: "Montage", number: null, visible: true },
    { id: 2, project: 1, name: "Rohinstallation", number: "R-1", visible: true },
  ],
  timesheets: [
    ts(10, 2, "2026-09-01T07:00:00+0200", "2026-09-01T15:30:00+0200", { break: 1800 }),
    ts(11, 2, "2026-09-02T07:00:00+0200", "2026-09-02T11:00:00+0200", { activity: 2 }),
    ts(12, 2, "2026-09-02T11:00:00+0200", "2026-09-02T15:00:00+0200"),
    ts(13, 3, "2026-09-03T07:00:00+0200", "2026-09-03T12:00:00+0200", { project: 2 }),
    ts(14, 3, "2026-09-04T07:00:00+0200", null, { project: 2 }),
  ],
};
