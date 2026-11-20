import { z } from "zod";

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

/** The server's settings from the environment, checked with Zod at the boundary */
const envSchema = z
  .object({
    SOLL_PORT: z.coerce.number().int().min(1).max(65535).default(8200),
    SOLL_HOST: z.string().min(1).default("0.0.0.0"),
    SOLL_VERSION: z.string().min(1).default("0.0.0"),
    SOLL_DATA_DIR: z.string().min(1).default("data"),
    SOLL_SECRET_KEY: schluessel,
    // without a trailing slash: links are built as `${url}/einladung/…` and the passkey origin is the URL
    SOLL_URL: z
      .url()
      .default("http://localhost:8200")
      .transform((url) => url.replace(/\/+$/, "")),
    // mail over SMTP (S-306): both or neither; the password in the URL stays in the environment
    SOLL_SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    SOLL_MAIL_VON: z.string().min(3).optional(),
  })
  .refine((env) => (env.SOLL_SMTP_URL === undefined) === (env.SOLL_MAIL_VON === undefined), {
    message: "SOLL_SMTP_URL and SOLL_MAIL_VON go together: set both or neither",
  });

export type Env = {
  port: number;
  host: string;
  version: string;
  dataDir: string;
  /** The decoded key; never logged */
  geheimerSchluessel: Uint8Array;
  /** Where the instance is reached, for links in invitations and for Better Auth */
  url: string;
  /** SMTP for mail, or null when the instance sends none */
  smtp: { url: string; von: string } | null;
};

/** Reads the settings or throws with the reason; the server refuses to start without a valid key */
export const parseEnv = (source: Record<string, string | undefined>): Env => {
  const parsed = envSchema.parse(source);
  return {
    port: parsed.SOLL_PORT,
    host: parsed.SOLL_HOST,
    version: parsed.SOLL_VERSION,
    dataDir: parsed.SOLL_DATA_DIR,
    geheimerSchluessel: new Uint8Array(Buffer.from(parsed.SOLL_SECRET_KEY, "base64")),
    url: parsed.SOLL_URL,
    smtp:
      parsed.SOLL_SMTP_URL && parsed.SOLL_MAIL_VON
        ? { url: parsed.SOLL_SMTP_URL, von: parsed.SOLL_MAIL_VON }
        : null,
  };
};
