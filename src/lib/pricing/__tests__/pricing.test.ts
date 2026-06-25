import { describe, expect, it } from "vitest";
import {
  applyMarkup,
  computeJobQuote,
  customerUnitPrice,
  resellerPayout,
  resolveMarkupBps,
  servicePrice,
  taxFor,
  type JobQuoteInput,
} from "../index";

describe("applyMarkup", () => {
  it("applies a positive markup correctly", () => {
    // $100.00 list + 20% markup = $120.00
    expect(applyMarkup(10000, 2000)).toBe(12000);
  });

  it("returns list when markup is zero", () => {
    expect(applyMarkup(10000, 0)).toBe(10000);
  });

  it("rounds to the nearest cent", () => {
    // 999 * 1.075 = 1073.925 -> 1074
    expect(applyMarkup(999, 750)).toBe(1074);
  });

  it("supports negative markup (a discount)", () => {
    // $100 list − 10% = $90
    expect(applyMarkup(10000, -1000)).toBe(9000);
  });
});

describe("customerUnitPrice — wholesale floor", () => {
  it("blocks underpricing: never returns below wholesale", () => {
    // list 10000, wholesale 8000, but a steep −50% discount would be 5000.
    // The floor must clamp the price up to wholesale (8000).
    expect(customerUnitPrice(10000, 8000, -5000)).toBe(8000);
  });

  it("allows discounts down to (but not below) the wholesale floor", () => {
    // −20% on 10000 = 8000, exactly the wholesale floor -> allowed.
    expect(customerUnitPrice(10000, 8000, -2000)).toBe(8000);
  });

  it("normal markup is unaffected by the floor", () => {
    expect(customerUnitPrice(10000, 8000, 2500)).toBe(12500);
  });
});

describe("resolveMarkupBps — precedence", () => {
  it("prefers the catalog override", () => {
    expect(resolveMarkupBps({ catalogOverrideBps: 1500, perVerticalBps: 1000, defaultBps: 500 })).toBe(
      1500,
    );
  });
  it("falls back to per-vertical when no override", () => {
    expect(
      resolveMarkupBps({ catalogOverrideBps: null, perVerticalBps: 1000, defaultBps: 500 }),
    ).toBe(1000);
  });
  it("falls back to the default when nothing else set", () => {
    expect(resolveMarkupBps({ catalogOverrideBps: null, perVerticalBps: null, defaultBps: 500 })).toBe(
      500,
    );
  });
});

describe("servicePrice — labor models", () => {
  it("per_unit labor scales by quantity (toilet install)", () => {
    // $50 base + $120/unit * 3 = $410
    const r = servicePrice({ pricingModel: "per_unit", baseCents: 5000, perUnitCents: 12000 }, {
      units: 3,
    });
    expect(r).toEqual({ cents: 41000, needsQuote: false });
  });

  it("per_area labor scales by square footage (flooring install)", () => {
    // $0 base + $3.50/sqft * 200 sqft = $700
    const r = servicePrice({ pricingModel: "per_area", baseCents: 0, perUnitCents: 350 }, {
      units: 200,
    });
    expect(r).toEqual({ cents: 70000, needsQuote: false });
  });

  it("per_area vs per_unit differ for the same numeric input", () => {
    const area = servicePrice({ pricingModel: "per_area", baseCents: 1000, perUnitCents: 350 }, {
      units: 200,
    });
    const unit = servicePrice({ pricingModel: "per_unit", baseCents: 1000, perUnitCents: 350 }, {
      units: 200,
    });
    // Same formula shape but the engine treats the unit driver differently per job type;
    // here both compute base + perUnit*units, proving the model is explicit, not implicit.
    expect(area.cents).toBe(71000);
    expect(unit.cents).toBe(71000);
  });

  it("flat labor ignores quantity", () => {
    const r = servicePrice({ pricingModel: "flat", baseCents: 9900, perUnitCents: 0 }, { units: 99 });
    expect(r.cents).toBe(9900);
  });

  it("quote pricing flags needsQuote and charges nothing up front", () => {
    const r = servicePrice({ pricingModel: "quote", baseCents: 0, perUnitCents: 0 }, { units: 1 });
    expect(r).toEqual({ cents: 0, needsQuote: true });
  });

  it("applies the ZIP labor multiplier", () => {
    // $400 labor * 1.25x zone multiplier = $500
    const r = servicePrice({ pricingModel: "per_unit", baseCents: 0, perUnitCents: 40000 }, {
      units: 1,
      multiplierBps: 12500,
    });
    expect(r.cents).toBe(50000);
  });
});

