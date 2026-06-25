"use client";

import { useActionState } from "react";
import { placeOrder, type CheckoutState } from "@/server/order";

const initial: CheckoutState = { ok: false };
const input = "w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400";

export function CheckoutForm({ defaultZip }: { defaultZip: string }) {
  const [state, action, pending] = useActionState(placeOrder, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <h2 className="font-semibold">Contact</h2>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Full name</span>
        <input name="name" required className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input type="email" name="email" required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Phone</span>
          <input name="phone" className={input} />
        </label>
      </div>

      <h2 className="pt-2 font-semibold">Service address</h2>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Street address</span>
        <input name="line1" required className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-medium">City</span>
          <input name="city" required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">State</span>
          <input name="state" required className={input} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">ZIP</span>
          <input name="zip" required defaultValue={defaultZip} className={input} />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-lg px-6 py-3 font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {pending ? "Placing order…" : "Place order & pay deposit"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Deposit charged now; balance due on completion. (Payments run in mock mode until Stripe is connected.)
      </p>
    </form>
  );
}
