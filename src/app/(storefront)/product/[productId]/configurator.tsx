"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quoteJob, type QuoteResult } from "@/server/quote";
import { addToCart } from "@/server/cart";
import { formatCents } from "@/lib/format";
import type { PricedVariant } from "@/server/storefront";

type ConfiguratorType = "unit" | "area" | "linear" | "custom";

function variantLabel(v: PricedVariant): string {
  const attrs = Object.values(v.attributes ?? {}).join(" · ");
  return attrs ? `${attrs} (${v.sku})` : v.sku;
}

export function Configurator({
  variants,
  configuratorType,
  coverageZips,
}: {
  variants: PricedVariant[];
  configuratorType: ConfiguratorType;
  coverageZips: string[];
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

  const estimate = useMemo(
    () => (selected ? selected.unitPriceCents * quantity : 0),
    [selected, quantity],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    startTransition(async () => {
      const r = await quoteJob({ variantId, zip, quantity });
      setResult(r);
    });
  }

  function onAddToCart() {
    setAddError(null);
    startAdding(async () => {
      const r = await addToCart({ variantId, zip, quantity });
      if (!r.ok) {
        setAddError(r.error ?? "Could not add to cart");
        return;
      }
      router.push("/cart");
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Configure your job</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Option</span>
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {variantLabel(v)} — {formatCents(v.unitPriceCents)}
              {v.unitOfMeasure === "each" ? " / unit" : ` / ${v.unitOfMeasure}`}
            </option>
          ))}
        </select>
      </label>

      {isArea ? (
        <fieldset className="grid grid-cols-2 gap-4">
          <legend className="mb-1 text-sm font-medium">Room size</legend>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Length (ft)</span>
            <input
              type="number"
              min={1}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Width (ft)</span>
            <input
              type="number"
              min={1}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <p className="col-span-2 text-sm text-slate-600">
            Area: <strong>{quantity} sq ft</strong>
          </p>
        </fieldset>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Quantity</span>
          <input
            type="number"
            min={1}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2"
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Service ZIP code</span>
        <input
          inputMode="numeric"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="98036"
          className="w-full rounded-lg border px-3 py-2"
          aria-describedby="zip-help"
        />
        <span id="zip-help" className="mt-1 block text-xs text-slate-500">
          {coverageZips.length > 0 ? `We serve: ${coverageZips.join(", ")}` : "Enter your ZIP"}
        </span>
      </label>

      <p className="text-sm text-slate-500">
        Parts estimate: {formatCents(estimate)} — get the full installed price below.
      </p>

      <button
        type="submit"
        disabled={pending || !selected || quantity < 1 || !zip}
        className="w-full rounded-lg px-6 py-3 font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {pending ? "Calculating…" : "Get my installed price"}
      </button>

      <div aria-live="polite">
        {result && !result.ok && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {result.error}
          </p>
        )}
        {result && result.ok && <QuoteBreakdown result={result} />}
      </div>

      {result && result.ok && (
        <div className="space-y-2">
          {addError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
              {addError}
            </p>
          )}
          <button
            type="button"
            onClick={onAddToCart}
            disabled={adding}
            className="w-full rounded-lg border-2 px-6 py-3 font-medium disabled:opacity-50"
            style={{ borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }}
          >
            {adding ? "Adding…" : "Add to cart"}
          </button>
        </div>
      )}
    </form>
  );
}

function QuoteBreakdown({ result }: { result: Extract<QuoteResult, { ok: true }> }) {
  const q = result.quote;
  const row = (label: string, value: string) => (
    <div className="flex justify-between py-1">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-green-300 bg-green-50 p-5">
      <h3 className="text-base font-semibold text-green-900">Your full-service quote</h3>
      <div className="mt-3 text-sm">
        {row("Parts", formatCents(q.subtotalCents))}
        {row("Delivery", formatCents(q.deliveryCents))}
        {row("Install (labor)", q.needsQuote && q.laborCents === 0 ? "Quote after site visit" : formatCents(q.laborCents))}
        {row("Haulaway (old fixture)", formatCents(q.haulawayCents))}
        {row("Tax", formatCents(q.taxCents))}
        <div className="mt-2 flex justify-between border-t pt-2 text-base">
          <span className="font-semibold">Total{q.needsQuote ? " (excl. labor)" : ""}</span>
          <span className="font-bold">{formatCents(q.totalCents)}</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-green-800">
        Estimated lead time: {result.leadTimeDays} days
        {q.needsQuote ? " · final install price confirmed after a site visit" : ""}
      </p>
    </div>
  );
}
