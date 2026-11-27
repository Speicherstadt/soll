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

/** A form to add a row: compact inline toolbar when `zeile` is set, or a full-width 3-column grid */
export const NeuFormular = (props: {
  label: string;
  knopf: string;
  fehler: string;
  arbeitet: boolean;
  zeile?: boolean;
  onSubmit: (daten: FormData, form: HTMLFormElement) => void;
  children: JSX.Element;
}) => (
  <form
    aria-label={props.label}
    class="flex flex-col gap-4 rounded-xl border border-border bg-background p-5"
    onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      props.onSubmit(new FormData(form), form);
    }}
  >
    <h2 class="font-semibold text-[14px] text-foreground">{props.label}</h2>
    <Show
      when={props.zeile}
      fallback={
        <>
          <div class="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.children}
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-4">
            <Fehler text={props.fehler ? fehlerText(props.fehler) : ""} />
            <Button type="submit" variant="primary" disabled={props.arbeitet}>
              {props.knopf}
            </Button>
          </div>
        </>
      }
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        {props.children}
        <Button type="submit" variant="primary" class="h-9 shrink-0" disabled={props.arbeitet}>
          {props.knopf}
        </Button>
      </div>
      <Fehler text={props.fehler ? fehlerText(props.fehler) : ""} />
    </Show>
  </form>
);

/** The text of the empty list, or nothing */
export const LeerText = (props: { leer: boolean; text: string }) => (
  <Show when={props.leer}>
    <p class="text-muted-foreground">{props.text}</p>
  </Show>
);
