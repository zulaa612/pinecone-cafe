import type { Category, CustomerType, OrderStatus, Role } from "@/db/schema";

export type { Category, CustomerType, OrderStatus, Role };

/** Client-facing shapes. Money is in dollars here; the database stores integer cents. */
export type Product = {
  id: string; name: string; category: Category; price: number; description: string; image: string;
  available: boolean; featured: boolean; rating: number; reviewCount: number; badge?: string;
};
export type OrderItem = { productId: string | null; name: string; unitPrice: number; quantity: number };
export type Order = {
  id: string; customerName: string; customerEmail: string; customerType: CustomerType;
  classGrade: string | null; location: string | null; status: OrderStatus;
  subtotal: number; discount: number; total: number; createdAt: string; items: OrderItem[];
};
export type Review = { id: string; productId: string; productName: string; name: string; rating: number; comment: string; date: string };
export type CartItem = { productId: string; quantity: number };
export type AppUser = { id: string; name: string; email: string; role: Role; customerType: CustomerType };
export type CafeState = { user: AppUser | null; products: Product[]; orders: Order[]; reviews: Review[] };
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
export const toCents = (dollars: number) => Math.round(dollars * 100);
