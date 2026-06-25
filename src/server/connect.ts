"use server";
/**
 * Stripe Connect onboarding for resellers (B.9). Creates a Standard connected account and a
 * hosted onboarding link; no bank/card data ever touches our app. Inactive until
 * STRIPE_SECRET_KEY is set (returns a clear message). UI is wired in the reseller dashboard (M6).
 */
import { eq } from "drizzle-orm";
import { adminDb } from "@/db";
import { tenants } from "@/db/schema";
import { getCurrentTenant } from "@/server/tenant";

export type ConnectResult = { ok: true; url: string } | { ok: false; error: string };

export async function startConnectOnboarding(): Promise<ConnectResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "Stripe is not configured yet (set STRIPE_SECRET_KEY)." };
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No storefront resolved for this host." };

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey);

  let accountId = tenant.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: tenant.supportEmail ?? undefined,
      metadata: { tenantId: tenant.id },
    });
    accountId = account.id;
    await adminDb.update(tenants).set({ stripeAccountId: accountId }).where(eq(tenants.id, tenant.id));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/reseller/payouts`,
    return_url: `${appUrl}/reseller/payouts`,
  });

  return { ok: true, url: link.url };
}
