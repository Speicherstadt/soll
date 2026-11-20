import { createFileRoute } from "@tanstack/solid-router";
import { m } from "../paraglide/messages.js";
import { Darstellung } from "../rahmen/darstellung.tsx";
import { Seite } from "../rahmen/seite.tsx";

const Einstellungen = () => (
  <Seite titel={m.nav_einstellungen()}>
    <section class="flex max-w-sm flex-col gap-3">
      <h2 class="font-semibold">{m.darstellung_titel()}</h2>
      <Darstellung />
    </section>
  </Seite>
);

export const Route = createFileRoute("/einstellungen")({ component: Einstellungen });
