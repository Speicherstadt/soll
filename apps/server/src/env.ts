import { z } from "zod";
import { erlaubteUrspruenge } from "./modules/umzug/kimai-adresse.ts";

/** 32 random bytes in base64: the key of the encrypted columns and the secret of Better Auth */
const schluessel = z
  .string({
    error: "SOLL_SECRET_KEY is missing: 32 random bytes in base64 (openssl rand -base64 32)",
  })
  .refine(
    (wert) => /^[A-Za-z0-9+/]+={0,2}$/.test(wert) && Buffer.from(wert, "base64").length === 32,
    {
      message: "SOLL_SECRET_KEY must be 32 bytes in base64 (openssl rand -base64 32)",
    },
  );

/** What the commands next to the server need (backup, restore, health): no key */
const betriebsSchema = z.object({
  SOLL_PORT: z.coerce.number().int().min(1).max(65535).default(8200),
  SOLL_DATA_DIR: z.string().min(1).default("data"),
});

/** The server's settings from the environment, checked with Zod at the boundary */
const envSchema = betriebsSchema
  .extend({
    SOLL_HOST: z.string().min(1).default("0.0.0.0"),
    SOLL_VERSION: z.string().min(1).default("0.0.0"),
    // the static build of apps/web (the image sets /app/web); unset, the server serves the API only
    SOLL_WEB_DIR: z.string().min(1).optional(),
    SOLL_SECRET_KEY: schluessel,
    // without a trailing slash: links are built as `${url}/einladung/…` and the passkey origin is the URL
    SOLL_URL: z
      .url()
      .default("http://localhost:8200")
      .transform((url) => url.replace(/\/+$/, "")),
    // mail over SMTP (S-306): both or neither; the password in the URL stays in the environment
    SOLL_SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    SOLL_MAIL_VON: z.string().min(3).optional(),
    // origins an import may call although http or private (S-705): a Kimai in the own network
    SOLL_IMPORT_ALLOWED_ORIGINS: z.string().optional(),
  })
  .refine((env) => (env.SOLL_SMTP_URL === undefined) === (env.SOLL_MAIL_VON === undefined), {
    message: "SOLL_SMTP_URL and SOLL_MAIL_VON go together: set both or neither",
  });

export type Env = {
  port: number;
  host: string;
  version: string;
  dataDir: string;
  /** The static build of the web app, or null when Vite serves it (development) */
  webDir: string | null;
  /** The decoded key; never logged */
  geheimerSchluessel: Uint8Array;
  /** Where the instance is reached, for links in invitations and for Better Auth */
  url: string;
  /** SMTP for mail, or null when the instance sends none */
  smtp: { url: string; von: string } | null;
  /** Origins an import may call although http or private (S-705) */
  importErlaubt: ReadonlySet<string>;
};

/** Reads the settings or throws with the reason; the server refuses to start without a valid key */
export const parseEnv = (source: Record<string, string | undefined>): Env => {
  const parsed = envSchema.parse(source);
  return {
    port: parsed.SOLL_PORT,
    host: parsed.SOLL_HOST,
    version: parsed.SOLL_VERSION,
    dataDir: parsed.SOLL_DATA_DIR,
    webDir: parsed.SOLL_WEB_DIR ?? null,
    geheimerSchluessel: new Uint8Array(Buffer.from(parsed.SOLL_SECRET_KEY, "base64")),
    url: parsed.SOLL_URL,
    smtp:
      parsed.SOLL_SMTP_URL && parsed.SOLL_MAIL_VON
        ? { url: parsed.SOLL_SMTP_URL, von: parsed.SOLL_MAIL_VON }
        : null,
    importErlaubt: erlaubteUrspruenge(parsed.SOLL_IMPORT_ALLOWED_ORIGINS),
  };
};

export type BetriebsEnv = { port: number; dataDir: string };

/** The settings of `soll backup`, `soll restore` and `soll health`, which work without the key */
export const parseBetriebsEnv = (source: Record<string, string | undefined>): BetriebsEnv => {
  const parsed = betriebsSchema.parse(source);
  return { port: parsed.SOLL_PORT, dataDir: parsed.SOLL_DATA_DIR };
};
