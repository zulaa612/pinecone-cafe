import type { db } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { orderPayments, orders, wireWebhookEvents } from "@/db/schema";
import { assertIntent, canAccessPayment, eventIntent, paymentStatus, WireClient, WireError } from "./wire-core";
import type { PaymentCheckout } from "@/lib/cafe";

type Database = typeof db;
type Payment = typeof orderPayments.$inferSelect;
type Identity = { guestHash: string | null; user: { id: string; role: string } | null };

/** Server callers supply the verified browser identity; totals always come from the ledger. */
export class PaymentService {
  constructor(private readonly database: Database, private readonly wire: WireClient) {}

  private async ownedOrder(id: string, identity: Identity) {
    const order = await this.database.query.orders.findFirst({ where: eq(orders.id, id), with: { payment: true } });
    if (!order || !canAccessPayment(order, identity.guestHash, identity.user)) throw new WireError("not_allowed");
    return order;
  }

  private async sync(payment: Payment) {
    if (!payment.providerIntentId || payment.status === "paid") return payment.status;
    const intent = await this.wire.getIntent(payment.providerIntentId);
    assertIntent(intent, { id: payment.providerIntentId, amountMnt: payment.amountMnt });
    const status = paymentStatus(intent);
    await this.database.update(orderPayments).set({ status, ...(status === "paid" ? { paidAt: new Date().toISOString() } : {}) })
      .where(and(eq(orderPayments.orderId, payment.orderId), eq(orderPayments.providerIntentId, intent.id), ne(orderPayments.status, "paid")));
    const current = await this.database.query.orderPayments.findFirst({ where: eq(orderPayments.orderId, payment.orderId) });
    return current?.status ?? status;
  }

  async check(id: string, identity: Identity) {
    const order = await this.ownedOrder(id, identity);
    return order.payment ? this.sync(order.payment) : "pay_at_collection" as const;
  }

  async start(id: string, identity: Identity, settings: { appUrl: string; operatorId: string }): Promise<PaymentCheckout> {
    const order = await this.ownedOrder(id, identity);
    if (order.status === "cancelled") throw new WireError("not_allowed");
    if (!order.payment) return { paymentStatus: "pay_at_collection", checkoutUrl: null };
    let payment = order.payment;
    if (payment.amountMnt * 100 !== order.totalCents || payment.currency !== "MNT") throw new WireError("payment_mismatch");
    const status = await this.sync(payment);
    if (status === "paid") return { paymentStatus: "paid", checkoutUrl: null };
    if (status === "canceled") {
      // Only one concurrent caller can advance a canceled attempt. All others reuse it.
      await this.database.update(orderPayments).set({ attempt: payment.attempt + 1, status: "pending",
        providerIntentId: null, checkoutSessionId: null, checkoutUrl: null })
        .where(and(eq(orderPayments.orderId, id), eq(orderPayments.attempt, payment.attempt), eq(orderPayments.status, "canceled")));
      const current = await this.database.query.orderPayments.findFirst({ where: eq(orderPayments.orderId, id) });
      if (!current) throw new WireError("not_allowed");
      payment = current;
    }
    if (payment.checkoutUrl) return { paymentStatus: "pending", checkoutUrl: payment.checkoutUrl };
    const key = `cafe:${id}:${payment.attempt}`;
    let intentId = payment.providerIntentId;
    if (!intentId) {
      const intent = await this.wire.createIntent(id, payment.amountMnt, settings.operatorId, `${key}:intent`);
      assertIntent(intent, { id: intent.id, amountMnt: payment.amountMnt });
      intentId = intent.id;
      const saved = await this.database.update(orderPayments).set({ providerIntentId: intentId })
        .where(and(eq(orderPayments.orderId, id), eq(orderPayments.attempt, payment.attempt), eq(orderPayments.status, "pending")))
        .returning({ id: orderPayments.orderId });
      if (!saved.length) throw new WireError("idempotency_in_flight");
    }
    const checkout = await this.wire.createCheckout(intentId, settings.appUrl, id, `${key}:checkout`);
    const saved = await this.database.update(orderPayments).set({ checkoutSessionId: checkout.id, checkoutUrl: checkout.url })
      .where(and(eq(orderPayments.orderId, id), eq(orderPayments.providerIntentId, intentId), eq(orderPayments.attempt, payment.attempt)))
      .returning({ id: orderPayments.orderId });
    if (!saved.length) throw new WireError("idempotency_in_flight");
    return { paymentStatus: "pending", checkoutUrl: checkout.url };
  }

  async cancel(id: string, identity: Identity) {
    const order = await this.ownedOrder(id, identity);
    if (!order.payment) return;
    if (order.payment.status === "paid") throw new WireError("already_paid");
    if (order.payment.providerIntentId) {
      const intent = await this.wire.cancelIntent(order.payment.providerIntentId, `cafe:${id}:${order.payment.attempt}:cancel`);
      assertIntent(intent, { id: order.payment.providerIntentId, amountMnt: order.payment.amountMnt });
      if (intent.status !== "canceled") throw new WireError("already_paid");
    }
    await this.database.update(orderPayments).set({ status: "canceled" }).where(and(eq(orderPayments.orderId, id), ne(orderPayments.status, "paid")));
  }

  async acceptEvent(event: { id: string; type: string; data?: unknown }) {
    if (!["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type)) return;
    if (await this.database.query.wireWebhookEvents.findFirst({ where: eq(wireWebhookEvents.id, event.id) })) return;
    const snapshot = eventIntent(event.data);
    const payment = await this.database.query.orderPayments.findFirst({ where: eq(orderPayments.providerIntentId, snapshot.id) });
    if (!payment) return; // Other payments in the same Wire project do not belong to this app.
    assertIntent(snapshot, { id: payment.providerIntentId!, amountMnt: payment.amountMnt });
    // Re-fetch rather than trusting delivery order or a success redirect.
    const intent = await this.wire.getIntent(snapshot.id);
    assertIntent(intent, { id: snapshot.id, amountMnt: payment.amountMnt });
    const status = paymentStatus(intent);
    await this.database.transaction(async tx => {
      const recorded = await tx.insert(wireWebhookEvents).values({ id: event.id }).onConflictDoNothing().returning({ id: wireWebhookEvents.id });
      if (!recorded.length) return;
      await tx.update(orderPayments).set({ status, ...(status === "paid" ? { paidAt: new Date().toISOString() } : {}) })
        .where(and(eq(orderPayments.orderId, payment.orderId), eq(orderPayments.providerIntentId, intent.id), ne(orderPayments.status, "paid")));
    });
  }
}
