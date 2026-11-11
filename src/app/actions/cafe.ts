"use server";

import { randomInt } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { isMongoDatabase } from "@/db/config";
import {
  isMongoDuplicateKey, mongoCreateProduct, mongoDeleteProduct, mongoDeleteReview,
  mongoFindPayment, mongoFindProduct, mongoFindProducts, mongoInsertOrder,
  mongoReviewPurchase, mongoUpdateOrderStatus, mongoUpdateProduct, mongoUpsertReview,
} from "@/db/mongo-store";
import { orderItems, orderPayments, orders, products, reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/cafe";
import { getT, issueMessage } from "@/lib/i18n-server";
import { toCents } from "@/lib/cafe";
import { computePricing } from "@/lib/pricing";
import { persistGuestIdentity, prepareGuestIdentity, readGuestTokenHash } from "@/lib/guest";
import { removeUpload, resolveImage } from "@/lib/uploads";
import { orderSchema, orderStatusSchema, productSchema, reviewSchema } from "@/lib/validation";
import { checkoutSettings, paymentService } from "@/lib/payments/server";
import { wireAmount } from "@/lib/payments/wire-core";


/** Re-checks the session and role on every call; never trust that the UI hid a button. */
async function adminOrError() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

// ---------- Products (admin) ----------

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const image = await resolveImage(parsed.data.image);
  if (!image.ok) return { ok: false, error: (await getT())(image.error) };
  const { price, ...rest } = parsed.data;
  if (isMongoDatabase()) {
    const id = await mongoCreateProduct({ ...rest, image: image.url, priceCents: toCents(price) });
    return { ok: true, id };
  }
  const [row] = await db.insert(products).values({ ...rest, image: image.url, priceCents: toCents(price) }).returning({ id: products.id });
  return { ok: true, id: row.id };
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const existing = isMongoDatabase()
    ? await mongoFindProduct(id)
    : (await db.select({ image: products.image }).from(products).where(eq(products.id, id)))[0];
  if (!existing) return { ok: false, error: (await getT())("err.productGone") };
  const image = await resolveImage(parsed.data.image);
  if (!image.ok) return { ok: false, error: (await getT())(image.error) };
  const { price, ...rest } = parsed.data;
  if (isMongoDatabase()) await mongoUpdateProduct(id, { ...rest, image: image.url, priceCents: toCents(price) });
  else await db.update(products).set({ ...rest, image: image.url, priceCents: toCents(price) }).where(eq(products.id, id));
  if (existing.image !== image.url) await removeUpload(existing.image);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  if (isMongoDatabase()) {
    const image = await mongoDeleteProduct(id);
    if (image !== null) await removeUpload(image);
    return { ok: true };
  }
  const [existing] = await db.select({ image: products.image }).from(products).where(eq(products.id, id));
  if (!existing) return { ok: true };
  // Order items keep their name/price snapshot (product_id is set null), so history survives.
  await db.delete(products).where(eq(products.id, id));
  await removeUpload(existing.image);
  return { ok: true };
}

// ---------- Orders ----------

export async function placeOrder(input: unknown): Promise<ActionResult<{ id: string; totalCents: number }>> {
  const t = await getT();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const { customerName, classGrade, customerType } = parsed.data;
  try { await checkoutSettings(); }
  catch { return { ok: false, error: t("err.paymentUnavailable") }; }

  // Merge duplicate lines, then price everything from the database.
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) quantities.set(item.productId, Math.min(99, (quantities.get(item.productId) ?? 0) + item.quantity));
  const found = isMongoDatabase()
    ? await mongoFindProducts([...quantities.keys()])
    : await db.select().from(products).where(inArray(products.id, [...quantities.keys()]));
  if (found.length !== quantities.size) return { ok: false, error: t("err.itemsGone") };
  const unavailable = found.find(p => !p.available);
  if (unavailable) return { ok: false, error: t("err.unavailable", { name: unavailable.name }) };

  const subtotalCents = found.reduce((sum, p) => sum + p.priceCents * (quantities.get(p.id) ?? 0), 0);
  // The selected checkout role controls pricing; submitted totals are never trusted.
  const pricing = computePricing(subtotalCents, customerType);
  let amountMnt: number;
  try { amountMnt = wireAmount(pricing.totalCents); }
  catch { return { ok: false, error: t("err.paymentAmount") }; }
  const guest = await prepareGuestIdentity();

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `PP-${randomInt(100000, 1000000)}`;
    try {
      const order = {
        id, guestTokenHash: guest.hash, customerName, customerType, classGrade,
        subtotalCents: pricing.subtotalCents, discountCents: pricing.discountCents, totalCents: pricing.totalCents,
      };
      if (isMongoDatabase()) await mongoInsertOrder(order, found, quantities, amountMnt);
      else await db.transaction(async tx => {
        await tx.insert(orders).values({
          ...order,
        });
        await tx.insert(orderItems).values(found.map(p => ({ orderId: id, productId: p.id, name: p.name, unitPriceCents: p.priceCents, quantity: quantities.get(p.id) ?? 0 })));
        await tx.insert(orderPayments).values({ orderId: id, amountMnt });
      });
    } catch (error) {
      if (!String(error).includes("UNIQUE") && !isMongoDuplicateKey(error)) return { ok: false, error: t("err.orderFailed") };
      continue;
    }
    // Browsing and invalid checkouts do not create a browser identity.
    await persistGuestIdentity(guest.token);
    return { ok: true, id, totalCents: pricing.totalCents };
  }
  return { ok: false, error: t("err.orderFailed") };
}

