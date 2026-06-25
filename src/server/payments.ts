import "server-only";
/**
 * Payments abstraction (B.9). Stripe Connect destination charges are wired but gated behind
 * env config; until STRIPE_SECRET_KEY (and the tenant's connected account) are present, a
 * `mock` provider records a successful charge so the full booking flow is testable offline.
 *
 * Stripe model: the platform takes its margin via `application_fee_amount`; the remainder
 * settles to the reseller's connected account via `transfer_data.destination`.
 */
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { Tenant } from "@/server/tenant";

export type PaymentProviderName = "mock" | "stripe";

export interface ChargeArgs {
  amountCents: number;
  currency: string;
  /** Platform margin retained on this charge (Stripe application_fee_amount). */
  applicationFeeCents: number;
  /** Reseller's Stripe connected account id (destination). */
  destinationAccountId?: string | null;
  /** Idempotency key — required for all charge creation (B.9). */
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  provider: PaymentProviderName;
  id: string;
  status: "succeeded" | "requires_action" | "pending";
  clientSecret?: string | null;
}

/** Choose the provider: Stripe only when configured AND the tenant is connected. */
export function selectProvider(tenant: Tenant): PaymentProviderName {
  return process.env.STRIPE_SECRET_KEY && tenant.stripeAccountId ? "stripe" : "mock";
}

let stripeClient: Stripe | null = null;
async function getStripe(): Promise<Stripe> {
  if (!stripeClient) {
    const { default: Stripe } = await import("stripe");
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

export async function chargeDeposit(
  provider: PaymentProviderName,
  args: ChargeArgs,
): Promise<ChargeResult> {
  if (provider === "mock") {
    return { provider: "mock", id: `mock_pi_${randomUUID()}`, status: "succeeded" };
  }

  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.create(
    {
      amount: args.amountCents,
      currency: args.currency,
      application_fee_amount: args.applicationFeeCents,
      transfer_data: args.destinationAccountId ? { destination: args.destinationAccountId } : undefined,
      automatic_payment_methods: { enabled: true },
      description: args.description,
      metadata: args.metadata,
    },
    { idempotencyKey: args.idempotencyKey },
  );

  return {
    provider: "stripe",
    id: pi.id,
    status: pi.status === "succeeded" ? "succeeded" : pi.status === "requires_action" ? "requires_action" : "pending",
    clientSecret: pi.client_secret,
  };
}
