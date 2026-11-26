import clockify from "./clockify-api.json" with { type: "json" };
import toggl from "./toggl-api.json" with { type: "json" };

/*
 * Lina Petersen Design in Toggl Track and Clockify (BAULISTE.md S-707): the answers of their APIs as
 * their OpenAPI documents describe them, for the readers' tests and the stand-ins of the server.
 * Toggl after its API v9 document (engineering.toggl.com, `related.UserWithRelated`, `models.Client`,
 * `models.Project`, `models.Task`, `models.TimeEntry`: instants in UTC, `stop` null and a negative
 * `duration` while running); Clockify after "Clockify API v1" (docs.clockify.me, `UserDtoV1`,
 * `ClientWithCurrencyDtoV1`, `ProjectDtoImplV1`, `TaskDtoV1`, `TimeEntryWithRatesDtoV1`: `type` one
 * of REGULAR, BREAK, HOLIDAY, TIME_OFF; `timeInterval.end` null while running). The CSV files beside
 * them are the same weeks as the Detailed report exports them. Not part of the package's main entry,
 * so no app bundle carries them.
 */

export const PETERSEN = { toggl, clockify } as const;
