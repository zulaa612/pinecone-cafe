"use server";

import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import type { ActionResult } from "@/lib/cafe";
import { getT, issueMessage } from "@/lib/i18n-server";
import { toCents } from "@/lib/cafe";
import { computePricing } from "@/lib/pricing";
import { removeUpload, resolveImage } from "@/lib/uploads";
import { orderSchema, orderStatusSchema, productSchema, reviewSchema } from "@/lib/validation";


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
  const [row] = await db.insert(products).values({ ...rest, image: image.url, priceCents: toCents(price) }).returning({ id: products.id });
  return { ok: true, id: row.id };
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const [existing] = await db.select({ image: products.image }).from(products).where(eq(products.id, id));
  if (!existing) return { ok: false, error: (await getT())("err.productGone") };
  const image = await resolveImage(parsed.data.image);
  if (!image.ok) return { ok: false, error: (await getT())(image.error) };
  const { price, ...rest } = parsed.data;
  await db.update(products).set({ ...rest, image: image.url, priceCents: toCents(price) }).where(eq(products.id, id));
  if (existing.image !== image.url) await removeUpload(existing.image);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
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
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: t("err.signInToOrder") };
  if (user.role !== "customer") return { ok: false, error: t("err.staffNoOrder") };
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const { customerName, classGrade, location } = parsed.data;

  // Role decides which details are required. The role comes from the database, not the client.
  if (user.customerType === "student" && !classGrade) return { ok: false, error: t("err.classRequired") };
  if (user.customerType === "teacher" && !location) return { ok: false, error: t("err.locationRequired") };

  // Merge duplicate lines, then price everything from the database.
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) quantities.set(item.productId, Math.min(99, (quantities.get(item.productId) ?? 0) + item.quantity));
  const found = await db.select().from(products).where(inArray(products.id, [...quantities.keys()]));
  if (found.length !== quantities.size) return { ok: false, error: t("err.itemsGone") };
  const unavailable = found.find(p => !p.available);
  if (unavailable) return { ok: false, error: t("err.unavailable", { name: unavailable.name }) };

  const subtotalCents = found.reduce((sum, p) => sum + p.priceCents * (quantities.get(p.id) ?? 0), 0);
  const pricing = computePricing(subtotalCents, user.customerType);

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `PP-${randomInt(100000, 1000000)}`;
    try {
      await db.transaction(async tx => {
        await tx.insert(orders).values({
          id, userId: user.id, customerName, customerType: user.customerType,
          classGrade: user.customerType === "student" ? classGrade : null,
          location: user.customerType === "teacher" ? location : null,
          subtotalCents: pricing.subtotalCents, discountCents: pricing.discountCents, totalCents: pricing.totalCents,
        });
        await tx.insert(orderItems).values(found.map(p => ({ orderId: id, productId: p.id, name: p.name, unitPriceCents: p.priceCents, quantity: quantities.get(p.id) ?? 0 })));
      });
      return { ok: true, id, totalCents: pricing.totalCents };
    } catch (error) {
      if (!String(error).includes("UNIQUE")) return { ok: false, error: t("err.orderFailed") };
    }
  }
  return { ok: false, error: t("err.orderFailed") };
}

export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const { id, status } = parsed.data;
  // completedAt drives the 7-day bestseller window, so keep it in sync with the status.
  const result = await db.update(orders).set({ status, completedAt: status === "completed" ? new Date().toISOString() : null }).where(eq(orders.id, id)).returning({ id: orders.id });
  return result.length ? { ok: true } : { ok: false, error: (await getT())("err.orderNotFound") };
}

// ---------- Reviews ----------

export async function submitReview(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: (await getT())("err.signInToReview") };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: issueMessage(await getT(), parsed.error.issues[0]) };
  const { productId, rating, comment } = parsed.data;
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
  if (!product) return { ok: false, error: (await getT())("err.productGone") };
  // One review per customer per product: submitting again updates it, which keeps averages honest.
  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.userId, user.id)));
  if (existing) await db.update(reviews).set({ rating, comment, createdAt: new Date().toISOString() }).where(eq(reviews.id, existing.id));
  else await db.insert(reviews).values({ productId, userId: user.id, rating, comment });
  return { ok: true };
}

export async function deleteReview(id: string): Promise<ActionResult> {
  if (!(await adminOrError())) return { ok: false, error: (await getT())("err.adminRequired") };
  await db.delete(reviews).where(eq(reviews.id, id));
  return { ok: true };
}
