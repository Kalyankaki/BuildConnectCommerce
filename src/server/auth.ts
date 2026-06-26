import "server-only";
/**
 * Authentication via Supabase Auth, mapped to our profiles/memberships tables.
 *
 * Identity rule: profiles.id === the Supabase auth user id (1:1). A profile row is ensured on
 * first authenticated request. Role/tenant authorization comes from `memberships` (read with
 * the admin connection — this is an auth check, not tenant-scoped data exposure).
 */
import { and, eq } from "drizzle-orm";
import { adminDb } from "@/db";
import { memberships, profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "customer" | "reseller_owner" | "reseller_staff" | "platform_admin" | "installer";

export interface Session {
  profileId: string;
  email: string;
  isPlatformAdmin: boolean;
  role?: Role;
  tenantId?: string | null;
}

/** True only when Supabase Auth env is configured. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** The signed-in profile (creating the profile row on first login), or null. */
export async function getSession(): Promise<Session | null> {
  if (!isAuthConfigured()) return null; // no Supabase yet → treated as signed-out (no 500)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  // Ensure a profile exists, keyed by the auth user id.
  await adminDb
    .insert(profiles)
    .values({ id: user.id, email: user.email, fullName: (user.user_metadata?.full_name as string) ?? null })
    .onConflictDoNothing();
  const [profile] = await adminDb.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (!profile) return null;

  return { profileId: profile.id, email: profile.email, isPlatformAdmin: profile.isPlatformAdmin };
}

const RESELLER_ROLES: Role[] = ["reseller_owner", "reseller_staff"];

async function membershipRole(profileId: string, tenantId: string): Promise<Role | null> {
  const [m] = await adminDb
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, profileId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  return (m?.role as Role) ?? null;
}

/** Session iff the user is a reseller for the given tenant. */
export async function getResellerSession(tenantId: string): Promise<Session | null> {
  const base = await getSession();
  if (!base) return null;
  const role = await membershipRole(base.profileId, tenantId);
  if (!role || !RESELLER_ROLES.includes(role)) return null;
  return { ...base, role, tenantId };
}

/** Session iff the user is a platform admin. */
export async function getAdminSession(): Promise<Session | null> {
  const base = await getSession();
  if (!base || !base.isPlatformAdmin) return null;
  return { ...base, role: "platform_admin", tenantId: null };
}

/** Session iff the user is an installer for the given tenant. */
export async function getInstallerSession(tenantId: string): Promise<Session | null> {
  const base = await getSession();
  if (!base) return null;
  const role = await membershipRole(base.profileId, tenantId);
  if (role !== "installer") return null;
  return { ...base, role, tenantId };
}
