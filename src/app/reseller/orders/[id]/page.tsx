import Link from "next/link";
import { notFound } from "next/navigation";
import { resellerContextOrRedirect } from "@/server/reseller-data";
import { getOrderTrackingForTenant } from "@/server/order-core";
import { advanceOrderForm, scheduleOrderForm } from "@/server/order-actions";
import { ORDER_TRANSITIONS, type OrderStatus } from "@/server/lifecycle-core";
import { formatCents } from "@/lib/format";

function fmt(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d) : "—";
}

export default async function ResellerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await resellerContextOrRedirect();
  const data = await getOrderTrackingForTenant(tenant, id);
  if (!data) notFound();
  const { order, items, appointments } = data;
  const nextStates = ORDER_TRANSITIONS[order.status as OrderStatus] ?? [];

  return (
    <div className="max-w-2xl">
      <Link href="/reseller/orders" className="text-sm underline">
        ← Orders
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Order {order.id.slice(0, 8)}</h1>
      <p className="text-slate-500">
        {order.customerEmail} · status <strong>{order.status}</strong> · {formatCents(order.totalCents)}
      </p>

      <h2 className="mt-6 font-semibold">Items</h2>
      <ul className="mt-2 divide-y rounded-xl border bg-white">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between px-4 py-2 text-sm">
            <span>{it.qty} × line</span>
            <span>{formatCents(it.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-semibold">Appointments</h2>
      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None yet.</p>
      ) : (
        <ul className="mt-2 divide-y rounded-xl border bg-white text-sm">
          {appointments.map((a) => (
            <li key={a.id} className="flex justify-between px-4 py-2">
              <span className="capitalize">{a.type}</span>
              <span>{fmt(a.windowStart)}</span>
              <span className="capitalize text-slate-500">{a.status}</span>
            </li>
          ))}
        </ul>
      )}

      {order.status === "booked" && (
        <form action={scheduleOrderForm} className="mt-6 flex items-end gap-3 rounded-xl border bg-white p-4">
          <input type="hidden" name="orderId" value={order.id} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Schedule window start</span>
            <input type="datetime-local" name="date" required className="rounded-lg border px-3 py-2" />
          </label>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Schedule job</button>
        </form>
      )}

      {nextStates.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold">Advance status</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {nextStates.map((to) => (
              <form key={to} action={advanceOrderForm}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="to" value={to} />
                <button className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-100">
                  Mark {to.replace("_", " ")}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
