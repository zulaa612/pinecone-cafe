import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { PaymentService } from "../src/lib/payments/ledger";
import {
  canAccessPayment,
  paymentStatus,
  verifyWireEvent,
  wireAmount,
  WireClient,
  WireError,
  type WireIntent,
} from "../src/lib/payments/wire-core";
import { migrateWirePayments } from "./lib/wire-payments-migration";

type Call = {
  url: string;
  method: string;
  headers: Headers;
  body: Record<string, unknown> | null;
};
const guest = { guestHash: "guest-owner-hash", user: null };
const settings = {
  appUrl: "https://cafe.example.test",
  operatorId: "op_qpay_fixture",
};
const paymentError = (code: string) => (error: unknown) =>
  error instanceof WireError && error.code === code;

function mockProvider() {
  const calls: Call[] = [];
  const intents = new Map<string, WireIntent>();
  const replay = new Map<string, object>();
  let intentSequence = 0;
  let failCheckout = false;
  let override: ((call: Call) => object | undefined) | undefined;
  const respond = (value: object, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const request: typeof fetch = async (input, init) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    calls.push(call);
    const replaced = override?.(call);
    if (replaced) return respond(replaced);
    const path = new URL(call.url).pathname;
    if (call.method === "GET") {
      const intent = intents.get(path.split("/").at(-1)!);
      assert.ok(intent, `Unexpected lookup ${path}`);
      return respond({ ...intent, client_secret: "cs_private_fixture" });
    }
    const key = call.headers.get("Idempotency-Key");
    assert.ok(key, "Every mutating request must have an idempotency key");
    if (replay.has(key)) return respond(replay.get(key)!);
    let result: object;
    if (path === "/v1/payment_intents") {
      const intent: WireIntent = {
        id: `pi_mock_${++intentSequence}`,
        amount: Number(call.body?.amount),
        currency: "MNT",
        status: "requires_payment_method",
      };
      intents.set(intent.id, intent);
      result = { ...intent, client_secret: "cs_private_fixture" };
    } else if (path === "/v1/checkout/sessions") {
      if (failCheckout) {
        failCheckout = false;
        return respond(
          {
            error: {
              code: "operator_timeout",
              message: "Provider diagnostic must stay private",
            },
          },
          503,
        );
      }
      const intentId = String(call.body?.payment_intent);
      const sessionId = `cs_${intentId}`;
      result = {
        id: sessionId,
        payment_intent: intentId,
        status: "open",
        url: `https://pay.wire.mn/c/${sessionId}`,
        client_secret: "cs_private_fixture",
      };
    } else if (path.endsWith("/cancel")) {
      const intentId = path.split("/").at(-2)!;
      const intent = intents.get(intentId);
      assert.ok(intent);
      const canceled: WireIntent = { ...intent, status: "canceled" };
      intents.set(intentId, canceled);
      result = canceled;
    } else {
      throw new Error(`Unexpected mock request ${call.method} ${path}`);
    }
    replay.set(key, result);
    return respond(result);
  };
  return {
    calls,
    intents,
    request,
    failNextCheckout() {
      failCheckout = true;
    },
    setOverride(value: typeof override) {
      override = value;
    },
    setStatus(id: string, status: WireIntent["status"]) {
      const intent = intents.get(id);
      assert.ok(intent);
      intents.set(id, { ...intent, status });
    },
  };
}

