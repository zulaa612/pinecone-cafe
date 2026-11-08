import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function verifyCredentials(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  dummyHash ??= bcrypt.hash("unused-placeholder", 12);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
  return ok && user ? user : null;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
