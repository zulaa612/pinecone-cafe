import { createClient } from "@libsql/client";
import { getDatabaseUrl } from "../src/db/config";
import { migrateGuestCheckout } from "./lib/guest-checkout-migration";

const client = createClient({ url: getDatabaseUrl() });
try {
  const result = await migrateGuestCheckout(client);
  console.log(`${result.version}: ${result.changed ? "applied; existing accounts, orders, items and reviews preserved" : "already applied"}.`);
} finally {
  client.close();
}