async function fixture() {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE orders (
    id TEXT PRIMARY KEY, user_id TEXT, guest_token_hash TEXT,
    customer_name TEXT NOT NULL, customer_type TEXT NOT NULL, class_grade TEXT, location TEXT,
    status TEXT NOT NULL DEFAULT 'pending', subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT 'fixture-date', completed_at TEXT
  )`);
  await migrateWirePayments(client);
  const database = drizzle(client, { schema });
  await database.insert(schema.orders).values({
    id: "PP TEST",
    guestTokenHash: guest.guestHash,
    userId: "account-owner",
    customerName: "Fixture Customer",
    customerType: "student",
    classGrade: "Grade 8",
    subtotalCents: 1_500_000,
    totalCents: 1_500_000,
  });
  await database
    .insert(schema.orderPayments)
    .values({ orderId: "PP TEST", amountMnt: 15_000 });
  const provider = mockProvider();
  const wire = new WireClient("test-key", provider.request);
  const service = new PaymentService(database, wire);
  const payment = () =>
    database.query.orderPayments.findFirst({
      where: eq(schema.orderPayments.orderId, "PP TEST"),
    });
  return { client, database, provider, wire, service, payment };
}

test("Wire receives whole MNT with QPay restricted and strips provider secrets", async () => {
  assert.equal(wireAmount(1_500_000), 15_000);
  assert.equal(wireAmount(100), 1);
  for (const value of [
    0,
    -100,
    101,
    1.5,
    Number.MAX_SAFE_INTEGER,
    100_000_000_100,
  ])
    assert.throws(() => wireAmount(value), paymentError("invalid_amount"));
  const provider = mockProvider();
  const wire = new WireClient("test-key", provider.request);
  const intent = await wire.createIntent(
    "PP TEST",
    wireAmount(1_500_000),
    settings.operatorId,
    "order:intent",
  );
  const create = provider.calls[0];
  assert.equal(create.url, "https://api.wire.mn/v1/payment_intents");
  assert.equal(create.headers.get("Authorization"), "Bearer test-key");
  assert.equal(create.headers.get("Content-Type"), "application/json");
  assert.equal(create.body?.amount, 15_000);
  assert.equal(create.body?.currency, "MNT");
  assert.deepEqual(create.body?.allowed_operators, [settings.operatorId]);
  assert.deepEqual(create.body?.metadata, { order_id: "PP TEST" });
  assert.equal(Object.hasOwn(intent, "client_secret"), false);
  assert.equal(
    Object.hasOwn(await wire.getIntent(intent.id), "client_secret"),
    false,
  );
  const checkout = await wire.createCheckout(
    intent.id,
    settings.appUrl,
    "PP TEST",
    "order:checkout",
  );
  assert.equal(Object.hasOwn(checkout, "client_secret"), false);
  const body = provider.calls.at(-1)!.body!;
  assert.equal(
    new URL(String(body.success_url)).searchParams.get("payment_order"),
    "PP TEST",
  );
  assert.equal(
    new URL(String(body.cancel_url)).searchParams.get("payment"),
    "canceled",
  );
});

test("ownership is checked before remote requests for guests, accounts, and admins", async () => {
  const f = await fixture();
  try {
    assert.equal(
      canAccessPayment(
        { guestTokenHash: guest.guestHash, userId: "account-owner" },
        null,
        null,
      ),
      false,
    );
    for (const identity of [
      { guestHash: "someone-else", user: null },
      { guestHash: null, user: { id: "other-account", role: "customer" } },
      { guestHash: null, user: { id: "account-owner", role: "unexpected" } },
    ]) {
      await assert.rejects(
        f.service.start("PP TEST", identity, settings),
        paymentError("not_allowed"),
      );
      await assert.rejects(
        f.service.check("PP TEST", identity),
        paymentError("not_allowed"),
      );
      await assert.rejects(
        f.service.cancel("PP TEST", identity),
        paymentError("not_allowed"),
      );
    }
    await assert.rejects(
      f.service.check("missing", guest),
      paymentError("not_allowed"),
    );
    assert.equal(f.provider.calls.length, 0);
    for (const identity of [
      guest,
      { guestHash: null, user: { id: "account-owner", role: "customer" } },
      { guestHash: null, user: { id: "staff", role: "admin" } },
    ]) {
      assert.equal(await f.service.check("PP TEST", identity), "pending");
    }
    await f.database
      .insert(schema.orders)
      .values({
        id: "LEGACY",
        guestTokenHash: guest.guestHash,
        customerName: "Legacy",
        customerType: "student",
        subtotalCents: 100,
        totalCents: 100,
      });
    assert.equal(await f.service.check("LEGACY", guest), "pay_at_collection");
    assert.deepEqual(await f.service.start("LEGACY", guest, settings), {
      paymentStatus: "pay_at_collection",
      checkoutUrl: null,
    });
    assert.equal(f.provider.calls.length, 0);
  } finally {
    f.client.close();
  }
});

test("repeated checkout starts reuse the persisted intent and stable operation keys", async () => {
  const f = await fixture();
  try {
    f.provider.failNextCheckout();
    await assert.rejects(
      f.service.start("PP TEST", guest, settings),
      paymentError("operator_timeout"),
    );
    assert.equal((await f.payment())?.providerIntentId, "pi_mock_1");
    assert.equal((await f.payment())?.checkoutUrl, null);
    const checkout = await f.service.start("PP TEST", guest, settings);
    assert.deepEqual(checkout, {
      paymentStatus: "pending",
      checkoutUrl: "https://pay.wire.mn/c/cs_pi_mock_1",
    });
    assert.deepEqual(
      await f.service.start("PP TEST", guest, settings),
      checkout,
    );
    const writes = f.provider.calls.filter((call) => call.method === "POST");
    assert.deepEqual(
      writes.map((call) => call.headers.get("Idempotency-Key")),
      [
        "cafe:PP TEST:1:intent",
        "cafe:PP TEST:1:checkout",
        "cafe:PP TEST:1:checkout",
      ],
    );
    assert.equal(
      writes.filter(
        (call) => new URL(call.url).pathname === "/v1/payment_intents",
      ).length,
      1,
    );
    assert.equal(JSON.stringify(checkout).includes("client_secret"), false);
  } finally {
    f.client.close();
  }
});

test("server status checks map pending/canceled and require verified matching paid intent", async () => {
  const f = await fixture();
  try {
    for (const status of [
      "new",
      "requires_payment_method",
      "requires_action",
      "requires_capture",
      "processing",
    ] as const) {
      assert.equal(
        paymentStatus({
          id: "pi_status",
          amount: 15_000,
          currency: "MNT",
          status,
        }),
        "pending",
      );
    }
    await f.service.start("PP TEST", guest, settings);
    f.provider.setStatus("pi_mock_1", "requires_action");
    assert.equal(await f.service.check("PP TEST", guest), "pending");
    f.provider.setStatus("pi_mock_1", "canceled");
    assert.equal(await f.service.check("PP TEST", guest), "canceled");
    f.provider.setOverride((call) =>
      call.method === "GET"
        ? { id: "pi_mock_1", amount: 1, currency: "MNT", status: "succeeded" }
        : undefined,
    );
    await assert.rejects(
      f.service.check("PP TEST", guest),
      paymentError("payment_mismatch"),
    );
    assert.equal((await f.payment())?.status, "canceled");
    f.provider.setOverride((call) =>
      call.method === "GET"
        ? {
            id: "pi_mock_1",
            amount: 15_000,
            currency: "USD",
            status: "succeeded",
          }
        : undefined,
    );
    await assert.rejects(
      f.service.check("PP TEST", guest),
      paymentError("invalid_response"),
    );
    assert.equal((await f.payment())?.paidAt, null);
    f.provider.setOverride(undefined);
    f.provider.setStatus("pi_mock_1", "succeeded");
    assert.equal(await f.service.check("PP TEST", guest), "paid");
    assert.ok((await f.payment())?.paidAt);
    const count = f.provider.calls.length;
    assert.deepEqual(await f.service.start("PP TEST", guest, settings), {
      paymentStatus: "paid",
      checkoutUrl: null,
    });
    assert.equal(f.provider.calls.length, count);
  } finally {
    f.client.close();
  }
});

test("canceled attempts advance once and retry using new stable keys", async () => {
  const f = await fixture();
  try {
    await f.service.start("PP TEST", guest, settings);
    await f.service.cancel("PP TEST", guest);
    assert.equal((await f.payment())?.status, "canceled");
    const retry = await f.service.start("PP TEST", guest, settings);
    assert.equal((await f.payment())?.attempt, 2);
    assert.equal((await f.payment())?.providerIntentId, "pi_mock_2");
    assert.deepEqual(await f.service.start("PP TEST", guest, settings), retry);
    assert.deepEqual(
      f.provider.calls
        .filter((call) => call.method === "POST")
        .map((call) => call.headers.get("Idempotency-Key")),
      [
        "cafe:PP TEST:1:intent",
        "cafe:PP TEST:1:checkout",
        "cafe:PP TEST:1:cancel",
        "cafe:PP TEST:2:intent",
        "cafe:PP TEST:2:checkout",
      ],
    );
  } finally {
    f.client.close();
  }
});

test("webhook verification uses exact raw bytes and rejects forged or expired timestamps", () => {
  const now = 1_800_000_000_000;
  const timestamp = String(now / 1000);
  const secret = "whsec_local_fixture";
  const raw = Buffer.from(
    '{ "id": "evt_signed", "type": "payment_intent.succeeded", "data": {"label":"Төлбөр"} }',
  );
  const signature = (time: string, bytes = raw) =>
    `t=${time},v1=${createHmac("sha256", secret).update(`${time}.`).update(bytes).digest("hex")}`;
  assert.equal(
    verifyWireEvent(raw, signature(timestamp), secret, now).id,
    "evt_signed",
  );
  assert.throws(
    () =>
      verifyWireEvent(
        Buffer.concat([raw, Buffer.from("\n")]),
        signature(timestamp),
        secret,
        now,
      ),
    paymentError("bad_signature"),
  );
  assert.throws(
    () =>
      verifyWireEvent(
        raw,
        signature(timestamp).replace(
          `t=${timestamp}`,
          `t=${Number(timestamp) + 1}`,
        ),
        secret,
        now,
      ),
    paymentError("bad_signature"),
  );
  for (const offset of [-301, 301]) {
    const time = String(Number(timestamp) + offset);
    assert.throws(
      () => verifyWireEvent(raw, signature(time), secret, now),
      paymentError("bad_signature"),
    );
  }
  for (const header of [
    null,
    "t=invalid,v1=abcd",
    `t=${timestamp},v1=${"0".repeat(64)}`,
  ]) {
    assert.throws(
      () => verifyWireEvent(raw, header, secret, now),
      paymentError("bad_signature"),
    );
  }
  const ping = Buffer.from(
    JSON.stringify({ id: "evt_verification", type: "endpoint.verification" }),
  );
  assert.equal(
    verifyWireEvent(ping, signature(timestamp, ping), secret, now).type,
    "endpoint.verification",
  );
});

test("webhooks re-fetch payment state, deduplicate events, and cannot downgrade paid orders", async () => {
  const f = await fixture();
  try {
    await f.service.start("PP TEST", guest, settings);
    const snapshot = {
      id: "pi_mock_1",
      object: "payment_intent",
      amount: 15_000,
      currency: "MNT",
      status: "succeeded",
    };
    await f.service.acceptEvent({
      id: "evt_ping",
      type: "endpoint.verification",
    });
    const count = f.provider.calls.length;
    await assert.rejects(
      f.service.acceptEvent({
        id: "evt_forged_amount",
        type: "payment_intent.succeeded",
        data: { ...snapshot, amount: 1 },
      }),
      paymentError("payment_mismatch"),
    );
    await assert.rejects(
      f.service.acceptEvent({
        id: "evt_forged_currency",
        type: "payment_intent.succeeded",
        data: { ...snapshot, currency: "USD" },
      }),
      paymentError("invalid_event"),
    );
    assert.equal(f.provider.calls.length, count);
    await f.service.acceptEvent({
      id: "evt_early",
      type: "payment_intent.succeeded",
      data: snapshot,
    });
    assert.equal(
      (await f.payment())?.status,
      "pending",
      "A success snapshot alone must not mark an unpaid intent paid",
    );
    f.provider.setStatus("pi_mock_1", "succeeded");
    await f.service.acceptEvent({
      id: "evt_paid",
      type: "payment_intent.succeeded",
      data: snapshot,
    });
    const paid = await f.payment();
    assert.equal(paid?.status, "paid");
    assert.ok(paid?.paidAt);
    const afterPaid = f.provider.calls.length;
    await f.service.acceptEvent({
      id: "evt_paid",
      type: "payment_intent.succeeded",
      data: snapshot,
    });
    assert.equal(f.provider.calls.length, afterPaid);
    f.provider.setStatus("pi_mock_1", "canceled");
    await f.service.acceptEvent({
      id: "evt_old_cancel",
      type: "payment_intent.canceled",
      data: { ...snapshot, status: "canceled" },
    });
    assert.equal((await f.payment())?.status, "paid");
    assert.equal((await f.payment())?.paidAt, paid?.paidAt);
    assert.deepEqual(
      (await f.database.select().from(schema.wireWebhookEvents))
        .map((event) => event.id)
        .sort(),
      ["evt_early", "evt_old_cancel", "evt_paid"],
    );
  } finally {
    f.client.close();
  }
});

test("checkout refuses a provider URL outside Wire hosted checkout", async () => {
  const provider = mockProvider();
  provider.setOverride(() => ({
    id: "cs_untrusted",
    payment_intent: "pi_fixture",
    status: "open",
    url: "https://example.test/c/phishing",
  }));
  await assert.rejects(
    new WireClient("test-key", provider.request).createCheckout(
      "pi_fixture",
      settings.appUrl,
      "PP TEST",
      "checkout:untrusted",
    ),
    paymentError("invalid_checkout"),
  );
});
