import { z } from "zod";
import { CATEGORIES, CUSTOMER_TYPES, ORDER_STATUSES } from "@/db/schema";

/** Shared by client forms and server actions so both enforce the same rules. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(256),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters.").max(256),
  customerType: z.enum(CUSTOMER_TYPES, { message: "Choose Student or Teacher." }),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> };

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(70),
  description: z.string().trim().min(1, "Add a short description.").max(240),
  price: z.number({ message: "Enter a valid price." }).min(0.01, "Price must be at least 0.01.").max(9999),
  category: z.enum(CATEGORIES, { message: "Choose a category." }),
  image: z.string().max(2_000_000),
  available: z.boolean(),
  featured: z.boolean().default(false),
});

export const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your full name.").max(80),
  classGrade: z.string().trim().max(30).optional(),
  location: z.string().trim().max(100).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
  })).min(1, "Your bag is empty.").max(50),
});

export const orderStatusSchema = z.object({ id: z.string().min(1).max(40), status: z.enum(ORDER_STATUSES, { message: "Invalid status." }) });

export const reviewSchema = z.object({
  productId: z.string().min(1, "Choose a product."),
  rating: z.number().int().min(1, "Choose a rating.").max(5),
  comment: z.string().trim().min(5, "Write at least 5 characters.").max(1000),
});
