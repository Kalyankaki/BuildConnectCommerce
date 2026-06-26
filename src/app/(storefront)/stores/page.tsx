import Link from "next/link";
import { ArrowRight, MapPin, Store } from "lucide-react";
import { listActiveStores } from "@/server/storefront";

export const metadata = { title: "Browse storefronts · RenovateConnect" };
export const dynamic = "force-dynamic";

export default async function StoresDirectory() {
  const stores = await listActiveStores();

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">Directory</p>
      <h1 className="font-serif mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Live storefronts</h1>
      <p className="mt-3 max-w-xl text-slate-600">
        Branded renovation storefronts running on RenovateConnect. Every one sells the full job —
        parts, delivery, install, and haulaway.
      </p>

      {stores.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center text-slate-500">
          <Store className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3">No storefronts yet.</p>
          <Link href="/onboarding" className="mt-3 inline-block font-medium text-slate-900 underline">
            Create the first one →
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <Link
              key={s.slug}
              href={`/store/${s.slug}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="h-2 w-full" style={{ backgroundColor: s.primaryColor }} />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: s.primaryColor }}
                  >
                    <Store className="h-5 w-5" />
                  </span>
                  <h2 className="font-display text-lg font-semibold">{s.displayName}</h2>
                </div>
                {s.coverageZips.length > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" /> {s.coverageZips.join(", ")}
                  </p>
                )}
                <span
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                  style={{ color: s.primaryColor }}
                >
                  Visit store <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
