"use server";

import { redirect } from "next/navigation";
import { verifyCredentials } from "@/lib/auth/credentials";
import { createSession, destroySession } from "@/lib/auth/session";
import { getT, issueMessage } from "@/lib/i18n-server";
import { loginSchema, translateFieldErrors, type FormState } from "@/lib/validation";

export async function signInStaff(_state: FormState, formData: FormData): Promise<FormState> {
  const t = await getT();
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return {
      error: issueMessage(t, parsed.error.issues[0]),
      fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, message => issueMessage(t, { message })),
    };
  }
  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  // Same message for unknown user, wrong password and non-admin so nothing is revealed.
  if (!user || user.role !== "admin") return { error: t("err.badAdminLogin") };
  await createSession(user.id);
  redirect("/admin");
}

export async function signOutStaff() {
  await destroySession();
  redirect("/admin");
}
