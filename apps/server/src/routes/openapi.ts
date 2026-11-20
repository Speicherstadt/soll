import { Hono } from "hono";
import { OPERATIONEN, openapiDokument } from "../openapi/index.ts";

/**
 * The OpenAPI description, public like the API's own documentation (S-607): it names routes and
 * input, no data. Built once per start; it changes only with the code.
 */
export const openapiRouten = (angaben: { version: string; url: string }) => {
  const dokument = openapiDokument(OPERATIONEN, angaben);
  return new Hono().get("/", (c) => c.json(dokument));
};
