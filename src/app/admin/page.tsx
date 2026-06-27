import { adminContextOrRedirect, getGlobalReport } from "@/server/admin-data";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Admin overview" };

export default async function AdminOverview() {
  await adminContextOrRedirect();
  const r = await getGlobalReport();

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Platform overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Tenants" value={String(r.tenantCount)} />
        <Card label="Orders" value={String(r.orderCount)} />
        <Card label="Gross revenue" value={formatCents(r.grossRevenueCents)} />
        <Card label="Platform fees" value={formatCents(r.platformFeesCents)} />
      </div>
      <p className="mt-2 text-sm text-slate-500">Reseller payouts total {formatCents(r.resellerPayoutsCents)}.</p>

      <h2 className="mt-8 font-semibold">Orders by status</h2>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {Object.entries(r.byStatus).map(([s, n]) => (
          <li key={s} className="rounded-full bg-white px-3 py-1 shadow-sm">
            {s}: <strong>{n}</strong>
          </li>
        ))}
        {r.orderCount === 0 && <li className="text-slate-500">No orders yet.</li>}
      </ul>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 font-serif text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
