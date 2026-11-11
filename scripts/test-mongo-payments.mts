import assert from "node:assert/strict";
import test from "node:test";
import type { ClientSession } from "mongodb";
import type { MongoCollections, MongoPayment } from "../src/db/mongodb";
import type { orders } from "../src/db/schema";
import { MongoPaymentService } from "../src/lib/payments/mongo-ledger";
import { WireClient, WireError, type WireIntent } from "../src/lib/payments/wire-core";

type Document = Record<string, unknown>;
type StoredOrder = typeof orders.$inferSelect;
type Storage = NonNullable<ConstructorParameters<typeof MongoPaymentService>[1]>;
const guest = { guestHash: "owner-hash", user: null };
const settings = { appUrl: "https://cafe.example.test", operatorId: "op_fixture" };
const paymentError = (code: string) => (error: unknown) => error instanceof WireError && error.code === code;

function fixture() {
  let order: StoredOrder = {
    id: "ORDER", userId: null, guestTokenHash: guest.guestHash, customerName: "Guest",
    customerType: "student", classGrade: null, location: null, status: "pending",
    subtotalCents: 1_500_000, discountCents: 0, totalCents: 1_500_000,
    createdAt: "2026-01-01T00:00:00.000Z", completedAt: null,
  };
  let payment: MongoPayment = {
    orderId: order.id, amountMnt: 15_000, currency: "MNT", status: "pending", attempt: 1,
    providerIntentId: null, checkoutSessionId: null, checkoutUrl: null, paidAt: null,
    createdAt: order.createdAt,
  };
  let events: Document[] = [];
  let failPaymentWrite = false;
  let session: ClientSession | undefined;
  let transactionCount = 0;
  const matches = (document: Document, filter: Document) => Object.entries(filter).every(([key, expected]) => {
    if (expected && typeof expected === "object" && "$ne" in expected) return document[key] !== expected.$ne;
    return document[key] === expected;
  });
  const collections = {
    orders: {
      findOne: async (filter: Document) => matches(order, filter) ? { ...order } : null,
    },
    orderPayments: {
      findOne: async (filter: Document) => matches(payment, filter) ? { ...payment } : null,
      updateOne: async (filter: Document, update: { $set: Document }, options?: { session?: ClientSession }) => {
        if (session) assert.equal(options?.session, session, "payment update must share the event transaction");
        if (failPaymentWrite) {
          failPaymentWrite = false;
          throw new Error("simulated payment write failure");
        }
        if (!matches(payment, filter)) return { matchedCount: 0 };
        payment = { ...payment, ...update.$set } as MongoPayment;
        return { matchedCount: 1 };
      },
    },
    wireWebhookEvents: {
      findOne: async (filter: Document) => events.find(event => matches(event, filter)) ?? null,
      updateOne: async (filter: Document, update: { $setOnInsert: Document }, options: { session?: ClientSession; upsert?: boolean }) => {
        assert.equal(options.session, session);
        assert.equal(options.upsert, true);
        if (events.some(event => matches(event, filter))) return { upsertedCount: 0 };
        events.push({ ...update.$setOnInsert });
        return { upsertedCount: 1 };
      },
    },
  } as unknown as MongoCollections;
  const storage: Storage = {
    collections: async () => collections,
    transaction: async callback => {
      transactionCount += 1;
      const previousPayment = { ...payment };
      const previousEvents = events.map(event => ({ ...event }));
      session = {} as ClientSession;
      try {
        return await callback(collections, session);
      } catch (error) {
        payment = previousPayment;
        events = previousEvents;
        throw error;
      } finally {
        session = undefined;
      }
    },
  };
  const intents = new Map<string, WireIntent>();
  const replay = new Map<string, object>();
  const calls: { method: string; key: string | null; path: string }[] = [];
  let sequence = 0;
  const request: typeof fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    const key = new Headers(init?.headers).get("Idempotency-Key");
    const path = new URL(String(input)).pathname;
    calls.push({ method, key, path });
    let result = key ? replay.get(key) : undefined;
    if (!result) {
      if (path === "/v1/payment_intents") {
        const intent: WireIntent = { id: `pi_mock_${++sequence}`, amount: 15_000, currency: "MNT", status: "new" };
        intents.set(intent.id, intent);
        result = intent;
      } else if (path === "/v1/checkout/sessions") {
        const body = JSON.parse(String(init?.body)) as { payment_intent: string };
        const id = `cs_${body.payment_intent}`;
        result = { id, payment_intent: body.payment_intent, status: "open", url: `https://pay.wire.mn/c/${id}` };
      } else {
        const id = path.split("/")[3];
        const intent = intents.get(id);
        assert.ok(intent);
        if (path.endsWith("/cancel")) intent.status = "canceled";
        result = { ...intent };
      }
      if (key) replay.set(key, result);
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const service = new MongoPaymentService(new WireClient("fixture-key", request), storage);
  return {
    service, calls, intents,
    payment: () => ({ ...payment }),
    events: () => events.map(event => ({ ...event })),
    transactions: () => transactionCount,
    failNextPaymentWrite: () => { failPaymentWrite = true; },
    setOrder: (update: Partial<StoredOrder>) => { order = { ...order, ...update }; },
  };
}

test("Mongo payment ownership and stored totals are checked before provider calls", async () => {
  const f = fixture();
  const stranger = { guestHash: "other-owner", user: null };
  await assert.rejects(f.service.check("ORDER", stranger), paymentError("not_allowed"));
  await assert.rejects(f.service.start("ORDER", stranger, settings), paymentError("not_allowed"));
  await assert.rejects(f.service.cancel("ORDER", stranger), paymentError("not_allowed"));
  f.setOrder({ totalCents: 100 });
  await assert.rejects(f.service.start("ORDER", guest, settings), paymentError("payment_mismatch"));
  assert.equal(f.calls.length, 0);
});

test("Mongo checkout retries reuse intent keys and advance a canceled attempt only once", async () => {
  const f = fixture();
  const checkout = await f.service.start("ORDER", guest, settings);
  assert.deepEqual(await f.service.start("ORDER", guest, settings), checkout);
  assert.equal(f.intents.size, 1);
  await f.service.cancel("ORDER", guest);
  const retries = await Promise.all([
    f.service.start("ORDER", guest, settings),
    f.service.start("ORDER", guest, settings),
  ]);
  assert.deepEqual(retries[0], retries[1]);
  assert.equal(f.payment().attempt, 2);
  assert.equal(f.intents.size, 2);
  assert.equal(f.payment().providerIntentId, "pi_mock_2");
  assert.ok(f.calls.some(call => call.key === "cafe:ORDER:2:intent"));
  assert.ok(f.calls.some(call => call.key === "cafe:ORDER:2:checkout"));
});

test("Mongo webhook payment updates and deduplication share a transaction and roll back together", async () => {
  const f = fixture();
  await f.service.start("ORDER", guest, settings);
  const snapshot = { id: "pi_mock_1", amount: 15_000, currency: "MNT", status: "succeeded" };
  await assert.rejects(
    f.service.acceptEvent({ id: "evt_wrong_amount", type: "payment_intent.succeeded", data: { ...snapshot, amount: 1 } }),
    paymentError("payment_mismatch"),
  );
  await f.service.acceptEvent({ id: "evt_early", type: "payment_intent.succeeded", data: snapshot });
  assert.equal(f.payment().status, "pending", "event snapshot cannot override verified provider state");
  f.intents.get(snapshot.id)!.status = "succeeded";
  f.failNextPaymentWrite();
  const event = { id: "evt_paid", type: "payment_intent.succeeded", data: snapshot };
  await assert.rejects(f.service.acceptEvent(event), /simulated payment write failure/);
  assert.equal(f.payment().status, "pending");
  assert.equal(f.events().some(record => record.id === event.id), false);
  await f.service.acceptEvent(event);
  const paid = f.payment();
  assert.equal(paid.status, "paid");
  assert.ok(paid.paidAt);
  const calls = f.calls.length;
  await f.service.acceptEvent(event);
  assert.equal(f.calls.length, calls, "duplicate event should not call the provider again");
  f.intents.get(snapshot.id)!.status = "canceled";
  await f.service.acceptEvent({ id: "evt_late_cancel", type: "payment_intent.canceled", data: { ...snapshot, status: "canceled" } });
  assert.equal(f.payment().status, "paid");
  assert.equal(f.payment().paidAt, paid.paidAt);
  assert.equal(f.transactions(), 4);
  assert.deepEqual(f.events().map(record => record.id).sort(), ["evt_early", "evt_late_cancel", "evt_paid"]);
  await assert.rejects(f.service.cancel("ORDER", guest), paymentError("already_paid"));
});
