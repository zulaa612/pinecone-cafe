import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDatabaseUrl, isMongoDatabase } from "../src/db/config";
import { closeMongoConnection, getMongoCollections } from "../src/db/mongodb";
import { users } from "../src/db/schema";

// Run with: npm run db:seed (loads .env.local via --env-file)
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local before seeding.");
if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");

const passwordHash = await bcrypt.hash(password, 12);
if (isMongoDatabase()) {
  try {
    const c = await getMongoCollections();
    await c.users.updateOne({ email }, {
      $set: { passwordHash, role: "admin" },
      $setOnInsert: { id: randomUUID(), email, name: process.env.ADMIN_NAME || "Cafe Admin",
        customerType: "student", lastQuoteId: null, createdAt: new Date().toISOString() },
    }, { upsert: true });
    console.log("MongoDB staff account is ready.");
  } finally { await closeMongoConnection(); }
} else {
  const client = createClient({ url: getDatabaseUrl() });
  try {
    const db = drizzle(client);
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      await db.update(users).set({ passwordHash, role: "admin" }).where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({ name: process.env.ADMIN_NAME || "Cafe Admin", email, passwordHash, role: "admin" });
    }
    console.log("SQLite staff account is ready.");
  } finally { client.close(); }
}
