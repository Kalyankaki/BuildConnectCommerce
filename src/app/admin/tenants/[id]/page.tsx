import Link from "next/link";
import { notFound } from "next/navigation";
import { adminContextOrRedirect, getTenantById, getTenantExport } from "@/server/admin-data";
import { setTenantStatus } from "@/server/admin-actions";

export const metadata = { title: "Tenant detail" };

export default async function AdminTenantDetail({ params }: { params: Promise<{ id: string }> }) {
  await adminContextOrRedirect();
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();
  const exportConfig = await getTenantExport(id);

  return (
    <div className="max-w-2xl">
      <Link href="/admin/tenants" className="text-sm underline">← Tenants</Link>
      <h1 className="mt-2 text-2xl font-bold">{tenant.displayName}</h1>
      <p className="text-slate-500">
        {tenant.slug} · status <strong>{tenant.status}</strong>
        {tenant.customDomain ? ` · ${tenant.customDomain}${tenant.customDomainVerified ? " ✓" : " (unverified)"}` : ""}
      </p>

      <div className="mt-4 flex gap-2">
        {(["active", "suspended", "pending"] as const).map((s) => (
          <form key={s} action={setTenantStatus}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="status" value={s} />
            <button
              disabled={tenant.status === s}
              className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-40"
            >
              {s}
            </button>
          </form>
        ))}
      </div>

      <h2 className="mt-8 font-semibold">Export storefront config (D1)</h2>
      <p className="text-sm text-slate-500">
        Pre-seeds a standalone deploy with this tenant's config. (Full repo generation is a follow-up.)
      </p>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
{JSON.stringify(exportConfig, null, 2)}
      </pre>
    </div>
  );
}
