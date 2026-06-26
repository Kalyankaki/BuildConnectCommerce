/**
 * Reseller onboarding ("/onboarding") — lives on the platform/apex host. Collects brand,
 * verticals, markup, and coverage, then provisions a live tenant storefront (B.3).
 */
import { redirect } from "next/navigation";
import { adminDb } from "@/db";
import { verticals } from "@/db/schema";
import { getSession } from "@/server/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Create your storefront — RenovateConnect" };

// Reads the catalog from the DB at request time — don't prerender at build.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/onboarding");

  const available = await adminDb
    .select({ slug: verticals.slug, name: verticals.name, icon: verticals.icon })
    .from(verticals);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Create your storefront</h1>
      <p className="mt-2 text-slate-600">
        Spin up a self-branded site that sells full-service renovation bundles. Your
        subdomain goes live instantly.
      </p>
      <OnboardingForm verticals={available} rootDomain={rootDomain} />
    </section>
  );
}
