import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { isMongoDatabase } from "@/db/config";
import { getMongoCollections } from "@/db/mongodb";
import { users } from "@/db/schema";

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function verifyCredentials(email: string, password: string) {
  const user = isMongoDatabase()
    ? await (await getMongoCollections()).users.findOne({ email })
    : (await db.select().from(users).where(eq(users.email, email)))[0];
  dummyHash ??= bcrypt.hash("unused-placeholder", 12);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
  return ok && user ? user : null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
