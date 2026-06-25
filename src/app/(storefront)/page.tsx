/**
 * Home route ("/").
 *  - On a tenant host: the reseller's branded storefront (enabled verticals + coverage).
 *  - On the apex/platform host: a landing page pointing resellers to onboarding.
 */
import Link from "next/link";
import { getCurrentTenant } from "@/server/tenant";
import { getEnabledVerticals } from "@/server/storefront";

export default async function HomePage() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight">RenovateConnect</h1>
        <p className="mt-4 text-lg text-slate-600">
          Launch your own white-label renovation storefront. Sell full-service bundles —
          parts, delivery, install, and haulaway — under your brand.
        </p>
        <Link
          href="/onboarding"
          className="mt-8 inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-700"
        >
          Create your storefront →
        </Link>
      </section>
    );
  }

  const verticals = await getEnabledVerticals(tenant.id);

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>
        {tenant.displayName}
      </h1>
      <p className="mt-2 text-slate-600">
        One price, fully installed. We handle the parts, delivery, install, and haulaway of
        your old fixtures.
      </p>

      {tenant.coverageZips.length > 0 && (
        <p className="mt-3 text-sm text-slate-500">
          Serving ZIP codes: {tenant.coverageZips.join(", ")}
        </p>
      )}

      <h2 className="mt-10 text-xl font-semibold">What we install</h2>
      {verticals.length === 0 ? (
        <p className="mt-3 text-slate-500">No product lines enabled yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {verticals.map((v) => (
            <li
              key={v.id}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--brand-secondary)" }}
            >
              <span className="text-2xl" aria-hidden>
                {v.icon ?? "🔧"}
              </span>
              <div className="mt-2 font-medium">{v.name}</div>
              <div className="text-sm text-slate-500">
                Configure your {v.configuratorType === "area" ? "measured" : "per-unit"} job
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
