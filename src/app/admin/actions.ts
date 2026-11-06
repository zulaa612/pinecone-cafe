"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { clearStaffSession, createStaffSession } from "./session";

export async function signInStaff(_state: { error: string }, formData: FormData) {
  const supplied = String(formData.get("password") ?? "");
  const configured = process.env.ADMIN_PASSWORD || "pinecone";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (supplied.length > 256 || !timingSafeEqual(digest(supplied), digest(configured))) {
    return { error: "That access code doesn’t match. Please try again." };
  }
  await createStaffSession();
  redirect("/admin");
}

export async function signOutStaff() {
  await clearStaffSession();
  redirect("/admin");
}
