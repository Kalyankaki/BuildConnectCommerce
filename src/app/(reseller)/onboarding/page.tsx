/**
 * Reseller onboarding ("/onboarding") — lives on the platform/apex host. Collects brand
 * (theme), the specific items to resell, markup, and coverage, then provisions a live tenant.
 */
import { redirect } from "next/navigation";
import { getSession, isAuthConfigured } from "@/server/auth";
import { ensureSampleCatalog } from "@/server/bootstrap";
import { getFullCatalog } from "@/server/storefront";
import { THEMES } from "@/lib/themes";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Create your storefront — RenovateConnect" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (isAuthConfigured() && !(await getSession())) redirect("/login?next=/onboarding");

  await ensureSampleCatalog(); // populate a sample catalog if the DB is empty
  const catalog = await getFullCatalog();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Create your storefront</h1>
      <p className="mt-2 text-slate-600">
        Pick a theme, choose the products you want to resell, set your markup, and go live.
      </p>
      <OnboardingForm catalog={catalog} themes={THEMES} rootDomain={rootDomain} />
    </section>
  );
}
