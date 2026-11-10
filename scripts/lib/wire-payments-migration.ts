import type { Client } from "@libsql/client";

export const WIRE_PAYMENTS_MIGRATION = "2026-11-10-wire-payments-v1";

/** Add payment tracking without assigning a new payment requirement to legacy orders. */
export async function migrateWirePayments(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  const tx = await client.transaction("write");
  try {
    const orders = await tx.execute("PRAGMA table_info(orders)");
    if (!orders.rows.length) {
      throw new Error("Initialize the database with npm run db:push before running npm run db:migrate:payments; this migration requires the existing orders table.");
    }

    const before = await tx.execute("SELECT count(*) AS count FROM orders");
    const existing = await tx.execute("SELECT name FROM sqlite_master WHERE name IN ('order_payments', 'order_payments_intent_idx', 'wire_webhook_events')");

    await tx.execute(`CREATE TABLE IF NOT EXISTS order_payments (
      order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      amount_mnt INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MNT',
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 1,
      provider_intent_id TEXT,
      checkout_session_id TEXT,
      checkout_url TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
    await tx.execute("CREATE UNIQUE INDEX IF NOT EXISTS order_payments_intent_idx ON order_payments(provider_intent_id)");
    await tx.execute(`CREATE TABLE IF NOT EXISTS wire_webhook_events (
      id TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);

    const after = await tx.execute("SELECT count(*) AS count FROM orders");
    if (before.rows[0].count !== after.rows[0].count) {
      throw new Error("Order count changed; payment migration rolled back.");
    }

    await tx.commit();
    return { changed: existing.rows.length !== 3, version: WIRE_PAYMENTS_MIGRATION };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
