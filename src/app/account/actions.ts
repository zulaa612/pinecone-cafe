"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { CUSTOMER_TYPES, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/cafe";
import { getT, issueMessage } from "@/lib/i18n-server";

const roleSchema = z.object({ customerType: z.enum(CUSTOMER_TYPES, { message: "err.role" }) });

/**
 * Students and teachers switch roles themselves; the teacher 50% discount needs no approval.
 * Orders snapshot the role at checkout, so changing it never rewrites past orders.
 */
export async function setCustomerType(input: unknown): Promise<ActionResult> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("err.signIn") };
  if (user.role !== "customer") return { ok: false, error: t("err.customersOnly") };
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(t, parsed.error.issues[0]) };
  await db.update(users).set({ customerType: parsed.data.customerType }).where(eq(users.id, user.id));
  return { ok: true };
}
