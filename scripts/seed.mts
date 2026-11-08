import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users } from "../src/db/schema";

// Run with: npm run db:seed (loads .env.local via --env-file)
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local before seeding.");
if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");

const db = drizzle(createClient({ url: process.env.DATABASE_URL ?? "file:./data/cafe.db" }));
const passwordHash = await bcrypt.hash(password, 12);
const [existing] = await db.select().from(users).where(eq(users.email, email));
if (existing) {
  await db.update(users).set({ passwordHash, role: "admin" }).where(eq(users.id, existing.id));
  console.log(`Updated admin account ${email}`);
} else {
  await db.insert(users).values({ name: process.env.ADMIN_NAME || "Café Admin", email, passwordHash, role: "admin" });
  console.log(`Created admin account ${email}`);
}
