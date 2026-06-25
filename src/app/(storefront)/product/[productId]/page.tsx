import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Hammer, Package, Truck, Trash2 } from "lucide-react";
import { getCurrentTenant } from "@/server/tenant";
import { getStorefrontProduct } from "@/server/storefront";
import { Configurator } from "./configurator";

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const data = await getStorefrontProduct(tenant, productId);
  if (!data || data.variants.length === 0) notFound();
  const { product, vertical, variants } = data;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/shop/${vertical.slug}`} className="hover:text-slate-900">{vertical.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{product.name}</h1>
          {product.brand && <p className="mt-1 text-slate-500">{product.brand}</p>}
          {product.description && <p className="mt-5 text-slate-700">{product.description}</p>}
          {product.specSheetUrl && (
            <a
              href={product.specSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
            >
              <FileText className="h-4 w-4" /> View spec sheet
            </a>
          )}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="font-display text-base font-semibold">Every job includes</h2>
            <ul className="mt-4 grid grid-cols-2 gap-4 text-sm">
              {[
                { icon: Package, label: "Parts & materials" },
                { icon: Truck, label: "Delivery to your home" },
                { icon: Hammer, label: "Professional install" },
                { icon: Trash2, label: "Old-fixture haulaway" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-slate-700">
                  <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--brand-primary)" }} /> {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Configurator
            variants={variants}
            configuratorType={vertical.configuratorType}
            coverageZips={tenant.coverageZips}
          />
        </div>
      </div>
    </section>
  );
}
