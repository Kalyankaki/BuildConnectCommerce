import {
  adminContextOrRedirect,
  listMasterCatalog,
  listProductsAdmin,
  listVerticalsAdmin,
} from "@/server/admin-data";
import { createProduct, createVariant, createVertical } from "@/server/admin-actions";
import { formatCents } from "@/lib/format";
import { ImageUpload } from "@/components/image-upload";

export const metadata = { title: "Master catalog" };
const input = "w-full rounded-lg border px-3 py-2 text-sm";

export default async function AdminCatalog() {
  await adminContextOrRedirect();
  const [rows, verticalList, productList] = await Promise.all([
    listMasterCatalog(),
    listVerticalsAdmin(),
    listProductsAdmin(),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Master catalog</h1>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-slate-500">
            <tr>
              <th className="p-3">Vertical</th>
              <th className="p-3">Product</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Wholesale</th>
              <th className="p-3">List</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.variant?.id ?? r.product?.id ?? r.vertical.id}-${i}`} className="border-b last:border-0">
                <td className="p-3">{r.vertical.icon} {r.vertical.name}</td>
                <td className="p-3">{r.product?.name ?? "—"}</td>
                <td className="p-3">{r.variant?.sku ?? "—"}</td>
                <td className="p-3">{r.variant ? formatCents(r.variant.wholesaleCents) : "—"}</td>
                <td className="p-3">{r.variant ? formatCents(r.variant.platformListCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form action={createVertical} className="space-y-2 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Add vertical</h2>
          <input name="slug" placeholder="slug (e.g. sinks)" className={input} />
          <input name="name" placeholder="Name" className={input} />
          <select name="configuratorType" className={input}>
            <option value="unit">unit</option>
            <option value="area">area</option>
            <option value="linear">linear</option>
            <option value="custom">custom</option>
          </select>
          <input name="icon" placeholder="icon (emoji, optional)" className={input} />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create</button>
        </form>

        <form action={createProduct} className="space-y-2 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Add product</h2>
          <select name="verticalId" className={input} required>
            <option value="">Select vertical…</option>
            {verticalList.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <input name="name" placeholder="Product name" className={input} />
          <input name="brand" placeholder="Brand (optional)" className={input} />
          <input name="description" placeholder="Description (optional)" className={input} />
          <ImageUpload name="defaultImageUrl" bucket="uploads" label="Product image" />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create</button>
        </form>

        <form action={createVariant} className="space-y-2 rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Add variant</h2>
          <select name="productId" className={input} required>
            <option value="">Select product…</option>
            {productList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input name="sku" placeholder="SKU" className={input} />
          <input name="unitOfMeasure" placeholder="unit of measure (each/sqft)" defaultValue="each" className={input} />
          <input name="wholesaleCents" type="number" placeholder="wholesale (cents)" className={input} />
          <input name="platformListCents" type="number" placeholder="list (cents)" className={input} />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create</button>
        </form>
      </div>
    </div>
  );
}
