import { render } from "@solidjs/web";
import { QueryClientProvider } from "@tanstack/solid-query";
import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { abfrageCache } from "./abfragen/client.ts";
import { applyLocale } from "./i18n.ts";
import { liesThema, wendeThemaAn } from "./rahmen/theme.ts";
import { routeTree } from "./routeTree.gen.ts";
import "./styles.css";

const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

applyLocale();
// before the first render, so a dark theme never flashes light
try {
  wendeThemaAn(document.documentElement, liesThema(localStorage));
} catch {
  // storage blocked: follow the device
}

const root = document.getElementById("app");
if (root)
  render(
    () => (
      <QueryClientProvider client={abfrageCache}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
    root,
  );

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
