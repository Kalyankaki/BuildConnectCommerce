import "server-only";
/**
 * Order lifecycle state machine (B.8): quote → booked → scheduled → in_progress →
 * completed → closed (+ canceled, needs_quote). Each transition records an order_event and
 * notifies the customer. Moving to `completed` charges the remaining balance.
 */
import { eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { orderEvents, orders } from "@/db/schema";
import { roundCents } from "@/lib/pricing";
import { chargeDeposit, selectProvider } from "@/server/payments";
import { notifyOrderStatus } from "@/server/notifications";
import type { Tenant } from "@/server/tenant";

export type OrderStatus =
  | "quote"
  | "needs_quote"
  | "booked"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "closed"
  | "canceled";

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  quote: ["needs_quote", "booked", "canceled"],
  needs_quote: ["quote", "booked", "canceled"],
  booked: ["scheduled", "canceled"],
  scheduled: ["in_progress", "canceled"],
  in_progress: ["completed", "canceled"],
  completed: ["closed"],
  closed: [],
  canceled: [],
};

export type TransitionResult = { ok: true } | { ok: false; error: string };

export async function transitionOrderForTenant(
  tenant: Tenant,
  orderId: string,
  to: OrderStatus,
): Promise<TransitionResult> {
  const [order] = await withTenant(tenant.id, (tx) =>
    tx.select().from(orders).where(eq(orders.id, orderId)).limit(1),
  );
  if (!order) return { ok: false, error: "Order not found." };

  const from = order.status as OrderStatus;
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    return { ok: false, error: `Cannot move an order from "${from}" to "${to}".` };
  }

  // Balance-on-completion charge.
  let balancePaid = order.balancePaid;
  let balancePaymentRef = order.balancePaymentRef;
  if (to === "completed" && !order.balancePaid && order.balanceCents > 0) {
    const provider = selectProvider(tenant);
    const applicationFeeCents =
      order.totalCents > 0
        ? roundCents((order.platformMarginCents * order.balanceCents) / order.totalCents)
        : 0;
    const charge = await chargeDeposit(provider, {
      amountCents: order.balanceCents,
      currency: order.currency,
      applicationFeeCents,
      destinationAccountId: tenant.stripeAccountId,
      idempotencyKey: `balance_${orderId}`,
      description: `Balance for order ${orderId}`,
      metadata: { orderId, tenantId: tenant.id, kind: "balance" },
    });
    if (charge.status !== "succeeded") {
      return { ok: false, error: "Balance charge did not complete." };
    }
    balancePaid = true;
    balancePaymentRef = charge.id;
  }

  await withTenant(tenant.id, async (tx) => {
    await tx
      .update(orders)
      .set({
        status: to,
        balancePaid,
        balancePaymentRef,
        paymentProvider: order.paymentProvider ?? selectProvider(tenant),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    await tx.insert(orderEvents).values({
      tenantId: tenant.id,
      orderId,
      type: "status_change",
      fromStatus: from,
      toStatus: to,
    });
  });

  // Notify the customer + log each channel as an order_event.
  const { message, results } = await notifyOrderStatus(order, tenant.displayName, to);
  await withTenant(tenant.id, async (tx) => {
    for (const r of results) {
      await tx.insert(orderEvents).values({
        tenantId: tenant.id,
        orderId,
        type: "notification",
        toStatus: to,
        channel: r.channel,
        message: r.sent ? message : `(failed) ${message}`,
      });
    }
  });

  return { ok: true };
}
