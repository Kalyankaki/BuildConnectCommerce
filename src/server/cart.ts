"use server";
/**
 * Cart actions. Add re-prices server-side before storing the snapshot; the client never
 * sets price (B.7). Cart is keyed by an httpOnly session cookie so guests can shop.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withTenant } from "@/db";
import { cartItems, carts } from "@/db/schema";
import { computeQuoteForTenant } from "@/server/quote-core";
import { getCartToken, setCartToken } from "@/server/cart-cookie";
import { getCurrentTenant } from "@/server/tenant";

const addSchema = z.object({
  variantId: z.string().uuid(),
  zip: z.string().regex(/^\d{3,5}$/),
  quantity: z.number().int().positive(),
});

export async function addToCart(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No storefront resolved for this host." };

  // Re-price before adding — store the authoritative server snapshot.
  const result = await computeQuoteForTenant(tenant, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  let token = await getCartToken();
  if (!token) {
    token = randomUUID();
    await setCartToken(token);
  }

  await withTenant(tenant.id, async (tx) => {
    let [cart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.sessionToken, token!), eq(carts.status, "active")))
      .limit(1);
    if (!cart) {
      [cart] = await tx
        .insert(carts)
        .values({ tenantId: tenant.id, sessionToken: token! })
        .returning();
    }
    await tx.insert(cartItems).values({
      tenantId: tenant.id,
      cartId: cart.id,
      variantId: parsed.data.variantId,
      qty: parsed.data.quantity,
      zip: parsed.data.zip,
      configuratorInputs: parsed.data,
      quoteSnapshot: result.quote as unknown as Record<string, unknown>,
    });
  });

  revalidatePath("/cart");
  return { ok: true };
}

export async function removeCartItem(formData: FormData): Promise<void> {
  const itemId = z.string().uuid().safeParse(String(formData.get("itemId") ?? ""));
  if (!itemId.success) return;
  const tenant = await getCurrentTenant();
  if (!tenant) return;

  await withTenant(tenant.id, async (tx) => {
    await tx.delete(cartItems).where(eq(cartItems.id, itemId.data));
  });
  revalidatePath("/cart");
}
