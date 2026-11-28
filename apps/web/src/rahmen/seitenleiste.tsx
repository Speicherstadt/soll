import { Icon, Menu } from "@soll/ui";
import { Link, useNavigate } from "@tanstack/solid-router";
import { User } from "lucide";
import { createSignal, For, Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { abmeldenAusfuehren, aktuelleModule, aktuellerBetrieb } from "../sitzung/sitzung.ts";
import { bereicheFuer } from "./bereiche.ts";
import { Darstellung } from "./darstellung.tsx";

const KontoFuss = () => {
  const navigate = useNavigate();
  const [fehler, setFehler] = createSignal("");
  const abmelden = async () => {
    const grund = await abmeldenAusfuehren();
    if (grund === "netz") return setFehler(m.fehler_netz());
    if (grund === "fehler") return setFehler(m.fehler_abmelden());
    setFehler("");
    await navigate({ to: "/anmelden" });
  };
  return (
    <Show when={aktuellerBetrieb()?.nutzerName}>
      {(name) => (
        <div class="mb-2 flex flex-col gap-1">
          <Menu
            variant="ghost"
            aria-label={m.einstellungen_tab_konto()}
            ausloeser={
              <span class="flex w-full min-w-0 max-w-[172px] items-center gap-2 text-start">
                <Icon icon={User} size={15} class="shrink-0 text-muted-foreground" />
                <span class="truncate text-[13px] font-medium text-foreground">{name()}</span>
              </span>
            }
            eintraege={[
              {
                label: m.einstellungen_tab_konto(),
                onWaehlen: () => void navigate({ to: "/einstellungen" }),
              },
              {
                label: m.abmelden(),
                gefaehrlich: true,
                onWaehlen: () => void abmelden(),
              },
            ]}
          />
          <Show when={fehler()}>
            <p role="alert" class="px-1 text-[11px] text-danger">
              {fehler()}
            </p>
          </Show>
        </div>
      )}
    </Show>
  );
};

/** The sidebar from md on: the app and the business, its areas, account, colours and language (DESIGN.md) */
export const Seitenleiste = () => (
  <nav
    aria-label={m.nav_bereiche()}
    class="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col gap-1 border-e border-border bg-muted px-3 py-5 md:flex"
  >
    <div class="flex items-center gap-2.5 px-2 pb-4">
      <span
        aria-hidden="true"
        class="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary font-bold text-primary-foreground"
      >
        {m.start_title().slice(0, 1)}
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="font-semibold">{m.start_title()}</span>
        <Show when={aktuellerBetrieb()}>
          {(betrieb) => (
            <span class="truncate text-[12px] text-muted-foreground">{betrieb().name}</span>
          )}
        </Show>
      </span>
    </div>
    <For each={bereicheFuer(aktuelleModule())}>
      {(bereich) => (
        <Link
          to={bereich.pfad}
          activeOptions={{ exact: true }}
          class="flex min-h-9 items-center gap-2.5 rounded-sm px-2.5 hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
        >
          <Icon icon={bereich.icon} />
          {bereich.name()}
        </Link>
      )}
    </For>
    <div class="mt-auto border-t border-border pt-3">
      <KontoFuss />
      <Darstellung />
      <p class="mt-2.5 px-1 text-[11px] text-muted-foreground tabular-nums">v{__APP_VERSION__}</p>
    </div>
  </nav>
);
