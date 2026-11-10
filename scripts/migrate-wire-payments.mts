import { createClient } from "@libsql/client";
import { getDatabaseUrl } from "../src/db/config";
import { migrateWirePayments } from "./lib/wire-payments-migration";

const client = createClient({ url: getDatabaseUrl() });
try {
  const result = await migrateWirePayments(client);
  console.log(`${result.version}: ${result.changed ? "applied; existing orders preserved without payment backfill" : "already applied"}.`);
} finally {
  client.close();
}
