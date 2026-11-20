import { z } from "zod";

/** The server's settings from the environment, checked with Zod at the boundary */
const envSchema = z.object({
  SOLL_PORT: z.coerce.number().int().min(1).max(65535).default(8200),
  SOLL_HOST: z.string().min(1).default("0.0.0.0"),
  SOLL_VERSION: z.string().min(1).default("0.0.0"),
  SOLL_DATA_DIR: z.string().min(1).default("data"),
});

export type Env = { port: number; host: string; version: string; dataDir: string };

export const parseEnv = (source: Record<string, string | undefined>): Env => {
  const parsed = envSchema.parse(source);
  return {
    port: parsed.SOLL_PORT,
    host: parsed.SOLL_HOST,
    version: parsed.SOLL_VERSION,
    dataDir: parsed.SOLL_DATA_DIR,
  };
};
