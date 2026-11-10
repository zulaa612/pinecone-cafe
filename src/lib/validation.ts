import { z } from "zod";
import { CATEGORIES, CUSTOMER_TYPES, ORDER_STATUSES } from "@/db/schema";

/**
 * Shared by client forms and server actions so both enforce the same rules.
 * Messages are translation keys (see src/locales/common.ts); the server translates
 * them with the visitor's language via issueMessage().
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("err.email").max(254, "err.email"),
  password: z.string().min(1, "err.passwordRequired").max(256, "err.invalid"),
});

/** Field errors are already translated by the server. */
export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export const productSchema = z.object({
  name: z.string().trim().min(2, "err.productName").max(70, "err.productName"),
  description: z.string().trim().min(1, "err.description").max(240, "err.description"),
  price: z.number({ message: "err.price" }).int("err.price").min(1, "err.priceMin").max(1_000_000_000, "err.price"),
  category: z.enum(CATEGORIES, { message: "err.category" }),
  image: z.string().max(2_000_000, "err.imageSize"),
  available: z.boolean(),
  featured: z.boolean().default(false),
});

export const orderSchema = z.object({
  customerName: z.string().trim().min(2, "err.name").max(80, "err.name"),
  classGrade: z.string().trim().min(1, "err.classRequired").max(30, "err.invalid"),
  customerType: z.enum(CUSTOMER_TYPES, { message: "err.role" }),
  items: z.array(z.object({
    productId: z.string().min(1, "err.invalid"),
    quantity: z.number().int("err.invalid").min(1, "err.invalid").max(99, "err.invalid"),
  })).min(1, "err.bagEmpty").max(50, "err.invalid"),
});

export const orderStatusSchema = z.object({ id: z.string().min(1, "err.invalid").max(40, "err.invalid"), status: z.enum(ORDER_STATUSES, { message: "err.statusInvalid" }) });

export const reviewSchema = z.object({
  productId: z.string().min(1, "err.chooseProduct"),
  rating: z.number().int("err.rating").min(1, "err.rating").max(5, "err.rating"),
  comment: z.string().trim().min(5, "err.commentMin").max(1000, "err.commentMin"),
});

/** Maps zod's flattened field errors to translated strings. */
export function translateFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  translate: (message: string) => string,
): Record<string, string[] | undefined> {
  return Object.fromEntries(Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.map(translate)]));
}
