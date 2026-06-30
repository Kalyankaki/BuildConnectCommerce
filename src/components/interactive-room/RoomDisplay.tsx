"use client";

import type { Zone, ZoneId } from "./data";

/**
 * High-fidelity interactive room view: a layered CSS scene (concrete wall, oak-slat ceiling,
 * stone floor, low-profile sectional) with a coordinate overlay of pulsing hotspots. Pass
 * `imageSrc` to swap the CSS art for an optimized photoreal render — the hotspots still align.
 */
export function RoomDisplay({
  zones,
  activeZone,
  onZoneClick,
  imageSrc,
}: {
  zones: Zone[];
  activeZone: ZoneId | null;
  onZoneClick: (id: ZoneId) => void;
  imageSrc?: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-[#1a1714] shadow-2xl">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="Luxury living room" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          {/* Back wall — warm concrete / plaster */}
          <div
            className="absolute inset-x-0 top-0 h-[72%]"
            style={{ background: "linear-gradient(160deg,#cdc3b4 0%,#b3a795 55%,#8f8473 100%)" }}
          />
          {/* Main-wall plaster panel (left) */}
          <div
            className="absolute top-[24%] left-[6%] h-[46%] w-[40%]"
            style={{ background: "linear-gradient(135deg,#d8cfc1,#b6ab98)", boxShadow: "inset 0 0 60px rgba(0,0,0,0.12)" }}
          />
          {/* Concrete pillars */}
          {["46%", "88%"].map((l) => (
            <div
              key={l}
              className="absolute top-0 h-[72%] w-[6%]"
              style={{ left: l, background: "linear-gradient(90deg,#9c917f,#bdb3a2,#8b8170)" }}
            />
          ))}
          {/* Oak-slat ceiling */}
          <div
            className="absolute inset-x-0 top-0 h-[20%]"
            style={{
              background:
                "repeating-linear-gradient(90deg,#7a5230 0px,#9a6c40 6px,#7a5230 12px,#6b4626 14px)",
              boxShadow: "inset 0 -18px 30px rgba(0,0,0,0.35)",
            }}
          />
          {/* Warm track lighting */}
          {[20, 38, 56, 74].map((l) => (
            <div
              key={l}
              className="absolute top-[20%] h-16 w-24 -translate-x-1/2"
              style={{ left: `${l}%`, background: "radial-gradient(closest-side,#ffce8a88,transparent)" }}
            />
          ))}
          {/* Stone floor with perspective */}
          <div
            className="absolute inset-x-0 bottom-0 h-[30%]"
            style={{ background: "linear-gradient(180deg,#cfc6ba,#a99e8f)" }}
          />
          {/* Rug */}
          <div
            className="absolute bottom-[4%] left-1/2 h-[16%] w-[58%] -translate-x-1/2 rounded-[40%]"
            style={{ background: "radial-gradient(closest-side,#e7ddd0,#c9bdab)", filter: "blur(0.3px)" }}
          />
          {/* Low-profile sectional */}
          <div className="absolute bottom-[14%] left-[42%] h-[20%] w-[50%]">
            <div className="absolute bottom-0 h-2/3 w-full rounded-2xl" style={{ background: "linear-gradient(180deg,#e9e2d6,#cdc3b3)" }} />
            <div className="absolute bottom-[40%] h-1/2 w-full rounded-2xl" style={{ background: "linear-gradient(180deg,#f1ebe0,#dcd3c5)" }} />
          </div>
          {/* Accent chair */}
          <div
            className="absolute bottom-[15%] left-[20%] h-[16%] w-[14%] rounded-2xl"
            style={{ background: "linear-gradient(180deg,#7c5a3c,#5e4329)" }}
          />
          {/* Vignette */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 30%,transparent 55%,rgba(0,0,0,0.45))" }} />
        </>
      )}

      {/* Active-zone highlight */}
      {zones.map((z) =>
        activeZone === z.id ? (
          <div
            key={`hl-${z.id}`}
            className="pointer-events-none absolute rounded-2xl border-2 border-amber-300/80 bg-amber-300/10 transition-all duration-300"
            style={{ top: `${z.region.top}%`, left: `${z.region.left}%`, width: `${z.region.width}%`, height: `${z.region.height}%` }}
          />
        ) : null,
      )}

      {/* Hotspots */}
      {zones.map((z) => {
        const active = activeZone === z.id;
        return (
          <button
            key={z.id}
            onClick={() => onZoneClick(z.id)}
            aria-label={z.label}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${z.hotspot.top}%`, left: `${z.hotspot.left}%` }}
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              {!active && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/70" />
              )}
              <span
                className={`relative inline-flex rounded-full ring-2 ring-white/70 transition-all ${
                  active ? "h-5 w-5 bg-amber-400" : "h-3 w-3 bg-amber-300 group-hover:h-4 group-hover:w-4"
                }`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
