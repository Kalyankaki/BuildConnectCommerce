import "server-only";
/**
 * Cart session cookie helpers (kept out of cart-core so cart-core stays testable in Node).
 * Reading is safe in any server context; writing only works in actions / route handlers.
 */
import { cookies } from "next/headers";
import { CART_COOKIE } from "@/server/cart-core";

export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function setCartToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
