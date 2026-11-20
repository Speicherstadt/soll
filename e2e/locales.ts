import { readFileSync } from "node:fs";

/** The locales of project.inlang and their messages, read from the files the app is built from */
const settings = JSON.parse(readFileSync("project.inlang/settings.json", "utf8")) as {
  locales: string[];
};

export const locales = settings.locales;

export const messagesOf = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
