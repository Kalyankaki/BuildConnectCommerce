/**
 * M7 tests — platform-admin global reporting (cross-tenant) and tenant export payload.
 * Uses deltas vs. a baseline so it's robust against other rows in the dev DB.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "@/db";
import { orders, tenants } from "@/db/schema";
import { getGlobalReport, getTenantExport, type GlobalReport } from "@/server/admin-data";

let tenantId: string;
let baseline: GlobalReport;

beforeAll(async () => {
  baseline = await getGlobalReport();
  const sfx = randomUUID().slice(0, 8);
  const [t] = await adminDb
    .insert(tenants)
    .values({ slug: `adm-${sfx}`, displayName: "Admin Test Co.", status: "active", coverageZips: ["12345"] })
    .returning();
  tenantId = t.id;
  await adminDb.insert(orders).values({
    tenantId: t.id,
    customerEmail: "c@x.com",
    status: "booked",
    totalCents: 100000,
    platformMarginCents: 20000,
    depositPaid: true,
  });
});

afterAll(async () => {
  await adminDb.delete(tenants).where(eq(tenants.id, tenantId));
  await closeDb();
});

describe("getGlobalReport", () => {
  it("counts the new tenant + paid order across all tenants", async () => {
    const r = await getGlobalReport();
    expect(r.tenantCount).toBe(baseline.tenantCount + 1);
    expect(r.orderCount).toBe(baseline.orderCount + 1);
    expect(r.grossRevenueCents).toBe(baseline.grossRevenueCents + 100000);
    expect(r.platformFeesCents).toBe(baseline.platformFeesCents + 20000);
    expect(r.resellerPayoutsCents).toBe(baseline.resellerPayoutsCents + 80000);
  });
});

describe("getTenantExport", () => {
  it("builds a config payload for the tenant", async () => {
    const cfg = await getTenantExport(tenantId);
    expect(cfg).not.toBeNull();
    expect(cfg!.tenant.slug).toMatch(/^adm-/);
    expect(cfg!.tenant.coverageZips).toEqual(["12345"]);
    expect(Array.isArray(cfg!.envTemplate)).toBe(true);
  });
});
