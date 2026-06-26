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
import { getCurrentTenant, getStoreBase } from "@/server/tenant";
import { getEnabledVerticals } from "@/server/storefront";
import { HeroExperience } from "./hero-experience";
import { CountUp, Reveal } from "@/components/motion-ui";

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
      {/* Grand interactive 3D room hero */}
      <section className="relative min-h-[100svh] overflow-hidden bg-slate-950">
        <HeroExperience />
      </section>

      {/* Bundle strip */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-slate-100 sm:grid-cols-4 sm:divide-x">
          {BUNDLE.map(({ icon: Icon, label }, i) => (
            <Reveal key={label} delay={i * 0.08}>
              <div className="flex items-center justify-center gap-2.5 px-4 py-6 text-slate-800">
                <Icon className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-semibold">{label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6">
          {[
            { value: <CountUp to={4} suffix="-in-1" />, label: "Parts, delivery, install & haulaway — one job, one price." },
            { value: <CountUp to={100} suffix="%" />, label: "Transparent, itemized pricing. No surprises at the door." },
            { value: "Minutes", label: "From sign-up to a live, fully-branded storefront." },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <div className="text-center sm:text-left">
                <div className="font-serif text-5xl font-semibold text-amber-400">{s.value}</div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">The platform</p>
          <h2 className="font-serif mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            From storefront to installed,
            <span className="block italic text-slate-500">in three moves.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { icon: Store, title: "Launch your storefront", body: "Choose your verticals, set your markup, drop in your brand. Your subdomain is live in minutes." },
            { icon: ClipboardCheck, title: "Customers configure the job", body: "Homeowners size the work, get a transparent installed-price quote, and book with a deposit." },
            { icon: ShieldCheck, title: "We deliver the craft", body: "Delivery, master-craftsman install, and old-fixture haulaway — scheduled and tracked to done." },
          ].map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-amber-600">Step {i + 1}</div>
                <h3 className="mt-1 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What you can sell */}
      <section id="verticals" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">The catalog</p>
            <h2 className="font-serif mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Built for the renovations people actually buy.
            </h2>
            <p className="mt-4 max-w-xl text-slate-600">
              Every vertical is sold as a complete, installed bundle — configured, quoted, and
              fulfilled end to end.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SHOWCASE.map(({ icon: Icon, name, note }, i) => (
              <Reveal key={name} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-lg">
                  <Icon className="h-8 w-8 text-slate-900" />
                  <h3 className="mt-5 font-display text-lg font-semibold">{name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-amber-500">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(40% 80% at 90% 50%, #ffffff 0%, transparent 70%)" }} />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-center">
          <Reveal>
            <h2 className="font-serif text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              Build your renovation brand.
            </h2>
            <p className="mt-3 max-w-md text-lg text-slate-900/80">
              A branded, full-service storefront — live in minutes, fulfilled end to end.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-8 py-4 font-semibold text-white shadow-xl transition hover:bg-slate-800"
            >
              Start your storefront <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ───────────────────────── Tenant storefront ───────────────────────── */

async function TenantStorefront({ tenant }: { tenant: Awaited<ReturnType<typeof getCurrentTenant>> & object }) {
  const verticals = await getEnabledVerticals(tenant.id);
  const base = await getStoreBase();

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
                href={`${base}/shop/${v.slug}`}
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
