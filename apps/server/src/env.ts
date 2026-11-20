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
const envSchema = z.object({
  SOLL_PORT: z.coerce.number().int().min(1).max(65535).default(8200),
  SOLL_HOST: z.string().min(1).default("0.0.0.0"),
  SOLL_VERSION: z.string().min(1).default("0.0.0"),
  SOLL_DATA_DIR: z.string().min(1).default("data"),
  SOLL_SECRET_KEY: schluessel,
  SOLL_URL: z.url().default("http://localhost:8200"),
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
  };
};
