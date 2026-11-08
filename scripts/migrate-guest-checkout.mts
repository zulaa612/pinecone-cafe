import { createClient } from "@libsql/client";
import { migrateGuestCheckout } from "./lib/guest-checkout-migration";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/cafe.db" });
try {
  const result = await migrateGuestCheckout(client);
  console.log(`${result.version}: ${result.changed ? "applied; existing accounts, orders, items and reviews preserved" : "already applied"}.`);
} finally {
  client.close();
}
