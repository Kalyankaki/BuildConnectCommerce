/**
 * RenovateConnect — pricing engine (B.4).
 *
 * PURE, server-only functions. No I/O, no DB, no client input. The DB layer fetches
 * catalog/zone/policy rows and passes plain numbers in; this module computes prices.
 * Keeping it pure makes every rule unit-testable without a database.
 *
 * INVARIANTS:
 *  - All money is integer CENTS. All ratios are basis points (bps): 10000 = 1.0 = 100%.
 *  - Prices are NEVER computed on the client. Recompute server-side at quote, add-to-cart,
 *    and checkout (B.7).
 *  - Customer price can never fall below the wholesale floor (B.4).
 */

export type PricingModel = "flat" | "per_unit" | "per_area" | "quote";
export type ServiceType = "delivery" | "labor" | "haulaway";

export const BPS_DENOMINATOR = 10000;

/* ───────────────────────────── guards ───────────────────────────── */

function assertInt(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`pricing: ${label} must be an integer (got ${value})`);
  }
}

function assertNonNegativeInt(value: number, label: string): void {
  assertInt(value, label);
  if (value < 0) throw new Error(`pricing: ${label} must be >= 0 (got ${value})`);
}

/** Round a fractional cents value to the nearest whole cent. */
export function roundCents(value: number): number {
  return Math.round(value);
}

/* ──────────────────────────── unit price ─────────────────────────── */

/**
 * Apply a markup (in bps) to the platform list price. markupBps may be negative
 * (a discount); the wholesale floor is applied separately by customerUnitPrice().
 */
export function applyMarkup(platformListCents: number, markupBps: number): number {
  assertNonNegativeInt(platformListCents, "platformListCents");
  assertInt(markupBps, "markupBps");
  return roundCents((platformListCents * (BPS_DENOMINATOR + markupBps)) / BPS_DENOMINATOR);
}

/**
 * Customer-facing unit price: list * (1 + markup), floored at wholesale so a reseller
 * can never sell below the platform's wholesale cost (B.4 wholesale-floor rule).
 */
export function customerUnitPrice(
  platformListCents: number,
  wholesaleCents: number,
  markupBps: number,
): number {
  assertNonNegativeInt(wholesaleCents, "wholesaleCents");
  const marked = applyMarkup(platformListCents, markupBps);
  return Math.max(marked, wholesaleCents);
}

/**
 * Resolve the effective markup in bps. Precedence (B.4 / B.10):
 *   tenant_catalog override → markup policy per-vertical → markup policy default.
 */
export function resolveMarkupBps(input: {
  catalogOverrideBps?: number | null;
  perVerticalBps?: number | null;
  defaultBps: number;
}): number {
  if (input.catalogOverrideBps != null) return input.catalogOverrideBps;
  if (input.perVerticalBps != null) return input.perVerticalBps;
  return input.defaultBps;
}

/* ───────────────────────────── services ─────────────────────────── */

export interface ServiceInput {
  pricingModel: PricingModel;
  baseCents: number;
  perUnitCents: number;
}

export interface ServicePriceResult {
  cents: number;
  needsQuote: boolean;
}

/**
 * Price a single service (delivery / labor / haulaway).
 *  - flat:      baseCents
 *  - per_unit:  baseCents + perUnitCents * units   (units = quantity)
 *  - per_area:  baseCents + perUnitCents * units   (units = area in sqft)
 *  - quote:     needsQuote=true, cents=0 (priced after a site visit)
 *
 * `multiplierBps` scales the result — used for the ZIP labor multiplier (10000 = no change).
 */
export function servicePrice(
  service: ServiceInput | null | undefined,
  opts: { units: number; multiplierBps?: number },
): ServicePriceResult {
  if (!service) return { cents: 0, needsQuote: false };
  const multiplierBps = opts.multiplierBps ?? BPS_DENOMINATOR;
  assertNonNegativeInt(service.baseCents, "service.baseCents");
  assertNonNegativeInt(service.perUnitCents, "service.perUnitCents");
  assertInt(multiplierBps, "multiplierBps");

  if (service.pricingModel === "quote") return { cents: 0, needsQuote: true };

  const units = service.pricingModel === "flat" ? 0 : opts.units;
  assertNonNegativeInt(units, "units");

  const raw = service.baseCents + service.perUnitCents * units;
  return { cents: roundCents((raw * multiplierBps) / BPS_DENOMINATOR), needsQuote: false };
}

/* ─────────────────────────────── tax ────────────────────────────── */

