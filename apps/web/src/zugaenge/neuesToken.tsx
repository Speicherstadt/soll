import { Button, Icon } from "@soll/ui";
import { Copy } from "lucide";
import { createSignal, Show } from "solid-js";
import { m } from "../paraglide/messages.js";

/** The new token, shown this once: selecting the field or the button copies it */
export const NeuesToken = (props: { name: string; token: string }) => {
  const [kopiert, setKopiert] = createSignal(false);
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(props.token);
      setKopiert(true);
    } catch {
      // no clipboard (an insecure origin): the token stays selectable in its field
    }
  };
  return (
    <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
      <p role="status">{m.zugang_neu()}</p>
      <div class="flex items-center gap-2">
        <input
          readonly
          aria-label={m.zugang_token({ name: props.name })}
          value={props.token}
          class="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-[12px]"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button variant="icon" aria-label={m.zugang_kopieren()} onClick={kopieren}>
          <Icon icon={Copy} />
        </Button>
      </div>
      <Show when={kopiert()}>
        <span class="text-[12px] text-success">{m.zugang_kopiert()}</span>
      </Show>
    </div>
  );
};
