import type { CustomerType } from "@/db/schema";

/** Teachers get half off automatically; students pay the listed price. */
export const TEACHER_DISCOUNT_RATE = 0.5;

/**
 * Pure and integer-cent based. The server calls this when placing an order and
 * is the only source of truth; the client uses it purely to preview totals.
 */
export function computePricing(subtotalCents: number, customerType: CustomerType) {
  const discountCents = customerType === "teacher" ? Math.round(subtotalCents * TEACHER_DISCOUNT_RATE) : 0;
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}
