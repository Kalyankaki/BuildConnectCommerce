import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Hammer,
  MapPin,
  Package,
  PaintRoller,
  Ruler,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Trash2,
} from "lucide-react";
import { getCurrentTenant } from "@/server/tenant";
import { getEnabledVerticals } from "@/server/storefront";
import { Hero3D } from "./hero-3d";

export default async function HomePage() {
  const tenant = await getCurrentTenant();
  return tenant ? <TenantStorefront tenant={tenant} /> : <MarketingLanding />;
}

/* ───────────────────────── Apex marketing landing ───────────────────────── */

const BUNDLE = [
  { icon: Package, label: "Parts" },
  { icon: Truck, label: "Delivery" },
  { icon: Hammer, label: "Install" },
  { icon: Trash2, label: "Haulaway" },
];

const SHOWCASE = [
  { icon: Ruler, name: "Carpet → Hardwood", note: "Measured by the sq ft" },
  { icon: Store, name: "Toilets & commodes", note: "Swap-and-haul, per unit" },
  { icon: PaintRoller, name: "Decorative panels", note: "Accent walls, installed" },
  { icon: Sparkles, name: "Bathroom updates", note: "Multi-item bundles" },
];

function MarketingLanding() {
  return (
    <>
      {/* Grand full-height hero — 3D centerpiece behind a luxury serif headline */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-slate-950 text-white">
        {/* Ambient gold light */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(60% 50% at 50% 38%, #f59e0b33 0%, transparent 70%)" }}
        />
        {/* Full-bleed 3D object */}
        <div className="absolute inset-x-0 top-0 h-[72%]">
          <Hero3D />
        </div>
        {/* Legibility scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950" />

        {/* Content, anchored toward the lower third */}
        <div className="relative z-10 mx-auto flex max-w-4xl flex-1 flex-col items-center justify-end px-6 pb-28 pt-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-amber-300">
            <Hammer className="h-3.5 w-3.5" /> White-label renovation commerce
          </span>
          <h1 className="font-serif mt-8 text-5xl font-semibold leading-[0.98] sm:text-7xl lg:text-8xl">
            Renovation materials,
            <span className="mt-1 block italic">
              <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                fully installed.
              </span>
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300/90">
            A branded storefront that sells the entire job — parts, delivery, master-craftsman
            install, and haulaway of the old fixture — for one transparent price.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-8 py-3.5 font-semibold text-slate-950 shadow-xl shadow-amber-500/25 transition hover:bg-amber-400"
            >
              Start your storefront <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white transition hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Bundle strip */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-slate-100 sm:grid-cols-4 sm:divide-x">
          {BUNDLE.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2.5 px-4 py-6 text-slate-800">
              <Icon className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h2 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Store, title: "Spin up your storefront", body: "Pick your verticals, set your markup, add your brand. Your subdomain goes live instantly." },
            { icon: ClipboardCheck, title: "Customers configure the job", body: "Homeowners size the job, get a transparent installed-price quote, and book with a deposit." },
            { icon: ShieldCheck, title: "We handle fulfillment", body: "Delivery, professional install, and haulaway are scheduled and tracked to completion." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-600">Step {i + 1}</div>
              <h3 className="mt-1 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we install */}
      <section id="verticals" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">What you can sell</h2>
          <p className="mt-3 max-w-xl text-slate-600">
            Configurable verticals for the renovations homeowners actually buy — each sold as a
            complete, installed bundle.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SHOWCASE.map(({ icon: Icon, name, note }) => (
              <div key={name} className="rounded-2xl border border-slate-200 bg-white p-6">
                <Icon className="h-7 w-7 text-slate-900" />
                <h3 className="mt-4 font-semibold">{name}</h3>
                <p className="mt-1 text-sm text-slate-500">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-amber-500">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-serif text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Ready to launch?</h2>
            <p className="mt-2 text-slate-900/80">Your branded, full-service storefront in minutes.</p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Start your storefront <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

/* ───────────────────────── Tenant storefront ───────────────────────── */

async function TenantStorefront({ tenant }: { tenant: Awaited<ReturnType<typeof getCurrentTenant>> & object }) {
  const verticals = await getEnabledVerticals(tenant.id);

  return (
    <>
      {/* Branded hero */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "radial-gradient(50% 80% at 90% 0%, #ffffff 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h1 className="font-serif max-w-3xl text-5xl font-semibold leading-[1.02] sm:text-6xl">
            {tenant.displayName}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            One price, fully installed. We handle the parts, delivery, professional install, and
            haulaway of your old fixtures.
          </p>
          {tenant.coverageZips.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              <span className="text-white/80">Serving</span>
              {tenant.coverageZips.map((z) => (
                <span key={z} className="rounded-full bg-white/15 px-2.5 py-0.5 font-medium">{z}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bundle trust strip */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
          {BUNDLE.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-slate-700">
              <Icon className="h-5 w-5" style={{ color: "var(--brand-primary)" }} /> {label}
            </div>
          ))}
        </div>
      </section>

      {/* Verticals */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">What we install</h2>
        {verticals.length === 0 ? (
          <p className="mt-4 text-slate-500">No product lines enabled yet.</p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {verticals.map((v) => (
              <Link
                key={v.id}
                href={`/shop/${v.slug}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="text-3xl" aria-hidden>{v.icon ?? "🔧"}</span>
                <h3 className="mt-3 font-display text-lg font-semibold">{v.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Configure your {v.configuratorType === "area" ? "measured" : "per-unit"} job
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--brand-primary)" }}>
                  Get a quote <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
