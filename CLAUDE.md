# Notes for Claude

Soll: self-hosted time tracking and shift planning for small businesses (2 to 50 employees), built
around the German duty to record working time (BAG, 13.09.2022, 1 ABR 22/21). Clock in and out on
the web, as a PWA and on a tablet terminal; every day is checked against the Arbeitszeitgesetz with
the paragraph in each finding; the month is closed, and each employee keeps a check value that
exposes any later change; payroll data goes
to DATEV, project time to Haben. Part of the Speicherstadt suite, but it knows no other app: every
connection goes through an open standard or a documented API (OpenID Connect, REST, ICS).

## Where to look

| What | Where |
| --- | --- |
| What to build next, acceptance criteria, how the loop works | `BAULISTE.md` |
| Why: goals, decisions, stack, law, GoBD, data model, tests | `docs/plan.md` |
| Look and behaviour of the UI | `DESIGN.md` |
| Every rule the app checks, with its norm and test cases (before anything in `packages/arbeitszeit`) | `docs/regeln.md` (written in S-103) |

The documentation is in `docs/` (<https://soll.work/>), German only. Links in the README and the docs
point to the site, not to `docs/*.md`.

## The agent loop

Work through `BAULISTE.md` as it describes: the first open item whose dependencies are done, one
item per pull request, tests first, an independent review by a separate subagent (`tdd-review`),
then **merge it yourself** (squash) once CI is green and the review has no findings left, and tick
the item in the same pull request. Never wait for a person: open questions are decided by
`docs/plan.md` ("Entscheidungen"), and a new decision is written there with its reason. An item that
fails three times goes under "Zurückgestellt" with the reason and the loop goes on with the next
independent one. Steps only a person can do (trademark, pilot, translations by native speakers,
DATEV test import at a tax office) are not on the loop's path.

## Reference implementations and sources

Base details on the sources, not on memory. Clone repositories shallowly (`git clone --depth 1`)
into the scratchpad and name the source in comments, tests and commit messages where it settles a
detail. Law over vendor documentation.

- **Law**: ArbZG, ArbSchG, MiLoG, SchwarzArbG § 2a, JArbSchG, MuSchG, TzBfG, BUrlG, EntgFG, SGB IX
  § 208, BEEG § 17, EStG § 3b, BetrVG § 87, AO § 147, EStG § 41, LStDV § 4, DSGVO, all on
  gesetze-im-internet.de; BAG 1 ABR 22/21; EuGH C-55/18 (CCOO), C-151/02 (Jaeger), C-518/15 (Matzak).
- **GoBD**: BMF-Schreiben vom 28.11.2019 (GoBD), Rz. 107 ff. (Unveränderbarkeit) and 151 ff.
  (Verfahrensdokumentation). `packages/gobd-kern` in `firsttris/haben` is a source to copy from: the
  Prüfwert (`pruefwert.ts`), the texts of the Verfahrensdokumentation (`verfahrensdoku/`) and the
  content-addressed file store (`dateispeicher.ts`). Copied code names its source; no dependency on
  it, no shared package for now.
- **Kennwort**: `Speicherstadt/kennwort` for the same stack in practice (Solid 2, Hono, Better Auth,
  Paraglide, the UI package, CI and docs).
- **Haben**: `firsttris/haben` for `docs/api.md` for `POST /api/v1/leistungen`, `docs/lohn.md` for payroll, and
  the Gesetzeswächter in `scripts/jahreswerte/`.
- **DATEV**: the published interface description for importing movement data into LODAS and Lohn und
  Gehalt (ASCII import) on developer.datev.de; if it cannot be reached, say so in the pull request
  and build against the format as documented by DATEV in other public sources, named in the code.
- **Holidays**: the holiday laws of the 16 Länder; Easter after Gauß (Lichtenberg's formula).
- **Calendar**: RFC 5545 (iCalendar). **Web NFC**: the W3C draft and Chrome's implementation notes.

## Never

- Floats for money or time: durations in whole minutes, money in cents, holidays in half days.
- Change a closed month or a link of the audit chain, write to the database past the chain, change
  an existing migration, write `drizzle/meta/` by hand.
- Round working time to the employee's disadvantage, or stamp out automatically.
- Track location continuously, take photos or fingerprints at clock-in (Art. 9 DSGVO).
- Show a per-person utilisation report unless the business switched it on (BetrVG § 87).
- Compute with the values of another year when a yearly value (minimum wage, mini-job limit) is
  missing: say "nicht hinterlegt" instead.
- Point tests at a database with real data; skip, weaken or delete a test or a gate to get green;
  report a skipped test as passed.
- Push to `main`, merge without the independent review, create or comment on issues and pull
  requests without being asked.
- Change `firsttris/haben` from this repository's loop; Haben is a source to read and copy from.
- Store a secret outside an encrypted column.
- Stop the user's processes or work around `sudo`.

## With every change

Update what the change affects, in the same pull request, and only that:

- the tests for what changed: Vitest next to the code, database tests next to the module, Playwright
  for what a user does (desktop and `@phone`, the terminal in kiosk size); a bug fix starts with a
  failing test; a rule in `packages/arbeitszeit` comes with the cases from `docs/regeln.md`;
- the docs in `docs/` that describe it (German only);
- `README.md` (German only) when a feature a user sees is added, changed or removed;
- the texts in every file under `messages/`;
- the screenshots after a change to the look: **Actions → Update screenshots → Run workflow**, then
  look at the new pictures.

## Checks

Green before every push, then check CI:

```sh
bun run typecheck && bun run lint && bun run test && bun run build
zensical build --strict    # when docs/ or mkdocs.yml changed
```

Database tests run against SQLite in a temporary file; nothing needs a running database.

## Pull requests

- One item per pull request; it carries only its own commits.
- Before every push check whether the branch's pull request is still open. If it is merged, start
  again from the current `origin/main` and open a **new** pull request.
- An independent review by a separate subagent before the merge (`tdd-review`).
- Merge method: squash.

## Working rules

- Commands as root (`sudo`, `pkexec`) are run by the user; don't work around that.
- The user's running processes are not stopped; use other ports for tests (dev: server 18200, Vite 5177;
  e2e: server 28200, Vite 5178).
- Language: code, comments and commits in English; `README.md` and the docs in German only; the app
  through Paraglide with `messages/de.json` and `messages/en.json` for every text, and for the
  screens employees use also `tr`, `pl`, `uk` and `ar` (right to left). Findings name their norm in
  German in every language.

## Code style

Technology choices follow `tech-stack.md` in firsttris/workflows and the stack of Kennwort (without
Tauri), with two deviations from `tech-stack.md`:

- **Solid 2 instead of React**, as in Kennwort: one look and one way of building across the suite,
  and a small bundle for phones and the tablet terminal.
- **No TanStack Start or SSR; a Hono server and a static SPA/PWA**, as in Kennwort: the same API
  serves the web app, the offline queue of the PWA and the terminal, the REST API and the MCP
  server, and the static build is cached whole by the service worker for clocking in offline.

Server: Bun, Hono, Drizzle on SQLite (WAL), Zod at every boundary, Better Auth (organization plugin
for several businesses in one instance, passkeys, invitation links), `bun build --compile`. Client:
Solid 2, `@tanstack/solid-router` and `solid-query` if they carry Solid 2 (else a small own router and
Solid's async), Paraglide, Tailwind 4. UI in the shadcn style without a component library: native
`<dialog>`, the Popover API, CSS anchor positioning, own `cn()` and `variants()`, `lucide-solid`,
Geist, zinc tokens.

Clean Code, written functionally: clear names, small functions that do one thing, dependencies
passed in, no duplication or dead code, comments that say why; the ideas behind SOLID and the design
patterns are welcome as functions, data and closures, but not as classes, inheritance or class
hierarchies.

Functional, not object-oriented: pure functions that take data and return data, side effects at the
edges; function components, no classes; errors as values. A file does one thing: split it
past ~400 lines, a function past ~80. A refactor changes no behaviour.

## Project specifics

- Monorepo with Bun workspaces: `packages/arbeitszeit` (rules, holidays, target and actual time,
  accounts, surcharges; pure functions, no database), `packages/import` (parsers for other tools),
  `packages/export` (DATEV, CSV, PDF), `packages/ui`, `apps/server` (Hono, Drizzle, SQLite,
  Better Auth), `apps/web` (Solid SPA/PWA, terminal view).
- Routes in `apps/server` stay thin: auth, Zod, then a call into `apps/server/src/modules/`; a module
  reaches another only through its `index.ts`.
- Every table carries `betrieb_id`; every query filters by it; a test per endpoint proves that no
  business sees another's data.
- Writes go through one function that appends to the audit chain in the same transaction (actor,
  table, row, hash of the content, hash of the previous link); there is no other way to write. A
  closed month locks its rows. The chain hashes the content's hash, not the content, so content can
  be deleted after its retention period without breaking the check.
- The protection against changes by the business itself is the Prüfwert on each employee's
  monthly time sheet, not the server: whoever runs the server can change its database, but not the
  Prüfwert an employee already holds.
- Time: instants as `timestamptz`, calendar days in `Europe/Berlin`; a working day is the day the
  shift starts. DST changes are tested, not assumed.
- Test data: "Weber Haustechnik" (SHK, Hamburg: Jonas Weber, owner; Anna, office; Sandra and Max,
  fitters; Leon, apprentice, 17) and "Café Elbblick" (Hamburg: Mia, owner; Tom, Lea and Yusuf in
  shifts; Olena and Piotr on mini-jobs). Addresses under `.test`.
- Screen sizes: desktop from `md` (768 px), phones one screen at a time with a tab bar, the
  terminal on a tablet in landscape (1280 × 800).
