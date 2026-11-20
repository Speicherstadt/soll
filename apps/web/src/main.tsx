import { render } from "@solidjs/web";
import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { applyLocale } from "./i18n.ts";
import { routeTree } from "./routeTree.gen.ts";
import "./styles.css";

const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

applyLocale();

const root = document.getElementById("app");
if (root) render(() => <RouterProvider router={router} />, root);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
