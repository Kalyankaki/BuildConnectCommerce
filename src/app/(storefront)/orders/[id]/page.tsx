import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { getOrderForTenant } from "@/server/order-core";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Order confirmation" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const data = await getOrderForTenant(tenant, id);
  if (!data) notFound();
  const { order, items } = data;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-xl border border-green-300 bg-green-50 p-6">
        <h1 className="text-2xl font-bold text-green-900">
          {order.depositPaid ? "Booking confirmed 🎉" : "Order received"}
        </h1>
        <p className="mt-2 text-green-800">
          {order.depositPaid
            ? `Your deposit of ${formatCents(order.depositCents)} is paid. We'll be in touch to schedule.`
            : "Your order is recorded; we'll confirm your deposit shortly."}
        </p>
        <p className="mt-1 text-sm text-green-700">
          Order {order.id.slice(0, 8)} · status: {order.status}
        </p>
      </div>

      <h2 className="mt-8 font-semibold">Your job{items.length > 1 ? "s" : ""}</h2>
      <ul className="mt-3 divide-y rounded-xl border">
        {items.map((it) => (
          <li key={it.id} className="flex justify-between px-4 py-3 text-sm">
            <span>
              {it.qty} × line
            </span>
            <span className="font-medium">{formatCents(it.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-1 text-sm">
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
        <Row label="Balance on completion" value={formatCents(order.balanceCents)} />
      </dl>

      <Link href="/" className="mt-8 inline-block underline">
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
