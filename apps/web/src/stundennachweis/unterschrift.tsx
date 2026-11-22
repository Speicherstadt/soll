import { aufFlaeche, FLAECHE, type Punkt, type Striche } from "@soll/arbeitszeit";
import { Button } from "@soll/ui";
import { createUniqueId } from "solid-js";
import { m } from "../paraglide/messages.js";

/** Draws the strokes in the color of the text (light and dark), with round ends and joints */
const zeichnen = (flaeche: HTMLCanvasElement, striche: Striche) => {
  const stift = flaeche.getContext("2d");
  if (!stift) return;
  stift.clearRect(0, 0, FLAECHE.breite, FLAECHE.hoehe);
  stift.strokeStyle = getComputedStyle(flaeche).color;
  stift.lineWidth = 4;
  stift.lineCap = "round";
  stift.lineJoin = "round";
  for (const strich of striche) {
    const [erster, ...rest] = strich;
    if (!erster) continue;
    stift.beginPath();
    stift.moveTo(erster[0], erster[1]);
    for (const [x, y] of rest.length > 0 ? rest : [erster]) stift.lineTo(x, y);
    stift.stroke();
  }
};

/**
 * The surface the customer signs on with a finger, a pen or the mouse (Pointer Events). It keeps
 * whole-number points on the fixed surface of 600 × 200, whatever the screen, and nothing about time,
 * pressure or speed (docs/plan.md, "Unterschrift des Kunden"). Reports the strokes after each one.
 */
export const UnterschriftFlaeche = (props: { onAendern: (striche: Striche) => void }) => {
  const id = createUniqueId();
  let flaeche: HTMLCanvasElement | undefined;
  let striche: Punkt[][] = [];
  let zieht = false;
  const punkt = (event: PointerEvent): Punkt | null => {
    if (!flaeche) return null;
    const rahmen = flaeche.getBoundingClientRect();
    return aufFlaeche(
      { x: event.clientX - rahmen.left, y: event.clientY - rahmen.top },
      { breite: rahmen.width, hoehe: rahmen.height },
    );
  };
  const neu = () => {
    if (flaeche) zeichnen(flaeche, striche);
  };
  const beginnen = (event: PointerEvent) => {
    const p = punkt(event);
    if (!p || striche.length >= FLAECHE.striche) return;
    event.preventDefault();
    flaeche?.setPointerCapture(event.pointerId);
    zieht = true;
    striche = [...striche, [p]];
    neu();
  };
  const ziehen = (event: PointerEvent) => {
    const p = punkt(event);
    const strich = striche.at(-1);
    const letzter = strich?.at(-1);
    if (!zieht || !p || !strich || (letzter?.[0] === p[0] && letzter?.[1] === p[1])) return;
    if (striche.reduce((summe, s) => summe + s.length, 0) >= FLAECHE.punkte) return;
    strich.push(p);
    neu();
  };
  const enden = () => {
    if (!zieht) return;
    zieht = false;
    props.onAendern(striche.map((strich) => [...strich]));
  };
  const loeschen = () => {
    striche = [];
    neu();
    props.onAendern([]);
  };
  return (
    <div class="flex flex-col gap-1.5">
      <span id={`${id}-titel`} class="font-medium">
        {m.nachweis_unterschrift()}
      </span>
      <canvas
        ref={(el) => {
          flaeche = el;
        }}
        width={FLAECHE.breite}
        height={FLAECHE.hoehe}
        role="img"
        aria-labelledby={`${id}-titel`}
        aria-describedby={`${id}-hinweis`}
        data-testid="unterschrift"
        class="aspect-[3/1] w-full max-w-xl touch-none rounded-md border border-border bg-background text-foreground"
        onPointerDown={beginnen}
        onPointerMove={ziehen}
        onPointerUp={enden}
        onPointerCancel={enden}
      />
      <p id={`${id}-hinweis`} class="text-[12px] text-muted-foreground">
        {m.nachweis_unterschrift_hinweis()}
      </p>
      <Button variant="outline" class="self-start" onClick={loeschen}>
        {m.nachweis_unterschrift_loeschen()}
      </Button>
    </div>
  );
};
