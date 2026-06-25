"use server";
/**
 * Order lifecycle + scheduling actions. Resolve the tenant from the host and delegate to the
 * cores. NOTE(M6/M8): add role authorization (reseller/installer) when those route groups land.
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { transitionOrderForTenant, type OrderStatus } from "@/server/lifecycle-core";
import { scheduleOrderForTenant } from "@/server/scheduling-core";
import { getCurrentTenant } from "@/server/tenant";

export type ActionResult = { ok: boolean; error?: string };

const statuses = [
  "quote",
  "needs_quote",
  "booked",
  "scheduled",
  "in_progress",
  "completed",
  "closed",
  "canceled",
] as const;

export async function advanceOrder(orderId: string, to: OrderStatus): Promise<ActionResult> {
  const parsed = z.object({ orderId: z.string().uuid(), to: z.enum(statuses) }).safeParse({ orderId, to });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No storefront resolved for this host." };

  const res = await transitionOrderForTenant(tenant, parsed.data.orderId, parsed.data.to);
  if (res.ok) revalidatePath(`/orders/${orderId}`);
  return res;
}

const scheduleSchema = z.object({
  orderId: z.string().uuid(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  zip: z.string().regex(/^\d{3,5}$/).optional(),
});

export async function scheduleOrder(input: unknown): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No storefront resolved for this host." };

  const res = await scheduleOrderForTenant(tenant, parsed.data.orderId, {
    windowStart: new Date(parsed.data.windowStart),
    windowEnd: new Date(parsed.data.windowEnd),
    zip: parsed.data.zip,
  });
  if (res.ok) revalidatePath(`/orders/${parsed.data.orderId}`);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
