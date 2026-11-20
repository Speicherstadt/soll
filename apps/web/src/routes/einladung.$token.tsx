import { Button, Input } from "@soll/ui";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { api } from "../api.ts";
import { ROLLEN_NAMEN } from "../einrichtung/namen.ts";
import { m } from "../paraglide/messages.js";
import { Fehler, KartenSeite } from "../rahmen/karte.tsx";
import { sitzungNeu } from "../sitzung/sitzung.ts";

type Einladung = { betrieb: string; name: string; rolle: string };

const rollenName = (rolle: string) => ROLLEN_NAMEN[rolle as keyof typeof ROLLEN_NAMEN]?.() ?? rolle;

/** Accepting an invitation by link: a username and a password, no e-mail address (S-106) */
const Annehmen = (props: { token: string; einladung: Einladung }) => {
  const navigate = useNavigate();
  const [fehler, setFehler] = createSignal("");
  const absenden = async (event: SubmitEvent) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget as HTMLFormElement);
    const benutzername = String(daten.get("benutzername")).trim();
    const passwort = String(daten.get("passwort"));
    const angenommen = await api(`/api/v1/einladung/${props.token}/annehmen`, {
      body: { benutzername, passwort },
    });
    if (!angenommen.ok)
      return setFehler(
        angenommen.fehler === "benutzername_vergeben"
          ? m.einladung_vergeben()
          : m.einladung_fehler(),
      );
    await api("/api/auth/sign-in/username", {
      body: { username: benutzername, password: passwort },
    });
    await sitzungNeu();
    await navigate({ to: "/" });
  };
  return (
    <>
      <p>
        {m.einladung_text({
          name: props.einladung.name,
          betrieb: props.einladung.betrieb,
          rolle: rollenName(props.einladung.rolle),
        })}
      </p>
      <form class="flex flex-col gap-4" onSubmit={absenden}>
        <Input
          label={m.einladung_benutzername()}
          hinweis={m.einladung_benutzername_hinweis()}
          name="benutzername"
          autocomplete="username"
          required
          pattern="[a-zA-Z0-9_.]{3,30}"
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
          {m.einladung_knopf()}
        </Button>
      </form>
    </>
  );
};

const EinladungSeite = () => {
  const daten = Route.useLoaderData();
  const params = Route.useParams();
  return (
    <KartenSeite titel={m.einladung_titel()}>
      <Show when={daten().ok && daten()} fallback={<p role="alert">{m.einladung_ungueltig()}</p>}>
        {(gefunden) => (
          <Annehmen token={params().token} einladung={(gefunden() as { daten: Einladung }).daten} />
        )}
      </Show>
    </KartenSeite>
  );
};

export const Route = createFileRoute("/einladung/$token")({
  component: EinladungSeite,
  loader: ({ params }) => api<Einladung>(`/api/v1/einladung/${encodeURIComponent(params.token)}`),
});
