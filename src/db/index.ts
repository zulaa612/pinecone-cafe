import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getDatabaseUrl } from "./config";
import * as schema from "./schema";

function create() {
  const client = createClient({ url: getDatabaseUrl() });
  return drizzle(client, { schema });
}

const globalForDb = globalThis as typeof globalThis & { __cafeDb?: ReturnType<typeof create> };

/** Open SQLite only when used, so importing the legacy adapter also works in MongoDB mode. */
export const db = new Proxy({} as ReturnType<typeof create>, {
  get(_target, property) {
    const database = (globalForDb.__cafeDb ??= create());
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
