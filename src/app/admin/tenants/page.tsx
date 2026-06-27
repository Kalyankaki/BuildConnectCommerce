import Link from "next/link";
import { adminContextOrRedirect, listTenants } from "@/server/admin-data";
import { setTenantStatus } from "@/server/admin-actions";

export const metadata = { title: "Tenants" };

export default async function AdminTenants() {
  await adminContextOrRedirect();
  const tenants = await listTenants();

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Tenants</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-slate-500">
            <tr>
              <th className="p-3">Storefront</th>
              <th className="p-3">Subdomain</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link href={`/admin/tenants/${t.id}`} className="font-medium underline">
                    {t.displayName}
                  </Link>
                </td>
                <td className="p-3 text-slate-500">{t.slug}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.status === "active"
                        ? "bg-green-100 text-green-800"
                        : t.status === "suspended"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {t.status !== "active" && (
                      <StatusButton tenantId={t.id} status="active" label="Activate" />
                    )}
                    {t.status !== "suspended" && (
                      <StatusButton tenantId={t.id} status="suspended" label="Suspend" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusButton({ tenantId, status, label }: { tenantId: string; status: string; label: string }) {
  return (
    <form action={setTenantStatus}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-100">{label}</button>
    </form>
  );
}
