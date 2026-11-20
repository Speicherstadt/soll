import type { IconNode } from "lucide";
import { For } from "solid-js";

/** An icon of `lucide` as data: elements with their attributes (lucide-solid carries only Solid 1) */
export type { IconNode };

type Attribute = Record<string, string | number>;

export type IconProps = { icon: IconNode; size?: number; class?: string };

/**
 * A lucide icon, decorative: it carries no name of its own, the button or text next to it does
 * (DESIGN.md: icon buttons always with aria-label). 16 px at the desktop, 20 to 24 px on phones.
 */
export const Icon = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class={props.class}
  >
    <For each={props.icon}>
      {([tag, roh]) => {
        const attrs = roh as Attribute;
        return tag === "path" ? (
          <path {...attrs} />
        ) : tag === "circle" ? (
          <circle {...attrs} />
        ) : tag === "rect" ? (
          <rect {...attrs} />
        ) : tag === "line" ? (
          <line {...attrs} />
        ) : tag === "polyline" ? (
          <polyline {...attrs} />
        ) : tag === "polygon" ? (
          <polygon {...attrs} />
        ) : (
          <ellipse {...attrs} />
        );
      }}
    </For>
  </svg>
);
