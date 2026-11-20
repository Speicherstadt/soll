import { Button } from "@soll/ui";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { api } from "../api.ts";
import { ModuleSchalter } from "../einstellungen/moduleSchalter.tsx";
import { m } from "../paraglide/messages.js";
import { Darstellung } from "../rahmen/darstellung.tsx";
import { Seite } from "../rahmen/seite.tsx";
import { sitzungNeu } from "../sitzung/sitzung.ts";

const Einstellungen = () => {
  const navigate = useNavigate();
  const abmelden = async () => {
    await api("/api/auth/sign-out", { body: {} });
    await sitzungNeu();
    await navigate({ to: "/anmelden" });
  };
  return (
    <Seite titel={m.nav_einstellungen()}>
      <ModuleSchalter />
      <section class="flex max-w-sm flex-col gap-3">
        <h2 class="font-semibold">{m.darstellung_titel()}</h2>
        <Darstellung />
      </section>
      <section class="flex max-w-sm flex-col items-start gap-3">
        <h2 class="font-semibold">{m.konto_titel()}</h2>
        <Button variant="outline" onClick={abmelden}>
          {m.abmelden()}
        </Button>
      </section>
    </Seite>
  );
};

export const Route = createFileRoute("/einstellungen")({ component: Einstellungen });
