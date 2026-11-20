import type { JSX } from "@solidjs/web";
import { cn } from "./cn.ts";

type Teil<T> = { children: JSX.Element; class?: string } & Omit<
  JSX.HTMLAttributes<T>,
  "class" | "children"
>;

/** A native table, dense and quiet (DESIGN.md); numbers and times line up with tabular-nums */
export const Table = (props: Teil<HTMLTableElement> & { beschriftung: string }) => (
  <div class="w-full overflow-x-auto">
    <table class={cn("w-full border-collapse text-start tabular-nums", props.class)}>
      <caption class="sr-only">{props.beschriftung}</caption>
      {props.children}
    </table>
  </div>
);

export const Thead = (props: Teil<HTMLTableSectionElement>) => (
  <thead class={cn("border-b border-border text-muted-foreground", props.class)}>
    {props.children}
  </thead>
);

export const Tbody = (props: Teil<HTMLTableSectionElement>) => (
  <tbody class={props.class}>{props.children}</tbody>
);

export const Tr = (props: Teil<HTMLTableRowElement>) => (
  <tr class={cn("border-b border-border last:border-0", props.class)}>{props.children}</tr>
);

export const Th = (props: Teil<HTMLTableCellElement>) => (
  <th scope="col" class={cn("h-9 px-3 text-start font-medium", props.class)}>
    {props.children}
  </th>
);

export const Td = (props: Teil<HTMLTableCellElement>) => (
  <td class={cn("h-9 px-3", props.class)}>{props.children}</td>
);
