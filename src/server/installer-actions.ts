"use server";
/**
 * Installer actions (B.8). Installers move their appointments through in_progress → completed,
 * and complete the order (which charges the balance via the lifecycle state machine).
 */
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withTenant } from "@/db";
import { appointments } from "@/db/schema";
import { getInstallerSession } from "@/server/auth";
import { transitionOrderForTenant } from "@/server/lifecycle-core";
import { getCurrentTenant, type Tenant } from "@/server/tenant";

async function requireInstaller(): Promise<{ tenant: Tenant; profileId: string }> {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/installer/login");
  const session = await getInstallerSession(tenant.id);
  if (!session) redirect("/installer/login");
  return { tenant, profileId: session.profileId };
}

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  const { tenant, profileId } = await requireInstaller();
  const parsed = z
    .object({
      appointmentId: z.string().uuid(),
      status: z.enum(["scheduled", "in_progress", "completed"]),
    })
    .safeParse({
      appointmentId: String(formData.get("appointmentId") ?? ""),
      status: String(formData.get("status") ?? ""),
    });
  if (!parsed.success) return;

  const orderId = await withTenant(tenant.id, async (tx) => {
    // Only the assigned installer may update their appointment (plus RLS tenant scope).
    const [updated] = await tx
      .update(appointments)
      .set({ status: parsed.data.status })
      .where(and(eq(appointments.id, parsed.data.appointmentId), eq(appointments.installerProfileId, profileId)))
      .returning({ orderId: appointments.orderId });
    return updated?.orderId ?? null;
  });

  // Starting work moves a scheduled order into progress.
  if (orderId && parsed.data.status === "in_progress") {
    await transitionOrderForTenant(tenant, orderId, "in_progress").catch(() => {});
  }
  revalidatePath("/installer");
}

export async function completeOrder(formData: FormData): Promise<void> {
  const { tenant } = await requireInstaller();
  const orderId = z.string().uuid().safeParse(String(formData.get("orderId") ?? ""));
  if (!orderId.success) return;
  // Charges the balance via the lifecycle machine (in_progress → completed).
  await transitionOrderForTenant(tenant, orderId.data, "completed").catch(() => {});
  revalidatePath("/installer");
}
