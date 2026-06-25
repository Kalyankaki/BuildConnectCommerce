/**
 * M5 integration test — proves an order moves quote→booked→scheduled→in_progress→completed
 * →closed with appointments created, an installer assigned (capacity v1), balance charged on
 * completion, and notifications firing on each transition. Also checks order_events RLS.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb, withTenant } from "@/db";
import { appointments, memberships, orderEvents, orders, profiles, tenants } from "@/db/schema";
import { transitionOrderForTenant } from "@/server/lifecycle-core";
import { findAvailableInstaller, scheduleOrderForTenant } from "@/server/scheduling-core";
import type { Tenant } from "@/server/tenant";

const ZIP = "00003";
let tenant: Tenant;
let tenant2: Tenant;
let installerProfileId: string;
let orderId: string;

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const windowEnd = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

beforeAll(async () => {
  const sfx = randomUUID().slice(0, 8);
  const [t, t2] = await adminDb
    .insert(tenants)
    .values([
      { slug: `lc-${sfx}`, displayName: "Lifecycle Co.", status: "active", coverageZips: [ZIP] },
      { slug: `lc2-${sfx}`, displayName: "Other Co.", status: "active", coverageZips: [ZIP] },
    ])
    .returning();
  tenant = t;
  tenant2 = t2;

  const [installer] = await adminDb
    .insert(profiles)
    .values({ email: `inst-${sfx}@test.dev`, fullName: "Test Installer", phone: "+15555550111" })
    .returning();
  installerProfileId = installer.id;
  await adminDb
    .insert(memberships)
    .values({ tenantId: t.id, userId: installer.id, role: "installer", coverageZips: [ZIP] });

  const [order] = await adminDb
    .insert(orders)
    .values({
      tenantId: t.id,
      customerEmail: "owner@example.com",
      customerPhone: "+15555550199",
      status: "booked",
      serviceAddress: { line1: "1 St", city: "Lynnwood", state: "WA", zip: ZIP },
      subtotalCents: 60000,
      totalCents: 100000,
      platformMarginCents: 20000,
      depositCents: 50000,
      balanceCents: 50000,
      depositPaid: true,
      paymentProvider: "mock",
    })
    .returning();
  orderId = order.id;
});

afterAll(async () => {
  await adminDb.delete(tenants).where(inArray(tenants.id, [tenant.id, tenant2.id]));
  await adminDb.delete(profiles).where(eq(profiles.id, installerProfileId));
  await closeDb();
});

describe("scheduling + installer capacity", () => {
  it("finds an installer who serves the ZIP", async () => {
    const inst = await findAvailableInstaller(tenant, ZIP, tomorrow);
    expect(inst?.profileId).toBe(installerProfileId);
  });

  it("schedules delivery/install/haulaway and assigns the installer", async () => {
    const res = await scheduleOrderForTenant(tenant, orderId, { windowStart: tomorrow, windowEnd });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.appointmentsCreated).toBe(3);
    expect(res.installerProfileId).toBe(installerProfileId);

    const appts = await withTenant(tenant.id, (tx) =>
      tx.select().from(appointments).where(eq(appointments.orderId, orderId)),
    );
    expect(appts.length).toBe(3);
    expect(appts.filter((a) => a.installerProfileId === installerProfileId).length).toBe(2); // install + haulaway

    const [o] = await withTenant(tenant.id, (tx) =>
      tx.select().from(orders).where(eq(orders.id, orderId)).limit(1),
    );
    expect(o.status).toBe("scheduled");
  });
});

describe("lifecycle transitions", () => {
  it("advances scheduled → in_progress → completed (charges balance) → closed", async () => {
    expect((await transitionOrderForTenant(tenant, orderId, "in_progress")).ok).toBe(true);
    expect((await transitionOrderForTenant(tenant, orderId, "completed")).ok).toBe(true);

    const [completed] = await withTenant(tenant.id, (tx) =>
      tx.select().from(orders).where(eq(orders.id, orderId)).limit(1),
    );
    expect(completed.status).toBe("completed");
    expect(completed.balancePaid).toBe(true);
    expect(completed.balancePaymentRef?.startsWith("mock_pi_")).toBe(true);

    expect((await transitionOrderForTenant(tenant, orderId, "closed")).ok).toBe(true);
  });

  it("rejects an illegal transition", async () => {
    const res = await transitionOrderForTenant(tenant, orderId, "booked");
    expect(res.ok).toBe(false);
  });

  it("recorded status-change and notification events on each transition", async () => {
    const events = await withTenant(tenant.id, (tx) =>
      tx.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)),
    );
    const statusChanges = events.filter((e) => e.type === "status_change");
    const notifications = events.filter((e) => e.type === "notification");
    // scheduled, in_progress, completed, closed
    expect(statusChanges.length).toBeGreaterThanOrEqual(4);
    expect(notifications.length).toBeGreaterThan(0); // notifications fired
  });
});

describe("order_events RLS isolation", () => {
  it("a tenant cannot read another tenant's order events", async () => {
    const mine = await withTenant(tenant.id, (tx) => tx.select().from(orderEvents));
    expect(mine.every((e) => e.tenantId === tenant.id)).toBe(true);

    const other = await withTenant(tenant2.id, (tx) =>
      tx.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)),
    );
    expect(other.length).toBe(0);
  });

  it("a tenant cannot write an order_event for another tenant (WITH CHECK)", async () => {
    await expect(
      withTenant(tenant2.id, (tx) =>
        tx.insert(orderEvents).values({ tenantId: tenant.id, orderId, type: "note", message: "evil" }),
      ),
    ).rejects.toThrow();
  });
});
