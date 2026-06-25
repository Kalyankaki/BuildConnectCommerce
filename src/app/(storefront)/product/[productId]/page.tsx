import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { getStorefrontProduct } from "@/server/storefront";
import { Configurator } from "./configurator";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const data = await getStorefrontProduct(tenant, productId);
  if (!data || data.variants.length === 0) notFound();

  const { product, vertical, variants } = data;

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        /{" "}
        <Link href={`/shop/${vertical.slug}`} className="hover:underline">
          {vertical.name}
        </Link>{" "}
        / {product.name}
      </nav>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.brand && <p className="mt-1 text-slate-500">{product.brand}</p>}
          {product.description && <p className="mt-4 text-slate-700">{product.description}</p>}
          {product.specSheetUrl && (
            <a
              href={product.specSheetUrl}
              className="mt-4 inline-block text-sm underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View spec sheet →
            </a>
          )}
          <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Every job includes <strong>parts + delivery + professional install + haulaway</strong>{" "}
            of your old fixture — quoted as one transparent price.
          </p>
        </div>

        <Configurator
          variants={variants}
          configuratorType={vertical.configuratorType}
          coverageZips={tenant.coverageZips}
        />
      </div>
    </section>
  );
}
