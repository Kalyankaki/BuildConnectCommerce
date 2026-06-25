import "server-only";
/**
 * Cart core (server-only, no request context). Loads a cart by session token and RE-PRICES
 * every line server-side (B.7), flagging drift vs. the snapshot taken when it was added.
 * Actions in cart.ts wrap these with cookies()/host.
 */
import { and, eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { cartItems, carts, productVariants, products } from "@/db/schema";
import type { JobQuote } from "@/lib/pricing";
import { computeQuoteForTenant } from "@/server/quote-core";
import type { Tenant } from "@/server/tenant";

export const CART_COOKIE = "rc_cart";

export interface CartLine {
  itemId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  qty: number;
  zip: string;
  unitOfMeasure: string;
  snapshotTotalCents: number;
  current: JobQuote | null; // null = no longer available / not serviceable
  available: boolean;
  driftDeltaCents: number; // current.total - snapshot.total (0 if unavailable)
}

export interface CartTotals {
  subtotalCents: number;
  deliveryCents: number;
  laborCents: number;
  haulawayCents: number;
  taxCents: number;
  totalCents: number;
  platformMarginCents: number;
  needsQuote: boolean;
}

export interface LoadedCart {
  cartId: string;
  lines: CartLine[];
  totals: CartTotals;
  hasDrift: boolean;
  hasUnavailable: boolean;
}

function variantLabelFrom(attributes: Record<string, string>, sku: string): string {
  const a = Object.values(attributes ?? {}).join(" · ");
  return a ? `${a} (${sku})` : sku;
}

export async function loadCartForToken(tenant: Tenant, token: string | null): Promise<LoadedCart | null> {
  if (!token) return null;

  const rows = await withTenant(tenant.id, async (tx) => {
    const [cart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.sessionToken, token), eq(carts.status, "active")))
      .limit(1);
    if (!cart) return null;

    const items = await tx
      .select({ item: cartItems, variant: productVariants, product: products })
      .from(cartItems)
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(cartItems.cartId, cart.id));

    return { cart, items };
  });

  if (!rows) return null;

  const lines: CartLine[] = [];
  for (const { item, variant, product } of rows.items) {
    const snapshot = item.quoteSnapshot as unknown as JobQuote;
    const result = await computeQuoteForTenant(tenant, {
      variantId: item.variantId,
      zip: item.zip,
      quantity: item.qty,
    });
    const current = result.ok ? result.quote : null;
    lines.push({
      itemId: item.id,
      variantId: item.variantId,
      productName: product.name,
      variantLabel: variantLabelFrom(variant.attributes, variant.sku),
      qty: item.qty,
      zip: item.zip,
      unitOfMeasure: variant.unitOfMeasure,
      snapshotTotalCents: snapshot.totalCents,
      current,
      available: result.ok,
      driftDeltaCents: current ? current.totalCents - snapshot.totalCents : 0,
    });
  }

  const totals = lines.reduce<CartTotals>(
    (acc, l) => {
      if (!l.current) return acc;
      acc.subtotalCents += l.current.subtotalCents;
      acc.deliveryCents += l.current.deliveryCents;
      acc.laborCents += l.current.laborCents;
      acc.haulawayCents += l.current.haulawayCents;
      acc.taxCents += l.current.taxCents;
      acc.totalCents += l.current.totalCents;
      acc.platformMarginCents += l.current.platformMarginCents;
      acc.needsQuote = acc.needsQuote || l.current.needsQuote;
      return acc;
    },
    {
      subtotalCents: 0,
      deliveryCents: 0,
      laborCents: 0,
      haulawayCents: 0,
      taxCents: 0,
      totalCents: 0,
      platformMarginCents: 0,
      needsQuote: false,
    },
  );

  return {
    cartId: rows.cart.id,
    lines,
    totals,
    hasDrift: lines.some((l) => l.available && l.driftDeltaCents !== 0),
    hasUnavailable: lines.some((l) => !l.available),
  };
}
