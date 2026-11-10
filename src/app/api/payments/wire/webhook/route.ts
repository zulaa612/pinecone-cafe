import { paymentService } from "@/lib/payments/server";
import { verifyWireEvent, WireError } from "@/lib/payments/wire-core";

export async function POST(request: Request) {
  const secret = process.env.WIRE_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  if (Number(request.headers.get("content-length")) > 65536) return new Response(null, { status: 413 });
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > 65536) return new Response(null, { status: 413 });
  try {
    const event = verifyWireEvent(body, request.headers.get("WirePayment-Signature"), secret);
    if (event.type !== "endpoint.verification") await paymentService().acceptEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    const invalid = error instanceof WireError && ["bad_signature", "invalid_event"].includes(error.code);
    // A transient provider/DB failure must be retried by Wire rather than acknowledged.
    return Response.json({ error: invalid ? "Invalid webhook." : "Please retry delivery." }, { status: invalid ? 400 : 503 });
  }
}
