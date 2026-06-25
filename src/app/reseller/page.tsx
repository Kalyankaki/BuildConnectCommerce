import Link from "next/link";
import { resellerContextOrRedirect, getRevenueSummary } from "@/server/reseller-data";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Reseller overview" };

export default async function ResellerOverview() {
  const { tenant } = await resellerContextOrRedirect();
  const rev = await getRevenueSummary(tenant);

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-slate-500">Storefront: {tenant.slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Booked revenue" value={formatCents(rev.bookedRevenueCents)} />
        <Card label="Your payout" value={formatCents(rev.resellerPayoutCents)} />
        <Card label="Platform fees" value={formatCents(rev.platformFeesCents)} />
      </div>

      <h2 className="mt-8 font-semibold">Orders by status</h2>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {Object.entries(rev.byStatus).map(([status, n]) => (
          <li key={status} className="rounded-full bg-white px-3 py-1 shadow-sm">
            {status}: <strong>{n}</strong>
          </li>
        ))}
        {rev.orderCount === 0 && <li className="text-slate-500">No orders yet.</li>}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/reseller/catalog" className="rounded-lg border bg-white px-4 py-2 hover:bg-slate-100">
          Manage catalog →
        </Link>
        <Link href="/reseller/orders" className="rounded-lg border bg-white px-4 py-2 hover:bg-slate-100">
          View orders →
        </Link>
        <Link href="/reseller/branding" className="rounded-lg border bg-white px-4 py-2 hover:bg-slate-100">
          Edit branding →
        </Link>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
