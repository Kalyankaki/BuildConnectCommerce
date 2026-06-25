/**
 * DEV utility: print a signed reseller session cookie value for a tenant's owner.
 * Usage: npx tsx scripts/dev-token.ts [tenantSlug]
 */
import "./load-env";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { adminDb, closeDb } from "../src/db";
import { memberships, profiles, tenants } from "../src/db/schema";

const SECRET = process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
function sign(session: object): string {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function main() {
  const slug = process.argv[2] ?? "acme";

  // `admin` -> mint a platform_admin session (apex host).
  if (slug === "admin") {
    const [a] = await adminDb
      .select()
      .from(profiles)
      .where(eq(profiles.isPlatformAdmin, true))
      .limit(1);
    if (!a) throw new Error("No platform admin");
    console.log(sign({ profileId: a.id, tenantId: null, role: "platform_admin", email: a.email }));
    return;
  }

  const [tenant] = await adminDb.select().from(tenants).where(eq(tenants.slug, slug));
  if (!tenant) throw new Error(`No tenant "${slug}"`);
  const [m] = await adminDb
    .select({ pid: profiles.id, email: profiles.email, role: memberships.role })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.id, memberships.userId))
    .where(and(eq(memberships.tenantId, tenant.id), eq(memberships.role, "reseller_owner")))
    .limit(1);
  if (!m) throw new Error(`No reseller_owner for "${slug}"`);
  console.log(sign({ profileId: m.pid, tenantId: tenant.id, role: m.role, email: m.email }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
