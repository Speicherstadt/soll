import type { JSX } from "@solidjs/web";
import { Badge, Button, Dialog, Icon } from "@soll/ui";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide";
import { createSignal, Show } from "solid-js";
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

/** Clean "+ Anlegen" trigger button opening a modal shadcn Dialog instead of a permanent form wall */
export const NeuFormular = (props: {
  label: string;
  knopf: string;
  fehler: string;
  arbeitet: boolean;
  onSubmit: (daten: FormData, form: HTMLFormElement) => Promise<boolean> | boolean;
  children: JSX.Element;
}) => {
  const [offen, setOffen] = createSignal(false);
  return (
    <>
      <div class="flex justify-end">
        <Button variant="primary" onClick={() => setOffen(true)}>
          <Icon icon={Plus} size={15} />
          {props.knopf}
        </Button>
      </div>
      <Show when={offen()}>
        <Dialog offen={offen()} titel={props.label} onSchliessen={() => setOffen(false)}>
          <form
            aria-label={props.label}
            class="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const ok = await props.onSubmit(new FormData(form), form);
              if (ok) setOffen(false);
            }}
          >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">{props.children}</div>
            <Fehler text={props.fehler ? fehlerText(props.fehler) : ""} />
            <div class="flex justify-end gap-2 border-border border-t pt-3">
              <Button variant="outline" onClick={() => setOffen(false)}>
                {m.abbrechen()}
              </Button>
              <Button type="submit" variant="primary" disabled={props.arbeitet}>
                {props.knopf}
              </Button>
            </div>
          </form>
        </Dialog>
      </Show>
    </>
  );
};

/** The text of the empty list, or nothing */
export const LeerText = (props: { leer: boolean; text: string }) => (
  <Show when={props.leer}>
    <p class="text-muted-foreground">{props.text}</p>
  </Show>
);
