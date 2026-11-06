import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

const COOKIE_NAME = "pinecone_staff";
const SESSION_AGE = 60 * 60 * 8;
const sessionGlobal = globalThis as typeof globalThis & { __pineconeAdminKey?: string };

function signingKey() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  sessionGlobal.__pineconeAdminKey ??= randomBytes(32).toString("hex");
  return sessionGlobal.__pineconeAdminKey;
}

function signature(value: string) {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

export async function isStaffAuthenticated() {
  await connection();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [payload, signed, extra] = token.split(".");
  if (!payload || !signed || extra) return false;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(signed);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as { role?: string; expires?: number };
    return session.role === "staff" && typeof session.expires === "number" && session.expires > Date.now();
  } catch {
    return false;
  }
}

export async function createStaffSession() {
  const payload = Buffer.from(JSON.stringify({ role: "staff", expires: Date.now() + SESSION_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE_NAME, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_AGE,
    path: "/",
  });
}

export async function clearStaffSession() {
  (await cookies()).delete(COOKIE_NAME);
}
