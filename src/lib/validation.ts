import { z } from "zod";
import { CUSTOMER_TYPES } from "@/db/schema";

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
