import { Button, Input } from "@soll/ui";
import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler, KartenSeite } from "../rahmen/karte.tsx";
import { sitzungNeu } from "../sitzung/sitzung.ts";

/** An account for whoever sets up a business; Better Auth signs it in right away */
const Registrieren = () => {
  const navigate = useNavigate();
  const [fehler, setFehler] = createSignal("");
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const antwort = await api("/api/auth/sign-up/email", {
      body: {
        name: String(daten.get("name")).trim(),
        email: String(daten.get("email")).trim(),
        password: String(daten.get("passwort")),
      },
    });
    if (!antwort.ok) {
      if (antwort.status === 0) return setFehler(m.fehler_netz());
      return setFehler(
        /EXIST/i.test(antwort.fehler) ? m.registrieren_vergeben() : m.registrieren_fehler(),
      );
    }
    await sitzungNeu();
    await navigate({ to: "/einrichtung" });
  };
  return (
    <KartenSeite titel={m.registrieren_titel()}>
      <form class="flex flex-col gap-4" onSubmit={absenden}>
        <Input
          label={m.registrieren_name()}
          name="name"
          autocomplete="name"
          required
          maxlength={100}
        />
        <Input
          label={m.registrieren_email()}
          name="email"
          type="email"
          autocomplete="email"
          required
        />
        <Input
          label={m.passwort_label()}
          hinweis={m.passwort_hinweis()}
          name="passwort"
          type="password"
          autocomplete="new-password"
          required
          minlength={10}
          maxlength={128}
        />
        <Fehler text={fehler()} />
        <Button type="submit" size="lg">
          {m.registrieren_knopf()}
        </Button>
      </form>
      <p class="text-muted-foreground">
        {m.registrieren_konto()}{" "}
        <Link to="/anmelden" class="font-medium text-foreground underline underline-offset-2">
          {m.anmelden_titel()}
        </Link>
      </p>
    </KartenSeite>
  );
};

export const Route = createFileRoute("/registrieren")({ component: Registrieren });
