import { listAdminProfiles } from "@/server/admin-data";
import { devSignInAdmin } from "@/server/auth-actions";

export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage() {
  const admins = await listAdminProfiles();
  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold">Platform admin sign in</h1>
      <p className="mt-2 text-sm text-slate-500">Dev sign-in (no password). Replaced by real auth in production.</p>
      {admins.length === 0 ? (
        <p className="mt-6 text-slate-500">No platform admins seeded.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {admins.map((a) => (
            <li key={a.id}>
              <form action={devSignInAdmin}>
                <input type="hidden" name="profileId" value={a.id} />
                <button className="w-full rounded-lg border px-4 py-3 text-left hover:bg-slate-100">
                  <span className="font-medium">{a.name ?? a.email}</span>
                  <span className="block text-sm text-slate-500">{a.email}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
