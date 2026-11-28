import { describe, expect, it } from "vitest";
import { liesThema, speichereThema, themeFarbe, wendeThemaAn } from "./theme.ts";

type FakeMeta = {
  name: string;
  content: string;
  media: string;
  dataset: Record<string, string | undefined>;
  remove: () => void;
  before: (node: FakeMeta) => void;
};

const fakeDokument = () => {
  const kinder: FakeMeta[] = [];
  const meta = (init: Partial<Pick<FakeMeta, "name" | "content" | "media">> = {}): FakeMeta => {
    const el: FakeMeta = {
      name: init.name ?? "",
      content: init.content ?? "",
      media: init.media ?? "",
      dataset: {},
      remove: () => {
        const i = kinder.indexOf(el);
        if (i >= 0) kinder.splice(i, 1);
      },
      before: (node: FakeMeta) => {
        const i = kinder.indexOf(el);
        if (i >= 0) kinder.splice(i, 0, node);
      },
    };
    return el;
  };
  kinder.push(
    meta({ name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" }),
    meta({ name: "theme-color", content: "#09090b", media: "(prefers-color-scheme: dark)" }),
  );
  const head = {
    querySelector: (sel: string) => {
      if (sel.includes("data-soll-theme-color"))
        return (
          kinder.find((m) => m.name === "theme-color" && m.dataset.sollThemeColor !== undefined) ??
          null
        );
      if (sel.includes('name="theme-color"'))
        return kinder.find((m) => m.name === "theme-color") ?? null;
      return null;
    },
    append: (node: FakeMeta) => void kinder.push(node),
    prepend: (node: FakeMeta) => void kinder.unshift(node),
    insertBefore: (node: FakeMeta, ref: FakeMeta | null) => {
      const i = ref ? kinder.indexOf(ref) : -1;
      if (i >= 0) kinder.splice(i, 0, node);
      else kinder.push(node);
      return node;
    },
  };
  const root = {
    dataset: {} as Record<string, string | undefined>,
    ownerDocument: {
      head,
      createElement: () => meta(),
    },
  };
  /** HTML Living Standard §4.2.5.1: first meta[name="theme-color"] in tree order whose media matches */
  const aktiveThemeFarbe = (systemDunkel: boolean): string | null => {
    const media = systemDunkel ? "(prefers-color-scheme: dark)" : "(prefers-color-scheme: light)";
    const treffer = kinder.find((m) => m.name === "theme-color" && (!m.media || m.media === media));
    return treffer?.content ?? null;
  };
  return { root: root as unknown as HTMLElement, aktiveThemeFarbe };
};

const ablage = () => {
  const werte = new Map<string, string>();
  return {
    getItem: (key: string) => werte.get(key) ?? null,
    setItem: (key: string, value: string) => void werte.set(key, value),
  };
};

describe("theme", () => {
  it("is system when nothing is stored", () => {
    expect(liesThema(ablage())).toBe("system");
    expect(liesThema(undefined)).toBe("system");
  });

  it("reads back what was stored", () => {
    const a = ablage();
    speichereThema(a, "dunkel");
    expect(liesThema(a)).toBe("dunkel");
  });

  it("ignores unknown values and blocked storage", () => {
    const a = ablage();
    a.setItem("soll-thema", "lila");
    expect(liesThema(a)).toBe("system");
    const gesperrt = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(liesThema(gesperrt)).toBe("system");
    expect(() => speichereThema(gesperrt, "hell")).not.toThrow();
  });

  it("maps manual themes to their browser theme-color and leaves system to media queries (#119)", () => {
    expect(themeFarbe("hell")).toBe("#ffffff");
    expect(themeFarbe("dunkel")).toBe("#09090b");
    expect(themeFarbe("system")).toBeNull();
  });

  it("places manual theme-color meta ahead of media-query metas in tree order (#119)", () => {
    const { root, aktiveThemeFarbe } = fakeDokument();
    wendeThemaAn(root, "dunkel");
    expect(root.dataset.theme).toBe("dark");
    // OS is light, but manual choice is dark: first matching meta must be #09090b
    expect(aktiveThemeFarbe(false)).toBe("#09090b");

    wendeThemaAn(root, "hell");
    expect(root.dataset.theme).toBe("light");
    // OS is dark, but manual choice is light: first matching meta must be #ffffff
    expect(aktiveThemeFarbe(true)).toBe("#ffffff");

    wendeThemaAn(root, "system");
    expect(root.dataset.theme).toBeUndefined();
    expect(aktiveThemeFarbe(false)).toBe("#ffffff");
    expect(aktiveThemeFarbe(true)).toBe("#09090b");
  });
});
