import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

const COOKIE_NAME = "pinecone_session";
const SESSION_AGE = 60 * 60 * 24 * 7; // 7 days
const devKey = globalThis as typeof globalThis & { __pineconeSessionKey?: string };

function signingKey() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production.");
  devKey.__pineconeSessionKey ??= randomBytes(32).toString("hex");
  return devKey.__pineconeSessionKey;
}

function sign(value: string) {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

/** Returns the user id from a valid, unexpired session cookie, otherwise null. */
export async function readSessionUserId(): Promise<string | null> {
  // Expiry is compared with the current time, so this must run at request time, never during prerender.
  await connection();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid?: unknown; exp?: unknown };
    return typeof session.uid === "string" && typeof session.exp === "number" && session.exp > Date.now() ? session.uid : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_AGE,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}
