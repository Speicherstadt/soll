import { createFileRoute } from "@tanstack/solid-router";
import { Kiosk } from "../terminal/kiosk.tsx";

/** The terminal on a tablet (S-801): no session, only the device token of its pairing */
export const Route = createFileRoute("/terminal")({ component: Kiosk });
