import { MongoServerError } from "mongodb";
import {
  getMongoCollections,
  withMongoTransaction,
  type MongoPayment,
} from "@/db/mongodb";
import type { PaymentCheckout } from "@/lib/cafe";
import {
  assertIntent,
  canAccessPayment,
  eventIntent,
  paymentStatus,
  WireClient,
  WireError,
} from "./wire-core";

type Identity = {
  guestHash: string | null;
  user: { id: string; role: string } | null;
};
type Storage = {
  collections: typeof getMongoCollections;
  transaction: typeof withMongoTransaction;
};

/** MongoDB ledger with the same ownership and provider checks as the SQL ledger. */
export class MongoPaymentService {
  constructor(
    private readonly wire: WireClient,
    private readonly storage: Storage = {
      collections: getMongoCollections,
      transaction: withMongoTransaction,
    },
  ) {}

  private async ownedOrder(id: string, identity: Identity) {
    const collections = await this.storage.collections();
    const order = await collections.orders.findOne({ id });
    if (!order || !canAccessPayment(order, identity.guestHash, identity.user)) {
      throw new WireError("not_allowed");
    }
    const payment = await collections.orderPayments.findOne({ orderId: id });
    return { ...order, payment };
  }

  private async sync(payment: MongoPayment) {
    if (!payment.providerIntentId || payment.status === "paid") return payment.status;
    const intent = await this.wire.getIntent(payment.providerIntentId);
    assertIntent(intent, { id: payment.providerIntentId, amountMnt: payment.amountMnt });
    const status = paymentStatus(intent);
    const { orderPayments } = await this.storage.collections();
    await orderPayments.updateOne(
      { orderId: payment.orderId, providerIntentId: intent.id, status: { $ne: "paid" } },
      { $set: { status, ...(status === "paid" ? { paidAt: new Date().toISOString() } : {}) } },
    );
    const current = await orderPayments.findOne({ orderId: payment.orderId });
    return current?.status ?? status;
  }

  async check(id: string, identity: Identity) {
    const order = await this.ownedOrder(id, identity);
    return order.payment ? this.sync(order.payment) : "pay_at_collection" as const;
  }

  async start(
    id: string,
    identity: Identity,
    settings: { appUrl: string; operatorId: string },
  ): Promise<PaymentCheckout> {
    const order = await this.ownedOrder(id, identity);
    if (order.status === "cancelled") throw new WireError("not_allowed");
    if (!order.payment) return { paymentStatus: "pay_at_collection", checkoutUrl: null };
    let payment = order.payment;
    if (payment.amountMnt * 100 !== order.totalCents || payment.currency !== "MNT") {
      throw new WireError("payment_mismatch");
    }
    const status = await this.sync(payment);
    if (status === "paid") return { paymentStatus: "paid", checkoutUrl: null };
    const { orderPayments } = await this.storage.collections();
    if (status === "canceled") {
      // The attempt predicate lets only one concurrent caller advance the attempt.
      await orderPayments.updateOne(
        { orderId: id, attempt: payment.attempt, status: "canceled" },
        { $set: {
          attempt: payment.attempt + 1,
          status: "pending",
          providerIntentId: null,
          checkoutSessionId: null,
          checkoutUrl: null,
        } },
      );
      const current = await orderPayments.findOne({ orderId: id });
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
      const saved = await orderPayments.updateOne(
        { orderId: id, attempt: payment.attempt, status: "pending" },
        { $set: { providerIntentId: intentId } },
      );
      if (!saved.matchedCount) throw new WireError("idempotency_in_flight");
    }
    const checkout = await this.wire.createCheckout(intentId, settings.appUrl, id, `${key}:checkout`);
    const saved = await orderPayments.updateOne(
      { orderId: id, providerIntentId: intentId, attempt: payment.attempt },
      { $set: { checkoutSessionId: checkout.id, checkoutUrl: checkout.url } },
    );
    if (!saved.matchedCount) throw new WireError("idempotency_in_flight");
    return { paymentStatus: "pending", checkoutUrl: checkout.url };
  }

  async cancel(id: string, identity: Identity) {
    const order = await this.ownedOrder(id, identity);
    if (!order.payment) return;
    if (order.payment.status === "paid") throw new WireError("already_paid");
    if (order.payment.providerIntentId) {
      const intent = await this.wire.cancelIntent(
        order.payment.providerIntentId,
        `cafe:${id}:${order.payment.attempt}:cancel`,
      );
      assertIntent(intent, { id: order.payment.providerIntentId, amountMnt: order.payment.amountMnt });
      if (intent.status !== "canceled") throw new WireError("already_paid");
    }
    const { orderPayments } = await this.storage.collections();
    await orderPayments.updateOne(
      { orderId: id, status: { $ne: "paid" } },
      { $set: { status: "canceled" } },
    );
  }

  async acceptEvent(event: { id: string; type: string; data?: unknown }) {
    if (!["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type)) return;
    const collections = await this.storage.collections();
    if (await collections.wireWebhookEvents.findOne({ id: event.id })) return;
    const snapshot = eventIntent(event.data);
    const payment = await collections.orderPayments.findOne({ providerIntentId: snapshot.id });
    if (!payment) return;
    assertIntent(snapshot, { id: payment.providerIntentId!, amountMnt: payment.amountMnt });
    // Delivery order and redirect parameters cannot establish that a payment succeeded.
    const intent = await this.wire.getIntent(snapshot.id);
    assertIntent(intent, { id: snapshot.id, amountMnt: payment.amountMnt });
    const status = paymentStatus(intent);
    try {
      await this.storage.transaction(async (tx, session) => {
        const recorded = await tx.wireWebhookEvents.updateOne(
          { id: event.id },
          { $setOnInsert: { id: event.id, processedAt: new Date().toISOString() } },
          { upsert: true, session },
        );
        if (!recorded.upsertedCount) return;
        await tx.orderPayments.updateOne(
          { orderId: payment.orderId, providerIntentId: intent.id, status: { $ne: "paid" } },
          { $set: { status, ...(status === "paid" ? { paidAt: new Date().toISOString() } : {}) } },
          { session },
        );
      });
    } catch (error) {
      // A simultaneous delivery may commit the same unique event before our upsert.
      if (error instanceof MongoServerError && error.code === 11000
        && await collections.wireWebhookEvents.findOne({ id: event.id })) return;
      throw error;
    }
  }
}
