import Link from "next/link";
import { resellerContextOrRedirect, listOrdersForReseller } from "@/server/reseller-data";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Orders" };

const COLUMNS = ["quote", "needs_quote", "booked", "scheduled", "in_progress", "completed", "closed"] as const;

export default async function OrdersBoard() {
  const { tenant } = await resellerContextOrRedirect();
  const orders = await listOrdersForReseller(tenant);

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = orders.filter((o) => o.status === col);
          return (
            <div key={col} className="w-64 shrink-0">
              <h2 className="mb-2 text-sm font-semibold capitalize text-slate-600">
                {col.replace("_", " ")} ({items.length})
              </h2>
              <div className="space-y-2">
                {items.map((o) => (
                  <Link
                    key={o.id}
                    href={`/reseller/orders/${o.id}`}
                    className="block rounded-lg border bg-white p-3 text-sm shadow-sm hover:shadow"
                  >
                    <div className="font-medium">{o.id.slice(0, 8)}</div>
                    <div className="text-slate-500">{o.customerEmail}</div>
                    <div className="mt-1 font-semibold">{formatCents(o.totalCents)}</div>
                  </Link>
                ))}
                {items.length === 0 && <p className="text-xs text-slate-400">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
