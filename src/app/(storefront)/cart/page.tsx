import Link from "next/link";
import { notFound } from "next/navigation";
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
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/" className="mt-4 inline-block underline">
          Browse {tenant.displayName} →
        </Link>
      </section>
    );
  }

  const t = cart.totals;
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Your cart</h1>

      {cart.hasDrift && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some prices changed since you added them — the latest prices are shown below.
        </p>
      )}

      <ul className="mt-6 divide-y">
        {cart.lines.map((line) => (
          <li key={line.itemId} className="flex items-start justify-between gap-4 py-4">
            <div>
              <div className="font-medium">{line.productName}</div>
              <div className="text-sm text-slate-500">{line.variantLabel}</div>
              <div className="text-sm text-slate-500">
                {line.qty} {line.unitOfMeasure === "each" ? "unit(s)" : line.unitOfMeasure} · ZIP {line.zip}
              </div>
              {!line.available && (
                <div className="mt-1 text-sm text-red-600">No longer available at this address.</div>
              )}
              {line.available && line.driftDeltaCents !== 0 && (
                <div className="mt-1 text-xs text-amber-700">
                  Price {line.driftDeltaCents > 0 ? "up" : "down"} {formatCents(Math.abs(line.driftDeltaCents))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {line.current ? formatCents(line.current.totalCents) : "—"}
              </div>
              <form action={removeCartItem}>
                <input type="hidden" name="itemId" value={line.itemId} />
                <button type="submit" className="mt-1 text-sm text-slate-500 underline hover:text-red-600">
                  Remove
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-1 border-t pt-4 text-sm">
        <Row label="Parts" value={formatCents(t.subtotalCents)} />
        <Row label="Delivery" value={formatCents(t.deliveryCents)} />
        <Row label="Install" value={t.needsQuote ? `${formatCents(t.laborCents)} + site-visit quote` : formatCents(t.laborCents)} />
        <Row label="Haulaway" value={formatCents(t.haulawayCents)} />
        <Row label="Tax" value={formatCents(t.taxCents)} />
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <dt>Total</dt>
          <dd>{formatCents(t.totalCents)}</dd>
        </div>
      </dl>

      <Link
        href="/checkout"
        className="mt-6 block rounded-lg px-6 py-3 text-center font-medium text-white"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        Proceed to checkout →
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
