"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Loader2 } from "lucide-react";
import { quoteJob, type QuoteResult } from "@/server/quote";
import { addToCart } from "@/server/cart";
import { formatCents } from "@/lib/format";
import type { PricedVariant } from "@/server/storefront";

type ConfiguratorType = "unit" | "area" | "linear" | "custom";

function variantLabel(v: PricedVariant): string {
  const attrs = Object.values(v.attributes ?? {}).join(" · ");
  return attrs ? `${attrs} (${v.sku})` : v.sku;
}

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function Configurator({
  variants,
  configuratorType,
  coverageZips,
  base = "",
}: {
  variants: PricedVariant[];
  configuratorType: ConfiguratorType;
  coverageZips: string[];
  base?: string;
}) {
  const isArea = configuratorType === "area";
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [zip, setZip] = useState(coverageZips[0] ?? "");
  const [length, setLength] = useState(12);
  const [width, setWidth] = useState(10);
  const [units, setUnits] = useState(1);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, startAdding] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const router = useRouter();

  const quantity = isArea ? Math.max(0, Math.round(length * width)) : Math.max(0, Math.round(units));
  const selected = variants.find((v) => v.id === variantId);
  const estimate = useMemo(() => (selected ? selected.unitPriceCents * quantity : 0), [selected, quantity]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    startTransition(async () => setResult(await quoteJob({ variantId, zip, quantity })));
  }

  function onAddToCart() {
    setAddError(null);
    startAdding(async () => {
      const r = await addToCart({ variantId, zip, quantity });
      if (!r.ok) return setAddError(r.error ?? "Could not add to cart");
      router.push(`${base}/cart`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Configure your job</h2>
      <p className="mt-1 text-sm text-slate-500">Get your full installed price in seconds.</p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Option</span>
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={field}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(v)} — {formatCents(v.unitPriceCents)}{v.unitOfMeasure === "each" ? " / unit" : ` / ${v.unitOfMeasure}`}
              </option>
            ))}
          </select>
        </label>

        {isArea ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Room size</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Length (ft)</span>
                <input type="number" min={1} value={length} onChange={(e) => setLength(Number(e.target.value))} className={field} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Width (ft)</span>
                <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} className={field} />
              </label>
            </div>
            <p className="mt-2 text-sm text-slate-600">Area: <strong>{quantity} sq ft</strong></p>
          </fieldset>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Quantity</span>
            <input type="number" min={1} value={units} onChange={(e) => setUnits(Number(e.target.value))} className={field} />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Service ZIP code</span>
          <input inputMode="numeric" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="98036" className={field} aria-describedby="zip-help" />
          <span id="zip-help" className="mt-1 block text-xs text-slate-500">
            {coverageZips.length > 0 ? `We serve: ${coverageZips.join(", ")}` : "Enter your ZIP"}
          </span>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <span>Parts estimate</span>
        <span className="font-semibold text-slate-900">{formatCents(estimate)}</span>
      </div>

      <button
        type="submit"
        disabled={pending || !selected || quantity < 1 || !zip}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</> : "Get my installed price"}
      </button>

      <div aria-live="polite" className="mt-4">
        {result && !result.ok && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>
        )}
        {result && result.ok && <QuoteBreakdown result={result} />}
      </div>

      {result && result.ok && (
        <div className="mt-4 space-y-2">
          {addError && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{addError}</p>}
          <button
            type="button"
            onClick={onAddToCart}
            disabled={adding}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 px-6 py-3 font-semibold transition disabled:opacity-50"
            style={{ borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }}
          >
            {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : <>Add to cart <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </form>
  );
}

function QuoteBreakdown({ result }: { result: Extract<QuoteResult, { ok: true }> }) {
  const q = result.quote;
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-1.5">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
      <h3 className="font-display text-base font-semibold text-emerald-900">Your full-service quote</h3>
      <div className="mt-3 text-sm">
        <Row label="Parts" value={formatCents(q.subtotalCents)} />
        <Row label="Delivery" value={formatCents(q.deliveryCents)} />
        <Row label="Install (labor)" value={q.needsQuote && q.laborCents === 0 ? "Quote after site visit" : formatCents(q.laborCents)} />
        <Row label="Haulaway (old fixture)" value={formatCents(q.haulawayCents)} />
        <Row label="Tax" value={formatCents(q.taxCents)} />
        <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2.5 text-base">
          <span className="font-semibold text-slate-900">Total{q.needsQuote ? " (excl. labor)" : ""}</span>
          <span className="font-bold text-slate-900">{formatCents(q.totalCents)}</span>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-800">
        <Clock className="h-4 w-4" /> Est. lead time: {result.leadTimeDays} days
        {q.needsQuote ? " · final labor confirmed after a site visit" : ""}
      </p>
    </div>
  );
}
