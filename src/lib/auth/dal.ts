import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { isMongoDatabase } from "@/db/config";
import { getMongoCollections } from "@/db/mongodb";
import { users, type CustomerType, type Role } from "@/db/schema";
import { readSessionUserId } from "./session";

export type SessionUser = { id: string; name: string; email: string; role: Role; customerType: CustomerType };

/**
 * Data access layer: the single place that turns a session cookie into a user.
 * Always re-reads the role from the database so demotions take effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  if (isMongoDatabase()) {
    const user = await (await getMongoCollections()).users.findOne({ id: userId }, {
      projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, customerType: 1 },
    });
    return user ? { id: user.id, name: user.name, email: user.email, role: user.role, customerType: user.customerType } : null;
  }
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, customerType: users.customerType })
    .from(users)
    .where(eq(users.id, userId));
  return user ?? null;
});

/** Admin-only gate. Signed-out users go to the admin sign-in; non-admins go home. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}
