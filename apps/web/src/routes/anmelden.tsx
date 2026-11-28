import { Button, Input } from "@soll/ui";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler, KartenSeite } from "../rahmen/karte.tsx";
import { sitzungNeu } from "../sitzung/sitzung.ts";

/** Better Auth signs in by e-mail, or by username for people invited without one (S-106) */
const anmelden = (kennung: string, passwort: string) =>
  kennung.includes("@")
    ? api("/api/auth/sign-in/email", { body: { email: kennung, password: passwort } })
    : api("/api/auth/sign-in/username", { body: { username: kennung, password: passwort } });

const Anmelden = () => {
  const navigate = useNavigate();
  const [fehler, setFehler] = createSignal("");
  const [laeuft, setLaeuft] = createSignal(false);
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    if (laeuft()) return;
    setLaeuft(true);
    setFehler("");
    try {
      const daten = new FormData(event.currentTarget as HTMLFormElement);
      const antwort = await anmelden(
        String(daten.get("kennung")).trim(),
        String(daten.get("passwort")),
      );
      if (!antwort.ok)
        return setFehler(antwort.status === 0 ? m.fehler_netz() : m.anmelden_fehler());
      await sitzungNeu();
      // the router leads on: to the setup, or to Heute
      await navigate({ to: "/" });
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <KartenSeite titel={m.anmelden_titel()}>
      <form class="flex flex-col gap-4" onSubmit={absenden}>
        <Input
          label={m.anmelden_kennung()}
          name="kennung"
          autocomplete="username"
          spellcheck={false}
          autocapitalize="off"
          required
        />
        <Input
          label={m.passwort_label()}
          name="passwort"
          type="password"
          autocomplete="current-password"
          required
        />
        <Fehler text={fehler()} />
        <Button type="submit" size="lg" disabled={laeuft()}>
          {m.anmelden_knopf()}
        </Button>
      </form>
      <p class="text-muted-foreground">
        {m.anmelden_neu()}{" "}
        <Link to="/registrieren" class="font-medium text-foreground underline underline-offset-2">
          {m.registrieren_titel()}
        </Link>
      </p>
    </KartenSeite>
  );
};

export const Route = createFileRoute("/anmelden")({ component: Anmelden });
