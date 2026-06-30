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
  const toggle = (id: ZoneId) => setActiveZone((p) => (p === id ? null : id));

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#14110e] text-white">
      {/* Full-bleed room image + hotspots */}
      <RoomDisplay zones={ZONES} activeZone={activeZone} onZoneClick={toggle} imageSrc={imageSrc} fullBleed />

      {/* Legibility scrim */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,12,10,.78) 0%, rgba(15,12,10,.15) 26%, rgba(15,12,10,.10) 55%, rgba(15,12,10,.88) 100%)",
        }}
      />

      {/* Overlay UI (clicks pass through empty areas to the hotspots) */}
      <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-6xl flex-col px-4 py-10 sm:px-6 sm:py-12">
        {/* Headline */}
        <div className="pointer-events-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Interactive configurator</p>
          <h1 className="font-serif mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl">
            Design the room. <span className="italic text-amber-200">See the price.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-white/75 sm:text-lg">
            Tap a hotspot to explore each surface — materials, delivery, install, and haulaway,
            itemized and totaled live.
          </p>
        </div>

        <div className="flex-1" />

        {/* Bottom controls */}
        <div className="pointer-events-auto space-y-3">
          {active && (
            <div className="max-w-sm">
              <PriceOverlay
                zone={active}
                selectedOptionId={selectedOptions[active.id]}
                onSelectOption={(optId) => setSelectedOptions((p) => ({ ...p, [active.id]: optId }))}
                onClose={() => setActiveZone(null)}
                onSelectBundle={() => router.push(ctaHref)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <div className="px-2">
              <p className="text-[0.65rem] uppercase tracking-wide text-white/50">Room estimate</p>
              <p className="font-serif text-2xl font-semibold text-amber-300">{formatUSD(grandTotal)}</p>
            </div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {ZONES.map((z) => {
                const Icon = z.icon;
                const on = activeZone === z.id;
                return (
                  <button
                    key={z.id}
                    onClick={() => toggle(z.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      on ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {z.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => router.push(ctaHref)}
              className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Start your storefront <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
