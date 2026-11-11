import type { Filter } from "mongodb";
import { getMongoCollections, type MongoOrder, type MongoProduct, type MongoReview } from "./mongodb";
import type { SessionUser } from "../lib/auth/dal";
import type { Order, Product, Review } from "../lib/cafe";

export async function getMongoProducts(): Promise<Product[]> {
  const c = await getMongoCollections();
  const rows = await c.products.aggregate<MongoProduct & { stats: { average: number; count: number }[] }>([
    { $sort: { createdAt: 1 } },
    { $lookup: { from: "reviews", let: { product: "$id" }, pipeline: [
      { $match: { $expr: { $eq: ["$productId", "$$product"] } } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ], as: "stats" } },
  ]).toArray();
  return rows.map(p => ({
    id: p.id, name: p.name, category: p.category, description: p.description, image: p.image,
    available: p.available, featured: p.featured, price: p.priceCents / 100,
    rating: Math.round((p.stats[0]?.average ?? 0) * 10) / 10, reviewCount: p.stats[0]?.count ?? 0,
  }));
}

export async function getMongoReviews(): Promise<Review[]> {
  const c = await getMongoCollections();
  const rows = await c.reviews.aggregate<MongoReview & { product: { name: string }; legacyUser: { name: string }[] }>([
    { $sort: { createdAt: -1 } },
    { $lookup: { from: "products", localField: "productId", foreignField: "id", as: "product" } },
    { $unwind: "$product" },
    { $limit: 200 },
    { $lookup: { from: "users", localField: "userId", foreignField: "id", as: "legacyUser" } },
  ]).toArray();
  return rows.map(r => ({ id: r.id, productId: r.productId, productName: r.product.name,
    name: r.customerName ?? r.legacyUser[0]?.name ?? "Guest", rating: r.rating, comment: r.comment, date: r.createdAt }));
}

export async function getMongoOrders(user: SessionUser | null, guestHash: string | null): Promise<Order[]> {
  const ownership: Filter<MongoOrder>[] = [];
  if (guestHash) ownership.push({ guestTokenHash: guestHash });
  if (user?.role === "customer") ownership.push({ userId: user.id });
  if (user?.role !== "admin" && !ownership.length) return [];
  const c = await getMongoCollections();
  const rows = await c.orders.find(user?.role === "admin" ? {} : { $or: ownership }).sort({ createdAt: -1 }).limit(500).toArray();
  if (!rows.length) return [];
  const ids = rows.map(o => o.id);
  const userIds = rows.flatMap(o => o.userId ? [o.userId] : []);
  const [items, payments, users] = await Promise.all([
    c.orderItems.find({ orderId: { $in: ids } }).toArray(),
    c.orderPayments.find({ orderId: { $in: ids } }).toArray(),
    c.users.find({ id: { $in: userIds } }, { projection: { id: 1, email: 1 } }).toArray(),
  ]);
  const emailByUser = new Map(users.map(u => [u.id, u.email]));
  const paymentByOrder = new Map(payments.map(p => [p.orderId, p.status]));
  return rows.map(o => ({
    id: o.id, customerName: o.customerName, customerEmail: o.userId ? emailByUser.get(o.userId) ?? null : null,
    customerType: o.customerType, classGrade: o.classGrade, location: o.location, status: o.status,
    paymentStatus: paymentByOrder.get(o.id) ?? "pay_at_collection", subtotal: o.subtotalCents / 100,
    discount: o.discountCents / 100, total: o.totalCents / 100, createdAt: o.createdAt,
    items: items.filter(i => i.orderId === o.id).map(i => ({ productId: i.productId, name: i.name,
      unitPrice: i.unitPriceCents / 100, quantity: i.quantity })),
  }));
}
