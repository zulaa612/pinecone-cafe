import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { orderSchema } from "../src/lib/validation";
import { computePricing } from "../src/lib/pricing";
import { migrateGuestCheckout } from "./lib/guest-checkout-migration";
import { migrateWirePayments } from "./lib/wire-payments-migration";

test("checkout requires name, class and a valid role for both students and teachers", () => {
  const item = { productId: "coffee", quantity: 1 };
  for (const customerType of ["student", "teacher"] as const) {
    assert.equal(
      orderSchema.safeParse({
        customerName: "Guest Name",
        classGrade: " ",
        customerType,
        items: [item],
      }).success,
      false,
    );
    assert.equal(
      orderSchema.safeParse({
        customerName: "Guest Name",
        classGrade: "Grade 8",
        customerType,
        items: [item],
      }).success,
      true,
    );
  }
  assert.equal(
    orderSchema.safeParse({
      customerName: " ",
      classGrade: "Grade 8",
      customerType: "teacher",
      items: [item],
    }).success,
    false,
  );
  assert.equal(
    orderSchema.safeParse({
      customerName: "Guest Name",
      classGrade: "Grade 8",
      items: [item],
    }).success,
    false,
  );
  assert.equal(
    orderSchema.safeParse({
      customerName: "Guest Name",
      classGrade: "Grade 8",
      customerType: "admin",
      items: [item],
    }).success,
    false,
  );
  assert.deepEqual(computePricing(1001, "teacher"), {
    subtotalCents: 1001,
    discountCents: 501,
    totalCents: 500,
  });
  assert.deepEqual(computePricing(1001, "student"), {
    subtotalCents: 1001,
    discountCents: 1,
    totalCents: 1000,
  });
  assert.deepEqual(computePricing(100100, "teacher"), {
    subtotalCents: 100100,
    discountCents: 50000,
    totalCents: 50100,
  });
  assert.deepEqual(computePricing(0, "student"), {
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
  });
});

