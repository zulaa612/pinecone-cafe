import type { Category, CustomerType, OrderStatus, Role } from "@/db/schema";

export type { Category, CustomerType, OrderStatus, Role };

/** Client-facing amounts are MNT; the database stores integer hundredths of a tugrug. */
export type Product = {
  id: string; name: string; category: Category; price: number; description: string; image: string;
  available: boolean; featured: boolean; rating: number; reviewCount: number; badge?: string;
};
export type OrderItem = { productId: string | null; name: string; unitPrice: number; quantity: number };
export type PaymentStatus = "pending" | "paid" | "canceled" | "pay_at_collection";
export type PaymentCheckout = { paymentStatus: PaymentStatus; checkoutUrl: string | null };
export type Order = {
  id: string; customerName: string; customerEmail: string | null; customerType: CustomerType;
  classGrade: string | null; location: string | null; status: OrderStatus; paymentStatus: PaymentStatus;
  subtotal: number; discount: number; total: number; createdAt: string; items: OrderItem[];
};
export type Review = { id: string; productId: string; productName: string; name: string; rating: number; comment: string; date: string };
export type CartItem = { productId: string; quantity: number };
export type AppUser = { id: string; name: string; email: string; role: Role; customerType: CustomerType };
export type CafeState = { user: AppUser | null; products: Product[]; orders: Order[]; reviews: Review[] };
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const CURRENCY = "MNT" as const;
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const money = (value: number) => moneyFormatter.formatToParts(value)
  .map(part => part.type === "currency" ? "₮" : part.value)
  .join("");

/** Preserve the database's scale of 100 minor MNT units per tugrug. */
export const toCents = (mnt: number) => Math.round(mnt * 100);
