"use client";

import { Check, X } from "lucide-react";
import { formatUSD, optionTotal, type Zone } from "./data";

const TYPE_LABEL: Record<string, string> = {
  parts: "Parts",
  delivery: "Delivery",
  install: "Install",
  haulaway: "Haulaway",
};

export function PriceOverlay({
  zone,
  selectedOptionId,
  onSelectOption,
  onClose,
  onSelectBundle,
}: {
  zone: Zone;
  selectedOptionId: string;
  onSelectOption: (optionId: string) => void;
  onClose: () => void;
  onSelectBundle: () => void;
}) {
  const option = zone.options.find((o) => o.id === selectedOptionId) ?? zone.options[0];
  const total = optionTotal(option);

  return (
    <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-amber-300">{zone.label}</p>
          <h3 className="font-serif text-xl font-semibold">{option.name}</h3>
          <p className="text-sm text-white/60">{option.material}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Option switcher */}
      {zone.options.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {zone.options.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelectOption(o.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                o.id === option.id ? "bg-amber-400 text-slate-950" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}

      {/* Itemized */}
      <dl className="mt-5 space-y-2 text-sm">
        {option.items.map((it) => (
          <div key={it.id} className="flex justify-between">
            <dt className="text-white/70">
              <span className="text-white/40">{TYPE_LABEL[it.type]}</span> · {it.name}
            </dt>
            <dd className="font-medium tabular-nums">{formatUSD(it.price)}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-white/15 pt-3 text-base">
          <dt className="font-semibold">Zone total</dt>
          <dd className="font-bold tabular-nums">{formatUSD(total)}</dd>
        </div>
      </dl>

      <button
        onClick={onSelectBundle}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-300"
      >
        <Check className="h-4 w-4" /> Select this bundle
      </button>
    </div>
  );
}
