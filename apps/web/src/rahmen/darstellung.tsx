import { Icon } from "@soll/ui";
import { ChevronDown, Globe, Monitor, Moon, Sun } from "lucide";
import { createSignal, For } from "solid-js";
import { m } from "../paraglide/messages.js";
import { getLocale, type Locale, locales, setLocale } from "../paraglide/runtime.js";
import { liesThema, speichereThema, THEMEN, type Thema, wendeThemaAn } from "./theme.ts";

const ablage = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

const themaName = (thema: Thema): string =>
  thema === "hell" ? m.theme_hell() : thema === "dunkel" ? m.theme_dunkel() : m.theme_system();

const THEMA_ICONS = { system: Monitor, hell: Sun, dunkel: Moon } as const;

/** Each language under its own name ("Deutsch", "Türkçe", "العربية"), from the browser's Intl */
const sprachName = (locale: Locale): string =>
  new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;

// One theme for every picker: the sidebar and the page show the same choice. Module scope is fine
// in this client-only SPA (CLAUDE.md: no SSR).
const [thema, setThema] = createSignal(liesThema(ablage()));

const waehleThema = (neu: Thema) => {
  setThema(neu);
  speichereThema(ablage(), neu);
  wendeThemaAn(document.documentElement, neu);
};

/** Colours and language, at the foot of the sidebar and under "Mehr" on phones */
export const Darstellung = () => (
  <div class="flex flex-col gap-2">
    <fieldset
      aria-label={m.theme_label()}
      class="grid grid-cols-3 gap-0.5 rounded-lg border border-border bg-background p-0.5"
    >
      <For each={THEMEN}>
        {(wert) => {
          const aktiv = () => thema() === wert;
          return (
            <button
              type="button"
              aria-pressed={aktiv() ? "true" : "false"}
              aria-label={themaName(wert)}
              title={themaName(wert)}
              class={`flex h-7 items-center justify-center rounded-md outline-hidden transition-colors focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-solid ${
                aktiv()
                  ? "bg-accent text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => waehleThema(wert)}
            >
              <Icon icon={THEMA_ICONS[wert]} size={15} />
            </button>
          );
        }}
      </For>
    </fieldset>
    <div class="relative flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-foreground focus-within:outline-2 focus-within:outline-foreground focus-within:outline-solid">
      <Icon icon={Globe} size={14} class="pointer-events-none shrink-0 text-muted-foreground" />
      <select
        aria-label={m.sprache_label()}
        class="h-full w-full cursor-pointer appearance-none bg-transparent pr-5 pl-2 text-[13px] text-foreground outline-hidden"
        value={getLocale()}
        onChange={(event) => setLocale(event.currentTarget.value as Locale)}
      >
        <For each={locales}>
          {(locale) => (
            <option value={locale} lang={locale} class="bg-background text-foreground">
              {sprachName(locale)}
            </option>
          )}
        </For>
      </select>
      <Icon
        icon={ChevronDown}
        size={14}
        class="pointer-events-none absolute right-2 shrink-0 text-muted-foreground"
      />
    </div>
  </div>
);
