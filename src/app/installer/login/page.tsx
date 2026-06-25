import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { listInstallerMemberships } from "@/server/installer-data";
import { devSignIn } from "@/server/auth-actions";

export const metadata = { title: "Installer sign in" };

export default async function InstallerLoginPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  const installers = await listInstallerMemberships(tenant);

  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Installer sign in — {tenant.displayName}</h1>
      <p className="mt-2 text-sm text-slate-500">Dev sign-in (no password).</p>
      {installers.length === 0 ? (
        <p className="mt-6 text-slate-500">No installers for this storefront yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {installers.map((m) => (
            <li key={m.membershipId}>
              <form action={devSignIn}>
                <input type="hidden" name="membershipId" value={m.membershipId} />
                <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-slate-100">
                  <span className="font-medium">{m.name ?? m.email}</span>
                  <span className="block text-sm text-slate-500">{m.email}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
