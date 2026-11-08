import "server-only";

import { desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, reviews, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import type { CafeState, Order, Product, Review } from "@/lib/cafe";
import { readGuestTokenHash } from "@/lib/guest";

const dollars = (cents: number) => cents / 100;

export async function getProducts(): Promise<Product[]> {
  const rows = await db
    .select({
      id: products.id, name: products.name, category: products.category, priceCents: products.priceCents,
      description: products.description, image: products.image, available: products.available, featured: products.featured,
      avg: sql<number | null>`avg(${reviews.rating})`, count: sql<number>`count(${reviews.id})`,
    })
    .from(products)
    .leftJoin(reviews, eq(reviews.productId, products.id))
    .groupBy(products.id)
    .orderBy(products.createdAt);
  return rows.map(({ priceCents, avg, count, ...p }) => ({
    ...p, price: dollars(priceCents), rating: avg ? Math.round(avg * 10) / 10 : 0, reviewCount: Number(count),
  }));
}

export async function getReviews(): Promise<Review[]> {
  const rows = await db
    .select({ id: reviews.id, productId: reviews.productId, productName: products.name, name: sql<string>`coalesce(${reviews.customerName}, ${users.name}, 'Guest')`, rating: reviews.rating, comment: reviews.comment, date: reviews.createdAt })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .leftJoin(users, eq(users.id, reviews.userId))
    .orderBy(desc(reviews.createdAt))
    .limit(200);
  return rows;
}

/** Admins see all orders; other callers see only their checkout browser and legacy account orders. */
export async function getOrders(user: SessionUser | null): Promise<Order[]> {
  const guestTokenHash = await readGuestTokenHash();
  const ownership = or(
    guestTokenHash ? eq(orders.guestTokenHash, guestTokenHash) : undefined,
    user?.role === "customer" ? eq(orders.userId, user.id) : undefined,
  );
  if (user?.role !== "admin" && !ownership) return [];
  const rows = await db.query.orders.findMany({
    where: user?.role === "admin" ? undefined : ownership,
    with: { items: true, user: { columns: { email: true } } },
    orderBy: desc(orders.createdAt),
    limit: 500,
  });
  return rows.map(o => ({
    id: o.id, customerName: o.customerName, customerEmail: o.user?.email ?? null, customerType: o.customerType,
    classGrade: o.classGrade, location: o.location, status: o.status,
    subtotal: dollars(o.subtotalCents), discount: dollars(o.discountCents), total: dollars(o.totalCents), createdAt: o.createdAt,
    items: o.items.map(i => ({ productId: i.productId, name: i.name, unitPrice: dollars(i.unitPriceCents), quantity: i.quantity })),
  }));
}

export async function getCafeState(user: SessionUser | null): Promise<CafeState> {
  const [productList, reviewList, orderList] = await Promise.all([getProducts(), getReviews(), getOrders(user)]);
  return { user, products: productList, reviews: reviewList, orders: orderList };
}
