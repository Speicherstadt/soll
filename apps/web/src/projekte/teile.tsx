import type { JSX } from "@solidjs/web";
import { Badge, Button, Icon } from "@soll/ui";
import { Archive, ArchiveRestore, Trash2 } from "lucide";
import { Show } from "solid-js";
import { m } from "../paraglide/messages.js";
import { Fehler } from "../rahmen/karte.tsx";
import { fehlerText } from "./werte.ts";

/** The state of a row: nothing while in use, "archiviert" in words (not by color alone) */
export const Stand = (props: { archiviertAm: number | null }) => (
  <Show when={props.archiviertAm !== null}>
    <Badge>{m.archiviert()}</Badge>
  </Show>
);

/** Archive or restore, and remove: what a rate or an order still names is archived instead */
export const Aktionen = (props: {
  name: string;
  archiviertAm: number | null;
  archivieren: (archiviert: boolean) => void;
  entfernen: () => void;
}) => (
  <div class="flex justify-end gap-1">
    <Show
      when={props.archiviertAm === null}
      fallback={
        <Button
          variant="icon"
          aria-label={m.zurueckholen({ name: props.name })}
          onClick={() => props.archivieren(false)}
        >
          <Icon icon={ArchiveRestore} />
        </Button>
      }
    >
      <Button
        variant="icon"
        aria-label={m.archivieren({ name: props.name })}
        onClick={() => props.archivieren(true)}
      >
        <Icon icon={Archive} />
      </Button>
    </Show>
    <Button
      variant="icon"
      aria-label={m.entfernen({ name: props.name })}
      onClick={() => props.entfernen()}
    >
      <Icon icon={Trash2} />
    </Button>
  </div>
);

/** A form to add a row: fields side by side on the desktop, one below the other on a phone */
export const NeuFormular = (props: {
  label: string;
  knopf: string;
  fehler: string;
  arbeitet: boolean;
  onSubmit: (daten: FormData, form: HTMLFormElement) => void;
  children: JSX.Element;
}) => (
  <form
    aria-label={props.label}
    class="grid grid-cols-1 items-start gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3"
    onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      props.onSubmit(new FormData(form), form);
    }}
  >
    <div class="sm:col-span-full">
      <h2 class="font-semibold text-[13px] text-foreground">{props.label}</h2>
    </div>
    {props.children}
    <div class="flex flex-col gap-2 sm:col-span-full">
      <Button type="submit" variant="primary" class="self-start" disabled={props.arbeitet}>
        {props.knopf}
      </Button>
      <Fehler text={props.fehler ? fehlerText(props.fehler) : ""} />
    </div>
  </form>
);

/** The text of the empty list, or nothing */
export const LeerText = (props: { leer: boolean; text: string }) => (
  <Show when={props.leer}>
    <p class="text-muted-foreground">{props.text}</p>
  </Show>
);
