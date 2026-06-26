import "server-only";
/**
 * Installer view reads (B.8). An installer sees the appointments assigned to them, with the
 * order they belong to. Tenant-scoped via withTenant.
 */
import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { withTenant } from "@/db";
import { appointments, orders } from "@/db/schema";
import { getInstallerSession, isAuthConfigured, type Session } from "@/server/auth";
import { getCurrentTenant, type Tenant } from "@/server/tenant";

export async function installerContextOrRedirect(): Promise<{ tenant: Tenant; session: Session }> {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  // Demo mode: when Supabase auth isn't configured, allow installer access.
  if (!isAuthConfigured()) {
    return {
      tenant,
      session: { profileId: "demo", email: "demo@local", isPlatformAdmin: false, role: "installer", tenantId: tenant.id },
    };
  }
  const session = await getInstallerSession(tenant.id);
  if (!session) redirect("/login?next=/installer");
  return { tenant, session };
}

export interface AssignedJob {
  appointmentId: string;
  type: "delivery" | "install" | "haulaway";
  status: string;
  windowStart: Date | null;
  windowEnd: Date | null;
  orderId: string;
  orderStatus: string;
  customerEmail: string;
  address: Record<string, string> | null;
  balanceCents: number;
}

export async function listAssignedJobs(tenant: Tenant, installerProfileId: string): Promise<AssignedJob[]> {
  const rows = await withTenant(tenant.id, (tx) =>
    tx
      .select({ a: appointments, o: orders })
      .from(appointments)
      .innerJoin(orders, eq(orders.id, appointments.orderId))
      .where(eq(appointments.installerProfileId, installerProfileId))
      .orderBy(desc(appointments.windowStart)),
  );
  return rows.map(({ a, o }) => ({
    appointmentId: a.id,
    type: a.type,
    status: a.status,
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    orderId: o.id,
    orderStatus: o.status,
    customerEmail: o.customerEmail,
    address: (o.serviceAddress as Record<string, string> | null) ?? null,
    balanceCents: o.balanceCents,
  }));
}

/** Whether every appointment on an order is completed (used to allow order completion). */
export async function allAppointmentsComplete(tenant: Tenant, orderId: string): Promise<boolean> {
  const appts = await withTenant(tenant.id, (tx) =>
    tx.select({ status: appointments.status }).from(appointments).where(eq(appointments.orderId, orderId)),
  );
  return appts.length > 0 && appts.every((a) => a.status === "completed");
}

export async function listInstallerMemberships(tenant: Tenant) {
  const { memberships, profiles } = await import("@/db/schema");
  return withTenant(tenant.id, (tx) =>
    tx
      .select({ membershipId: memberships.id, role: memberships.role, email: profiles.email, name: profiles.fullName })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.role, "installer")),
  );
}
