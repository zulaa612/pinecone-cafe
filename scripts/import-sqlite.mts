import { existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { isMongoDatabase } from "../src/db/config";
import { closeMongoConnection, ensureMongoIndexes, getMongoClient, getMongoDatabase } from "../src/db/mongodb";
import * as schema from "../src/db/schema";

const marker = "sqlite-import-v1";
const sourceUrl = process.env.SQLITE_DATABASE_URL ?? "file:./data/cafe.db";
if (!isMongoDatabase()) throw new Error("Set DATABASE_URL to the destination MongoDB database before importing.");
if (!sourceUrl.startsWith("file:")) throw new Error("SQLITE_DATABASE_URL must identify a local SQLite file.");
if (!existsSync(sourceUrl.slice(5))) throw new Error("The source SQLite file does not exist.");
const client = createClient({ url: sourceUrl });

try {
  // Drizzle otherwise defaults to a write transaction; force a true read snapshot.
  const source = drizzle(new Proxy(client, {
    get(target, property) {
      if (property === "transaction") return () => target.transaction("read");
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }));
  const records = await source.transaction(async tx => {
    await tx.run(sql`PRAGMA query_only = ON`);
    const integrity = await tx.all<{ integrity_check: string }>(sql`PRAGMA integrity_check`);
    const foreignKeys = await tx.all(sql`PRAGMA foreign_key_check`);
    if (integrity[0]?.integrity_check !== "ok" || foreignKeys.length) {
      throw new Error("The source SQLite integrity check failed; no data was imported.");
    }
    return {
      users: await tx.select().from(schema.users),
      products: await tx.select().from(schema.products),
      reviews: await tx.select().from(schema.reviews),
      orders: await tx.select().from(schema.orders),
      order_items: await tx.select().from(schema.orderItems),
      order_payments: await tx.select().from(schema.orderPayments),
      wire_webhook_events: await tx.select().from(schema.wireWebhookEvents),
    };
  });
  const counts = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, rows.length]));
  const target = await getMongoDatabase();
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ sourceCounts: counts, apply: false, instruction: "Add -- --apply to import into an empty MongoDB database." }, null, 2));
  } else {
    await ensureMongoIndexes();
    const mongo = await getMongoClient();
    const result = await mongo.withSession(session => session.withTransaction(async () => {
      const migrations = target.collection<{ _id: string; counts: Record<string, number>; importedAt: string }>("app_migrations");
      if (await migrations.findOne({ _id: marker }, { session })) return "already imported";
      for (const name of Object.keys(records)) {
        if (await target.collection(name).countDocuments({}, { session, limit: 1 })) {
          throw new Error("The destination contains app data; refusing to overwrite or merge records.");
        }
      }
      for (const [name, rows] of Object.entries(records)) {
        if (rows.length) await target.collection(name).insertMany(rows, { session });
      }
      for (const [name, rows] of Object.entries(records)) {
        if (await target.collection(name).countDocuments({}, { session }) !== rows.length) {
          throw new Error("Import count verification failed; transaction rolled back.");
        }
      }
      await migrations.insertOne({ _id: marker, counts, importedAt: new Date().toISOString() }, { session });
      return "imported";
    }));
    console.log(JSON.stringify({ result, counts, sourcePreserved: true }, null, 2));
  }
} catch (error) {
  const detail = error as { name?: string; code?: string | number };
  console.error(JSON.stringify({ imported: false, error: detail.name ?? "DatabaseError", code: detail.code ?? null }));
  process.exitCode = 1;
} finally {
  client.close();
  await closeMongoConnection();
}
