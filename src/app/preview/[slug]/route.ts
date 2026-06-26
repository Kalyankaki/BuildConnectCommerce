/**
 * Single-domain storefront preview. GET /preview/<slug> sets the preview cookie and redirects
 * home, so the whole site renders as that tenant on one domain (useful where wildcard
 * subdomains aren't available, e.g. *.vercel.app). GET /preview/exit clears it.
 */
import { NextResponse } from "next/server";
import { PREVIEW_COOKIE } from "@/server/tenant";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = NextResponse.redirect(new URL("/", request.url));
  if (slug === "exit") {
    res.cookies.delete(PREVIEW_COOKIE);
  } else {
    res.cookies.set(PREVIEW_COOKIE, slug, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  }
  return res;
}
