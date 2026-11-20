import { Button, Icon } from "@soll/ui";
import { Copy } from "lucide";
import { createSignal, For, Show } from "solid-js";
import { api } from "../api.ts";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { Fuss, SchrittKopf } from "./geruest.tsx";
import type { Person } from "./mitarbeiterSchritt.tsx";
import { ROLLEN_NAMEN } from "./namen.ts";

type Einladung = { einladungId: string; name: string; rolle: Person["rolle"]; link: string };

/** A link to pass on; selecting the field or the button copies it */
const LinkZeile = (props: { einladung: Einladung }) => {
  const [kopiert, setKopiert] = createSignal(false);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(props.einladung.link);
      setKopiert(true);
    } catch {
      // no clipboard (an insecure origin): the link stays selectable in its field
    }
  };
  return (
    <li class="flex flex-col gap-1.5 px-3 py-2">
      <span>
        {props.einladung.name}{" "}
        <span class="text-muted-foreground">· {ROLLEN_NAMEN[props.einladung.rolle]()}</span>
      </span>
      <div class="flex items-center gap-2">
        <input
          readonly
          aria-label={m.einladung_link({ name: props.einladung.name })}
          value={props.einladung.link}
          class="h-9 min-w-0 flex-1 rounded-md border border-border bg-muted px-2 font-mono text-[12px]"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          variant="icon"
          aria-label={m.einladung_kopieren({ name: props.einladung.name })}
          onClick={kopieren}
        >
          <Icon icon={Copy} />
        </Button>
      </div>
      <Show when={kopiert()}>
        <span role="status" class="text-[12px] text-success">
          {m.einladung_kopiert()}
        </span>
      </Show>
    </li>
  );
};

/** Step 5: one invitation link per person of the list, without e-mail (S-106) */
export const EinladungenSchritt = (props: {
  personen: Person[];
  setzePersonen: (personen: Person[]) => void;
  nummer: number;
  anzahl: number;
  zurueck?: (() => void) | undefined;
  weiter: () => void;
}) => {
  const [einladungen, setEinladungen] = createSignal<Einladung[]>([]);
  const [fehler, setFehler] = createSignal("");
  const erstellen = async () => {
    const antwort = await api<{ einladungen: Einladung[] }>("/api/v1/einladungen/liste", {
      body: { personen: props.personen },
    });
    if (!antwort.ok) return setFehler(m.fehler_speichern());
    setFehler("");
    setEinladungen((bisher) => [...bisher, ...antwort.daten.einladungen]);
    // invited now: the list is empty again, so nobody gets two links
    props.setzePersonen([]);
  };
  return (
    <>
      <SchrittKopf id="schritt-titel" titel={m.einladungen_titel()} text={m.einladungen_text()} />
      <Show when={props.personen.length > 0}>
        <p>{m.einladungen_offen({ anzahl: props.personen.length })}</p>
        <Button variant="outline" class="self-start" onClick={erstellen}>
          {m.einladungen_erstellen()}
        </Button>
      </Show>
      <Show when={props.personen.length === 0 && einladungen().length === 0}>
        <p class="text-muted-foreground">{m.einladungen_leer()}</p>
      </Show>
      <Show when={einladungen().length > 0}>
        <ul
          aria-label={m.einladungen_liste()}
          class="flex flex-col divide-y divide-border rounded-lg border border-border"
        >
          <For each={einladungen()}>{(einladung) => <LinkZeile einladung={einladung} />}</For>
        </ul>
      </Show>
      <Fehler text={fehler()} />
      <Fuss
        nummer={props.nummer}
        anzahl={props.anzahl}
        zurueck={props.zurueck}
        weiter={props.weiter}
      />
    </>
  );
};