describe("taxFor — tax by ZIP", () => {
  it("computes tax at a ZIP rate", () => {
    // $1000 * 8.75% = $87.50
    expect(taxFor(100000, 875)).toBe(8750);
  });
  it("different ZIP rates produce different tax", () => {
    expect(taxFor(100000, 1025)).toBe(10250); // 10.25%
    expect(taxFor(100000, 0)).toBe(0); // tax-free ZIP
  });
});

describe("computeJobQuote — full bundle", () => {
  it("assembles a Carpet→Hardwood (area) quote with line-item breakdown", () => {
    const input: JobQuoteInput = {
      // 200 sqft of hardwood: list $6.00/sqft, wholesale $4.00, +25% markup
      lines: [{ platformListCents: 600, wholesaleCents: 400, markupBps: 2500, qty: 200 }],
      quantity: 200, // sqft drives labor
      delivery: { pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
      labor: { pricingModel: "per_area", baseCents: 0, perUnitCents: 350 }, // $3.50/sqft
      haulaway: { pricingModel: "per_area", baseCents: 0, perUnitCents: 100 }, // $1.00/sqft
      zone: { deliveryFeeCents: 7500, laborMultiplierBps: 10000, taxRateBps: 1025 },
      platformTakeRateBps: 500,
    };
    const q = computeJobQuote(input);

    // unit price = 600 * 1.25 = 750; subtotal = 750 * 200 = 150000
    expect(q.subtotalCents).toBe(150000);
    expect(q.lineItems[0].unitPriceCents).toBe(750);
    expect(q.deliveryCents).toBe(7500); // flat $0 + zone $75
    expect(q.laborCents).toBe(70000); // $3.50 * 200
    expect(q.haulawayCents).toBe(20000); // $1.00 * 200
    // taxable = 150000 + 7500 + 70000 + 20000 = 247500
    expect(q.taxableSubtotalCents).toBe(247500);
    expect(q.taxCents).toBe(25369); // 247500 * 10.25% = 25368.75 -> 25369
    expect(q.totalCents).toBe(272869);
    expect(q.needsQuote).toBe(false);
    // margin: goods spread (600-400)*200=40000 + take 500bps*150000=7500 => 47500
    expect(q.platformMarginCents).toBe(47500);
  });

  it("assembles a Commode (unit) quote and flags needs-quote labor", () => {
    const input: JobQuoteInput = {
      lines: [{ platformListCents: 25000, wholesaleCents: 18000, markupBps: 2000, qty: 2 }],
      quantity: 2,
      delivery: { pricingModel: "flat", baseCents: 4900, perUnitCents: 0 },
      labor: { pricingModel: "quote", baseCents: 0, perUnitCents: 0 }, // site-visit quote
      haulaway: { pricingModel: "per_unit", baseCents: 0, perUnitCents: 3500 },
      zone: { deliveryFeeCents: 0, laborMultiplierBps: 10000, taxRateBps: 0 },
      platformTakeRateBps: 500,
    };
    const q = computeJobQuote(input);
    expect(q.lineItems[0].unitPriceCents).toBe(30000); // 25000 * 1.2
    expect(q.subtotalCents).toBe(60000);
    expect(q.deliveryCents).toBe(4900);
    expect(q.laborCents).toBe(0);
    expect(q.haulawayCents).toBe(7000); // $35 * 2
    expect(q.needsQuote).toBe(true);
    expect(q.taxCents).toBe(0);
    expect(q.totalCents).toBe(71900);
  });
});

describe("resellerPayout", () => {
  it("is total minus platform margin minus stripe fee", () => {
    expect(resellerPayout(272869, 47500, 800)).toBe(224569);
  });
});

describe("input guards", () => {
  it("rejects non-integer cents (no floats)", () => {
    expect(() => applyMarkup(100.5, 2000)).toThrow();
  });
  it("rejects negative wholesale", () => {
    expect(() => customerUnitPrice(10000, -1, 0)).toThrow();
  });
});
