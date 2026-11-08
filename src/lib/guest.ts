import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pinecone_guest_orders";
const COOKIE_AGE = 60 * 60 * 24 * 365;

function validToken(token: string | undefined): token is string {
  return !!token && /^[a-f0-9]{64}$/.test(token);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Reading the storefront never creates a cookie or a customer identity. */
export async function readGuestTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return validToken(token) ? hashToken(token) : null;
}

/** Prepare ownership for checkout, then persist the cookie only after the order commits. */
export async function prepareGuestIdentity() {
  const existing = (await cookies()).get(COOKIE_NAME)?.value;
  const token = validToken(existing) ? existing : randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

export async function persistGuestIdentity(token: string) {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_AGE,
    path: "/",
  });
}
