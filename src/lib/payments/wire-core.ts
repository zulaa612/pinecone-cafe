import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const API_BASE = "https://api.wire.mn";
const intentSchema = z.object({
  id: z.string().regex(/^pi_[\w-]+$/),
  amount: z.number().int().min(1).max(1_000_000_000),
  currency: z.literal("MNT"),
  status: z.enum(["new", "requires_payment_method", "requires_action", "requires_capture", "processing", "succeeded", "canceled"]),
});
const checkoutSchema = z.object({
  id: z.string().min(1), payment_intent: z.string(), url: z.string().url(),
  status: z.enum(["open", "complete", "expired"]),
});
export type WireIntent = z.infer<typeof intentSchema>;

export class WireError extends Error {
  constructor(public readonly code: string) { super("Payment service unavailable."); }
}

/** Converts the app's stored hundredths to the whole MNT required by Wire. */
export function wireAmount(totalCents: number) {
  const amount = totalCents / 100;
  if (!Number.isSafeInteger(totalCents) || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000) {
    throw new WireError("invalid_amount");
  }
  return amount;
}

export function assertIntent(intent: WireIntent, expected: { id: string; amountMnt: number }) {
  if (intent.id !== expected.id || intent.amount !== expected.amountMnt || intent.currency !== "MNT") {
    throw new WireError("payment_mismatch");
  }
}

export function paymentStatus(intent: WireIntent): "paid" | "pending" | "canceled" {
  return intent.status === "succeeded" ? "paid" : intent.status === "canceled" ? "canceled" : "pending";
}

export function canAccessPayment(order: { guestTokenHash: string | null; userId: string | null }, guestHash: string | null,
  user: { id: string; role: string } | null) {
  return user?.role === "admin" || Boolean(guestHash && guestHash === order.guestTokenHash)
    || Boolean(user?.role === "customer" && user.id === order.userId);
}

export class WireClient {
  constructor(private readonly apiKey: string, private readonly request: typeof fetch = fetch) {}

  private async call(path: string, body?: object, idempotencyKey?: string): Promise<unknown> {
    if (!this.apiKey) throw new WireError("not_configured");
    let response: Response;
    try {
      response = await this.request(`${API_BASE}${path}`, {
        method: body ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new WireError("network_error"); }
    let result: unknown;
    try { result = await response.json(); } catch { throw new WireError("invalid_response"); }
    if (!response.ok) {
      const error = z.object({ error: z.object({ code: z.string() }) }).safeParse(result);
      throw new WireError(error.success ? error.data.error.code : "provider_error");
    }
    return result;
  }

  async createIntent(orderId: string, amount: number, operatorId: string, key: string) {
    const parsed = intentSchema.safeParse(await this.call("/v1/payment_intents", {
      amount, currency: "MNT", description: `Pine & Pour order ${orderId}`,
      metadata: { order_id: orderId }, allowed_operators: [operatorId],
    }, key));
    if (!parsed.success) throw new WireError("invalid_response");
    return parsed.data;
  }

  async getIntent(id: string) {
    const parsed = intentSchema.safeParse(await this.call(`/v1/payment_intents/${encodeURIComponent(id)}`));
    if (!parsed.success) throw new WireError("invalid_response");
    return parsed.data;
  }

  async createCheckout(intentId: string, appUrl: string, orderId: string, key: string) {
    const success = new URL("/", appUrl);
    success.searchParams.set("payment_order", orderId);
    success.searchParams.set("payment", "return");
    const cancel = new URL(success);
    cancel.searchParams.set("payment", "canceled");
    const parsed = checkoutSchema.safeParse(await this.call("/v1/checkout/sessions", {
      payment_intent: intentId, success_url: success.toString(), cancel_url: cancel.toString(),
    }, key));
    if (!parsed.success) throw new WireError("invalid_response");
    const checkout = parsed.data;
    const url = new URL(checkout.url);
    if (checkout.payment_intent !== intentId || url.protocol !== "https:" || url.hostname !== "pay.wire.mn" || !url.pathname.startsWith("/c/")) {
      throw new WireError("invalid_checkout");
    }
    return checkout;
  }

  async cancelIntent(id: string, key: string) {
    const parsed = intentSchema.safeParse(await this.call(`/v1/payment_intents/${encodeURIComponent(id)}/cancel`, {}, key));
    if (!parsed.success) throw new WireError("invalid_response");
    return parsed.data;
  }
}

/** Verify the exact bytes before parsing, and reject replayed/stale signatures. */
export function verifyWireEvent(rawBody: Uint8Array, header: string | null, secret: string, now = Date.now()) {
  if (!secret || !header) throw new WireError("bad_signature");
  const parts = header.split(",").map(part => part.trim());
  const timestamp = parts.find(part => part.startsWith("t="))?.slice(2) ?? "";
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new WireError("bad_signature");
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  const valid = parts.filter(part => part.startsWith("v1=")).some(part => {
    const signature = part.slice(3);
    if (!/^[a-f\d]{64}$/i.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
  });
  if (!valid) throw new WireError("bad_signature");
  let body: unknown;
  try { body = JSON.parse(Buffer.from(rawBody).toString("utf8")); } catch { throw new WireError("invalid_event"); }
  const parsed = z.object({ id: z.string().min(1), type: z.string(), data: z.unknown().optional() }).safeParse(body);
  if (!parsed.success) throw new WireError("invalid_event");
  return parsed.data;
}

export function eventIntent(data: unknown) {
  const parsed = intentSchema.safeParse(data);
  if (!parsed.success) throw new WireError("invalid_event");
  return parsed.data;
}
