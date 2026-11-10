"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { readGuestTokenHash } from "@/lib/guest";
import { getT } from "@/lib/i18n-server";
import type { ActionResult, PaymentCheckout, PaymentStatus } from "@/lib/cafe";
import { checkoutSettings, paymentService } from "@/lib/payments/server";
import { WireError } from "@/lib/payments/wire-core";

async function identity() {
  const [user, guestHash] = await Promise.all([getCurrentUser(), readGuestTokenHash()]);
  return { user, guestHash };
}

async function paymentError(error: unknown) {
  const t = await getT();
  if (error instanceof WireError) {
    if (error.code === "not_allowed") return t("err.paymentNotAllowed");
    if (error.code === "not_configured") return t("err.paymentUnavailable");
    if (error.code === "idempotency_in_flight") return t("err.paymentBusy");
  }
  return t("err.paymentFailed");
}

export async function startOrderPayment(orderId: string): Promise<ActionResult<PaymentCheckout>> {
  if (typeof orderId !== "string" || !/^PP-\d{6}$/.test(orderId)) return { ok: false, error: (await getT())("err.paymentNotAllowed") };
  try {
    const owner = await identity();
    const settings = await checkoutSettings();
    return { ok: true, ...await paymentService().start(orderId, owner, settings) };
  } catch (error) { return { ok: false, error: await paymentError(error) }; }
}

export async function checkOrderPayment(orderId: string): Promise<ActionResult<{ paymentStatus: PaymentStatus }>> {
  if (typeof orderId !== "string" || !/^PP-\d{6}$/.test(orderId)) return { ok: false, error: (await getT())("err.paymentNotAllowed") };
  try {
    return { ok: true, paymentStatus: await paymentService().check(orderId, await identity()) };
  } catch (error) { return { ok: false, error: await paymentError(error) }; }
}
