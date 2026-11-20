import type { JSX } from "@solidjs/web";
import { createContext, createSignal, For, useContext } from "solid-js";
import { cn } from "./cn.ts";

export type Toast = { id: number; text: string; ton: "neutral" | "success" | "danger" };

export type Toaster = { zeigen: (text: string, ton?: Toast["ton"]) => void };

const ToastKontext = createContext<Toaster>();

/** How long a toast stays, long enough to read two lines */
export const TOAST_DAUER_MS = 5000;

/**
 * Short messages in a region screen readers announce politely (aria-live), bottom of the screen.
 * Each disappears after TOAST_DAUER_MS; nothing in it needs an action.
 */
export const ToastBereich = (props: { label: string; children: JSX.Element }) => {
  const [toasts, setToasts] = createSignal<readonly Toast[]>([]);
  let naechste = 0;
  const zeigen: Toaster["zeigen"] = (text, ton = "neutral") => {
    const toast = { id: naechste++, text, ton };
    setToasts((alle) => [...alle, toast]);
    setTimeout(() => setToasts((alle) => alle.filter((t) => t.id !== toast.id)), TOAST_DAUER_MS);
  };
  return (
    <ToastKontext value={{ zeigen }}>
      {props.children}
      <section
        aria-label={props.label}
        aria-live="polite"
        class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2"
      >
        <For each={toasts()}>
          {(toast) => (
            <p
              role="status"
              class={cn(
                "pointer-events-auto rounded-lg border border-border bg-background px-4 py-3 shadow-lg",
                toast.ton === "success" && "text-success",
                toast.ton === "danger" && "text-danger",
              )}
            >
              {toast.text}
            </p>
          )}
        </For>
      </section>
    </ToastKontext>
  );
};

/** The toaster of the surrounding ToastBereich */
export const useToast = (): Toaster => useContext(ToastKontext);