async function verifyLegacyMigration(paymentsFirst: boolean) {
  const client = createClient({ url: ":memory:" });
  try {
    await client.execute("PRAGMA foreign_keys = ON");
    await client.batch(
      [
        "CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', customer_type TEXT NOT NULL DEFAULT 'student', last_quote_id TEXT, created_at TEXT NOT NULL DEFAULT 'legacy-date')",
        "CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', available INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT 'legacy-date')",
        "CREATE TABLE orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), customer_name TEXT NOT NULL, customer_type TEXT NOT NULL, class_grade TEXT, location TEXT, status TEXT NOT NULL DEFAULT 'pending', subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT 'legacy-date', completed_at TEXT)",
        "CREATE TABLE order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT REFERENCES products(id) ON DELETE SET NULL, name TEXT NOT NULL, unit_price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL)",
        "CREATE TABLE reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT 'legacy-date')",
        "INSERT INTO users (id, name, email, password_hash) VALUES ('legacy-user', 'Legacy User', 'legacy@example.test', 'retained-hash')",
        "INSERT INTO products (id, name, price_cents, category) VALUES ('coffee', 'Coffee', 1001, 'Coffee')",
        "INSERT INTO orders (id, user_id, customer_name, customer_type, class_grade, subtotal_cents, total_cents) VALUES ('PP-LEGACY', 'legacy-user', 'Legacy User', 'student', 'Grade 8', 1001, 1001)",
        "INSERT INTO order_items VALUES ('legacy-item', 'PP-LEGACY', 'coffee', 'Coffee snapshot', 1001, 1)",
        "INSERT INTO reviews (id, product_id, user_id, rating, comment) VALUES ('legacy-review', 'coffee', 'legacy-user', 5, 'Original review')",
      ],
      "write",
    );

    if (paymentsFirst) {
      await migrateWirePayments(client);
      await client.execute("INSERT INTO order_payments (order_id, amount_mnt, currency, status, attempt, provider_intent_id, checkout_session_id, checkout_url, paid_at, created_at) VALUES ('PP-LEGACY', 1001, 'MNT', 'paid', 2, 'pi_legacy', 'cs_legacy', 'https://example.test/checkout', 'paid-date', 'payment-date')");
      await client.execute("INSERT INTO wire_webhook_events (id, processed_at) VALUES ('evt_legacy', 'processed-date')");
    }
    const payments = paymentsFirst ? (await client.execute("SELECT * FROM order_payments")).rows : [];
    const paymentSchema = paymentsFirst ? (await client.execute("SELECT name, sql FROM sqlite_master WHERE tbl_name = 'order_payments' ORDER BY name")).rows : [];
    const legacy = await client.execute("SELECT * FROM orders");
    if (paymentsFirst) {
      // Fail at the final migration marker to verify that the entire rebuild,
      // including cascaded payments and temporary copies, rolls back together.
      await client.execute("CREATE TABLE app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT 'test-date')");
      await client.execute("CREATE TRIGGER reject_guest_migration BEFORE INSERT ON app_migrations BEGIN SELECT RAISE(ABORT, 'forced migration failure'); END");
      await assert.rejects(migrateGuestCheckout(client), /forced migration failure/);
      assert.deepEqual((await client.execute("SELECT * FROM orders")).rows, legacy.rows);
      assert.deepEqual((await client.execute("SELECT * FROM order_payments")).rows, payments);
      assert.deepEqual((await client.execute("SELECT name, sql FROM sqlite_master WHERE tbl_name = 'order_payments' ORDER BY name")).rows, paymentSchema);
      assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_guest_migration'")).rows.length, 0);
      assert.equal((await client.execute("SELECT * FROM app_migrations")).rows.length, 0);
      assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
      await client.execute("DROP TRIGGER reject_guest_migration");
    }
    assert.equal((await migrateGuestCheckout(client)).changed, true);
    const migrated = await client.execute(
      "SELECT * FROM orders WHERE id = 'PP-LEGACY'",
    );
    const { guest_token_hash, ...oldColumns } = migrated.rows[0];
    assert.equal(guest_token_hash, null);
    assert.deepEqual(oldColumns, legacy.rows[0]);
    assert.equal(
      (await client.execute("SELECT password_hash FROM users")).rows[0]
        .password_hash,
      "retained-hash",
    );
    assert.equal(
      (await client.execute("SELECT name FROM order_items")).rows[0].name,
      "Coffee snapshot",
    );
    assert.equal(
      (await client.execute("SELECT comment FROM reviews")).rows[0].comment,
      "Original review",
    );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_list(order_items)")).rows.some(
        (row) => row.table === "orders" && row.on_delete === "CASCADE",
      ),
      true,
    );
    if (paymentsFirst) {
      assert.deepEqual((await client.execute("SELECT * FROM order_payments")).rows, payments);
      assert.deepEqual((await client.execute("SELECT name, sql FROM sqlite_master WHERE tbl_name = 'order_payments' ORDER BY name")).rows, paymentSchema);
      assert.equal((await client.execute("SELECT processed_at FROM wire_webhook_events WHERE id = 'evt_legacy'")).rows[0].processed_at, "processed-date");
      assert.equal((await client.execute("PRAGMA foreign_key_list(order_payments)")).rows.some(row => row.table === "orders" && row.on_delete === "CASCADE"), true);
      await assert.rejects(client.execute("INSERT INTO order_payments (order_id, amount_mnt) VALUES ('missing-order', 1001)"), /FOREIGN KEY constraint failed/);
    }

    const db = drizzle(client, { schema });
    await db.insert(schema.orders).values({
      id: "PP GUEST A",
      guestTokenHash: "browser-a-hash",
      customerName: "Teacher Guest",
      customerType: "teacher",
      classGrade: "Grade 8",
      ...computePricing(1001, "teacher"),
    });
    await db.insert(schema.orders).values({
      id: "PP GUEST B",
      guestTokenHash: "browser-b-hash",
      customerName: "Student Guest",
      customerType: "student",
      classGrade: "Grade 9",
      ...computePricing(1001, "student"),
    });
    if (paymentsFirst) {
      await assert.rejects(client.execute("INSERT INTO order_payments (order_id, amount_mnt, provider_intent_id) VALUES ('PP GUEST A', 500, 'pi_legacy')"), /UNIQUE constraint failed/);
      await client.execute("INSERT INTO order_payments (order_id, amount_mnt) VALUES ('PP GUEST A', 500)");
    }
    await db.insert(schema.orderItems).values({
      orderId: "PP GUEST A",
      productId: "coffee",
      name: "Coffee",
      unitPriceCents: 1001,
      quantity: 1,
    });
    const owned = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.guestTokenHash, "browser-a-hash"));
    assert.deepEqual(
      owned.map((order) => order.id),
      ["PP GUEST A"],
    );
    assert.equal(owned[0].userId, null);
    assert.equal(owned[0].totalCents, 500);

    const review = {
      productId: "coffee",
      guestTokenHash: "browser-a-hash",
      customerName: "Teacher Guest",
      rating: 4,
      comment: "Guest review",
    };
    await db.insert(schema.reviews).values(review);
    await db
      .insert(schema.reviews)
      .values({ ...review, rating: 5 })
      .onConflictDoUpdate({
        target: [schema.reviews.guestTokenHash, schema.reviews.productId],
        set: { rating: 5 },
      });
    const guestReviews = await db
      .select()
      .from(schema.reviews)
      .where(
        and(
          eq(schema.reviews.guestTokenHash, "browser-a-hash"),
          eq(schema.reviews.productId, "coffee"),
        ),
      );
    assert.equal(guestReviews.length, 1);
    assert.equal(guestReviews[0].rating, 5);
    assert.equal((await migrateGuestCheckout(client)).changed, false);
    if (paymentsFirst) {
      assert.deepEqual((await client.execute("SELECT * FROM order_payments WHERE order_id = 'PP-LEGACY'")).rows, payments);
    }
    assert.equal(
      (await client.execute("SELECT count(*) AS count FROM orders")).rows[0]
        .count,
      3,
    );
    await db.delete(schema.orders).where(eq(schema.orders.id, "PP GUEST A"));
    if (paymentsFirst) {
      assert.deepEqual((await client.execute("SELECT * FROM order_payments")).rows, payments);
    }
    assert.equal(
      (
        await db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, "PP GUEST A"))
      ).length,
      0,
    );
    assert.equal(
      (
        await client.execute(
          "SELECT count(*) AS count FROM order_items WHERE id = 'legacy-item'",
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
  } finally {
    client.close();
  }
}

for (const paymentsFirst of [false, true]) {
  test(`legacy migration preserves rows, supports guests, isolates ownership and remains idempotent (${paymentsFirst ? "payments already migrated" : "without payments"})`, () => verifyLegacyMigration(paymentsFirst));
}
