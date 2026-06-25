/**
 * Stripe webhook (B.9). Verifies the signature, then marks deposit/balance paid based on
 * payment_intent.succeeded metadata. Uses the admin connection (no host/tenant context in a
 * webhook) to update the order by id. Returns 501 until Stripe is configured.
 */
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { adminDb } from "@/db";
import { orders } from "@/db/schema";

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return new Response("Stripe not configured", { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.orderId;
    const kind = pi.metadata?.kind;
    if (orderId) {
      if (kind === "deposit") {
        await adminDb
          .update(orders)
          .set({ depositPaid: true, status: "booked", depositPaymentRef: pi.id, updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      } else if (kind === "balance") {
        await adminDb
          .update(orders)
          .set({ balancePaid: true, status: "completed", balancePaymentRef: pi.id, updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      }
    }
  }

  return new Response("ok", { status: 200 });
}
