import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { getCurrentTenant, getStoreBase } from "@/server/tenant";
import { getStorefrontVertical } from "@/server/storefront";
import { formatCents } from "@/lib/format";
import { ProductImage } from "@/components/product-image";

export default async function VerticalPage({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical: slug } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const base = await getStoreBase();
  const data = await getStorefrontVertical(tenant, slug);
  if (!data) notFound();
  const { vertical, products } = data;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500">
        <Link href={`${base}/`} className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900">{vertical.name}</span>
      </nav>

      <div className="mt-4 flex items-start gap-4">
        <span className="text-4xl" aria-hidden>{vertical.icon ?? "🔧"}</span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{vertical.name}</h1>
          <p className="mt-1 text-slate-600">
            Fully installed — parts, delivery, professional install, and haulaway of the old fixture.
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-slate-500">No products available yet.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const from = Math.min(...p.variants.map((v) => v.unitPriceCents));
            const uom = p.variants[0]?.unitOfMeasure ?? "each";
            return (
              <li key={p.id}>
                <Link
                  href={`${base}/product/${p.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <ProductImage src={p.defaultImageUrl} alt={p.name} icon={vertical.icon} className="h-44 w-full" />
                  <div className="flex flex-1 flex-col p-6">
                    <span className="font-display text-lg font-semibold">{p.name}</span>
                    {p.brand && <span className="text-sm text-slate-500">{p.brand}</span>}
                    <span className="mt-4 text-2xl font-bold">
                      {formatCents(from)}
                      <span className="text-sm font-normal text-slate-500">
                        {uom === "each" ? " / unit" : ` / ${uom}`}
                      </span>
                    </span>
                    <span className="mt-1 text-xs uppercase tracking-wide text-slate-400">starting price · before install</span>
                    <span
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      Configure your job <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
