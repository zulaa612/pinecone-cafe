import type { CustomerType } from "@/db/schema";

/** Teachers get half off automatically; students pay the listed price. */
export const TEACHER_DISCOUNT_RATE = 0.5;

/**
 * Uses the existing hundredths-of-MNT storage. The server calls this when placing an order and
 * is the only source of truth; the client uses it purely to preview totals.
 */
export function computePricing(subtotalCents: number, customerType: CustomerType) {
  const discounted = customerType === "teacher" ? subtotalCents * (1 - TEACHER_DISCOUNT_RATE) : subtotalCents;
  // Wire accepts whole MNT only. Round once, after role pricing, on both client and server.
  const totalCents = Math.max(subtotalCents > 0 ? 100 : 0, Math.round(discounted / 100) * 100);
  return { subtotalCents, discountCents: subtotalCents - totalCents, totalCents };
}
