import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { istTag } from "@soll/arbeitszeit";
import { bilderServerStarten } from "./server.ts";

/**
 * `bun apps/server/src/screenshots/main.ts --heute <JJJJ-MM-TT> --web <build>`: the instance for
 * the screenshots (src/screenshots/server.ts), started by `bun run screenshots`
 * (scripts/screenshots/main.ts). Prints one line `READY <json>` with the address, the clock and
 * the demo's sign-ins, then serves until it is stopped; the data directory goes with it.
 */
const { values } = parseArgs({
  options: { heute: { type: "string" }, web: { type: "string", default: "apps/web/dist" } },
});
const heute = values.heute ?? "";
if (!istTag(heute)) {
  console.error(`--heute must be a day as YYYY-MM-DD, not ${heute}`);
  process.exit(2);
}

const { stand, schliessen } = await bilderServerStarten({
  heute,
  webVerzeichnis: resolve(values.web),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    schliessen();
    process.exit(0);
  });
console.log(`READY ${JSON.stringify(stand)}`);
