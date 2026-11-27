import { Button, cn, Icon, Tooltip } from "@soll/ui";
import { CircleAlert, Move, TriangleAlert } from "lucide";
import { Show } from "solid-js";
import { befundKurz } from "./befunde.ts";
import { schichtFarbe } from "./farben.ts";
import { spanneText } from "./text.ts";
import type { PlanBefund, Schicht, Vorlage } from "./typen.ts";
import { SCHICHT_TYP } from "./ziehen.ts";

/** "Spät · Service": the name of the template and the role, as the mockup labels a block */
export const blockText = (schicht: Schicht, vorlagen: readonly Vorlage[]): string =>
  [vorlagen.find((v) => v.vorlageId === schicht.vorlageId)?.name, schicht.rolle]
    .filter(Boolean)
    .join(" · ");

/** The id of the note how the handle works, once per page (WochenRaster) */
export const GRIFF_HINWEIS = "plan-griff-hinweis";

const BLOCK = "flex w-full min-w-0 flex-col gap-0.5 rounded-sm px-2 py-1.5 text-start";

/** The icon of the worst finding of a shift: a triangle for a Verstoß, a circle for a Hinweis */
export const BefundIcon = (props: { befunde: readonly PlanBefund[] }) => (
  <Show when={props.befunde[0]}>
    {(erster) => (
      <Icon
        icon={erster().schwere === "verstoss" ? TriangleAlert : CircleAlert}
        size={14}
        class={cn("shrink-0", erster().schwere === "verstoss" ? "text-danger" : "text-warning")}
      />
    )}
  </Show>
);

/** The findings of a shift as one text, for the tooltip and for screen readers */
export const befundeText = (befunde: readonly PlanBefund[]): string =>
  befunde.map(befundKurz).join("; ");

/** The time and label of a shift with the icon of its findings (design/mockup/Dienstplan.dc.html) */
const Inhalt = (props: {
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  befunde: readonly PlanBefund[];
}) => (
  <>
    <span class="flex items-center justify-between gap-1">
      <span class="font-mono text-[12px]" dir="ltr">
        {spanneText(props.schicht)}
      </span>
      <BefundIcon befunde={props.befunde} />
    </span>
    <span class="truncate text-[12px] text-muted-foreground">
      {blockText(props.schicht, props.vorlagen)}
    </span>
    <Show when={props.befunde.length > 0}>
      <span class="sr-only">{befundeText(props.befunde)}</span>
    </Show>
  </>
);

/** The border and color tint of a shift: dashed while open, red/amber for findings, role color otherwise */
const rahmenVon = (
  schicht: Schicht,
  vorlagen: readonly Vorlage[],
  befunde: readonly PlanBefund[],
) => {
  const farbe = schichtFarbe(schicht, vorlagen);
  if (schicht.nutzerId === null) return farbe.karte;
  const schwere = befunde[0]?.schwere;
  if (schwere === "verstoss") return cn("border border-danger", farbe.karte);
  if (schwere === "hinweis") return cn("border border-warning", farbe.karte);
  return cn("border border-border/60", farbe.karte);
};

/** The button of a shift for whoever plans: opens it, and can be dragged */
const Knopf = (props: {
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  befunde: readonly PlanBefund[];
  onOeffnen: () => void;
}) => (
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
    <Inhalt schicht={props.schicht} vorlagen={props.vorlagen} befunde={props.befunde} />
  </button>
);

/**
 * A shift in the week. For whoever plans it is a button that opens the shift and can be dragged,
 * with a handle that picks it up for the keyboard (Enter, arrows, Enter again, Esc); for everyone
 * else just its text. An open shift has a dashed border; a finding colours the border and shows its
 * icon, with the text in a tooltip and for screen readers (DESIGN.md, "Dienstplan").
 */
export const Block = (props: {
  schicht: Schicht;
  vorlagen: readonly Vorlage[];
  /** the findings of the rules on this shift (S-502), a Verstoß first */
  befunde: readonly PlanBefund[];
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
      "flex items-start gap-1 rounded-sm transition-colors",
      rahmenVon(props.schicht, props.vorlagen, props.befunde),
      props.aufgenommen && "outline-2 outline-foreground",
    );
  return (
    <Show
      when={props.planer}
      fallback={
        <div class={cn(rahmen(), BLOCK)}>
          <Inhalt schicht={props.schicht} vorlagen={props.vorlagen} befunde={props.befunde} />
        </div>
      }
    >
      <div class={rahmen()}>
        <Show
          when={props.befunde.length > 0}
          fallback={
            <Knopf
              schicht={props.schicht}
              vorlagen={props.vorlagen}
              befunde={[]}
              onOeffnen={props.onOeffnen}
            />
          }
        >
          <Tooltip text={befundeText(props.befunde)} class="min-w-0 flex-1">
            <Knopf
              schicht={props.schicht}
              vorlagen={props.vorlagen}
              befunde={props.befunde}
              onOeffnen={props.onOeffnen}
            />
          </Tooltip>
        </Show>
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
