import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { getStorefrontVertical } from "@/server/storefront";
import { formatCents } from "@/lib/format";

export default async function VerticalPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical: slug } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const data = await getStorefrontVertical(tenant, slug);
  if (!data) notFound();

  const { vertical, products } = data;

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        / {vertical.name}
      </nav>

      <h1 className="mt-2 text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>
        {vertical.icon} {vertical.name}
      </h1>
      <p className="mt-2 text-slate-600">
        Fully installed: parts, delivery, {vertical.configuratorType === "area" ? "install" : "install"},
        and haulaway of the old fixture — one price.
      </p>

      {products.length === 0 ? (
        <p className="mt-8 text-slate-500">No products available yet.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {products.map((p) => {
            const from = Math.min(...p.variants.map((v) => v.unitPriceCents));
            const uom = p.variants[0]?.unitOfMeasure ?? "each";
            return (
              <li key={p.id}>
                <Link
                  href={`/product/${p.id}`}
                  className="flex h-full flex-col rounded-xl border p-5 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                  style={{ borderColor: "var(--brand-secondary)" }}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.brand && <span className="text-sm text-slate-500">{p.brand}</span>}
                  <span className="mt-3 text-lg font-semibold">
                    From {formatCents(from)}
                    <span className="text-sm font-normal text-slate-500">
                      {uom === "each" ? " / unit" : ` / ${uom}`}
                    </span>
                  </span>
                  <span className="mt-2 text-sm text-slate-500">Configure your job →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
