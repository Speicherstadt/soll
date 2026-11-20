import { befehlAusfuehren, befehlLesen } from "./cli.ts";
import { serverStarten } from "./serve.ts";

// `soll` starts the server; `soll backup|restore|health` are the operator's commands (src/cli.ts).
// In the compiled binary as under `bun src/main.ts`, the arguments start at index 2.
const befehl = befehlLesen(process.argv.slice(2));
if (befehl.art === "server") {
  serverStarten();
} else {
  process.exit(
    await befehlAusfuehren(befehl, {
      env: process.env,
      jetzt: Date.now,
      holen: fetch,
      ausgabe: (zeile) => console.log(zeile),
      fehler: (zeile) => console.error(zeile),
    }),
  );
}
