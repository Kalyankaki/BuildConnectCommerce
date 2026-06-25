import { resellerContextOrRedirect, getRevenueSummary } from "@/server/reseller-data";
import { formatCents } from "@/lib/format";
import { ConnectButton } from "./connect-button";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const { tenant } = await resellerContextOrRedirect();
  const rev = await getRevenueSummary(tenant);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Payouts</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Booked revenue" value={formatCents(rev.bookedRevenueCents)} />
        <Card label="Your payout" value={formatCents(rev.resellerPayoutCents)} />
        <Card label="Platform fees" value={formatCents(rev.platformFeesCents)} />
      </div>

      <h2 className="mt-8 font-semibold">Stripe Connect</h2>
      <div className="mt-2 rounded-xl border bg-white p-5">
        {tenant.stripeAccountId ? (
          <p className="text-sm text-green-700">
            Connected — account <code>{tenant.stripeAccountId}</code>. Payouts settle to your bank
            via Stripe; the platform retains its margin as an application fee.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              Connect a Stripe account to receive payouts. Until then, orders run in mock payment mode.
            </p>
            <ConnectButton />
          </>
        )}
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
