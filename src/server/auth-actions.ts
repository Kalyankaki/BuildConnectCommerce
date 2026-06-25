"use server";
/**
 * DEV auth actions (sign in/out). TODO(M9/prod): replace with Supabase Auth.
 */
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminDb, withTenant } from "@/db";
import { memberships, profiles } from "@/db/schema";
import { SESSION_COOKIE, signSession, type Session } from "@/server/auth";
import { getCurrentTenant } from "@/server/tenant";

async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Dev: sign in as a platform admin (apex host). */
export async function devSignInAdmin(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const [admin] = await adminDb
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.isPlatformAdmin, true)))
    .limit(1);
  if (!admin) return;
  await setSessionCookie({ profileId: admin.id, tenantId: null, role: "platform_admin", email: admin.email });
  redirect("/admin");
}

/** Dev: sign in as a specific reseller membership of the current tenant. */
export async function devSignIn(formData: FormData): Promise<void> {
  const membershipId = String(formData.get("membershipId") ?? "");
  const tenant = await getCurrentTenant();
  if (!tenant) return;

  const row = await withTenant(tenant.id, async (tx) => {
    const [m] = await tx
      .select({ role: memberships.role, profileId: profiles.id, email: profiles.email })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.id, membershipId))
      .limit(1);
    return m;
  });
  if (!row) return;

  const session: Session = {
    profileId: row.profileId,
    tenantId: tenant.id,
    role: row.role,
    email: row.email,
  };
  await setSessionCookie(session);
  redirect(row.role === "installer" ? "/installer" : "/reseller");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/reseller/login");
}
