import type { Client, Transaction } from "@libsql/client";

export const GUEST_CHECKOUT_MIGRATION = "2026-11-09-guest-checkout-v1";

async function columns(tx: Transaction, table: "orders" | "reviews") {
  const result = await tx.execute(`PRAGMA table_info(${table})`);
  return new Map(result.rows.map(row => [String(row.name), Number(row.notnull)]));
}

/** Rebuild SQLite's NOT NULL columns atomically while preserving every legacy row and FK. */
export async function migrateGuestCheckout(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  const tx = await client.transaction("write");
  try {
    await tx.execute("CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))");
    const applied = await tx.execute({ sql: "SELECT id FROM app_migrations WHERE id = ?", args: [GUEST_CHECKOUT_MIGRATION] });
    if (applied.rows.length) {
      await tx.commit();
      return { changed: false, version: GUEST_CHECKOUT_MIGRATION };
    }

    const orderColumns = await columns(tx, "orders");
    const reviewColumns = await columns(tx, "reviews");
    if (!orderColumns.size || !reviewColumns.size) throw new Error("Initialize a new database with npm run db:push; this migration requires existing orders and reviews tables.");
    const before = await tx.execute("SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM order_items) AS items, (SELECT count(*) FROM reviews) AS reviews");

    if (orderColumns.get("user_id") === 1 || !orderColumns.has("guest_token_hash")) {
      await tx.execute(`CREATE TABLE orders_guest_migration (
        id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), guest_token_hash TEXT,
        customer_name TEXT NOT NULL, customer_type TEXT NOT NULL, class_grade TEXT, location TEXT,
        status TEXT NOT NULL DEFAULT 'pending', subtotal_cents INTEGER NOT NULL,
        discount_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), completed_at TEXT
      )`);
      await tx.execute(`INSERT INTO orders_guest_migration
        (id, user_id, guest_token_hash, customer_name, customer_type, class_grade, location, status, subtotal_cents, discount_cents, total_cents, created_at, completed_at)
        SELECT id, user_id, ${orderColumns.has("guest_token_hash") ? "guest_token_hash" : "NULL"}, customer_name, customer_type, class_grade, location, status, subtotal_cents, discount_cents, total_cents, created_at, completed_at FROM orders`);
      // Point the copied children at the new parent before removing either old table.
      // This avoids ON DELETE CASCADE deleting historical items during the rebuild.
      await tx.execute(`CREATE TABLE order_items_guest_migration (
        id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders_guest_migration(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        name TEXT NOT NULL, unit_price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL
      )`);
      await tx.execute("INSERT INTO order_items_guest_migration SELECT id, order_id, product_id, name, unit_price_cents, quantity FROM order_items");
      await tx.execute("DROP TABLE order_items");
      await tx.execute("DROP TABLE orders");
      await tx.execute("ALTER TABLE orders_guest_migration RENAME TO orders");
      await tx.execute("ALTER TABLE order_items_guest_migration RENAME TO order_items");
    }

    if (reviewColumns.get("user_id") === 1 || !reviewColumns.has("guest_token_hash") || !reviewColumns.has("customer_name")) {
      await tx.execute(`CREATE TABLE reviews_guest_migration (
        id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE, guest_token_hash TEXT, customer_name TEXT,
        rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`);
      await tx.execute(`INSERT INTO reviews_guest_migration
        (id, product_id, user_id, guest_token_hash, customer_name, rating, comment, created_at)
        SELECT id, product_id, user_id, ${reviewColumns.has("guest_token_hash") ? "guest_token_hash" : "NULL"}, ${reviewColumns.has("customer_name") ? "customer_name" : "NULL"}, rating, comment, created_at FROM reviews`);
      await tx.execute("DROP TABLE reviews");
      await tx.execute("ALTER TABLE reviews_guest_migration RENAME TO reviews");
    }

    for (const sql of [
      "CREATE INDEX IF NOT EXISTS orders_status_completed_idx ON orders(status, completed_at)",
      "CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id)",
      "CREATE INDEX IF NOT EXISTS orders_guest_idx ON orders(guest_token_hash)",
      "CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id)",
      "CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items(product_id)",
      "CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id)",
      "CREATE UNIQUE INDEX IF NOT EXISTS reviews_guest_product_idx ON reviews(guest_token_hash, product_id)",
    ]) await tx.execute(sql);

    const after = await tx.execute("SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM order_items) AS items, (SELECT count(*) FROM reviews) AS reviews");
    if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) throw new Error("Row counts changed; migration rolled back.");
    const foreignKeys = await tx.execute("PRAGMA foreign_key_check");
    if (foreignKeys.rows.length) throw new Error("Foreign key check failed; migration rolled back.");
    await tx.execute({ sql: "INSERT INTO app_migrations (id) VALUES (?)", args: [GUEST_CHECKOUT_MIGRATION] });
    await tx.commit();
    return { changed: true, version: GUEST_CHECKOUT_MIGRATION };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
