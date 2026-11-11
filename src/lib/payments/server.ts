import "server-only";
import { db } from "@/db";
import { isMongoDatabase } from "@/db/config";
import { headers } from "next/headers";
import { PaymentService } from "./ledger";
import { MongoPaymentService } from "./mongo-ledger";
import { WireClient, WireError } from "./wire-core";

export function paymentService() {
  const wire = new WireClient(process.env.WIRE_API_KEY?.trim() ?? "");
  return isMongoDatabase() ? new MongoPaymentService(wire) : new PaymentService(db, wire);
}

export async function checkoutSettings() {
  const operatorId = process.env.WIRE_QPAY_OPERATOR_ID?.trim();
  if (!process.env.WIRE_API_KEY?.trim() || !operatorId) throw new WireError("not_configured");
  let appUrl = process.env.APP_URL?.trim();
  if (!appUrl && process.env.NODE_ENV !== "production") {
    const origin = (await headers()).get("origin");
    if (origin) {
      const url = new URL(origin);
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) appUrl = url.origin;
    }
  }
  if (!appUrl) throw new WireError("not_configured");
  const parsed = new URL(appUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password
    || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")) throw new WireError("not_configured");
  return { appUrl: parsed.origin, operatorId };
}
