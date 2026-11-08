"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyCredentials } from "@/lib/auth/credentials";
import { createSession, destroySession } from "@/lib/auth/session";
import { getT, issueMessage } from "@/lib/i18n-server";
import { loginSchema, registerSchema, translateFieldErrors, type FormState } from "@/lib/validation";

export async function registerCustomer(_state: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: issueMessage(t, parsed.error.issues[0]),
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, message => issueMessage(t, { message })),
    };
  }
  const { name, email, password, customerType } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: t("err.emailInUse"), fieldErrors: { email: [t("err.emailInUse")] } };
  // Role is always "customer" here; admins can only be created by the seed script.
  const [created] = await db.insert(users).values({ name, email, passwordHash: await hashPassword(password), role: "customer", customerType }).returning({ id: users.id });
  await createSession(created.id);
  redirect("/");
}

export async function loginCustomer(_state: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: issueMessage(t, parsed.error.issues[0]),
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, message => issueMessage(t, { message })),
    };
  }
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return { error: t("err.badLogin") };
  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
