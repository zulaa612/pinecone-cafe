import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { migrateWirePayments } from "./lib/wire-payments-migration";

test("payment migration requires an initialized orders table and leaves no partial tables", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await assert.rejects(migrateWirePayments(client), /npm run db:push.*existing orders table/);
    assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE name IN ('order_payments', 'wire_webhook_events')")).rows.length, 0);
  } finally {
    client.close();
  }
});

test("payment migration preserves legacy orders, persists attempts, and remains idempotent", async () => {
  const client = createClient({ url: ":memory:" });
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.batch([
      "CREATE TABLE orders (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, total_cents INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
      "CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, name TEXT NOT NULL)",
      "INSERT INTO orders VALUES ('legacy-order', 'Legacy Customer', 15000, 'completed', 'legacy-date')",
      "INSERT INTO orders VALUES ('legacy-pending', 'Existing Customer', 9000, 'pending', 'another-date')",
      "INSERT INTO order_items VALUES ('legacy-item', 'legacy-order', 'Original coffee snapshot')",
    ], "write");

    const originalOrders = (await client.execute("SELECT * FROM orders ORDER BY id")).rows;
    const originalItems = (await client.execute("SELECT * FROM order_items")).rows;
    const originalSchema = (await client.execute("SELECT name, sql FROM sqlite_master WHERE name IN ('orders', 'order_items') ORDER BY name")).rows;
    assert.equal((await migrateWirePayments(client)).changed, true);
    assert.deepEqual((await client.execute("SELECT * FROM orders ORDER BY id")).rows, originalOrders);
    assert.deepEqual((await client.execute("SELECT * FROM order_items")).rows, originalItems);
    assert.deepEqual((await client.execute("SELECT name, sql FROM sqlite_master WHERE name IN ('orders', 'order_items') ORDER BY name")).rows, originalSchema);
    assert.equal((await client.execute("SELECT count(*) AS count FROM order_payments")).rows[0].count, 0);

    await client.batch([
      "INSERT INTO orders VALUES ('qpay-order', 'QPay Customer', 12000, 'pending', 'new-date')",
      "INSERT INTO orders VALUES ('unconfirmed-order', 'Other Customer', 5000, 'pending', 'new-date')",
      "INSERT INTO order_payments (order_id, amount_mnt) VALUES ('qpay-order', 12000)",
      "INSERT INTO order_payments (order_id, amount_mnt) VALUES ('unconfirmed-order', 5000)",
    ], "write");
    const pending = (await client.execute("SELECT * FROM order_payments WHERE order_id = 'qpay-order'")).rows[0];
    assert.equal(pending.currency, "MNT");
    assert.equal(pending.status, "pending");
    assert.equal(pending.attempt, 1);
    assert.equal(pending.provider_intent_id, null);
    assert.match(String(pending.created_at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    await client.execute("UPDATE order_payments SET status = 'paid', attempt = 2, provider_intent_id = 'pi_paid', checkout_session_id = 'cs_paid', checkout_url = 'https://pay.wire.mn/c/cs_paid', paid_at = 'paid-date' WHERE order_id = 'qpay-order'");
    const paid = (await client.execute("SELECT * FROM order_payments WHERE order_id = 'qpay-order'")).rows[0];
    await assert.rejects(client.execute("UPDATE order_payments SET provider_intent_id = 'pi_paid' WHERE order_id = 'unconfirmed-order'"), /UNIQUE constraint failed/);
    await assert.rejects(client.execute("INSERT INTO order_payments (order_id, amount_mnt) VALUES ('missing-order', 1000)"), /FOREIGN KEY constraint failed/);
    await client.execute("INSERT INTO wire_webhook_events (id) VALUES ('evt_paid')");
    const processed = (await client.execute("SELECT * FROM wire_webhook_events WHERE id = 'evt_paid'")).rows[0];
    assert.match(String(processed.processed_at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    await assert.rejects(client.execute("INSERT INTO wire_webhook_events (id) VALUES ('evt_paid')"), /UNIQUE constraint failed/);

    assert.equal((await migrateWirePayments(client)).changed, false);
    assert.deepEqual((await client.execute("SELECT * FROM order_payments WHERE order_id = 'qpay-order'")).rows[0], paid);
    assert.deepEqual((await client.execute("SELECT * FROM wire_webhook_events WHERE id = 'evt_paid'")).rows[0], processed);
    assert.deepEqual((await client.execute("SELECT * FROM orders WHERE id LIKE 'legacy-%' ORDER BY id")).rows, originalOrders);
    assert.equal((await client.execute("SELECT count(*) AS count FROM orders")).rows[0].count, 4);
    assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);

    await client.execute("DELETE FROM orders WHERE id = 'qpay-order'");
    assert.equal((await client.execute("SELECT * FROM order_payments WHERE order_id = 'qpay-order'")).rows.length, 0);
    assert.equal((await client.execute("SELECT count(*) AS count FROM order_payments")).rows[0].count, 1);
    assert.deepEqual((await client.execute("SELECT * FROM order_items")).rows, originalItems);
  } finally {
    client.close();
  }
});