export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  const admin = await adminOrError();
  if (!admin) return { ok: false, error: (await getT())("err.adminRequired") };
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const { id, status } = parsed.data;
  const payment = isMongoDatabase()
    ? await mongoFindPayment(id)
    : await db.query.orderPayments.findFirst({ where: eq(orderPayments.orderId, id) });
  if (payment && status !== "cancelled" && payment.status !== "paid") {
    return { ok: false, error: (await getT())("err.paymentRequired") };
  }
  if (payment && status === "cancelled") {
    try { await paymentService().cancel(id, { user: admin, guestHash: null }); }
    catch { return { ok: false, error: (await getT())("err.paymentFailed") }; }
  }
  // completedAt drives the 7-day bestseller window, so keep it in sync with the status.
  if (isMongoDatabase()) {
    return await mongoUpdateOrderStatus(id, status) ? { ok: true } : { ok: false, error: (await getT())("err.orderNotFound") };
  }
  const result = await db.update(orders).set({ status, completedAt: status === "completed" ? new Date().toISOString() : null }).where(eq(orders.id, id)).returning({ id: orders.id });
  return result.length ? { ok: true } : { ok: false, error: (await getT())("err.orderNotFound") };
}

// ---------- Reviews ----------

export async function submitReview(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const { productId, rating, comment } = parsed.data;
  const product = isMongoDatabase()
    ? await mongoFindProduct(productId)
    : (await db.select({ id: products.id }).from(products).where(eq(products.id, productId)))[0];
  if (!product) return { ok: false, error: (await getT())("err.productGone") };
  const guestTokenHash = await readGuestTokenHash();
  if (!guestTokenHash) return { ok: false, error: (await getT())("err.orderToReview") };
  if (isMongoDatabase()) {
    const purchase = await mongoReviewPurchase(guestTokenHash, productId);
    if (!purchase) return { ok: false, error: (await getT())("err.orderToReview") };
    await mongoUpsertReview({ productId, guestTokenHash, customerName: purchase.customerName, rating, comment });
    return { ok: true };
  }
  // Identity comes exclusively from a purchased item's checkout, never a review form.
  const [purchase] = await db.select({ customerName: orders.customerName }).from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(orderPayments, eq(orderPayments.orderId, orders.id))
    .where(and(eq(orders.guestTokenHash, guestTokenHash), eq(orderItems.productId, productId), ne(orders.status, "cancelled"),
      or(isNull(orderPayments.orderId), eq(orderPayments.status, "paid"))))
    .orderBy(desc(orders.createdAt)).limit(1);
  if (!purchase) return { ok: false, error: (await getT())("err.orderToReview") };
  // The unique browser/product key also makes concurrent submissions update one review.
  await db.insert(reviews).values({ productId, guestTokenHash, customerName: purchase.customerName, rating, comment })
    .onConflictDoUpdate({
      target: [reviews.guestTokenHash, reviews.productId],
      set: { rating, comment, customerName: purchase.customerName, createdAt: new Date().toISOString() },
    });
  return { ok: true };
}

export async function deleteReview(id: string): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  if (isMongoDatabase()) await mongoDeleteReview(id);
  else await db.delete(reviews).where(eq(reviews.id, id));
  return { ok: true };
}