/** Tax on a taxable subtotal at a ZIP rate (bps). */
export function taxFor(taxableSubtotalCents: number, rateBps: number): number {
  assertNonNegativeInt(taxableSubtotalCents, "taxableSubtotalCents");
  assertNonNegativeInt(rateBps, "rateBps");
  return roundCents((taxableSubtotalCents * rateBps) / BPS_DENOMINATOR);
}

/* ──────────────────────────── job quote ─────────────────────────── */

export interface QuoteLineInput {
  /** Catalog base price before markup. */
  platformListCents: number;
  /** Platform cost; the floor below which the customer price cannot fall. */
  wholesaleCents: number;
  /** Effective markup (already resolved via resolveMarkupBps). */
  markupBps: number;
  /** Units (or sqft for area jobs). */
  qty: number;
}

export interface ZoneInput {
  deliveryFeeCents: number;
  /** Applied to LABOR only. 10000 = 1.0x. */
  laborMultiplierBps: number;
  taxRateBps: number;
}

export interface JobQuoteInput {
  lines: QuoteLineInput[];
  /** The job's quantity driver: units (unit jobs) or sqft (area jobs). */
  quantity: number;
  delivery?: ServiceInput | null;
  labor?: ServiceInput | null;
  haulaway?: ServiceInput | null;
  zone: ZoneInput;
  /** Platform commission on the product subtotal (bps). */
  platformTakeRateBps: number;
}

export interface QuoteLineResult {
  unitPriceCents: number;
  qty: number;
  lineTotalCents: number;
}

export interface JobQuote {
  lineItems: QuoteLineResult[];
  subtotalCents: number;
  deliveryCents: number;
  laborCents: number;
  haulawayCents: number;
  taxableSubtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** True if any service requires a post-visit quote (e.g. kitchen island labor). */
  needsQuote: boolean;
  /** Platform's margin on this job (goods spread + take rate). */
  platformMarginCents: number;
}

/**
 * Compute a full bundle quote: parts + delivery + labor + haulaway + tax (B.4).
 *
 * Taxability choice for v1: tax applies to the full pre-tax total (goods + services).
 * Make this per-tenant configurable in a later milestone if needed.
 */
export function computeJobQuote(input: JobQuoteInput): JobQuote {
  const lineItems: QuoteLineResult[] = input.lines.map((line) => {
    assertNonNegativeInt(line.qty, "line.qty");
    const unitPriceCents = customerUnitPrice(
      line.platformListCents,
      line.wholesaleCents,
      line.markupBps,
    );
    return { unitPriceCents, qty: line.qty, lineTotalCents: unitPriceCents * line.qty };
  });

  const subtotalCents = lineItems.reduce((sum, l) => sum + l.lineTotalCents, 0);

  const delivery = servicePrice(input.delivery, { units: input.quantity });
  const labor = servicePrice(input.labor, {
    units: input.quantity,
    multiplierBps: input.zone.laborMultiplierBps,
  });
  const haulaway = servicePrice(input.haulaway, { units: input.quantity });

  // Zone delivery fee is added on top of any per-service delivery price.
  const deliveryCents = delivery.cents + input.zone.deliveryFeeCents;
  const laborCents = labor.cents;
  const haulawayCents = haulaway.cents;

  const taxableSubtotalCents = subtotalCents + deliveryCents + laborCents + haulawayCents;
  const taxCents = taxFor(taxableSubtotalCents, input.zone.taxRateBps);
  const totalCents = taxableSubtotalCents + taxCents;

  const goodsSpread = input.lines.reduce(
    (sum, line) => sum + (line.platformListCents - line.wholesaleCents) * line.qty,
    0,
  );
  const takeRate = roundCents((subtotalCents * input.platformTakeRateBps) / BPS_DENOMINATOR);
  const platformMarginCents = goodsSpread + takeRate;

  return {
    lineItems,
    subtotalCents,
    deliveryCents,
    laborCents,
    haulawayCents,
    taxableSubtotalCents,
    taxCents,
    totalCents,
    needsQuote: delivery.needsQuote || labor.needsQuote || haulaway.needsQuote,
    platformMarginCents,
  };
}

/**
 * Reseller payout = job total − platform margin − Stripe fee (B.4 / M4).
 * Stripe fee is computed in the payments layer; defaults to 0 here.
 */
export function resellerPayout(
  totalCents: number,
  platformMarginCents: number,
  stripeFeeCents = 0,
): number {
  return totalCents - platformMarginCents - stripeFeeCents;
}
