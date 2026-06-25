import "server-only";
/**
 * Appointment scheduling + installer capacity (v1). Capacity = a max number of appointments
 * per installer per day; an installer must serve the job's ZIP (empty coverage = serves all).
 * Scheduling a booked order creates delivery/install/haulaway appointments and advances the
 * order to `scheduled` (which records the event + notifies the customer).
 */
import { and, count, eq, gte, lt } from "drizzle-orm";
import { withTenant } from "@/db";
import { appointments, memberships, orders, profiles } from "@/db/schema";
import { transitionOrderForTenant } from "@/server/lifecycle-core";
import type { Tenant } from "@/server/tenant";

export const DAILY_CAPACITY = Number(process.env.INSTALLER_DAILY_CAPACITY ?? 3);

export interface AvailableInstaller {
  profileId: string;
  fullName: string | null;
}

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** First installer who serves `zip` and has spare capacity on `date`. */
export async function findAvailableInstaller(
  tenant: Tenant,
  zip: string,
  date: Date,
): Promise<AvailableInstaller | null> {
  const { start, end } = dayBounds(date);
  return withTenant(tenant.id, async (tx) => {
    const installers = await tx
      .select({ profileId: profiles.id, fullName: profiles.fullName, coverageZips: memberships.coverageZips })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.role, "installer"));

    for (const inst of installers) {
      const serves = inst.coverageZips.length === 0 || inst.coverageZips.includes(zip);
      if (!serves) continue;
      const [{ c }] = await tx
        .select({ c: count() })
        .from(appointments)
        .where(
          and(
            eq(appointments.installerProfileId, inst.profileId),
            gte(appointments.windowStart, start),
            lt(appointments.windowStart, end),
          ),
        );
      if (Number(c) < DAILY_CAPACITY) {
        return { profileId: inst.profileId, fullName: inst.fullName };
      }
    }
    return null;
  });
}

export interface SchedulePlan {
  windowStart: Date;
  windowEnd: Date;
  zip?: string;
}

export type ScheduleResult =
  | { ok: true; appointmentsCreated: number; installerProfileId: string | null }
  | { ok: false; error: string };

export async function scheduleOrderForTenant(
  tenant: Tenant,
  orderId: string,
  plan: SchedulePlan,
): Promise<ScheduleResult> {
  const [order] = await withTenant(tenant.id, (tx) =>
    tx.select().from(orders).where(eq(orders.id, orderId)).limit(1),
  );
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "booked") {
    return { ok: false, error: `Only booked orders can be scheduled (status is "${order.status}").` };
  }

  const address = (order.serviceAddress ?? {}) as Record<string, string>;
  const zip = plan.zip ?? address.zip ?? "";
  const installer = await findAvailableInstaller(tenant, zip, plan.windowStart);

  await withTenant(tenant.id, async (tx) => {
    await tx.insert(appointments).values([
      {
        tenantId: tenant.id,
        orderId,
        type: "delivery",
        windowStart: plan.windowStart,
        windowEnd: plan.windowEnd,
        status: "scheduled",
      },
      {
        tenantId: tenant.id,
        orderId,
        type: "install",
        installerProfileId: installer?.profileId ?? null,
        windowStart: plan.windowStart,
        windowEnd: plan.windowEnd,
        status: "scheduled",
      },
      {
        tenantId: tenant.id,
        orderId,
        type: "haulaway",
        installerProfileId: installer?.profileId ?? null,
        windowStart: plan.windowStart,
        windowEnd: plan.windowEnd,
        status: "scheduled",
      },
    ]);
  });

  const moved = await transitionOrderForTenant(tenant, orderId, "scheduled");
  if (!moved.ok) return { ok: false, error: moved.error };

  return { ok: true, appointmentsCreated: 3, installerProfileId: installer?.profileId ?? null };
}
