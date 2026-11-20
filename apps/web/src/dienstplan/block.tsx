import { Button, cn, Icon } from "@soll/ui";
import { Move } from "lucide";
import { Show } from "solid-js";
import { spanneText } from "./text.ts";
import type { Schicht, Vorlage } from "./typen.ts";
import { SCHICHT_TYP } from "./ziehen.ts";

/** "Spät · Service": the name of the template and the role, as the mockup labels a block */
export const blockText = (schicht: Schicht, vorlagen: readonly Vorlage[]): string =>
  [vorlagen.find((v) => v.vorlageId === schicht.vorlageId)?.name, schicht.rolle]
    .filter(Boolean)
    .join(" · ");

/** The id of the note how the handle works, once per page (WochenRaster) */
export const GRIFF_HINWEIS = "plan-griff-hinweis";

const BLOCK = "flex w-full min-w-0 flex-col gap-0.5 rounded-sm px-2 py-1.5 text-start";

/** The time and label of a shift, in the look of design/mockup/Dienstplan.dc.html */
const Inhalt = (props: { schicht: Schicht; vorlagen: readonly Vorlage[] }) => (
  <>
    <span class="font-mono text-[12px]" dir="ltr">
      {spanneText(props.schicht)}
    </span>
    <span class="truncate text-[12px]">{blockText(props.schicht, props.vorlagen)}</span>
  </>
);

/**
 * A shift in the week. For whoever plans it is a button that opens the shift and can be dragged,
 * with a handle that picks it up for the keyboard (Enter, arrows, Enter again, Esc); for everyone
 * else just its text. An open shift has a dashed border.
 */
export const Block = (props: {
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  planer: boolean;
  /** the name of the handle: which shift of whom on which day */
  griffName: string;
  aufgenommen: boolean;
  onOeffnen: () => void;
  onGriff: () => void;
  onGriffTaste: (event: KeyboardEvent) => void;
  onGriffVerlassen: () => void;
}) => {
  const rahmen = () =>
    cn(
      "flex items-start gap-1 rounded-sm",
      props.schicht.nutzerId === null
        ? "border border-muted-foreground border-dashed"
        : "border border-transparent bg-accent",
      props.aufgenommen && "outline-2 outline-foreground",
    );
  return (
    <Show
      when={props.planer}
      fallback={
        <div class={cn(rahmen(), BLOCK)}>
          <Inhalt schicht={props.schicht} vorlagen={props.vorlagen} />
        </div>
      }
    >
      <div class={rahmen()}>
        <button
          type="button"
          draggable="true"
          class={cn(BLOCK, "cursor-grab focus-visible:outline-2 focus-visible:outline-foreground")}
          onClick={() => props.onOeffnen()}
          onDragStart={(event) => {
            event.dataTransfer?.setData(SCHICHT_TYP, props.schicht.schichtId);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          }}
        >
          <Inhalt schicht={props.schicht} vorlagen={props.vorlagen} />
        </button>
        <Button
          variant="icon"
          size="sm"
          aria-label={props.griffName}
          aria-pressed={props.aufgenommen ? "true" : "false"}
          aria-describedby={GRIFF_HINWEIS}
          class="shrink-0"
          onClick={() => props.onGriff()}
          onKeyDown={(event) => props.onGriffTaste(event)}
          onBlur={(event) => {
            // leaving the handle cancels the move; a handle the page rebuilt is not left
            const griff = event.currentTarget;
            queueMicrotask(() => griff.isConnected && props.onGriffVerlassen());
          }}
        >
          <Icon icon={Move} />
        </Button>
      </div>
    </Show>
  );
};
