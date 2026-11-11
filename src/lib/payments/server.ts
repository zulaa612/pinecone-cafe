import "server-only";
import { db } from "@/db";
import { isMongoDatabase } from "@/db/config";
import { headers } from "next/headers";
import { PaymentService } from "./ledger";
import { MongoPaymentService } from "./mongo-ledger";
import { WireClient } from "./wire-core";
import { resolveCheckoutSettings } from "./checkout-settings";

export function paymentService() {
  const wire = new WireClient(process.env.WIRE_API_KEY?.trim() ?? "");
  return isMongoDatabase() ? new MongoPaymentService(wire) : new PaymentService(db, wire);
}

export async function checkoutSettings() {
  return resolveCheckoutSettings(process.env, await headers());
}
