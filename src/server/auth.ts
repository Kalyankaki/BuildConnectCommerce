import "server-only";
/**
 * Lightweight session auth (DEV SHIM).
 *
 * TODO(M9/prod): replace with Supabase Auth. For now a signed (HMAC) cookie carries the
 * acting profile + tenant + role so the role-gated dashboards (reseller/admin/installer) work
 * locally. The authorization checks and RLS scoping are real; only the login mechanism is a stub.
 */
import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "rc_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";

export interface Session {
  profileId: string;
  tenantId: string | null; // null for platform_admin (apex host)
  role: "customer" | "reseller_owner" | "reseller_staff" | "platform_admin" | "installer";
  email: string;
}

export function signSession(session: Session): string {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${mac}`;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

const RESELLER_ROLES = new Set(["reseller_owner", "reseller_staff"]);

/** Returns the session iff it is a reseller for the given tenant; else null. */
export async function getResellerSession(tenantId: string): Promise<Session | null> {
  const s = await getSession();
  if (!s || s.tenantId !== tenantId || !RESELLER_ROLES.has(s.role)) return null;
  return s;
}
