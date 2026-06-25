import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { getCurrentTenant } from "@/server/tenant";
import { getCartToken } from "@/server/cart-cookie";
import { loadCartForToken } from "@/server/cart-core";
import { removeCartItem } from "@/server/cart";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Your cart" };

export default async function CartPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const token = await getCartToken();
  const cart = await loadCartForToken(tenant, token);

  if (!cart || cart.lines.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <ShoppingCart className="h-6 w-6 text-slate-400" />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold">Your cart is empty</h1>
        <Link href="/" className="mt-4 inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--brand-primary)" }}>
          Browse {tenant.displayName} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  const t = cart.totals;
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Your cart</h1>

      {cart.hasDrift && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some prices changed since you added them — the latest prices are shown below.
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {cart.lines.map((line) => (
            <li key={line.itemId} className="flex items-start justify-between gap-4 p-5">
              <div>
                <div className="font-display font-semibold">{line.productName}</div>
                <div className="text-sm text-slate-500">{line.variantLabel}</div>
                <div className="mt-0.5 text-sm text-slate-500">
                  {line.qty} {line.unitOfMeasure === "each" ? "unit(s)" : line.unitOfMeasure} · ZIP {line.zip}
                </div>
                {!line.available && <div className="mt-1 text-sm text-red-600">No longer available at this address.</div>}
                {line.available && line.driftDeltaCents !== 0 && (
                  <div className="mt-1 text-xs text-amber-700">
                    Price {line.driftDeltaCents > 0 ? "up" : "down"} {formatCents(Math.abs(line.driftDeltaCents))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold">{line.current ? formatCents(line.current.totalCents) : "—"}</div>
                <form action={removeCartItem}>
                  <input type="hidden" name="itemId" value={line.itemId} />
                  <button type="submit" className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-base font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label="Parts" value={formatCents(t.subtotalCents)} />
            <Row label="Delivery" value={formatCents(t.deliveryCents)} />
            <Row label="Install" value={t.needsQuote ? `${formatCents(t.laborCents)} + visit` : formatCents(t.laborCents)} />
            <Row label="Haulaway" value={formatCents(t.haulawayCents)} />
            <Row label="Tax" value={formatCents(t.taxCents)} />
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatCents(t.totalCents)}</dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            className="mt-5 flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Checkout <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
