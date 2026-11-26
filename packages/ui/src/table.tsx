import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "./cn.ts";

type Teil<T> = { children: JSX.Element; class?: string } & Omit<
  JSX.HTMLAttributes<T>,
  "class" | "children"
>;

/** The attributes of a part that are passed through to its element as they are */
const weitere = <T,>(props: Teil<T>) => omit(props, "class", "children");

/** A native table, dense and quiet (DESIGN.md); numbers and times line up with tabular-nums */
export const Table = (props: Teil<HTMLTableElement> & { beschriftung: string }) => (
  <section class="w-full overflow-x-auto" tabindex={0} aria-label={props.beschriftung}>
    <table
      {...omit(props, "class", "children", "beschriftung")}
      class={cn("w-full border-collapse text-start tabular-nums", props.class)}
    >
      <caption class="sr-only">{props.beschriftung}</caption>
      {props.children}
    </table>
  </section>
);

export const Thead = (props: Teil<HTMLTableSectionElement>) => (
  <thead
    {...weitere(props)}
    class={cn("border-b border-border text-muted-foreground", props.class)}
  >
    {props.children}
  </thead>
);

export const Tbody = (props: Teil<HTMLTableSectionElement>) => (
  <tbody {...weitere(props)} class={props.class}>
    {props.children}
  </tbody>
);

export const Tr = (props: Teil<HTMLTableRowElement>) => (
  <tr {...weitere(props)} class={cn("border-b border-border last:border-0", props.class)}>
    {props.children}
  </tr>
);

export const Th = (props: Teil<HTMLTableCellElement>) => (
  <th scope="col" {...weitere(props)} class={cn("h-9 px-3 text-start font-medium", props.class)}>
    {props.children}
  </th>
);

export const Td = (props: Teil<HTMLTableCellElement>) => (
  <td {...weitere(props)} class={cn("h-9 px-3", props.class)}>
    {props.children}
  </td>
);
