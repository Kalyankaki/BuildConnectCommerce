/**
 * M8 tests — an installer sees only their assigned appointments, and completing the order
 * charges the balance via the lifecycle machine.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb, withTenant } from "@/db";
import { appointments, memberships, orders, profiles, tenants } from "@/db/schema";
import { allAppointmentsComplete, listAssignedJobs } from "@/server/installer-data";
import { transitionOrderForTenant } from "@/server/lifecycle-core";
import type { Tenant } from "@/server/tenant";

let tenant: Tenant;
let installer1: string;
let installer2: string;
let order1: string;

beforeAll(async () => {
  const sfx = randomUUID().slice(0, 8);
  const [t] = await adminDb
    .insert(tenants)
    .values({ slug: `inst-${sfx}`, displayName: "Inst Co.", status: "active" })
    .returning();
  tenant = t;

  const [p1, p2] = await adminDb
    .insert(profiles)
    .values([
      { email: `i1-${sfx}@t.dev`, fullName: "I One" },
      { email: `i2-${sfx}@t.dev`, fullName: "I Two" },
    ])
    .returning();
  installer1 = p1.id;
  installer2 = p2.id;
  await adminDb.insert(memberships).values([
    { tenantId: t.id, userId: p1.id, role: "installer" },
    { tenantId: t.id, userId: p2.id, role: "installer" },
  ]);

  const [o1, o2] = await adminDb
    .insert(orders)
    .values([
      { tenantId: t.id, customerEmail: "a@x.com", status: "in_progress", totalCents: 100000, platformMarginCents: 20000, depositCents: 50000, balanceCents: 50000, depositPaid: true },
      { tenantId: t.id, customerEmail: "b@x.com", status: "in_progress", totalCents: 50000, balanceCents: 25000 },
    ])
    .returning();
  order1 = o1.id;

  await adminDb.insert(appointments).values([
    { tenantId: t.id, orderId: o1.id, type: "install", installerProfileId: p1.id, status: "scheduled" },
    { tenantId: t.id, orderId: o1.id, type: "haulaway", installerProfileId: p1.id, status: "scheduled" },
    { tenantId: t.id, orderId: o2.id, type: "install", installerProfileId: p2.id, status: "scheduled" },
  ]);
});

afterAll(async () => {
  await adminDb.delete(tenants).where(eq(tenants.id, tenant.id));
  await adminDb.delete(profiles).where(inArray(profiles.id, [installer1, installer2]));
  await closeDb();
});

describe("installer assigned jobs", () => {
  it("returns only the installer's own appointments", async () => {
    const jobs = await listAssignedJobs(tenant, installer1);
    expect(jobs.length).toBe(2);
    expect(jobs.every((j) => j.orderId === order1)).toBe(true);

    const other = await listAssignedJobs(tenant, installer2);
    expect(other.length).toBe(1);
  });
});

describe("completion charges the balance", () => {
  it("marks appointments done, then completing the order charges the balance", async () => {
    await withTenant(tenant.id, (tx) =>
      tx.update(appointments).set({ status: "completed" }).where(eq(appointments.orderId, order1)),
    );
    expect(await allAppointmentsComplete(tenant, order1)).toBe(true);

    const res = await transitionOrderForTenant(tenant, order1, "completed");
    expect(res.ok).toBe(true);

    const [o] = await withTenant(tenant.id, (tx) =>
      tx.select().from(orders).where(eq(orders.id, order1)).limit(1),
    );
    expect(o.status).toBe("completed");
    expect(o.balancePaid).toBe(true);
    expect(o.balancePaymentRef?.startsWith("mock_pi_")).toBe(true);
  });
});
