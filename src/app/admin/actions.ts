"use server";

import { redirect } from "next/navigation";
import { verifyCredentials } from "@/lib/auth/credentials";
import { createSession, destroySession } from "@/lib/auth/session";
import { loginSchema, type FormState } from "@/lib/validation";

const INVALID = "That email or password doesn’t match an admin account.";

export async function signInStaff(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? INVALID, fieldErrors: parsed.error.flatten().fieldErrors };
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  // Same message for unknown user, wrong password and non-admin so nothing is revealed.
  if (!user || user.role !== "admin") return { error: INVALID };
  await createSession(user.id);
  redirect("/admin");
}

export async function signOutStaff() {
  await destroySession();
  redirect("/admin");
}
