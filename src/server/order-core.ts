import "server-only";
/**
 * Order placement core (server-only). Re-prices the cart, creates the order + items, charges
 * the deposit (B.5: deposit-at-booking, balance-on-completion) via the payments provider,
 * and converts the cart. Testable directly (takes tenant + token, no request context).
 */
import { and, eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { cartItems, carts, orderItems, orders } from "@/db/schema";
import { roundCents } from "@/lib/pricing";
import { loadCartForToken } from "@/server/cart-core";
import { chargeDeposit, selectProvider } from "@/server/payments";
import type { Tenant } from "@/server/tenant";

export interface CustomerInput {
  name?: string;
  email: string;
  phone?: string;
  address: { line1: string; city: string; state: string; zip: string };
}

export type PlaceOrderResult = { ok: true; orderId: string } | { ok: false; error: string };

function depositPercentFor(tenant: Tenant): number {
  return tenant.depositPercent ?? Number(process.env.DEFAULT_DEPOSIT_PERCENT ?? 50);
}

export async function placeOrderForTenant(
  tenant: Tenant,
  token: string | null,
  customer: CustomerInput,
): Promise<PlaceOrderResult> {
  const cart = await loadCartForToken(tenant, token);
  if (!cart || cart.lines.length === 0) return { ok: false, error: "Your cart is empty." };
  if (cart.hasUnavailable) {
    return { ok: false, error: "Some items are no longer available. Please review your cart." };
  }

  const t = cart.totals;
  const depositPct = depositPercentFor(tenant);
  const depositCents = roundCents((t.totalCents * depositPct) / 100);
  const balanceCents = t.totalCents - depositCents;

  // 1) Create order + items (snapshot the re-priced totals).
  const orderId = await withTenant(tenant.id, async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        tenantId: tenant.id,
        customerEmail: customer.email,
        customerPhone: customer.phone ?? null,
        status: "quote",
        serviceAddress: { ...customer.address, name: customer.name ?? "" },
        subtotalCents: t.subtotalCents,
        deliveryCents: t.deliveryCents,
        laborCents: t.laborCents,
        haulawayCents: t.haulawayCents,
        taxCents: t.taxCents,
        totalCents: t.totalCents,
        platformMarginCents: t.platformMarginCents,
        depositCents,
        balanceCents,
        currency: "usd",
      })
      .returning();

    for (const line of cart.lines) {
      if (!line.current) continue;
      await tx.insert(orderItems).values({
        tenantId: tenant.id,
        orderId: order.id,
        variantId: line.variantId,
        qty: line.qty,
        unitPriceCents: line.current.lineItems[0]?.unitPriceCents ?? 0,
        services: line.current as unknown as Record<string, unknown>,
        lineTotalCents: line.current.totalCents,
      });
    }
    return order.id;
  });

  // 2) Charge the deposit (mock unless Stripe is configured). Platform fee is the margin,
  //    pro-rated to the deposit portion.
  const provider = selectProvider(tenant);
  const applicationFeeCents =
    t.totalCents > 0 ? roundCents((t.platformMarginCents * depositCents) / t.totalCents) : 0;

  const charge = await chargeDeposit(provider, {
    amountCents: depositCents,
    currency: "usd",
    applicationFeeCents,
    destinationAccountId: tenant.stripeAccountId,
    idempotencyKey: `deposit_${orderId}`,
    description: `Deposit for order ${orderId}`,
    metadata: { orderId, tenantId: tenant.id, kind: "deposit" },
  });

  const paid = charge.status === "succeeded";

  // 3) Record payment + convert the cart.
  await withTenant(tenant.id, async (tx) => {
    await tx
      .update(orders)
      .set({
        depositPaid: paid,
        status: paid ? "booked" : "quote",
        paymentProvider: provider,
        depositPaymentRef: charge.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    await tx
      .update(carts)
      .set({ status: "converted", customerEmail: customer.email, updatedAt: new Date() })
      .where(and(eq(carts.id, cart.cartId)));
    // Clean up the converted cart's items.
    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.cartId));
  });

  return { ok: true, orderId };
}

/** Load an order + its items for the confirmation/tracking page. */
export async function getOrderForTenant(tenant: Tenant, orderId: string) {
  return withTenant(tenant.id, async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return null;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return { order, items };
  });
}
