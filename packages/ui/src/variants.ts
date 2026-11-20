import { cn } from "./cn.ts";

type Auswahl = Record<string, Record<string, string>>;

export type VariantProps<A extends Auswahl> = { [K in keyof A]?: keyof A[K] };

/**
 * Classes from named variants, as in Kennwort: `variants({ base, variants: { size: { sm: "h-8" } },
 * defaults: { size: "sm" } })` returns a function from the chosen variants to a class string.
 */
export const variants =
  <A extends Auswahl>(config: {
    base: string;
    variants: A;
    defaults: { [K in keyof A]: keyof A[K] };
  }) =>
  (gewaehlt: VariantProps<A> = {}): string =>
    cn(
      config.base,
      ...Object.keys(config.variants).map((name) => {
        const wert = gewaehlt[name] ?? config.defaults[name];
        return config.variants[name]?.[wert as string];
      }),
    );
