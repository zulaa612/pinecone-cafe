import "server-only";

import { randomUUID } from "node:crypto";
import {
  getMongoCollections,
  withMongoTransaction,
  type MongoOrder,
  type MongoOrderItem,
  type MongoPayment,
  type MongoProduct,
  type MongoReview,
} from "./mongodb";
import type { OrderStatus } from "./schema";

type ProductInput = Pick<MongoProduct, "name" | "description" | "priceCents" | "category" | "image" | "available" | "featured">;
type OrderInput = Pick<MongoOrder, "id" | "guestTokenHash" | "customerName" | "customerType" | "classGrade" | "subtotalCents" | "discountCents" | "totalCents">;

export function isMongoDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function mongoCreateProduct(input: ProductInput) {
  const collections = await getMongoCollections();
  const product: MongoProduct = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  await collections.products.insertOne(product);
  return product.id;
}

export async function mongoFindProduct(id: string) {
  return (await getMongoCollections()).products.findOne({ id }, { projection: { _id: 0 } });
}

export async function mongoFindProducts(ids: string[]) {
  return (await getMongoCollections()).products.find({ id: { $in: ids } }, { projection: { _id: 0 } }).toArray();
}

export async function mongoUpdateProduct(id: string, input: ProductInput) {
  await (await getMongoCollections()).products.updateOne({ id }, { $set: input });
}

/** Match SQLite's cascades while retaining every purchased name and price snapshot. */
export async function mongoDeleteProduct(id: string) {
  return withMongoTransaction(async (collections, session) => {
    const product = await collections.products.findOne({ id }, { session, projection: { image: 1 } });
    if (!product) return null;
    await collections.reviews.deleteMany({ productId: id }, { session });
    await collections.orderItems.updateMany({ productId: id }, { $set: { productId: null } }, { session });
    await collections.products.deleteOne({ id }, { session });
    return product.image;
  });
}

/** Commit the order, immutable item snapshots and initial payment ledger together. */
export async function mongoInsertOrder(input: OrderInput, found: MongoProduct[], quantities: Map<string, number>, amountMnt: number) {
  const createdAt = new Date().toISOString();
  const order: MongoOrder = {
    ...input, userId: null, location: null, status: "pending", completedAt: null, createdAt,
  };
  const items: MongoOrderItem[] = found.map(product => ({
    id: randomUUID(), orderId: input.id, productId: product.id, name: product.name,
    unitPriceCents: product.priceCents, quantity: quantities.get(product.id) ?? 0,
  }));
  const payment: MongoPayment = {
    orderId: input.id, amountMnt, currency: "MNT", status: "pending", attempt: 1,
    providerIntentId: null, checkoutSessionId: null, checkoutUrl: null, paidAt: null, createdAt,
  };
  await withMongoTransaction(async (collections, session) => {
    // A real product write makes concurrent deletion retry with the new item rows
    // in its snapshot. Read-only checks do not protect MongoDB references.
    const locked = await collections.products.updateMany(
      { id: { $in: found.map(product => product.id) }, available: true },
      { $inc: { _referenceVersion: 1 } },
      { session },
    );
    if (locked.matchedCount !== found.length) throw new Error("An ordered product is no longer available.");
    await collections.orders.insertOne(order, { session });
    await collections.orderItems.insertMany(items, { session });
    await collections.orderPayments.insertOne(payment, { session });
  });
}

export async function mongoFindPayment(orderId: string) {
  return (await getMongoCollections()).orderPayments.findOne({ orderId }, { projection: { _id: 0 } });
}

export async function mongoUpdateOrderStatus(id: string, status: OrderStatus) {
  const result = await (await getMongoCollections()).orders.updateOne({ id }, {
    $set: { status, completedAt: status === "completed" ? new Date().toISOString() : null },
  });
  return result.matchedCount > 0;
}

/** Review names come from the latest eligible purchase owned by the browser. */
export async function mongoReviewPurchase(guestTokenHash: string, productId: string) {
  const collections = await getMongoCollections();
  const purchases = await collections.orders.aggregate<{ customerName: string }>([
    { $match: { guestTokenHash, status: { $ne: "cancelled" } } },
    { $lookup: {
      from: collections.orderItems.collectionName,
      let: { orderId: "$id" },
      pipeline: [
        { $match: { productId, $expr: { $eq: ["$orderId", "$$orderId"] } } },
        { $limit: 1 },
      ],
      as: "items",
    } },
    { $match: { "items.0": { $exists: true } } },
    { $lookup: { from: collections.orderPayments.collectionName, localField: "id", foreignField: "orderId", as: "payment" } },
    { $match: { $or: [{ "payment.0": { $exists: false } }, { "payment.status": "paid" }] } },
    { $sort: { createdAt: -1 } },
    { $limit: 1 },
    { $project: { _id: 0, customerName: 1 } },
  ]).toArray();
  return purchases[0] ?? null;
}

export async function mongoUpsertReview(input: Pick<MongoReview, "productId" | "guestTokenHash" | "customerName" | "rating" | "comment">) {
  const filter = { productId: input.productId, guestTokenHash: input.guestTokenHash };
  const update = { $set: { ...input, createdAt: new Date().toISOString() }, $setOnInsert: { id: randomUUID(), userId: null } };
  const write = (upsert: boolean) => withMongoTransaction(async (collections, session) => {
    const product = await collections.products.updateOne(
      { id: input.productId }, { $inc: { _referenceVersion: 1 } }, { session },
    );
    if (!product.matchedCount) throw new Error("The reviewed product no longer exists.");
    return collections.reviews.updateOne(filter, update, { upsert, session });
  });
  try {
    await write(true);
  } catch (error) {
    // The unique guest/product index may choose another concurrent insert first.
    // A duplicate-key error aborts its transaction, so retry in a fresh one.
    if (!isMongoDuplicateKey(error)) throw error;
    if (!(await write(false)).matchedCount) throw error;
  }
}

export async function mongoDeleteReview(id: string) {
  await (await getMongoCollections()).reviews.deleteOne({ id });
}
