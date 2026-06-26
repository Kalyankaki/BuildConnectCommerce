import { notFound, redirect } from "next/navigation";
import { getCurrentTenant, getStoreBase } from "@/server/tenant";
import { getCartToken } from "@/server/cart-cookie";
import { loadCartForToken } from "@/server/cart-core";
import { formatCents } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const base = await getStoreBase();
  const token = await getCartToken();
  const cart = await loadCartForToken(tenant, token);
  if (!cart || cart.lines.length === 0) redirect(`${base}/cart`);

  const depositPct = tenant.depositPercent ?? Number(process.env.DEFAULT_DEPOSIT_PERCENT ?? 50);
  const depositCents = Math.round((cart.totals.totalCents * depositPct) / 100);
  const defaultZip = cart.lines[0]?.zip ?? "";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Checkout</h1>

      <div className="mt-6 rounded-xl border p-5">
        <h2 className="font-semibold">Order summary</h2>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-slate-600">Total</span>
          <span className="font-semibold">{formatCents(cart.totals.totalCents)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-slate-600">Due today ({depositPct}% deposit)</span>
          <span className="font-semibold">{formatCents(depositCents)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-slate-600">Balance on completion</span>
          <span>{formatCents(cart.totals.totalCents - depositCents)}</span>
        </div>
      </div>

      <CheckoutForm defaultZip={defaultZip} />
    </section>
  );
}
