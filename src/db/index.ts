import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function create() {
  const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/cafe.db" });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as typeof globalThis & { __cafeDb?: ReturnType<typeof create> };

/** Reused across hot reloads so dev doesn't open a new connection per edit. */
export const db = (globalForDb.__cafeDb ??= create());
