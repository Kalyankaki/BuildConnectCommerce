import {
  resellerContextOrRedirect,
  getCatalogForReseller,
  getMarkupPolicy,
} from "@/server/reseller-data";
import { setPolicyDefaultMarkup, setVariantMarkup, toggleCatalogItem } from "@/server/reseller-actions";
import { formatCents } from "@/lib/format";

export const metadata = { title: "Catalog & pricing" };

export default async function CatalogPage() {
  const { tenant } = await resellerContextOrRedirect();
  const [groups, policy] = await Promise.all([getCatalogForReseller(tenant), getMarkupPolicy(tenant)]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Catalog &amp; pricing</h1>
      <p className="mt-1 text-slate-500">
        Toggle products on/off and set your markup. Markup precedence: per-product → default policy.
      </p>

      <form action={setPolicyDefaultMarkup} className="mt-4 flex items-end gap-3 rounded-xl border bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Default markup (%)</span>
          <input
            type="number"
            name="defaultPercent"
            step={0.5}
            min={0}
            defaultValue={(policy?.defaultMarkupBps ?? 0) / 100}
            className="w-32 rounded-lg border px-3 py-2"
          />
        </label>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Save default</button>
      </form>

      {groups.map((g) => (
        <section key={g.verticalId} className="mt-8">
          <h2 className="font-semibold">{g.verticalName}</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-slate-500">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Enabled</th>
                  <th className="p-3">Markup override (%)</th>
                  <th className="p-3">Effective</th>
                  <th className="p-3">Customer price</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.variantId} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{r.productName}</div>
                      <div className="text-xs text-slate-500">{r.sku}</div>
                    </td>
                    <td className="p-3">
                      <form action={toggleCatalogItem}>
                        <input type="hidden" name="variantId" value={r.variantId} />
                        <input type="hidden" name="enabled" value={(!r.enabled).toString()} />
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            r.enabled ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {r.enabled ? "Enabled" : "Disabled"}
                        </button>
                      </form>
                    </td>
                    <td className="p-3">
                      <form action={setVariantMarkup} className="flex items-center gap-2">
                        <input type="hidden" name="variantId" value={r.variantId} />
                        <input
                          type="number"
                          name="markupPercent"
                          step={0.5}
                          min={0}
                          defaultValue={r.overrideBps != null ? r.overrideBps / 100 : ""}
                          placeholder="—"
                          className="w-20 rounded-lg border px-2 py-1"
                        />
                        <button className="text-xs underline">Set</button>
                      </form>
                    </td>
                    <td className="p-3 text-slate-600">{(r.effectiveMarkupBps / 100).toFixed(1)}%</td>
                    <td className="p-3 font-medium">
                      {formatCents(r.unitPriceCents)}
                      <span className="text-xs font-normal text-slate-500">
                        {r.unitOfMeasure === "each" ? "" : ` / ${r.unitOfMeasure}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
