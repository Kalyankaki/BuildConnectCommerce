"use server";
/**
 * Checkout action. Resolves tenant + cart from request context, validates the customer, and
 * delegates to placeOrderForTenant. Redirects to the order confirmation on success.
 */
import { z } from "zod";
import { redirect } from "next/navigation";
import { placeOrderForTenant } from "@/server/order-core";
import { getCartToken } from "@/server/cart-cookie";
import { getCurrentTenant } from "@/server/tenant";

export type CheckoutState = { ok: boolean; error?: string };

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().optional(),
  line1: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().regex(/^\d{3,5}$/, "Valid ZIP required"),
});

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    line1: String(formData.get("line1") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    zip: String(formData.get("zip") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No storefront resolved for this host." };
  const token = await getCartToken();

  const res = await placeOrderForTenant(tenant, token, {
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    address: { line1: parsed.data.line1, city: parsed.data.city, state: parsed.data.state, zip: parsed.data.zip },
  });

  if (!res.ok) return { ok: false, error: res.error };
  redirect(`/orders/${res.orderId}`);
}
