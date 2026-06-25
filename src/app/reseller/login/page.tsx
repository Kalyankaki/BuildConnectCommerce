/**
 * DEV reseller sign-in. Lists the tenant's reseller owners; pick one to start a session.
 * TODO(M9/prod): replace with Supabase Auth (email/password or magic link).
 */
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { listResellerMemberships } from "@/server/reseller-data";
import { devSignIn } from "@/server/auth-actions";

export const metadata = { title: "Reseller sign in" };

export default async function ResellerLoginPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  const members = await listResellerMemberships(tenant);

  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Sign in — {tenant.displayName}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Dev sign-in (no password). This is replaced by real auth before production.
      </p>

      {members.length === 0 ? (
        <p className="mt-6 text-slate-500">No reseller accounts for this storefront yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {members.map((m) => (
            <li key={m.membershipId}>
              <form action={devSignIn}>
                <input type="hidden" name="membershipId" value={m.membershipId} />
                <button
                  type="submit"
                  className="w-full rounded-lg border px-4 py-3 text-left hover:bg-slate-100"
                >
                  <span className="font-medium">{m.name ?? m.email}</span>
                  <span className="block text-sm text-slate-500">
                    {m.email} · {m.role}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
