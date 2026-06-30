"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ZONES, formatUSD, optionTotal, type ZoneId } from "./data";
import { RoomDisplay } from "./RoomDisplay";
import { PriceOverlay } from "./PriceOverlay";

export function RoomConfigurator({ imageSrc, ctaHref = "/onboarding" }: { imageSrc?: string; ctaHref?: string }) {
  const router = useRouter();
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<ZoneId, string>>(() =>
    Object.fromEntries(ZONES.map((z) => [z.id, z.options[0].id])) as Record<ZoneId, string>,
  );

  const zoneTotal = (id: ZoneId) => {
    const z = ZONES.find((x) => x.id === id)!;
    return optionTotal(z.options.find((o) => o.id === selectedOptions[id]) ?? z.options[0]);
  };
  const grandTotal = useMemo(
    () => ZONES.reduce((sum, z) => sum + zoneTotal(z.id), 0),
    [selectedOptions], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const active = ZONES.find((z) => z.id === activeZone) ?? null;

  return (
    <section className="relative overflow-hidden bg-[#14110e] text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 0%, #f59e0b22, transparent 70%)" }} />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Interactive configurator</p>
        <h1 className="font-serif mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Design the room. <span className="italic text-amber-200">See the price.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/70">
          Tap a hotspot to explore each surface — materials, delivery, install, and haulaway,
          itemized and totaled live. The full job, one transparent price.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_22rem]">
          {/* Room + overlay */}
          <div className="relative aspect-[16/11] w-full sm:aspect-[16/10]">
            <RoomDisplay zones={ZONES} activeZone={activeZone} onZoneClick={(id) => setActiveZone((p) => (p === id ? null : id))} imageSrc={imageSrc} />
            {active && (
              <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-80">
                <PriceOverlay
                  zone={active}
                  selectedOptionId={selectedOptions[active.id]}
                  onSelectOption={(optId) => setSelectedOptions((p) => ({ ...p, [active.id]: optId }))}
                  onClose={() => setActiveZone(null)}
                  onSelectBundle={() => router.push(ctaHref)}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">Your room estimate</p>
              <p className="font-serif mt-1 text-4xl font-semibold text-amber-300">{formatUSD(grandTotal)}</p>
              <p className="mt-1 text-xs text-white/50">Parts + delivery + install + haulaway, all four zones.</p>
              <button
                onClick={() => router.push(ctaHref)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Start your storefront <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {ZONES.map((z) => {
                const Icon = z.icon;
                const isActive = activeZone === z.id;
                const opt = z.options.find((o) => o.id === selectedOptions[z.id]) ?? z.options[0];
                return (
                  <button
                    key={z.id}
                    onClick={() => setActiveZone((p) => (p === z.id ? null : z.id))}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isActive ? "border-amber-300/60 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-4 w-4 text-amber-300" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{z.label}</span>
                      <span className="block truncate text-xs text-white/50">{opt.name}</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums text-white/80">{formatUSD(zoneTotal(z.id))}</span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
