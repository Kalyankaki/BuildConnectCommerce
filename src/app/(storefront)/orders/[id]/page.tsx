import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTenant, getStoreBase } from "@/server/tenant";
import { getOrderTrackingForTenant } from "@/server/order-core";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Order tracking" };

const LIFECYCLE = ["booked", "scheduled", "in_progress", "completed", "closed"] as const;

function fmtWindow(start: Date | null, end: Date | null): string {
  if (!start) return "To be scheduled";
  const d = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
  return end ? `${d.format(start)} – ${new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(end)}` : d.format(start);
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const base = await getStoreBase();
  const data = await getOrderTrackingForTenant(tenant, id);
  if (!data) notFound();
  const { order, items, appointments, events } = data;

  const currentIdx = LIFECYCLE.indexOf(order.status as (typeof LIFECYCLE)[number]);

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-xl border border-green-300 bg-green-50 p-6">
        <h1 className="text-2xl font-bold text-green-900">
          {order.depositPaid ? "Booking confirmed 🎉" : "Order received"}
        </h1>
        <p className="mt-1 text-sm text-green-700">
          Order {order.id.slice(0, 8)} · status: <strong>{order.status}</strong>
        </p>
      </div>

      {/* Lifecycle progress */}
      <ol className="mt-8 flex flex-wrap gap-2">
        {LIFECYCLE.map((step, i) => {
          const done = currentIdx >= 0 && i <= currentIdx;
          return (
            <li
              key={step}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: done ? "var(--brand-primary)" : "#e2e8f0",
                color: done ? "white" : "#475569",
              }}
            >
              {step}
            </li>
          );
        })}
      </ol>

      {/* Appointments */}
      <h2 className="mt-8 font-semibold">Appointments</h2>
      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No appointments scheduled yet.</p>
      ) : (
        <ul className="mt-3 divide-y rounded-xl border">
          {appointments.map((a) => (
            <li key={a.id} className="flex justify-between px-4 py-3 text-sm">
              <span className="capitalize">{a.type}</span>
              <span className="text-slate-600">{fmtWindow(a.windowStart, a.windowEnd)}</span>
              <span className="capitalize text-slate-500">{a.status}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Timeline</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {events.map((e) => (
              <li key={e.id}>
                {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(e.createdAt)} —{" "}
                {e.fromStatus ? `${e.fromStatus} → ` : ""}
                {e.toStatus}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Totals */}
      <dl className="mt-8 space-y-1 text-sm">
        <Row label="Parts" value={formatCents(order.subtotalCents)} />
        <Row label="Delivery" value={formatCents(order.deliveryCents)} />
        <Row label="Install" value={formatCents(order.laborCents)} />
        <Row label="Haulaway" value={formatCents(order.haulawayCents)} />
        <Row label="Tax" value={formatCents(order.taxCents)} />
        <div className="flex justify-between border-t pt-2 font-bold">
          <dt>Total</dt>
          <dd>{formatCents(order.totalCents)}</dd>
        </div>
        <Row label="Deposit paid" value={formatCents(order.depositPaid ? order.depositCents : 0)} />
        <Row
          label={order.balancePaid ? "Balance paid" : "Balance due on completion"}
          value={formatCents(order.balanceCents)}
        />
      </dl>

      <p className="mt-4 text-xs text-slate-400">{items.length} item(s) in this order.</p>
      <Link href={`${base}/`} className="mt-6 inline-block underline">
        ← Back to {tenant.displayName}
      </Link>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
