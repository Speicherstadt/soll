/*
 * Weber Haustechnik in Personio (CLAUDE.md, test data): the records as API v2 answers them,
 * persons after persons-service-api-v2 (developer.personio.de/openapi, mirrored in
 * github.com/Hochfrequenz/personio_client.py), periods and absence types after the v2 clients
 * PK-Consulting/n8n-nodes-personio-hr and ninjaneers-team/pysonio, with the fields Soll leaves out
 * (e-mail, gender, picture, custom attributes, comments) so a test can show they stay out.
 */

export type PersonioDaten = {
  persons: Record<string, unknown>[];
  absenceTypes: Record<string, unknown>[];
  attendancePeriods: Record<string, unknown>[];
  absencePeriods: Record<string, unknown>[];
};

const person = (id: string, vorname: string, nachname: string) => ({
  id,
  email: `${vorname.toLowerCase()}@weber-haustechnik.test`,
  created_at: "2024-01-15T08:00:00Z",
  updated_at: "2026-08-01T08:00:00Z",
  first_name: vorname,
  last_name: nachname,
  preferred_name: `${vorname} ${nachname}`,
  gender: "UNSPECIFIED",
  profile_picture: { url: `https://api.personio.de/v1/company/employees/${id}/profile-picture` },
  status: "ACTIVE",
  custom_attributes: [{ id: "dynamic_305", type: "string", value: "DE02 1203", global_id: "IBAN" }],
  employments: [{ id: `c85d978e-1104-4762-be94-00000000${id}` }],
});

export const URLAUB = "3a6f9c2e-7d41-4b8a-9e15-0c2d4f6a8b10";
export const KRANKHEIT = "7b1e5d9a-2c48-4f63-a1d7-5e9c3b2a4f20";
const AUSGLEICH = "c4d8a2f6-9b13-4e57-8d21-6f0a7c3e5b30";

/** An attendance period of September 2026; `ende` null while it is open */
const periode = (
  n: number,
  wer: string,
  typ: "WORK" | "BREAK",
  beginn: string,
  ende: string | null,
  status = "CONFIRMED",
) => ({
  id: `a1b2c3d4-0000-4000-8000-${String(n).padStart(12, "0")}`,
  person: { id: wer },
  type: typ,
  start: { date_time: `2026-09-${beginn}` },
  end: ende === null ? null : { date_time: `2026-09-${ende}` },
  attribution_date: `2026-09-${beginn.slice(0, 2)}`,
  comment: typ === "WORK" ? "Bad Elbhof, Tor 3" : null,
  project: null,
  approval: { status },
  created_at: "2026-09-01T05:00:00Z",
  updated_at: "2026-09-08T16:00:00Z",
});

/** An absence period of September 2026, the halves as Personio keeps them */
const abwesenheit = (
  n: number,
  wer: string,
  art: string,
  von: string,
  bis: string,
  haelften: [string, string] = ["FIRST_HALF", "SECOND_HALF"],
) => ({
  id: `e5f6a7b8-0000-4000-8000-${String(n).padStart(12, "0")}`,
  person: { id: wer },
  absence_type: { id: art },
  starts_from: { date_time: `2026-09-${von}`, type: haelften[0] },
  ends_at: { date_time: `2026-09-${bis}`, type: haelften[1] },
  timezone_id: "Europe/Berlin",
  comment: art === KRANKHEIT ? "Bandscheibe" : null,
  approval: { status: "APPROVED" },
  created_at: "2026-08-01T08:00:00Z",
  updated_at: "2026-08-01T08:00:00Z",
});

/**
 * Jonas (the owner), Sandra and Max. September 2026: Sandra a day with a break between two periods
 * of work and a day with a break inside one, Max a morning, an open period and a pending one;
 * Sandra's leave of a week and an afternoon, Max sick until the morning of his second day, Jonas
 * two hours of time off in lieu
 */
export const WEBER_IN_PERSONIO: PersonioDaten = {
  persons: [
    person("1001", "Jonas", "Weber"),
    person("1002", "Sandra", "Kühn"),
    person("1003", "Max", "Brandt"),
  ],
  absenceTypes: [
    { id: URLAUB, name: "Urlaub", category: "PAID_VACATION", unit: "DAY" },
    { id: KRANKHEIT, name: "Krankheit", category: "SICK_LEAVE", unit: "DAY" },
    { id: AUSGLEICH, name: "Freizeitausgleich", category: "OVERTIME", unit: "HOUR" },
  ],
  attendancePeriods: [
    periode(1, "1002", "WORK", "01T07:00:00", "01T12:00:00"),
    periode(2, "1002", "BREAK", "01T12:00:00", "01T12:30:00"),
    periode(3, "1002", "WORK", "01T12:30:00", "01T15:30:00"),
    periode(4, "1002", "WORK", "02T07:00:00", "02T15:30:00"),
    periode(5, "1002", "BREAK", "02T11:00:00", "02T11:30:00"),
    periode(6, "1003", "WORK", "03T07:00:00", "03T12:00:00"),
    periode(7, "1003", "WORK", "04T07:00:00", null),
    periode(8, "1003", "WORK", "07T07:00:00", "07T15:00:00", "PENDING"),
  ],
  absencePeriods: [
    abwesenheit(1, "1002", URLAUB, "14T00:00:00", "18T00:00:00"),
    abwesenheit(2, "1003", KRANKHEIT, "21T00:00:00", "22T00:00:00", ["FIRST_HALF", "FIRST_HALF"]),
    abwesenheit(3, "1002", URLAUB, "25T00:00:00", "25T00:00:00", ["SECOND_HALF", "SECOND_HALF"]),
    abwesenheit(4, "1001", AUSGLEICH, "10T14:00:00", "10T16:00:00"),
  ],
};
